'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { generateMatchedSquareQrDataUrl } from '@/lib/styled-qr';
import { getShortQrBaseUrl } from '@/lib/sms-webhook';

const ORIGINAL_QR_TID = 'DJM51SKYIQ3';

export interface OfficialReceiptData {
  ref: string;
  orderId?: string;
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
  const rawRef = data.ref || ORIGINAL_QR_TID;
  const isStaticOriginalQr = !data.ref || data.ref.trim().toUpperCase() === ORIGINAL_QR_TID;

  const shouldResolveRemote = isStaticOriginalQr || !(data.amt && data.rec && data.name);

  const [fetchedData, setFetchedData] = useState<Partial<OfficialReceiptData> | null>(null);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(shouldResolveRemote);

  // Resolve live transaction data:
  // 1) Read from localStorage cache first for instant display
  // 2) Fetch from /api/receipt/get when online so scanning the untouched original PNG QR URL
  //    (https://cbepay1.cbe.com.et/aureceipt?TID=DJM51SKYIQ3&PH=251959754788) displays the live transaction.
  useEffect(() => {
    if (!shouldResolveRemote) return;

    let active = true;

    let cachedStored: Partial<OfficialReceiptData> | null = null;
    try {
      const localKey = isStaticOriginalQr ? 'cbe_receipt_latest' : `cbe_receipt_${rawRef}`;
      const localRaw = localStorage.getItem(localKey) || localStorage.getItem(`cbe_receipt_${rawRef}`);
      if (localRaw) {
        const stored = JSON.parse(localRaw);
        if (stored && stored.ref) {
          cachedStored = {
            ref: stored.ref,
            orderId: stored.orderId || stored.ref,
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
            totalPaid: stored.totalPaidAmount || stored.totalPaid,
          };
        }
      }
    } catch {}

    if (cachedStored) {
      const snapshot = cachedStored;
      Promise.resolve().then(() => {
        if (!active) return;
        setFetchedData(snapshot);
        setIsLoadingLive(false);
      });
    }

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const isLocalApk =
      typeof window !== 'undefined' &&
      (window.location?.origin?.includes('appassets.androidplatform.net') ||
        window.location?.protocol === 'file:');
    if (isOffline || isLocalApk) {
      Promise.resolve().then(() => {
        if (active) setIsLoadingLive(false);
      });
      return () => {
        active = false;
      };
    }

    fetch(`/api/receipt/get?TID=${encodeURIComponent(rawRef)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((stored) => {
        if (!active) return;
        if (stored && stored.ref) {
          setFetchedData({
            ref: stored.ref,
            orderId: stored.orderId || stored.ref,
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
            totalPaid: stored.totalPaidAmount || stored.totalPaid,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingLive(false);
      });

    return () => {
      active = false;
    };
  }, [rawRef, isStaticOriginalQr, shouldResolveRemote]);

  // Strict browser Back-button isolation:
  // Pressing Back must never expose any underlying app interface or menu;
  // this view remains strictly a standalone official receipt page holding the transaction's data.
  useEffect(() => {
    if (isModal || typeof window === 'undefined') return;

    const lockedUrl = window.location.href;
    try {
      document.title = 'CBEBirr Official Receipt';
      sessionStorage.setItem('__cbe_receipt_lock_url', lockedUrl);
      window.history.replaceState({ __cbeOfficialReceiptLock: true }, '', lockedUrl);
      window.history.pushState({ __cbeOfficialReceiptGuard: true }, '', lockedUrl);
    } catch {}

    let gestureGuardAdded = false;
    const addGestureGuard = () => {
      if (gestureGuardAdded) return;
      gestureGuardAdded = true;
      try {
        window.history.pushState({ __cbeOfficialReceiptGestureGuard: true }, '', lockedUrl);
      } catch {}
    };

    const handlePop = () => {
      try {
        sessionStorage.setItem('__cbe_receipt_lock_url', lockedUrl);
        window.history.pushState({ __cbeOfficialReceiptGuard: true }, '', lockedUrl);
      } catch {}
    };

    const handlePageShow = () => {
      try {
        window.history.pushState({ __cbeOfficialReceiptGuard: true }, '', lockedUrl);
      } catch {}
    };

    window.addEventListener('popstate', handlePop);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pointerdown', addGestureGuard, { once: true, passive: true });
    window.addEventListener('keydown', addGestureGuard, { once: true, passive: true });

    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pointerdown', addGestureGuard);
      window.removeEventListener('keydown', addGestureGuard);
    };
  }, [isModal]);

  // Fast synchronous fallback for instant render
  const isSaniTx = rawRef === 'FT263027RY7L' || rawRef.includes('DJT61TBG8Y2') || rawRef.includes('263027');

  const activeRef = (isStaticOriginalQr ? fetchedData?.ref : undefined) || data.ref || fetchedData?.ref || 'FT262413JRB4';
  const activeOrderId =
    (isStaticOriginalQr ? fetchedData?.orderId || fetchedData?.ref : undefined) ||
    data.orderId ||
    fetchedData?.orderId ||
    activeRef;
  const activeAmt = (isStaticOriginalQr ? fetchedData?.amt : data.amt) || fetchedData?.amt || data.amt || (isSaniTx ? '300.00' : '10.00');
  const activeRec = (isStaticOriginalQr ? fetchedData?.rec : data.rec) || fetchedData?.rec || data.rec || (isSaniTx ? '1000440979843' : '1000760389289');
  const activeName = (isStaticOriginalQr ? fetchedData?.name : data.name) || fetchedData?.name || data.name || (isSaniTx ? 'SANI AHMED MOHAMMED' : '');
  const activeUser = (isStaticOriginalQr ? fetchedData?.user : data.user) || fetchedData?.user || data.user || 'AYMEN NIGATU YIMAM';
  const activeAcc = (isStaticOriginalQr ? fetchedData?.acc : undefined) || fetchedData?.acc || data.acc || '0959754788';
  const activeDate = (isStaticOriginalQr ? fetchedData?.date : data.date) || fetchedData?.date || data.date || (isSaniTx ? '29-10-2026 12:40:02' : '2026-10-27 11:56:20');
  const activeReason = (isStaticOriginalQr ? fetchedData?.reason : data.reason) || fetchedData?.reason || data.reason || (isSaniTx ? 'Customer Transfer' : 'Customer transfer to CBE account');
  const activeBank = (isStaticOriginalQr ? fetchedData?.bank : data.bank) || fetchedData?.bank || data.bank || '';
  const serviceCharge = (isStaticOriginalQr ? fetchedData?.serviceCharge : data.serviceCharge) || fetchedData?.serviceCharge || data.serviceCharge || '';
  const vat = (isStaticOriginalQr ? fetchedData?.vat : data.vat) || fetchedData?.vat || data.vat || '';
  const totalPaid = (isStaticOriginalQr ? fetchedData?.totalPaid : data.totalPaid) || fetchedData?.totalPaid || data.totalPaid || '';

  const numericAmt = parseFloat(activeAmt) || (isSaniTx ? 300.00 : 10.00);
  const formattedAmt = numericAmt.toFixed(2);

  // Compute exact fee breakdown if Other Bank or Other Wallet transfer
  const isOtherBankOrWallet =
    Boolean(activeBank) ||
    Boolean(serviceCharge && parseFloat(serviceCharge) > 0) ||
    (activeReason && (activeReason.toLowerCase().includes('bank') || activeReason.toLowerCase().includes('wallet')));
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

  const isPhoneTx = activeRec.startsWith('09') || activeRec.startsWith('07') || activeRec.length === 10;
  const creditAccType = activeBank ? `${activeBank} Account` : (isPhoneTx ? 'Customer E-money Account' : 'CBE Bank Account');

  const [squareQrUrl, setSquareQrUrl] = useState<string>('');
  useEffect(() => {
    let active = true;
    const qrTarget = `${getShortQrBaseUrl()}/r/${encodeURIComponent(activeRef)}`;
    generateMatchedSquareQrDataUrl(qrTarget, 240)
      .then((dataUrl) => {
        if (active) setSquareQrUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeRef]);

  if (isLoadingLive && !fetchedData) {
    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-2 sm:p-4 text-slate-800 select-none overflow-y-auto relative">
        <main className="w-full max-w-[440px] sm:max-w-[480px] bg-white shadow-2xl rounded-lg border border-slate-300/80 overflow-hidden aspect-[665/912] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-2 sm:p-4 text-slate-800 select-none overflow-y-auto relative">
      {/* If inside modal, minimal floating close button at top right */}
      {isModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="fixed top-3 right-3 z-50 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white shadow-lg backdrop-blur-xs transition-all cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Main Official Receipt Document Container - Strictly standalone receipt view */}
      <main className="w-full max-w-[440px] sm:max-w-[480px] bg-white shadow-2xl rounded-lg border border-slate-300/80 overflow-hidden font-sans relative my-auto">
        <svg
          id="official-vat-receipt-svg"
          viewBox="0 0 665 912"
          className="w-full h-auto block select-none pointer-events-none"
          style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision' }}
        >
          {/* Clean background template with exact untouched original PNG QR code */}
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
              {activeOrderId}
            </text>

            {/* 5. Receipt Number in Table */}
            <rect x="14" y="563" width="250" height="18" fill="#ffffff" />
            <text x="16" y="577">
              {activeRef}
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

            {/* Crisp 33x33 Version 4 live QR code matching official_receipt_hq.png */}
            {squareQrUrl && (
              <>
                <rect x="517" y="768" width="108" height="108" fill="#ffffff" />
                <image href={squareQrUrl} x="519" y="770" width="104" height="104" />
              </>
            )}
          </g>
        </svg>
      </main>
    </div>
  );
}

function OfficialReceiptSearchParamsWrapper(props: OfficialReceiptProps) {
  const searchParams = useSearchParams();

  const data: OfficialReceiptData = {
    ref: searchParams?.get('TID') || searchParams?.get('ref') || searchParams?.get('tid') || ORIGINAL_QR_TID,
    orderId: searchParams?.get('orderId') || '',
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
        <div className="min-h-screen bg-[#ece7ef] sm:bg-[#f1f3f6] flex items-center justify-center p-2 sm:p-5 select-none">
          <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl bg-white shadow-2xl rounded-xl border border-slate-300 overflow-hidden aspect-[665/912] animate-pulse" />
        </div>
      }
    >
      <OfficialReceiptSearchParamsWrapper {...props} />
    </Suspense>
  );
}

