import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { jsPDF } from 'jspdf';
import { generateStyledQrSvg } from '@/lib/styled-qr';
import { getReceipt } from '@/lib/receipt-store';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function numberToWords(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertChunk(n % 100) : '');
  }

  const intPart = Math.floor(num);
  if (intPart === 0) return 'Zero';

  const thousands = ['', 'Thousand', 'Million', 'Billion'];
  let chunkIdx = 0;
  let temp = intPart;
  const parts: string[] = [];

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk !== 0) {
      const chunkStr = convertChunk(chunk);
      const label = thousands[chunkIdx];
      parts.unshift(label ? `${chunkStr} ${label}` : chunkStr);
    }
    temp = Math.floor(temp / 1000);
    chunkIdx++;
  }

  return parts.join(' ');
}

function amountToWords(num: number): string {
  const intPart = Math.floor(num);
  const centsPart = Math.round((num - intPart) * 100);
  const intWords = numberToWords(intPart);
  const centsWords = centsPart > 0 ? numberToWords(centsPart) : 'Zero';
  return `${intWords} ETB and ${centsWords} Cents .`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const ref = searchParams.get('TID') || searchParams.get('ref') || '9V8GPL5D';
    const stored = getReceipt(ref);

    const rawAmt = searchParams.get('amt') || (stored && stored.amt) || '740.00';
    const date = searchParams.get('date') || (stored && stored.date) || '27-10-2026 11:56:20';
    const rec = searchParams.get('rec') || searchParams.get('receiverAccount') || (stored && stored.rec) || '1000760389289';
    const recName = searchParams.get('name') || searchParams.get('receiverName') || (stored && stored.name) || 'Miss Simera Gofer Abdisa';
    const user = searchParams.get('user') || searchParams.get('fullName') || (stored && stored.user) || 'JUREY ABDUL HUSSEN';
    let rawAcc = searchParams.get('PH') || searchParams.get('acc') || searchParams.get('userAcc') || (stored && stored.acc) || '1000760389289';
    if (rawAcc.startsWith('251')) {
      rawAcc = rawAcc.slice(3);
    }
    const userAcc = rawAcc;
    const bank = searchParams.get('bank') || (stored && stored.bank) || '';
    const reason = searchParams.get('reason') || (stored && stored.reason) || 'Wallet Transfer';
    const format = searchParams.get('format') || 'pdf';
    const inline = searchParams.get('inline') === '1' || searchParams.get('inline') === 'true';

    const numericAmt = parseFloat(rawAmt) || 740.0;
    const formattedAmt = numericAmt.toFixed(2);
    const feeParam = searchParams.get('fee') || searchParams.get('serviceCharge') || (stored && stored.serviceCharge);
    const vatParam = searchParams.get('vat') || (stored && stored.vat);
    const totalPaidParam = searchParams.get('totalPaid') || (stored && stored.totalPaidAmount);

    const isBankOrWallet = Boolean(bank) || Boolean(feeParam) || (reason && (reason.toLowerCase().includes('bank') || reason.toLowerCase().includes('wallet')));
    let serviceCharge = '0.00';
    let vatAmount = '0.00';
    let totalPaid = formattedAmt;
    let amountInWordsString = amountToWords(numericAmt);

    if (isBankOrWallet) {
      if (feeParam && !isNaN(parseFloat(feeParam)) && parseFloat(feeParam) > 0) {
        const sc = parseFloat(feeParam);
        const v = vatParam && !isNaN(parseFloat(vatParam)) ? parseFloat(vatParam) : +(sc * 0.15).toFixed(5);
        const td = totalPaidParam && !isNaN(parseFloat(totalPaidParam)) ? parseFloat(totalPaidParam) : +(numericAmt + sc + v).toFixed(2);
        serviceCharge = sc.toString();
        vatAmount = v.toString();
        totalPaid = td.toFixed(2);
        amountInWordsString = amountToWords(td);
      } else {
        const sc = Math.max(0.005, +(numericAmt * 0.005).toFixed(5));
        const v = +(sc * 0.15).toFixed(5);
        const td = +(numericAmt + sc + v).toFixed(2);
        serviceCharge = sc.toString();
        vatAmount = v.toString();
        totalPaid = td.toFixed(2);
        amountInWordsString = amountToWords(td);
      }
    }

    // Build the dynamic receipt URL that will be encoded inside the QR code
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const origin = `${proto}://${host}`;
    const qrTargetUrl = `${origin}/official-receipt?TID=${encodeURIComponent(ref)}&PH=${encodeURIComponent(userAcc)}${bank ? `&bank=${encodeURIComponent(bank)}` : ''}${serviceCharge !== '0.00' ? `&fee=${encodeURIComponent(serviceCharge)}&vat=${encodeURIComponent(vatAmount)}&totalPaid=${encodeURIComponent(totalPaid)}` : ''}`;

    // Official VAT receipt QR code has NO center logo, matching authentic CBE invoice design
    const styledQrSvg = generateStyledQrSvg(qrTargetUrl, {
      size: 215,
      margin: 1,
      withCenterLogo: false,
      bgColor: '#ffffff',
    });

    const qrBuffer = await sharp(Buffer.from(styledQrSvg)).png().toBuffer();

    // High-resolution SVG text overlay mapped onto 1330 x 1824 coordinates
    // Fonts: Liberation Sans, DejaVu Sans, Noto Sans Ethiopic with XML escaping
    const svgOverlay = Buffer.from(`
      <svg width="1330" height="1824" xmlns="http://www.w3.org/2000/svg">
        <style>
          .val { font-family: 'Liberation Sans', 'DejaVu Sans', 'Noto Sans Ethiopic', 'Noto Sans', Arial, sans-serif; font-size: 22px; fill: #141414; }
          .boldVal { font-family: 'Liberation Sans', 'DejaVu Sans', 'Noto Sans Ethiopic', 'Noto Sans', Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #141414; }
          .smVal { font-family: 'Liberation Sans', 'DejaVu Sans', 'Noto Sans Ethiopic', 'Noto Sans', Arial, sans-serif; font-size: 21px; fill: #141414; }
        </style>

        <!-- Customer Name Overlay (top right) -->
        <rect x="880" y="215" width="400" height="34" fill="white" />
        <text x="884" y="238" class="val">${escapeXml(user.toUpperCase())}</text>

        <!-- 1. Debit Account Value -->
        <text x="884" y="736" class="val">${escapeXml(userAcc)} - ${escapeXml(user.toUpperCase())}</text>

        <!-- 2. Credit Account Value -->
        <text x="884" y="768" class="val">${escapeXml(rec)} - ${bank ? escapeXml(bank) + ' Account' : (rec.startsWith('0') ? 'MPESA' : 'CBE Account')}</text>

        <!-- 3. Receiver Name Value -->
        <text x="884" y="802" class="val">${escapeXml(recName)}</text>

        <!-- 4. Order ID Value -->
        <text x="884" y="852" class="val">${escapeXml(ref)}</text>

        <!-- 5. Receipt Number in Table -->
        <text x="32" y="1154" class="val">${escapeXml(ref)}</text>

        <!-- 6. Transaction Date in Table -->
        <text x="570" y="1154" class="val">${escapeXml(date)}</text>

        <!-- 7. Amount in Table (Clean Mask & Value) -->
        <rect x="1040" y="1126" width="140" height="38" fill="white" />
        <text x="1160" y="1154" class="val" text-anchor="end">${escapeXml(formattedAmt)}</text>

        <!-- Solid white mask covering all rows without touching left labels (labels end at x=1072) -->
        <rect x="1080" y="1172" width="100" height="252" fill="white" />

        <!-- 8. Paid amount -->
        <text x="1144" y="1204" class="val" text-anchor="end">${escapeXml(formattedAmt)}</text>

        <!-- 9. Service Charge -->
        <text x="1144" y="1236" class="val" text-anchor="end">${escapeXml(serviceCharge)}</text>

        <!-- Disaster Response Fee (First line has 0.00, second line 'Fee' has NO number) -->
        <text x="1144" y="1270" class="val" text-anchor="end">0.00</text>

        <!-- VAT -->
        <text x="1144" y="1336" class="val" text-anchor="end">${escapeXml(vatAmount)}</text>

        <!-- Tip -->
        <text x="1144" y="1368" class="val" text-anchor="end">0.00</text>

        <!-- 10. Total Paid Amount (Bold) -->
        <text x="1144" y="1404" class="boldVal" text-anchor="end">${escapeXml(totalPaid)}</text>

        <!-- 11. Total Amount in word (cleans existing text if any) -->
        <rect x="360" y="1415" width="500" height="30" fill="white" />
        <text x="364" y="1438" class="smVal">${escapeXml(amountInWordsString)}</text>

        <!-- 12. Payment Reason (cleans existing text if any) -->
        <rect x="360" y="1450" width="500" height="30" fill="white" />
        <text x="364" y="1472" class="smVal">${escapeXml(reason)}</text>

        <!-- 13. Clean white backing for QR code to cover old real transaction QR -->
        <rect x="1035" y="1535" width="215" height="215" fill="white" />
      </svg>
    `);

    // Path to the high-resolution clean official receipt template
    const templatePath = path.join(process.cwd(), 'public', 'screens', 'official_receipt_hq.png');
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Official receipt template not found' }, { status: 404 });
    }

    // Composite template with SVG text overlay and dynamic QR code (replaces old real transaction QR)
    const compositedPngBuffer = await sharp(templatePath)
      .composite([
        { input: svgOverlay, top: 0, left: 0 },
        { input: qrBuffer, top: 1540, left: 1040 },
      ])
      .png({ quality: 95 })
      .toBuffer();

    if (format === 'png') {
      const uint8 = new Uint8Array(compositedPngBuffer);
      return new NextResponse(uint8, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="CBEBirr_Receipt_${ref}.png"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Default format: PDF matching A4 standard
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const base64Data = compositedPngBuffer.toString('base64');
    doc.addImage(`data:image/png;base64,${base64Data}`, 'PNG', 0, 0, 210, 288, undefined, 'FAST');

    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);

    const dispositionType = inline ? 'inline' : 'attachment';
    return new NextResponse(pdfUint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="CBEBirr_Receipt_${ref}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating official receipt file:', error);
    return NextResponse.json({ error: 'Failed to generate official receipt' }, { status: 500 });
  }
}
