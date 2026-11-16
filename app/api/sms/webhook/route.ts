import { NextRequest, NextResponse } from 'next/server';
import { smsStore, MASTER_API_KEY } from '@/lib/sms-store';
import { buildOfficialReceiptUrl, repairTransferLabelInSmsText, resolveDestBankName } from '@/lib/sms-webhook';

export const dynamic = 'force-dynamic';

const REMOTE_WEBHOOK_URLS = [
  'https://ramussbirr.vercel.app/api/sms/webhook',
  'https://ms-bk-connect.vercel.app/api/sms/webhook',
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || 'dev_galaxy_a12';
  const unsyncedOnly = url.searchParams.get('unsynced') === 'true';

  let messages = smsStore.getAllMessages(deviceId, unsyncedOnly);

  // Sync with persistent backend (ms-bk-connect.vercel.app) to ensure real-time delivery across Vercel Lambdas
  try {
    const remoteRes = await fetch('https://ms-bk-connect.vercel.app/api/sms/messages?deviceId=all', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (remoteRes.ok) {
      const remoteData = await remoteRes.json();
      if (remoteData && Array.isArray(remoteData.messages) && remoteData.messages.length > 0) {
        for (const rm of remoteData.messages) {
          const rawText = rm.text || rm.message || '';
          if (!rawText) continue;
          let urlBank: string | undefined;
          let urlReason: string | undefined;
          if (rm.receiptUrl) {
            try {
              const ru = new URL(rm.receiptUrl);
              urlBank = resolveDestBankName(ru.searchParams.get('bank') || ru.searchParams.get('destBank') || '');
              urlReason = ru.searchParams.get('reason') || undefined;
            } catch {}
          }
          const destBank = resolveDestBankName(rm.destBank) || urlBank;
          const repairedText = repairTransferLabelInSmsText(rawText, {
            transferLabel: rm.transferLabel,
            destBank,
            receiptUrl: rm.receiptUrl,
            recipientAccount: rm.recipientAccount,
          });
          const existsWithoutTransfer = messages.some(
            (m) =>
              m.text === repairedText ||
              (m.txnId &&
                rm.reference &&
                m.txnId === rm.reference &&
                (!/\(\s*Transfer\s*\)/i.test(m.text) || /\(\s*Transfer\s*\)/i.test(repairedText)))
          );
          if (!existsWithoutTransfer) {
            smsStore.addMessage({
              sender: rm.bank || rm.senderName || 'CBEBirr',
              senderName: rm.senderName || 'CBEBirr',
              conversationId: 'CBEBirr',
              text: repairedText,
              amount: rm.amount,
              balance: rm.balance,
              recipient: rm.recipient,
              recipientAccount: rm.recipientAccount,
              fullName: rm.fullName,
              txnId: rm.reference,
              reference: rm.reference,
              receiptUrl: rm.receiptUrl,
              destBank,
              reason: rm.reason || urlReason,
              date: rm.dateTime || rm.date,
              createdAt: rm.receivedAt || Date.now(),
              deviceId: 'all',
              isOutgoing: false,
              status: 'delivered',
              isBank: true,
              bankName: 'CBEBirr',
            });
            messages = smsStore.getAllMessages(deviceId, unsyncedOnly);
          }
        }
      }
    }
  } catch {}

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
      const fullName = item.fullName || item.user || 'Customer';
      const senderPhone = item.userPhone || item.phone || '';
      const rawDestBank = item.destBank || item.bank || '';
      const destBank =
        rawDestBank && !/^(all banks|cbebirr|cbe birr|cbe)$/i.test(String(rawDestBank).trim())
          ? String(rawDestBank).trim()
          : undefined;
      const isPhoneRec = Boolean(recipientAccount && (String(recipientAccount).startsWith('09') || String(recipientAccount).startsWith('07')));
      const transferLabel =
        (item.transferLabel && String(item.transferLabel).trim()) ||
        destBank ||
        (isPhoneRec ? 'CBEBirr' : 'CBE');
      let receiptUrl = item.receiptUrl;

      if (!receiptUrl && txnId && (sender.toLowerCase().includes('cbe') || item.isBank)) {
        receiptUrl = buildOfficialReceiptUrl(
          txnId,
          senderPhone,
          amount,
          recipient,
          fullName,
          recipientAccount,
          item.date,
          item.reason || (destBank ? `Transfer to ${destBank}` : undefined),
          destBank
        );
      }

      if (!text) {
        if (item.isDeposit) {
          text = `Dear Customer, you have deposited ${amount || '100.00'}Br. into your CBE Birr account on ${new Date().toLocaleString()} with receipt number ${txnId || 'DJM51SKYIQ'}. Your current balance is ${balance || '500.00'}Br. Thank you!`;
        } else {
          text = `Dear ${fullName}, you have successfully transferred ${amount || '50.00'},Br. to ${recipientAccount || ''} - ${recipient || 'CBE Customer'} (${transferLabel}) on ${new Date().toLocaleString()}.Txn ID ${txnId || 'DJM51SKYIQ'}.Your balance is ${balance || '500.00'} Br.Thank You! CBEBirr transaction Receipt. Com ${receiptUrl || 'https://cbepay1.cbe.com.et/aureceipt'}`;
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
        date: item.date,
        createdAt: item.createdAt || Date.now(),
        deviceId: item.deviceId || reqDeviceId || 'all',
        isOutgoing: false,
        status: 'delivered',
        isBank: true,
        bankName: sender,
        destBank,
        transferLabel,
        reason: item.reason || (destBank ? `Transfer to ${destBank}` : undefined),
        creditAccountType: item.creditAccountType,
        isDeposit: item.isDeposit,
      });

      createdMessages.push(msg);
    }

    // Also forward to remote webhooks in background without blocking
    // Ensuring both dev_galaxy_a12 and all receive it so SamsungMessages.apk triggers notification immediately!
    try {
      const galaxyPayload = Array.isArray(payload)
        ? payload.map((p: any) => ({ ...p, deviceId: 'dev_galaxy_a12' }))
        : { ...payload, deviceId: 'dev_galaxy_a12' };

      for (const remoteUrl of REMOTE_WEBHOOK_URLS) {
        // Forward for dev_galaxy_a12
        fetch(remoteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': MASTER_API_KEY,
            'x-device-id': 'dev_galaxy_a12',
          },
          body: JSON.stringify(galaxyPayload),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {});

        // Forward for all
        fetch(remoteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': MASTER_API_KEY,
            'x-device-id': 'all',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {});
      }
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
