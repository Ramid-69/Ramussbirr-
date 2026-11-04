export interface CbeSmsWebhookPayload {
  senderName: string;
  senderPhone: string;
  fullName: string;
  amount: string;
  receiverAccount: string;
  receiverName: string;
  balance: string;
  txnId: string;
  receiptUrl: string;
  text: string;
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
}

/**
 * Formats a Date or date string to CBEBirr format: DD-MM-YYYY HH:mm:ss
 * Example: "27-10-2026 11:56:20"
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
 * Builds the official CBEBirr SMS text strictly matching the official CBEBirr format specification:
 * "Dear {fullName}, you have successfully transferred {amount}.00Br. to {receiverAccount}-{receiverName} on {DD-MM-YYYY HH:mm:ss}.Txn ID {txnId},FT262413JRB4.Your CBEBirr account balance is {newBalance}.00Br.Thank You for Choosing CBE Birr ! For your feedback please click the link https://shorturl.at/gy3AO For invoice {receiptUrl}"
 */
export function buildCbeSmsText({
  fullName,
  amount,
  receiverAccount,
  receiverName,
  dateTimeStr,
  txnId,
  ftRef,
  balance,
  receiptUrl,
}: {
  fullName: string;
  amount: string;
  receiverAccount: string;
  receiverName: string;
  dateTimeStr: string;
  txnId: string;
  ftRef?: string;
  balance: string;
  receiptUrl: string;
}): string {
  const ft = ftRef || 'FT262413JRB4';
  return `Dear ${fullName}, you have successfully transferred ${amount}Br. to ${receiverAccount}-${receiverName} on ${dateTimeStr}.Txn ID ${txnId},${ft}.Your CBEBirr account balance is ${balance}Br.Thank You for Choosing CBE Birr ! For your feedback please click the link https://shorturl.at/gy3AO For invoice ${receiptUrl}`;
}

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'https://ais-pre-ki5oatlcroezeequlsbky2-981643091972.europe-west2.run.app';
}

export function buildOfficialReceiptUrl(
  txnId: string,
  phone: string,
  amount?: string,
  name?: string,
  user?: string
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
    PH: fullPhone,
  });
  if (amount) params.set('amt', amount);
  if (name) params.set('name', name);
  if (user) params.set('user', user);

  return `${baseUrl}/official-receipt?${params.toString()}`;
}

/**
 * Creates a complete CbeSmsWebhookPayload object ready for POST dispatch
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
}): CbeSmsWebhookPayload {
  const finalFullName = (userFullName && userFullName.trim()) || 'JUREY ABDUL HUSSEN';
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

  // The working official receipt URL of this application
  const workingReceiptUrl =
    receiptUrl && !receiptUrl.includes('cbepay1.cbe.com.et')
      ? receiptUrl
      : buildOfficialReceiptUrl(finalTxnId, fullPhone, finalAmount, finalReceiverName, finalFullName);

  // The original authentic CBE receipt URL string shown in the SMS message text
  const originalCbeReceiptUrl = `https://cbepay1.cbe.com.et/aureceipt?TID=${finalTxnId}&PH=${fullPhone}`;

  const text = buildCbeSmsText({
    fullName: finalFullName,
    amount: finalAmount,
    receiverAccount: finalReceiverAcc,
    receiverName: finalReceiverName,
    dateTimeStr: finalDateTime,
    txnId: finalTxnId,
    ftRef: ftRef || 'FT262413JRB4',
    balance: finalBalance,
    receiptUrl: originalCbeReceiptUrl,
  });

  return {
    senderName: 'CBEBirr',
    senderPhone: 'CBEBirr',
    fullName: finalFullName,
    amount: finalAmount,
    receiverAccount: finalReceiverAcc,
    receiverName: finalReceiverName,
    balance: finalBalance,
    txnId: finalTxnId,
    receiptUrl: workingReceiptUrl,
    text,
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

  // 1. Call server-side proxy route with keepalive
  try {
    const res = await fetch('/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyStr,
      keepalive: true,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, count: data.count || count };
    }
  } catch {
    // If local fetch has network hiccup, fallback to direct fetch
  }

  // 2. Fallback: direct browser fetch with keepalive: true
  try {
    const directRes = await fetch('https://ms-bk-connect.vercel.app/api/sms/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'Ram69',
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
    // Silently continue without disrupting user flow
  }

  return { success: false, error: 'Could not connect to SMS server' };
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
}

/**
 * High-level helper matching user's exact specification:
 * await sendTransactionSms({
 *   fullName: 'JUREY ABDUL HUSSEN',
 *   amount: 740.00,
 *   receiverAccount: '1000760389289',
 *   receiverName: 'Miss Simera Gofer Abdisa',
 *   balance: 63535.00,
 *   txnId: '9V8GPL5D',
 *   receiptUrl: 'https://cbepay1.cbe.com.et/aureceipt?TID=9V8GPL5D&PH=251959842829',
 * });
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
  });

  return sendSmsWebhook(payload);
}

