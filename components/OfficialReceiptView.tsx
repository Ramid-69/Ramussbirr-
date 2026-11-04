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
} from 'lucide-react';
import QRCode from 'qrcode';

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

function OfficialReceiptContent() {
  const searchParams = useSearchParams();

  const ref =
    searchParams.get('TID') ||
    searchParams.get('ref') ||
    searchParams.get('tid') ||
    '9V8GPL5D';
  const amtParam = searchParams.get('amt') || '740.00';
  const recParam = searchParams.get('rec') || searchParams.get('receiverAccount') || '1000760389289';
  const nameParam = searchParams.get('name') || searchParams.get('receiverName') || 'Miss Simera Gofer Abdisa';
  const userParam = searchParams.get('user') || searchParams.get('fullName') || 'JUREY ABDUL HUSSEN';
  const accParam = searchParams.get('acc') || searchParams.get('PH') || searchParams.get('userAcc') || '1000760389289';
  const dateParam = searchParams.get('date') || '27-10-2026 11:56:20';
  const reasonParam = searchParams.get('reason') || 'Wallet Transfer';

  const numericAmt = parseFloat(amtParam) || 740.0;
  const formattedAmt = numericAmt.toFixed(2);
  const words = amountToWords(numericAmt);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadToast, setDownloadToast] = useState<string>('');

  useEffect(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    QRCode.toDataURL(currentUrl || `https://cbepay1.cbe.com.et/aureceipt?TID=${ref}&PH=${accParam}`, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
    })
      .then((data) => setQrDataUrl(data))
      .catch(() => {});
  }, [ref, accParam]);

  const handleDownload = (format: 'pdf' | 'png') => {
    setDownloadToast(`Preparing ${format.toUpperCase()} receipt...`);
    const downloadUrl = `/api/receipt/download?format=${format}&ref=${encodeURIComponent(ref)}&amt=${encodeURIComponent(formattedAmt)}&rec=${encodeURIComponent(recParam)}&name=${encodeURIComponent(nameParam)}&user=${encodeURIComponent(userParam)}&acc=${encodeURIComponent(accParam)}&date=${encodeURIComponent(dateParam)}&reason=${encodeURIComponent(reasonParam)}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `CBEBirr_Official_Receipt_${ref}.${format}`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
      setDownloadToast(`Official receipt downloaded (${format.toUpperCase()})`);
      setTimeout(() => setDownloadToast(''), 3000);
    }, 1000);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `CBEBirr Official Receipt ${ref}`,
          text: `CBEBirr Official VAT Receipt: Transferred ETB ${formattedAmt} to ${nameParam}. Ref: ${ref}`,
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-4 px-2 sm:px-4 text-slate-800">
      {/* Top Banner Navigation */}
      <header className="w-full max-w-3xl flex items-center justify-between bg-[#7a1c7d] text-white px-4 py-3 rounded-2xl shadow-md mb-4">
        <Link
          href="/"
          className="flex items-center space-x-2 text-white hover:text-purple-200 transition-colors text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ወደ ባንኪንግ አፕ (Back to CBEBirr App)</span>
        </Link>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
            <span>ኦፊሴላዊ ደረሰኝ (Official)</span>
          </span>
        </div>
      </header>

      {/* Floating Action Controls */}
      <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-800">Verified Electronic VAT Receipt</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#7a1c7d] hover:bg-[#68146a] text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload('png')}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Save Image (PNG)</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
            title="Share or Copy Link"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer"
            title="Print"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Official Receipt Document Container */}
      <main className="w-full max-w-3xl bg-white shadow-xl rounded-2xl border border-slate-300 overflow-hidden font-sans relative">
        {/* Document Header (Purple) */}
        <div className="bg-[#7a1c7d] text-white p-4 sm:p-5 flex items-center justify-between relative overflow-hidden">
          {/* Circular Gold Emblem Graphic */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 border-2 border-yellow-300/40 flex items-center justify-center shrink-0 shadow-inner">
            <span className="text-xl sm:text-2xl font-black text-yellow-300">CBE</span>
          </div>

          <div className="text-center flex-1 px-2">
            <h1 className="text-sm sm:text-base font-bold tracking-wide">
              Commercial Bank of Ethiopia
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-purple-100 mt-0.5">
              VAT Invoice / Customer Receipt
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-purple-200 mt-0.5">
              CBEBirr Electronic Channel
            </p>
          </div>

          {/* CBE Birr Plus Badge */}
          <div className="shrink-0 bg-white text-[#7a1c7d] px-2.5 py-1 rounded-xl shadow font-black text-xs sm:text-sm tracking-wider flex items-center space-x-1">
            <span>CBE</span>
            <span className="text-yellow-600">Birr</span>
            <span className="text-[9px] bg-[#7a1c7d] text-white px-1 rounded-md">Plus</span>
          </div>
        </div>

        {/* Section 1: Company Address vs Customer Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 text-xs border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-[#7a1c7d] text-[13px] mb-2 pb-1 border-b border-purple-200">
              Company Address &amp; Other Information
            </h3>
            <div className="space-y-1 text-slate-700">
              <p><span className="font-semibold text-slate-900">Country:</span> Ethiopia</p>
              <p><span className="font-semibold text-slate-900">City:</span> Addis Ababa</p>
              <p><span className="font-semibold text-slate-900">Address:</span> Ras Desta Damtew St, 01, Kirkos</p>
              <p><span className="font-semibold text-slate-900">Postal code:</span> 255</p>
              <p><span className="font-semibold text-slate-900">SWIFT Code:</span> CBETETAA</p>
              <p><span className="font-semibold text-slate-900">Email:</span> info@cbe.com.et</p>
              <p><span className="font-semibold text-slate-900">Tel:</span> 251-551-50-04 | <span className="font-semibold text-slate-900">Fax:</span> 251-551-45-22</p>
              <p><span className="font-semibold text-slate-900">TIN:</span> 0000006966</p>
              <p><span className="font-semibold text-slate-900">VAT Registration No:</span> 011140</p>
              <p><span className="font-semibold text-slate-900">VAT Registration Date:</span> 01/01/2003</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-[#7a1c7d] text-[13px] mb-2 pb-1 border-b border-purple-200">
              Customer Information
            </h3>
            <div className="space-y-1 text-slate-700">
              <p><span className="font-semibold text-slate-900">Customer Name:</span> <span className="font-bold text-slate-900">{userParam.toUpperCase()}</span></p>
              <p><span className="font-semibold text-slate-900">Region:</span> Addis Ababa</p>
              <p><span className="font-semibold text-slate-900">City:</span> Addis Ababa</p>
              <p><span className="font-semibold text-slate-900">Sub city:</span> Kirkos</p>
              <p><span className="font-semibold text-slate-900">Wereda/kebele:</span> 01</p>
              <p><span className="font-semibold text-slate-900">VAT Registration No:</span> -</p>
              <p><span className="font-semibold text-slate-900">TIN (TAX ID):</span> -</p>
              <p><span className="font-semibold text-slate-900">Branch:</span> E-Payment / Mobile Banking</p>
            </div>
          </div>
        </div>

        {/* Section 2: Transaction Information */}
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <div className="bg-[#7a1c7d] text-white py-1 px-3 rounded-lg text-xs font-bold mb-3">
            Transaction Information
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Authentic Stamp Graphic */}
            <div className="flex items-center justify-center p-3">
              <div className="w-32 h-32 rounded-full border-4 border-purple-900/60 flex flex-col items-center justify-center text-center p-2 rotate-[-6deg] shadow-inner">
                <span className="text-[10px] font-bold text-purple-900">የኢትዮጵያ ንግድ ባንክ</span>
                <span className="text-[9px] font-bold text-purple-900">Commercial Bank of Ethiopia</span>
                <span className="text-[12px] font-black text-purple-900 my-0.5">★ PAID ★</span>
                <span className="text-[8px] font-mono text-purple-800">{dateParam}</span>
              </div>
            </div>

            {/* Transaction Data */}
            <div className="space-y-2 text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold text-slate-900">Debit Account:</span>
                <span className="font-mono">{accParam} - {userParam.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold text-slate-900">Credit Account:</span>
                <span className="font-mono">{recParam} - CBE Account</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold text-slate-900">Receiver Name:</span>
                <span className="font-bold text-slate-900">{nameParam}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold text-slate-900">Order ID:</span>
                <span className="font-mono font-bold text-[#7a1c7d]">{ref}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="font-semibold text-slate-900">Transaction Status:</span>
                <span className="font-bold text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Reference:</span>
                <span className="font-mono text-slate-600">{ref}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Transaction Details Table */}
        <div className="p-4 sm:p-5">
          <div className="bg-[#7a1c7d] text-white py-1 px-3 rounded-lg text-xs font-bold mb-3">
            Transaction Details
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-300 text-slate-900 font-bold">
                  <th className="py-2 pr-2">Receipt Number</th>
                  <th className="py-2 px-2">Transaction Date</th>
                  <th className="py-2 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 pr-2 font-mono text-[#7a1c7d] font-bold">{ref}</td>
                  <td className="py-2.5 px-2 font-mono">{dateParam}</td>
                  <td className="py-2.5 pl-2 text-right font-mono font-bold text-slate-900">{formattedAmt}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount Breakdown */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs">
            <div className="space-y-1.5 flex-1">
              <p>
                <span className="font-semibold text-slate-900">Total Amount in word: </span>
                <span className="font-bold text-slate-900">{words}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">Payment Reason: </span>
                <span>{reasonParam}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">Payment Channel: </span>
                <span className="font-mono">API / CBEBirr</span>
              </p>
            </div>

            <div className="w-full sm:w-60 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600">Paid amount:</span>
                <span className="font-bold">{formattedAmt}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Service Charge:</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Disaster Response Fee:</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>VAT:</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tip:</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-bold text-[#7a1c7d]">
                <span>Total Paid Amount:</span>
                <span>{formattedAmt} ETB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Bank Slogan and QR Code */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="text-sm font-bold text-[#7a1c7d] italic">
              The Bank you can always rely on!
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              © 2026 Commercial Bank of Ethiopia. All rights reserved.
            </p>
          </div>

          {qrDataUrl && (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Receipt Verification QR Code"
                className="w-24 h-24 border border-slate-200 rounded-lg p-1 bg-white shadow-xs"
              />
              <span className="text-[9px] text-slate-400 mt-1 font-mono">Scan to Verify</span>
            </div>
          )}
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

export default function OfficialReceiptPage() {
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
      <OfficialReceiptContent />
    </Suspense>
  );
}
