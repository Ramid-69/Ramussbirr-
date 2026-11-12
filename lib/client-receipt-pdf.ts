import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface ReceiptData {
  ref: string;
  amt: string;
  date: string;
  rec: string;
  name?: string;
  user?: string;
  acc?: string;
  reason?: string;
  bank?: string;
  serviceCharge?: string;
  vat?: string;
  totalPaid?: string;
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

/**
 * Generates an authentic CBEBirr Official VAT Receipt PDF using the exact authentic template image.
 * 100% identical to the in-app Official Receipt view.
 */
export async function generateClientReceiptPdf(data: ReceiptData): Promise<{ blob: Blob; base64: string }> {
  const ref = data.ref || 'FT262413JRB4';
  const amtNum = parseFloat(data.amt) || 10.0;
  const formattedAmt = amtNum.toFixed(2);
  const user = (data.user || 'AYMEN NIGATU YIMAM').toUpperCase();
  const acc = data.acc || '0959754788';
  const rec = data.rec || '1000760389289';
  const recName = data.name || '';
  const date = data.date || '2026-10-27 11:56:20';
  const reason = data.reason || 'Customer transfer to CBE account';
  const bank = data.bank || '';
  const sc = data.serviceCharge && parseFloat(data.serviceCharge) > 0 ? parseFloat(data.serviceCharge).toFixed(2) : '0.00';
  const vat = data.vat && parseFloat(data.vat) > 0 ? parseFloat(data.vat).toFixed(2) : '0.00';
  const total = data.totalPaid && parseFloat(data.totalPaid) > 0 ? parseFloat(data.totalPaid).toFixed(2) : formattedAmt;
  const words = amountToWords(parseFloat(total) || amtNum);

  // 1. If DOM already has #official-vat-receipt-svg, rasterize it directly
  const svgEl = typeof document !== 'undefined' ? (document.getElementById('official-vat-receipt-svg') as SVGSVGElement | null) : null;
  if (svgEl) {
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const image64 = `data:image/svg+xml;base64,${svg64}`;

      const img = new Image();
      const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = image64;
      });

      const loadedImg = await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = 1330;
      canvas.height = 1824;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);
        const pngDataUrl = canvas.toDataURL('image/png', 0.95);

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.addImage(pngDataUrl, 'PNG', 0, 0, 210, 288, undefined, 'FAST');

        const arrayBuffer = doc.output('arraybuffer');
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const base64 = doc.output('datauristring').split(',')[1] || '';
        return { blob, base64 };
      }
    } catch (e) {
      console.warn('DOM SVG rasterization fallback:', e);
    }
  }

  // 2. Offscreen Canvas composite using /screens/official_receipt_hq.png
  return new Promise<{ blob: Blob; base64: string }>((resolve, reject) => {
    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1330;
        canvas.height = 1824;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Draw base authentic template
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        // Styling
        ctx.fillStyle = '#141414';
        ctx.font = '22px Arial, sans-serif';

        // Customer Name (top right)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(880, 215, 400, 34);
        ctx.fillStyle = '#141414';
        ctx.fillText(user, 884, 238);

        // 1. Debit Account
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(870, 715, 450, 30);
        ctx.fillStyle = '#141414';
        ctx.fillText(`${acc} - ${user}`, 884, 736);

        // 2. Credit Account
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(870, 748, 450, 28);
        ctx.fillStyle = '#141414';
        const creditLabel = bank ? `${bank} Account` : (rec.length === 10 ? 'Customer E-money Account' : 'CBE Account');
        ctx.fillText(`${rec} - ${creditLabel}`, 884, 768);

        // 3. Receiver Name
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(880, 780, 400, 30);
        if (recName) {
          ctx.fillStyle = '#141414';
          ctx.fillText(recName, 884, 802);
        }

        // 4. Order ID
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(870, 830, 400, 30);
        ctx.fillStyle = '#141414';
        ctx.fillText(ref, 884, 852);

        // 5. Receipt Number in Table
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(25, 1130, 450, 35);
        ctx.fillStyle = '#141414';
        ctx.fillText(ref, 32, 1154);

        // 6. Transaction Date in Table
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(550, 1130, 380, 35);
        ctx.fillStyle = '#141414';
        ctx.fillText(date, 570, 1154);

        // 7. Amount in Table
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1075, 1126, 220, 38);
        ctx.fillStyle = '#141414';
        ctx.fillText(formattedAmt, 1102, 1154);

        // White mask covering right value column
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1075, 1172, 220, 252);

        ctx.fillStyle = '#141414';
        // 8. Paid amount
        ctx.fillText(formattedAmt, 1102, 1204);
        // 9. Service Charge
        ctx.fillText(sc, 1102, 1238);
        // Disaster Response Fee
        ctx.fillText('0.00', 1102, 1270);
        // VAT
        ctx.fillText(vat, 1102, 1336);
        // Tip
        ctx.fillText('0.00', 1102, 1370);

        // 10. Total Paid Amount (Bold)
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(total, 1102, 1404);

        // 11. Amount in words
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(360, 1415, 680, 30);
        ctx.fillStyle = '#141414';
        ctx.font = '21px Arial, sans-serif';
        ctx.fillText(words, 364, 1438);

        // 12. Payment Reason
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(360, 1450, 680, 30);
        ctx.fillStyle = '#141414';
        ctx.fillText(reason, 364, 1472);

        // 13. Dynamic QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1035, 1535, 215, 215);

        try {
          const rawOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ramussbirr.vercel.app';
          const origin = (!rawOrigin || rawOrigin.includes('0.0.0.0') || rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1')) ? 'https://ramussbirr.vercel.app' : rawOrigin;
          const qrUrl = `${origin}/official-receipt?TID=${encodeURIComponent(ref)}&PH=${encodeURIComponent(acc)}${bank ? `&bank=${encodeURIComponent(bank)}` : ''}`;
          const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 215, errorCorrectionLevel: 'M' });
          const qrImg = new Image();
          await new Promise<void>((r) => {
            qrImg.onload = () => {
              ctx.drawImage(qrImg, 1038, 1538, 209, 209);
              r();
            };
            qrImg.onerror = () => r();
            qrImg.src = qrDataUrl;
          });
        } catch {
          // ignore
        }

        const pngDataUrl = canvas.toDataURL('image/png', 0.95);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.addImage(pngDataUrl, 'PNG', 0, 0, 210, 288, undefined, 'FAST');

        const arrayBuffer = doc.output('arraybuffer');
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const base64 = doc.output('datauristring').split(',')[1] || '';
        resolve({ blob, base64 });
      } catch (err) {
        reject(err);
      }
    };
    bgImg.onerror = () => reject(new Error('Failed to load official receipt template'));
    bgImg.src = '/screens/official_receipt_hq.png';
  });
}

/**
 * Universal downloader for the authentic CBEBirr Official Receipt.
 * Downloads the exact authentic CBE VAT receipt PDF in all environments:
 * - Native Android APK (direct to /sdcard/Download/)
 * - Mobile Chrome / Safari
 * - Desktop Browser
 */
export async function downloadReceiptPdfUniversally(
  data: ReceiptData,
  onProgress?: (msg: string) => void
): Promise<boolean> {
  const ref = data.ref || 'FT262413JRB4';
  const fileName = `CBEBirr_Official_Receipt_${ref}.pdf`;

  if (onProgress) onProgress('ኦፊሴላዊ ደረሰኝ በማዘጋጀት ላይ... (PDF)');

  let pdfBlob: Blob | null = null;
  let pdfBase64: string | null = null;

  // 1. Try server-side sharp composite first when online and not inside static APK bundle
  const isOfflineOrStaticApk =
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    (typeof window !== 'undefined' &&
      (window.location?.origin?.includes('appassets.androidplatform.net') ||
        window.location?.protocol === 'file:'));

  if (!isOfflineOrStaticApk) {
    try {
      const query = new URLSearchParams({
        format: 'pdf',
        ref: data.ref || '',
        amt: data.amt || '',
        date: data.date || '',
        rec: data.rec || '',
        name: data.name || '',
        user: data.user || '',
        acc: data.acc || '',
        reason: data.reason || '',
        bank: data.bank || '',
        fee: data.serviceCharge || '',
        vat: data.vat || '',
        totalPaid: data.totalPaid || '',
      });

      const res = await fetch(`/api/receipt/download?${query.toString()}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
        pdfBlob = await res.blob();
        const reader = new FileReader();
        pdfBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const resStr = reader.result as string;
            resolve(resStr.split(',')[1] || '');
          };
          reader.readAsDataURL(pdfBlob!);
        });
      }
    } catch (err) {
      console.warn('Server route unavailable or offline, generating authentic receipt locally:', err);
    }
  }

  // 2. Client-side authentic composite fallback
  if (!pdfBlob || !pdfBase64) {
    try {
      const generated = await generateClientReceiptPdf(data);
      pdfBlob = generated.blob;
      pdfBase64 = generated.base64;
    } catch (clientErr) {
      console.error('Client receipt generation error:', clientErr);
    }
  }

  if (!pdfBlob || !pdfBase64) {
    if (onProgress) onProgress('ደረሰኝ ማዘጋጀት አልተቻለም (Failed)');
    return false;
  }

  // 3. ANDROID NATIVE BRIDGE: Save authentic PDF directly to Downloads folder
  if (typeof window !== 'undefined' && (window as any).Android) {
    const androidObj = (window as any).Android;
    if (typeof androidObj.saveBase64Pdf === 'function') {
      try {
        androidObj.saveBase64Pdf(pdfBase64, fileName);
        if (onProgress) onProgress(`ትክክለኛው ደረሰኝ በስልክዎ Downloads ፎልደር ተቀምጧል (${fileName})`);
        return true;
      } catch (err) {
        console.warn('Android saveBase64Pdf call failed:', err);
      }
    }
  }

  // 4. Web Browser / PWA: Trigger clean Blob download as authentic .pdf
  try {
    const blobUrl = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 4000);

    if (onProgress) onProgress(`ደረሰኝ ወርዷል (${fileName})`);
    return true;
  } catch (downloadErr) {
    console.error('Browser download error:', downloadErr);
    if (onProgress) onProgress('የማውረድ ስህተት ተከስቷል');
    return false;
  }
}
