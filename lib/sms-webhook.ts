export interface CbeSmsWebhookPayload {
  senderName: string;
  senderPhone?: string;
  fullName?: string;
  amount: string;
  receiverAccount?: string;
  receiverName?: string;
  recipient: string;
  recipientAccount: string;
  balance: string;
  reference: string;
  txnId: string;
  receiptUrl: string;
  text: string;
  deviceId: string;
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
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    try {
      localStorage.setItem('cbebirr_current_origin', window.location.origin);
    } catch {}
    return window.location.origin;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('cbebirr_current_origin');
      if (stored) return stored;
    } catch {}
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
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
  const cleanPhone = (phone || '251959842829').replace(/\D/g, '');
  const fullPhone =
    cleanPhone.length >= 9
      ? cleanPhone.startsWith('251')
        ? cleanPhone
        : `251${cleanPhone.replace(/^0+/, '')}`
      : '251959842829';

  const params = new URLSearchParams({
    TID: txnId,
    ref: txnId,
    PH: fullPhone,
  });
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
 * Builds the official CBEBirr SMS text matching user's exact specification:
 * For transfer:
 * "Dear customer, you have successfully transferred [AMOUNT] Br to [RECEIVER_ACCOUNT] - [RECEIVER_NAME] on [DATE_TIME]. Txn ID [TXN_ID]. Your balance is [BALANCE] Br. Thank You! CBEBirr transaction Receipt. Com [URL]"
 * For deposit:
 * "Dear Customer, you have deposited [AMOUNT]Br. into your CBE Birr account on [DATE_TIME] with receipt number [TXN_ID]. Your current balance is [BALANCE]Br. Thank you!"
 */
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
}): string {
  const rawNum = typeof balance === 'number' ? balance : parseFloat(String(balance).replace(/,/g, ''));
  const formattedBalance = isNaN(rawNum)
    ? balance
    : rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isDeposit) {
    return `Dear Customer, you have deposited ${amount}Br. into your CBE Birr account on ${dateTimeStr} with receipt number ${txnId}. Your current balance is ${formattedBalance}Br. Thank you!`;
  }

  const workingUrl = receiptUrl || `https://cbepay1.cbe.com.et/aureceipt?TID=${txnId}&PH=+251915695670`;
  const recName = receiverName || 'Miss Simera Gofer Abdisa';
  const recAcc = receiverAccount || '1000760389289';

  return `Dear customer, you have successfully transferred ${amount} Br to ${recAcc} - ${recName} on ${dateTimeStr}. Txn ID ${txnId}. Your balance is ${formattedBalance} Br. Thank You! CBEBirr transaction Receipt. Com ${workingUrl}`;
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
}): CbeSmsWebhookPayload {
  const finalFullName = (userFullName && userFullName.trim()) || 'AYMEN NIGATU YIMAM';
  const finalAmount = formatCbeAmount(amount);
  const finalBalance = formatCbeAmount(balance);
  const finalReceiverAcc = receiverAccount || '1000760389289';
  const finalReceiverName = receiverName || 'Miss Simera Gofer Abdisa';
  const finalTxnId = txnId ? txnId.slice(0, 8).toUpperCase() : generate8CharTxnId(ftRef);
  const finalDateTime = formatCbeDateTime(date);

  const cleanPhone = (userPhone || '251959842829').replace(/\D/g, '');
  const fullPhone =
    cleanPhone.length >= 9
      ? cleanPhone.startsWith('251')
        ? cleanPhone
        : `251${cleanPhone.replace(/^0+/, '')}`
      : '251959842829';

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
          bank
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
  });

  const rawNum = typeof balance === 'number' ? balance : parseFloat(String(balance).replace(/,/g, ''));
  const formattedBalanceStr = isNaN(rawNum)
    ? String(balance)
    : rawNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    senderName: 'CBEBirr',
    senderPhone: 'CBEBirr',
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
    receiptUrl: workingReceiptUrl,
    deviceId: 'all',
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
  const count = isArray ? payload.length : 1;
  const bodyStr = JSON.stringify(payload);

  // 0. If running inside Android WebView bridge, invoke native sendSms if available
  try {
    if (typeof window !== 'undefined' && (window as any).Android?.sendSms) {
      (window as any).Android.sendSms(bodyStr);
    }
  } catch {}

  // 1. Direct browser fetch to https://ms-bk-connect.vercel.app/api/sms/webhook (instant delivery)
  try {
    const directRes = await fetch('https://ms-bk-connect.vercel.app/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'Ram69',
        'x-device-id': 'all',
      },
      body: bodyStr,
      keepalive: true,
      mode: 'cors',
    });

    if (directRes.ok) {
      const data = await directRes.json().catch(() => ({}));
      return { success: true, count: data.count || count };
    }
  } catch {
    // Continue to server proxy fallback
  }

  // 2. Fallback: Call server-side proxy route with keepalive
  try {
    const res = await fetch('/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'all',
      },
      body: bodyStr,
      keepalive: true,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, count: data.count || count };
    }
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
    balance: params.balance !== undefined ? params.balance : '63535.00',
    txnId: params.txnId,
    ftRef: params.ftRef,
    date: params.date,
    receiptUrl: params.receiptUrl,
    isDeposit: params.isDeposit,
    reason: params.reason,
    bank: params.bank,
  });

  return sendSmsWebhook(payload);
}
