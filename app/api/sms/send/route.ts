import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sender = body.sender || body.senderName || 'CBEBirr';
    const text = body.text || body.message || body.body || '';

    if (!text && !body.amount) {
      return NextResponse.json({ success: false, error: 'Text or amount is required' }, { status: 400 });
    }

    const newMsg = smsStore.addMessage({
      sender,
      senderName: sender,
      conversationId: body.conversationId || sender,
      text,
      amount: body.amount ? String(body.amount) : undefined,
      balance: body.balance ? String(body.balance) : undefined,
      recipient: body.recipient || body.receiverName,
      recipientAccount: body.recipientAccount || body.receiverAccount,
      fullName: body.fullName || 'AYMEN NIGATU YIMAM',
      txnId: body.txnId,
      receiptUrl: body.receiptUrl,
      deviceId: body.deviceId || 'all',
      isOutgoing: !!body.isOutgoing,
      isBank: body.isBank ?? true,
      bankName: body.bankName || sender,
      isDeposit: body.isDeposit,
    });

    return NextResponse.json({
      success: true,
      message: 'SMS message created successfully',
      sms: newMsg,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error sending SMS' }, { status: 500 });
  }
}
