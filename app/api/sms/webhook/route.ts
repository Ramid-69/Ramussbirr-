import { NextRequest, NextResponse } from 'next/server';
import { smsStore, MASTER_API_KEY } from '@/lib/sms-store';
import { buildOfficialReceiptUrl } from '@/lib/sms-webhook';

const REMOTE_WEBHOOK_URL = 'https://ms-bk-connect.vercel.app/api/sms/webhook';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || 'dev_galaxy_a12';
  const unsyncedOnly = url.searchParams.get('unsynced') === 'true';

  const messages = smsStore.getAllMessages(deviceId, unsyncedOnly);

  return NextResponse.json({
    success: true,
    count: messages.length,
    deviceId,
    messages,
  });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      new URL(req.url).searchParams.get('apiKey');

    // Optional auth check: if provided, validate, otherwise allow local dev requests with default
    const validation = smsStore.validateApiKey(apiKey);

    const payload = await req.json().catch(() => ({}));
    const reqDeviceId = req.headers.get('x-device-id') || payload.deviceId || 'all';

    const items = Array.isArray(payload) ? payload : [payload];
    const createdMessages = [];

    for (const item of items) {
      // Support raw strings or structured fields
      let sender = item.sender || item.senderName || item.bank;
      if (!sender || sender === 'All Banks' || sender.toLowerCase().includes('cbe')) {
        sender = 'CBEBirr';
      }
      let conversationId = item.conversationId || (sender.toLowerCase().includes('cbe') ? 'CBEBirr' : sender);
      if (conversationId === 'All Banks') {
        conversationId = 'CBEBirr';
      }
      let text = item.text || item.message || item.body || item.sms || '';

      const txnId = item.txnId || item.reference || item.orderId || (item.text?.match(/([A-Z0-9]{8,12})/)?.[1]);
      const amount = item.amount ? String(item.amount) : undefined;
      const balance = item.balance ? String(item.balance) : undefined;
      const recipient = item.recipient || item.receiverName || item.name;
      const recipientAccount = item.recipientAccount || item.receiverAccount || item.rec;
      const fullName = item.fullName || item.user || 'AYMEN NIGATU YIMAM';
      let receiptUrl = item.receiptUrl;

      if (!receiptUrl && txnId && (sender.toLowerCase().includes('cbe') || item.isBank)) {
        receiptUrl = buildOfficialReceiptUrl(
          txnId,
          '0959754788',
          amount,
          recipient,
          fullName,
          recipientAccount
        );
      }

      if (!text) {
        if (item.isDeposit) {
          text = `Dear Customer, you have deposited ${amount || '100.00'}Br. into your CBE Birr account on ${new Date().toLocaleString()} with receipt number ${txnId || 'DJM51SKYIQ'}. Your current balance is ${balance || '500.00'}Br. Thank you!`;
        } else {
          text = `Dear ${fullName}, you have successfully transferred ${amount || '50.00'},Br. to ${recipientAccount || '1000760389289'} - ${recipient || 'Miss Simera Gofer Abdisa'} (Transfer) on ${new Date().toLocaleString()}.Txn ID ${txnId || 'DJM51SKYIQ'}.Your balance is ${balance || '300.00'} Br.Thank You! CBEBirr transaction Receipt. Com ${receiptUrl || 'https://cbepay1.cbe.com.et/aureceipt'}`;
        }
      }

      const msg = smsStore.addMessage({
        sender,
        senderName: sender,
        conversationId,
        text,
        amount,
        balance,
        recipient,
        recipientAccount,
        fullName,
        txnId,
        reference: item.reference || txnId,
        receiptUrl,
        deviceId: item.deviceId || reqDeviceId || 'all',
        isOutgoing: false,
        status: 'delivered',
        isBank: true,
        bankName: sender,
        isDeposit: item.isDeposit,
      });

      createdMessages.push(msg);
    }

    // Also forward to remote webhook in background without blocking
    try {
      fetch(REMOTE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': MASTER_API_KEY,
          'x-device-id': reqDeviceId,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Processed and saved ${createdMessages.length} message(s) successfully`,
      count: createdMessages.length,
      messages: createdMessages,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to process webhook',
      },
      { status: 500 }
    );
  }
}
