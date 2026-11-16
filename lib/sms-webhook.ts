export interface CbeSmsWebhookPayload {
  sender?: string;
  senderName: string;
  senderPhone?: string;
  conversationId?: string;
  fullName?: string;
  amount: string;
  receiverAccount?: string;
  receiverName?: string;
  recipient: string;
  recipientAccount: string;
  balance: string;
  reference: string;
  txnId: string;
  ftRef?: string;
  receiptUrl: string;
  text: string;
  deviceId: string;
  destBank?: string;
  bank?: string;
  transferLabel?: string;
  reason?: string;
  creditAccountType?: string;
}

export interface CbeTransactionInput {
  id?: string;
  amount: string | number;
  receiverAccount?: string;
  receiverName?: string;
  account?: string;
  date?: string;
  ref?: string;
  orderId?: string;
  type?: 'credit' | 'debit';
  title?: string;
  bank?: string;
  reason?: string;
}

/**
 * Formats a Date or date string to CBEBirr format: DD-MM-YYYY HH:mm:ss
 * Example: "07-11-2026 15:20:00"
 */
export function formatCbeDateTime(dateInput?: Date | string): string {
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    const parsed = new Date(dateInput);
    d = isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const YYYY = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return `${DD}-${MM}-${YYYY} ${HH}:${mm}:${ss}`;
}

/**
 * Generates an authentic 8-character uppercase alphanumeric transaction ID (e.g. "9V8GPL5D")
 */
export function generate8CharTxnId(existingRef?: string): string {
  if (existingRef) {
    const cleaned = existingRef.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.startsWith('FT') && cleaned.length >= 10) {
      return cleaned.slice(2, 10);
    }
    if (cleaned.length >= 8) {
      return cleaned.slice(0, 8);
    }
  }
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < 8; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

/**
 * Formats numeric values to 2 decimal places (e.g. "740.00")
 */
export function formatCbeAmount(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * Returns the current application base URL so receipts are always accessible from any browser
 */
export function getAppBaseUrl(): string {
  const isPublicWebOrigin = (o: string) =>
    Boolean(o) &&
    o.startsWith('http') &&
    !o.includes('0.0.0.0') &&
    !o.includes('localhost') &&
    !o.includes('127.0.0.1') &&
    !o.includes('appassets.androidplatform.net') &&
    !o.includes('file:');

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (isPublicWebOrigin(origin)) {
      try {
        localStorage.setItem('cbebirr_current_origin', origin);
      } catch {}
      return origin;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cbebirr_current_origin');
      if (stored && isPublicWebOrigin(stored)) {
        return stored;
      }
    } catch {}
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    if (isPublicWebOrigin(envUrl)) {
      return envUrl;
    }
  }
  return 'https://ramussbirr.vercel.app';
}

/**
 * Returns a short public base URL so `/r/<ref>` stays <= 50 chars,
 * guaranteeing 33x33 Version 4 QR matrix density matching the authentic PNGs
 * and remaining accessible from any external phone camera without preview auth walls.
 */
export function getShortQrBaseUrl(): string {
  const base = getAppBaseUrl().replace(/\/$/, '');
  if (base.length <= 50 && !base.includes('run.app')) {
    return base;
  }
  return 'https://ramussbirr.vercel.app';
}

/**
 * Builds the working official receipt URL for this transaction
 */
export function buildOfficialReceiptUrl(
  txnId: string,
  phone: string,
  amount?: string,
  name?: string,
  user?: string,
  rec?: string,
  date?: string,
  reason?: string,
  bank?: string,
  fee?: string,
  vat?: string,
  totalPaid?: string
): string {
  const baseUrl = getAppBaseUrl();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const fullPhone =
    cleanPhone.length >= 9
      ? cleanPhone.startsWith('251')
        ? cleanPhone
        : `251${cleanPhone.replace(/^0+/, '')}`
      : '';

  const params = new URLSearchParams({
    TID: txnId,
    ref: txnId,
  });
  if (fullPhone) params.set('PH', fullPhone);
  if (amount) params.set('amt', amount);
  if (name) params.set('name', name);
  if (user) params.set('user', user);
  if (rec) params.set('rec', rec);
  if (date) params.set('date', date);
  if (reason) params.set('reason', reason);
  if (bank) params.set('bank', bank);
  if (fee) params.set('fee', fee);
  if (vat) params.set('vat', vat);
  if (totalPaid) params.set('totalPaid', totalPaid);

  return `${baseUrl}/aureceipt?${params.toString()}`;
}

/**
 * Formats a phone number consistently for the official CBE link when available
 */
export function formatPhoneForCbeLink(phone?: string): string {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  if (clean.startsWith('251')) {
    return `+${clean}`;
  }
  if (clean.startsWith('0')) {
    clean = clean.slice(1);
  }
  return `+251${clean}`;
}

/**
 * Builds the official CBEBirr SMS text matching user's exact specification:
 * For transfer:
 * "Dear customer, you have successfully transferred [AMOUNT] Br to [RECEIVER_ACCOUNT] - [RECEIVER_NAME] on [DATE_TIME]. Txn ID [TXN_ID]. Your balance is [BALANCE] Br. Thank You! CBEBirr transaction Receipt. Com [URL]"
 * For deposit:
 * "Dear Customer, you have deposited [AMOUNT]Br. into your CBE Birr account on [DATE_TIME] with receipt number [TXN_ID]. Your current balance is [BALANCE]Br. Thank you!"
 */
export function resolveDestBankName(bank?: string): string | undefined {
  const clean = (bank || '').trim();
  if (!clean) return undefined;
  if (/^(all banks|cbe ?birr|cbe|transfer)$/i.test(clean)) return undefined;
  return clean;
}

export function repairTransferLabelInSmsText(
  text: string,
  meta?: {
    transferLabel?: string;
    destBank?: string;
    bank?: string;
    receiptUrl?: string;
    recipientAccount?: string;
  }
): string {
  if (!text || !/\(\s*Transfer\s*\)/i.test(text)) return text;

  let label =
    meta?.transferLabel && !/^transfer$/i.test(meta.transferLabel.trim())
      ? meta.transferLabel.trim()
      : '';

  if (!label) {
    label = resolveDestBankName(meta?.destBank || meta?.bank) || '';
  }

  if (!label && meta?.receiptUrl) {
    try {
      const u = new URL(meta.receiptUrl);
      const b = u.searchParams.get('bank') || u.searchParams.get('destBank') || '';
      label = resolveDestBankName(b) || '';
    } catch {}
  }

  if (!label) {
    const accMatch = text.match(/\bto\s+([0-9A-Za-z]+)\s*[-–]/i);
    const recAcc = (meta?.recipientAccount || (accMatch ? accMatch[1] : '') || '').trim();
    const isPhone = recAcc.startsWith('09') || recAcc.startsWith('07') || (recAcc.startsWith('251') && recAcc.length >= 11);
    label = isPhone ? 'CBEBirr' : 'CBE';
  }

  return text.replace(/\(\s*Transfer\s*\)(?=\s+on\b|\s*\.|\s|$)/i, `(${label})`);
}

export function buildCbeSmsText({
  fullName,
  amount,
  receiverAccount,
  receiverName,
  dateTimeStr,
  txnId,
  balance,
  receiptUrl,
  isDeposit,
  userPhone,
  transferLabel,
  bank,
}: {
  fullName: string;
  amount: string;
  receiverAccount: string;
  receiverName?: string;
  dateTimeStr?: string;
  txnId: string;
  balance: string;
  receiptUrl?: string;
  isDeposit?: boolean;
  userPhone?: string;
  transferLabel?: string;
  bank?: string;
}): string {
  const rawNum = typeof balance === 'number' ? balance : parseFloat(String(balance).replace(/,/g, ''));
  const formattedBalance = isNaN(rawNum)
    ? balance
    : rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isDeposit) {
    return `Dear Customer, you have deposited ${amount}Br. into your CBE Birr account on ${dateTimeStr} with receipt number ${txnId}. Your current balance is ${formattedBalance}Br. Thank you!`;
  }

  const recName = receiverName || 'CBE Customer';
  const recAcc = receiverAccount || '';
  const cleanDestBank = resolveDestBankName(bank);
  const label =
    (transferLabel && transferLabel.trim()) ||
    cleanDestBank ||
    (recAcc.startsWith('09') || recAcc.startsWith('07') ? 'CBEBirr' : 'CBE');

  // Authentic visual CBE link format
  const ph = formatPhoneForCbeLink(userPhone);
  const visualUrl = ph
    ? `https://cbepay1.cbe.com.et/aureceipt?TID=${txnId}&PH=${ph}`
    : `https://cbepay1.cbe.com.et/aureceipt?TID=${txnId}`;

  return `Dear ${fullName}, you have successfully transferred ${amount},Br. to ${recAcc} - ${recName} (${label}) on ${dateTimeStr}.Txn ID ${txnId}.Your balance is ${formattedBalance} Br.Thank You! CBEBirr transaction Receipt. Com ${visualUrl}`;
}

/**
 * Creates a complete CbeSmsWebhookPayload object matching user's exact JSON specification
 */
export function buildCbeSmsPayload({
  userFullName,
  userPhone,
  receiverAccount,
  receiverName,
  amount,
  balance,
  txnId,
  ftRef,
  date,
  receiptUrl,
  isDeposit,
  reason,
  bank,
  transferLabel,
  creditAccountType,
}: {
  userFullName?: string;
  userPhone?: string;
  receiverAccount?: string;
  receiverName?: string;
  amount: string | number;
  balance: string | number;
  txnId?: string;
  ftRef?: string;
  date?: Date | string;
  receiptUrl?: string;
  isDeposit?: boolean;
  reason?: string;
  bank?: string;
  transferLabel?: string;
  creditAccountType?: string;
}): CbeSmsWebhookPayload {
  const finalFullName = (userFullName && userFullName.trim()) || 'Customer';
  const finalAmount = formatCbeAmount(amount);
  const finalBalance = formatCbeAmount(balance);
  const finalReceiverAcc = receiverAccount || '';
  const finalReceiverName = receiverName || 'CBE Customer';
  const finalTxnId = txnId ? txnId.slice(0, 8).toUpperCase() : generate8CharTxnId(ftRef);
  const finalDateTime = formatCbeDateTime(date);

  const cleanPhone = (userPhone || '').replace(/\D/g, '');
  const fullPhone =
    cleanPhone.length >= 9
      ? cleanPhone.startsWith('251')
        ? cleanPhone
        : `251${cleanPhone.replace(/^0+/, '')}`
      : '';

  const cleanDestBank = resolveDestBankName(bank);
  const finalTransferLabel =
    (transferLabel && transferLabel.trim()) ||
    cleanDestBank ||
    (finalReceiverAcc.startsWith('09') || finalReceiverAcc.startsWith('07') ? 'CBEBirr' : 'CBE');

  // Working official receipt URL that displays the authentic receipt in any browser
  const workingReceiptUrl =
    receiptUrl && !receiptUrl.includes('cbepay1.cbe.com.et')
      ? receiptUrl
      : buildOfficialReceiptUrl(
          finalTxnId,
          fullPhone,
          finalAmount,
          finalReceiverName,
          finalFullName,
          finalReceiverAcc,
          finalDateTime,
          reason,
          cleanDestBank
        );

  const text = buildCbeSmsText({
    fullName: finalFullName,
    amount: finalAmount,
    receiverAccount: finalReceiverAcc,
    receiverName: finalReceiverName,
    dateTimeStr: finalDateTime,
    txnId: finalTxnId,
    balance: finalBalance,
    receiptUrl: workingReceiptUrl,
    isDeposit,
    userPhone: cleanPhone ? `+${cleanPhone}` : '+251915695670',
    transferLabel: finalTransferLabel,
    bank: cleanDestBank,
  });

  const rawNum = typeof balance === 'number' ? balance : parseFloat(String(balance).replace(/,/g, ''));
  const formattedBalanceStr = isNaN(rawNum)
    ? String(balance)
    : rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    senderPhone: 'CBEBirr',
    conversationId: 'CBEBirr',
    text,
    amount: finalAmount,
    recipient: finalReceiverName,
    recipientAccount: finalReceiverAcc,
    receiverName: finalReceiverName,
    receiverAccount: finalReceiverAcc,
    fullName: finalFullName,
    balance: formattedBalanceStr,
    reference: finalTxnId,
    txnId: finalTxnId,
    ftRef,
    receiptUrl: workingReceiptUrl,
    deviceId: 'all',
    destBank: cleanDestBank,
    bank: cleanDestBank,
    transferLabel: finalTransferLabel,
    reason,
    creditAccountType,
  };
}

/**
 * Asynchronously posts single or bulk transactions to the webhook endpoint
 * Uses keepalive: true to prevent UI interruptions and handles network errors gracefully
 */
export async function sendSmsWebhook(
  payload: CbeSmsWebhookPayload | CbeSmsWebhookPayload[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const isArray = Array.isArray(payload);
  const items = isArray ? payload : [payload];
  const count = items.length;
  const bodyStr = JSON.stringify(payload);

  // 0. If running inside Android WebView bridge, invoke native sendSms (IPC broadcast) FIRST
  try {
    if (typeof window !== 'undefined') {
      const androidAny = (window as any).Android;
      if (androidAny?.sendSms) {
        androidAny.sendSms(bodyStr);
      }
      if ((window as any).AndroidSMSBridge?.dispatchLocalSms) {
        (window as any).AndroidSMSBridge.dispatchLocalSms(bodyStr);
      }
    }
  } catch {}

  // 0.5 Always persist to localStorage offline SMS queue so /messages works 100% offline
  try {
    if (typeof window !== 'undefined') {
      const existingRaw = localStorage.getItem('cbe_offline_sms_queue');
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      const nowIso = new Date().toISOString();
      const nowTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      for (const item of items) {
        existing.push({
          id: `offline-${item.txnId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          conversationId: item.conversationId || item.senderName || 'CBEBirr',
          sender: item.sender || 'CBEBirr',
          senderName: item.senderName || 'CBEBirr',
          text: item.text,
          timestamp: nowTime,
          date: nowIso,
          isOutgoing: false,
          status: 'delivered',
          isBank: true,
          bankName: 'CBEBirr',
          destBank: item.destBank || resolveDestBankName(item.bank),
          transferLabel: item.transferLabel,
          reason: item.reason,
          creditAccountType: item.creditAccountType,
          amount: item.amount,
          balance: item.balance,
          reference: item.reference,
          txnId: item.txnId,
          recipient: item.recipient,
          recipientAccount: item.recipientAccount,
          receiptUrl: item.receiptUrl,
        });
      }
      localStorage.setItem('cbe_offline_sms_queue', JSON.stringify(existing.slice(-200)));
      window.dispatchEvent(new CustomEvent('cbe-new-sms', { detail: payload }));
      localStorage.setItem('cbe_latest_sms_timestamp', String(Date.now()));
    }
  } catch {}

  // Skip remote HTTP webhooks when offline or inside standalone offline APK bundle
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const isLocalAssetHost =
    typeof window !== 'undefined' &&
    (window.location?.origin?.includes('appassets.androidplatform.net') ||
      window.location?.protocol === 'file:');

  if (isOffline) {
    return { success: true, count };
  }

  // 1. Save to local /api/sms/webhook when hosted on a server
  if (!isLocalAssetHost) {
    try {
      await fetch('/api/sms/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Ram69',
          'x-device-id': 'all',
        },
        body: bodyStr,
        keepalive: true,
      });
    } catch {}
  }

  // 2. Forward to remote webhook asynchronously without blocking offline flows
  try {
    fetch('https://ramussbirr.vercel.app/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'Ram69',
        'x-device-id': 'all',
      },
      body: bodyStr,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {}

  try {
    fetch('https://ms-bk-connect.vercel.app/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'Ram69',
        'x-device-id': 'all',
      },
      body: bodyStr,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {}

  return { success: true, count };
}

export interface SendTransactionSmsParams {
  fullName?: string;
  amount: number | string;
  receiverAccount?: string;
  receiverName?: string;
  balance?: number | string;
  txnId?: string;
  receiptUrl?: string;
  userPhone?: string;
  ftRef?: string;
  date?: Date | string;
  isDeposit?: boolean;
  reason?: string;
  bank?: string;
  transferLabel?: string;
  creditAccountType?: string;
}

/**
 * High-level helper dispatching SMS notification with exact real-time details
 */
export async function sendTransactionSms(
  params: SendTransactionSmsParams
): Promise<{ success: boolean; count?: number; error?: string }> {
  const payload = buildCbeSmsPayload({
    userFullName: params.fullName,
    userPhone: params.userPhone,
    receiverAccount: params.receiverAccount,
    receiverName: params.receiverName,
    amount: params.amount,
    balance: params.balance !== undefined ? params.balance : '500.00',
    txnId: params.txnId,
    ftRef: params.ftRef,
    date: params.date,
    receiptUrl: params.receiptUrl,
    isDeposit: params.isDeposit,
    reason: params.reason,
    bank: params.bank,
    transferLabel: params.transferLabel,
    creditAccountType: params.creditAccountType,
  });

  return sendSmsWebhook(payload);
}
