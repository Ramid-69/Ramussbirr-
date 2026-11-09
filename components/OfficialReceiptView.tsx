'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  Share2,
  Printer,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { downloadReceiptPdfUniversally } from '@/lib/client-receipt-pdf';

export interface OfficialReceiptData {
  ref: string;
  amt?: string;
  rec?: string;
  name?: string;
  user?: string;
  acc?: string;
  date?: string;
  reason?: string;
  bank?: string;
  serviceCharge?: string;
  vat?: string;
  totalPaid?: string;
}

export interface OfficialReceiptProps {
  initialData?: OfficialReceiptData;
  onClose?: () => void;
  isModal?: boolean;
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

export function OfficialReceiptCore({
  data,
  onClose,
  isModal,
}: {
  data: OfficialReceiptData;
  onClose?: () => void;
  isModal?: boolean;
}) {
  const ref = data.ref || 'FT262413JRB4';

  const [fetchedData, setFetchedData] = useState<Partial<OfficialReceiptData> | null>(null);

  // If query parameters or props are missing fields, automatically fetch real saved transaction details from server
  useEffect(() => {
    if (ref && (!data.amt || !data.rec || !data.name)) {
      fetch(`/api/receipt/get?ref=${encodeURIComponent(ref)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((stored) => {
          if (stored && stored.ref) {
            setFetchedData({
              amt: stored.amt,
              rec: stored.rec,
              name: stored.name,
              user: stored.user,
              acc: stored.acc,
              date: stored.date,
              reason: stored.reason,
              bank: stored.bank,
              serviceCharge: stored.serviceCharge,
              vat: stored.vat,
              totalPaid: stored.totalPaidAmount,
            });
          }
        })
        .catch(() => {});
    }
  }, [ref, data.amt, data.rec, data.name]);

  // Keep standalone browser tab firmly on official receipt page (never exit to banking app)
  useEffect(() => {
    if (!isModal && typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', window.location.href);
        const handlePop = () => {
          window.history.pushState(null, '', window.location.href);
        };
        window.addEventListener('popstate', handlePop);
        return () => {
          window.removeEventListener('popstate', handlePop);
        };
      } catch {}
    }
  }, [isModal]);

  const activeAmt = data.amt || fetchedData?.amt || '10.00';
  const activeRec = data.rec || fetchedData?.rec || '1000760389289';
  const activeName = data.name || fetchedData?.name || '';
  const activeUser = data.user || fetchedData?.user || 'AYMEN NIGATU YIMAM';
  const activeAcc = data.acc || fetchedData?.acc || '0959754788';
  const activeDate = data.date || fetchedData?.date || '2026-10-27 11:56:20';
  const activeReason = data.reason || fetchedData?.reason || 'Customer transfer to CBE account';
  const activeBank = data.bank || fetchedData?.bank || '';
  const serviceCharge = data.serviceCharge || fetchedData?.serviceCharge || '';
  const vat = data.vat || fetchedData?.vat || '';
  const totalPaid = data.totalPaid || fetchedData?.totalPaid || '';

  const numericAmt = parseFloat(activeAmt) || 10.00;
  const formattedAmt = numericAmt.toFixed(2);

  // Compute exact fee breakdown if Other Bank or Other Wallet transfer
  const isOtherBankOrWallet = Boolean(activeBank) || Boolean(serviceCharge && parseFloat(serviceCharge) > 0) || (activeReason && (activeReason.toLowerCase().includes('bank') || activeReason.toLowerCase().includes('wallet')));
  let feeObj: { serviceCharge: string; vat: string; totalPaid: string; totalPaidNum: number } | null = null;

  if (isOtherBankOrWallet) {
    const scNum = parseFloat(serviceCharge);
    const vNum = parseFloat(vat);
    if (!isNaN(scNum) && scNum > 0) {
      const v = !isNaN(vNum) ? vNum : +(scNum * 0.15).toFixed(5);
      const td = totalPaid && !isNaN(parseFloat(totalPaid)) ? parseFloat(totalPaid) : +(numericAmt + scNum + v).toFixed(2);
      feeObj = {
        serviceCharge: scNum >= 0.005 && scNum < 0.01 ? '0.01' : scNum.toFixed(2),
        vat: v.toFixed(2),
        totalPaid: td.toFixed(2),
        totalPaidNum: td,
      };
    } else {
      const sc = Math.max(0.005, +(numericAmt * 0.005).toFixed(5));
      const v = +(sc * 0.15).toFixed(5);
      const td = +(numericAmt + sc + v).toFixed(2);
      feeObj = {
        serviceCharge: sc >= 0.005 && sc < 0.01 ? '0.01' : sc.toFixed(2),
        vat: v.toFixed(2),
        totalPaid: td.toFixed(2),
        totalPaidNum: td,
      };
    }
  }

  const finalServiceCharge = feeObj ? feeObj.serviceCharge : '0.00';
  const finalVat = feeObj ? feeObj.vat : '0.00';
  const finalTotalPaid = feeObj ? feeObj.totalPaid : formattedAmt;
  const words = amountToWords(feeObj ? feeObj.totalPaidNum : numericAmt);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadToast, setDownloadToast] = useState<string>('');

  useEffect(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    QRCode.toDataURL(currentUrl || `https://cbepay1.cbe.com.et/official-receipt?TID=${ref}&PH=${activeAcc}${activeBank ? `&bank=${encodeURIComponent(activeBank)}` : ''}`, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
    })
      .then((data) => setQrDataUrl(data))
      .catch(() => {});
  }, [ref, activeAcc, activeBank]);

  const handleDownload = async (format: 'pdf' | 'png') => {
    if (format === 'pdf') {
      await downloadReceiptPdfUniversally(
        {
          ref,
          amt: formattedAmt,
          rec: activeRec,
          name: activeName,
          user: activeUser,
          acc: activeAcc,
          date: activeDate,
          reason: activeReason,
          bank: activeBank,
          serviceCharge: finalServiceCharge,
          vat: finalVat,
          totalPaid: finalTotalPaid,
        },
        (msg) => setDownloadToast(msg)
      );
      setTimeout(() => setDownloadToast(''), 3500);
      return;
    }

    setDownloadToast('Preparing PNG receipt...');
    const downloadUrl = `/api/receipt/download?format=png&ref=${encodeURIComponent(ref)}&amt=${encodeURIComponent(formattedAmt)}&rec=${encodeURIComponent(activeRec)}&name=${encodeURIComponent(activeName)}&user=${encodeURIComponent(activeUser)}&acc=${encodeURIComponent(activeAcc)}&date=${encodeURIComponent(activeDate)}&reason=${encodeURIComponent(activeReason)}${activeBank ? `&bank=${encodeURIComponent(activeBank)}` : ''}`;

    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const fileName = `CBEBirr_Official_Receipt_${ref}.png`;

      if (typeof window !== 'undefined' && (window as any).Android?.saveBase64Pdf) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = (reader.result as string).split(',')[1];
          if (b64) (window as any).Android.saveBase64Pdf(b64, fileName);
        };
        reader.readAsDataURL(blob);
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        setDownloadToast('Official receipt downloaded (PNG)');
        setTimeout(() => setDownloadToast(''), 3000);
      }, 1000);
    } catch {
      setDownloadToast('Failed to download PNG receipt');
      setTimeout(() => setDownloadToast(''), 3000);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `CBEBirr Official Receipt ${ref}`,
          text: `CBEBirr Official VAT Receipt: Transferred ETB ${formattedAmt} to ${activeName}. Ref: ${ref}`,
          url: window.location.href,
        });
      } catch {
        // ignore
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setDownloadToast('Receipt link copied to clipboard!');
      setTimeout(() => setDownloadToast(''), 2500);
    }
  };

  const isPhoneTx = activeRec.startsWith('09') || activeRec.startsWith('07') || activeRec.length === 10;
  const creditAccType = activeBank ? `${activeBank} Account` : (isPhoneTx ? 'Customer E-money Account' : 'CBE Bank Account');

  return (
    <div className={`w-full bg-[#f1f3f6] flex flex-col items-center ${isModal ? 'py-2 px-1 sm:px-3' : 'min-h-screen py-4 px-2 sm:px-4'} text-slate-800`}>
      {/* If inside modal, show only a minimal close button at top right */}
      {isModal && onClose && (
        <div className="w-full max-w-2xl flex justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main Official Receipt Document Container - 100% IDENTICAL TO IN-APP STEP 9 */}
      <main className="w-full max-w-2xl bg-white shadow-xl rounded-md border border-slate-300 overflow-hidden font-sans relative">
        <svg
          id="official-vat-receipt-svg"
          viewBox="0 0 665 912"
          className="w-full h-auto block select-none pointer-events-none"
          style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision' }}
        >
          {/* Clean background template with high-definition crisp scaling */}
          <image
            href="/screens/official_receipt_hq.png"
            width="665"
            height="912"
            preserveAspectRatio="none"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />

          <g fontFamily="Arial, Helvetica, sans-serif" fill="#141414" fontSize="11" fontWeight="normal">
            {/* Customer Name */}
            <rect x="440" y="105" width="215" height="20" fill="#ffffff" />
            <text x="442" y="118">
              {activeUser.toUpperCase()}
            </text>

            {/* 1. Debit Account Value */}
            <rect x="435" y="354" width="225" height="17" fill="#ffffff" />
            <text x="442" y="368">
              {`${activeAcc} - ${activeUser.toUpperCase()}`}
            </text>

            {/* 2. Credit Account Value */}
            <rect x="435" y="371" width="225" height="16" fill="#ffffff" />
            <text x="442" y="384">
              {`${activeRec} - ${creditAccType}`}
            </text>

            {/* 3. Receiver Name Value */}
            <rect x="435" y="388" width="225" height="16" fill="#ffffff" />
            {activeName ? (
              <text x="442" y="401">
                {activeName}
              </text>
            ) : null}

            {/* 4. Order ID Value */}
            <rect x="435" y="413" width="225" height="16" fill="#ffffff" />
            <text x="442" y="426">
              {ref}
            </text>

            {/* 5. Receipt Number in Table */}
            <rect x="14" y="563" width="250" height="18" fill="#ffffff" />
            <text x="16" y="577">
              {ref}
            </text>

            {/* 6. Transaction Date in Table */}
            <rect x="275" y="563" width="200" height="18" fill="#ffffff" />
            <text x="285" y="577">
              {activeDate}
            </text>

            {/* 7. Amount in Table (Starts at x=551, expands to the right) */}
            <rect x="538" y="563" width="110" height="19" fill="#ffffff" />
            <text x="551" y="577">
              {formattedAmt}
            </text>

            {/* Solid white mask covering value column cleanly up to right edge */}
            <rect x="538" y="586" width="110" height="126" fill="#ffffff" />

            {/* Row 1: Paid amount */}
            <text x="551" y="602">
              {formattedAmt}
            </text>

            {/* Row 2: Service Charge */}
            <text x="551" y="619">
              {finalServiceCharge}
            </text>

            {/* Row 3: Disaster Response */}
            <text x="551" y="635">
              0.00
            </text>

            {/* Row 4: VAT */}
            <text x="551" y="668">
              {finalVat}
            </text>

            {/* Row 5: Tip */}
            <text x="551" y="685">
              0.00
            </text>

            {/* Row 6: Total Paid Amount */}
            <text x="551" y="702" fontWeight="bold">
              {finalTotalPaid}
            </text>

            {/* 11. Total Amount in word */}
            <rect x="175" y="706" width="480" height="18" fill="#ffffff" />
            <text x="182" y="719" fontSize="10.5">
              {words}
            </text>

            {/* 12. Payment Reason */}
            <rect x="175" y="723" width="480" height="18" fill="#ffffff" />
            <text x="182" y="736" fontSize="10.5">
              {activeReason}
            </text>

            {/* 13. Dynamic QR Code overlay replacing old template QR */}
            <rect x="517" y="768" width="108" height="108" fill="#ffffff" />
            {qrDataUrl && (
              <image
                href={qrDataUrl}
                x="519"
                y="770"
                width="104"
                height="104"
              />
            )}
          </g>
        </svg>

        {/* Clean Action Buttons Below Receipt */}
        <div className="w-full max-w-xl flex items-center justify-center gap-2.5 mt-4 mb-2 print:hidden">
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#7a1c7d] hover:bg-[#68146a] active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload('png')}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Save Image</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition-all cursor-pointer"
            title="Share or Copy Link"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition-all cursor-pointer"
            title="Print"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </main>

      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-6 z-50 bg-slate-900/90 text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-2xl backdrop-blur-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{downloadToast}</span>
        </div>
      )}
    </div>
  );
}

function OfficialReceiptSearchParamsWrapper(props: OfficialReceiptProps) {
  const searchParams = useSearchParams();

  const data: OfficialReceiptData = {
    ref: searchParams?.get('TID') || searchParams?.get('ref') || searchParams?.get('tid') || 'FT262413JRB4',
    amt: searchParams?.get('amt') || '',
    rec: searchParams?.get('rec') || searchParams?.get('receiverAccount') || '',
    name: searchParams?.get('name') || searchParams?.get('receiverName') || '',
    user: searchParams?.get('user') || searchParams?.get('fullName') || '',
    acc: searchParams?.get('acc') || searchParams?.get('PH') || searchParams?.get('userAcc') || '',
    date: searchParams?.get('date') || '',
    reason: searchParams?.get('reason') || '',
    bank: searchParams?.get('bank') || searchParams?.get('destBank') || '',
    serviceCharge: searchParams?.get('fee') || searchParams?.get('serviceCharge') || '',
    vat: searchParams?.get('vat') || '',
    totalPaid: searchParams?.get('totalPaid') || '',
  };

  return <OfficialReceiptCore data={data} onClose={props.onClose} isModal={props.isModal} />;
}

export default function OfficialReceiptPage(props: OfficialReceiptProps) {
  if (props?.initialData) {
    return (
      <OfficialReceiptCore
        data={props.initialData}
        onClose={props.onClose}
        isModal={props.isModal}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-[#7a1c7d] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-700">ደረሰኝ በመጫን ላይ (Loading Official Receipt)...</p>
          </div>
        </div>
      }
    >
      <OfficialReceiptSearchParamsWrapper {...props} />
    </Suspense>
  );
}
