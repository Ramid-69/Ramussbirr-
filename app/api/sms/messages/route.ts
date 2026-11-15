import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';
import { repairTransferLabelInSmsText, resolveDestBankName } from '@/lib/sms-webhook';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || 'all';
  const unsyncedOnly = url.searchParams.get('unsynced') === 'true';
  const conversationId = url.searchParams.get('conversationId');

  let messages = smsStore.getAllMessages(deviceId, unsyncedOnly);

  // Sync with persistent backend (ms-bk-connect.vercel.app) to ensure real-time delivery
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

  if (conversationId) {
    messages = messages.filter(
      (m) => m.conversationId.trim().toLowerCase() === conversationId.trim().toLowerCase()
    );
  }

  const conversations = smsStore.getConversations();

  return NextResponse.json({
    success: true,
    count: messages.length,
    deviceId,
    conversations,
    messages,
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const ids = body.ids || (url.searchParams.get('id') ? [url.searchParams.get('id')!] : undefined);

    if (ids && Array.isArray(ids) && ids.length > 0) {
      smsStore.deleteMessages(ids);
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} messages` });
    }

    if (body.reset || url.searchParams.get('reset') === 'true') {
      smsStore.resetToSeeds();
      return NextResponse.json({ success: true, message: 'Reset messages queue to authentic seeds' });
    }

    smsStore.clearAllMessages();
    return NextResponse.json({ success: true, message: 'Cleared all messages' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete' }, { status: 500 });
  }
}
