import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';

export const dynamic = 'force-dynamic';
import {
  formatCbeDateTime,
  formatCbeAmount,
  generate8CharTxnId,
  buildOfficialReceiptUrl,
} from '@/lib/sms-webhook';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = (body.fullName || 'AYMEN NIGATU YIMAM').trim();
    const amount = formatCbeAmount(body.amount || 300.0);
    const balance = formatCbeAmount(body.balance !== undefined ? body.balance : 3.99);
    const recipient = body.recipient || body.receiverName || 'SANI AHMED MOHAMMED';
    const recipientAccount = body.recipientAccount || body.receiverAccount || '1000440979843';
    const txnId = body.txnId ? body.txnId.toUpperCase() : generate8CharTxnId();
    const dateTimeStr = formatCbeDateTime(body.date);
    const isDeposit = !!body.isDeposit;

    let receiptUrl = body.receiptUrl;
    if (!receiptUrl) {
      receiptUrl = buildOfficialReceiptUrl(
        txnId,
        '0959754788',
        amount,
        recipient,
        fullName,
        recipientAccount,
        dateTimeStr,
        isDeposit ? 'Deposit to CBE Birr' : 'Customer transfer to CBE account',
        'CBEBirr'
      );
    }

    let text = body.text;
    if (!text) {
      if (isDeposit) {
        text = `Dear Customer, you have deposited ${amount}Br. into your CBE Birr account on ${dateTimeStr} with receipt number ${txnId}. Your current balance is ${balance}Br. Thank you!`;
      } else {
        text = `Dear ${fullName}, you have successfully transferred ${amount},Br. to ${recipientAccount} - ${recipient} (Transfer) on ${dateTimeStr}.Txn ID ${txnId}.Your balance is ${balance} Br.Thank You! CBEBirr transaction Receipt. Com ${receiptUrl}`;
      }
    }

    const created = smsStore.addMessage({
      sender: 'CBEBirr',
      senderName: 'CBEBirr',
      conversationId: 'CBEBirr',
      text,
      amount,
      balance,
      recipient,
      recipientAccount,
      fullName,
      txnId,
      reference: body.reference || txnId,
      receiptUrl,
      deviceId: body.deviceId || 'all',
      isBank: true,
      bankName: 'CBEBirr',
      isDeposit,
    });

    return NextResponse.json({
      success: true,
      message: 'Instant CBEBirr SMS created and saved',
      sms: created,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error processing CBEBirr SMS' }, { status: 500 });
  }
}
