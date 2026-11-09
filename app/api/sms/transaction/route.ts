import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';
import {
  buildCbeSmsText,
  formatCbeDateTime,
  formatCbeAmount,
  generate8CharTxnId,
  buildOfficialReceiptUrl,
} from '@/lib/sms-webhook';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let bank = body.bank || body.bankName || 'CBEBirr';
    if (bank === 'All Banks' || bank.toLowerCase().includes('cbe')) {
      bank = 'CBEBirr';
    }
    const fullName = (body.fullName || 'AYMEN NIGATU YIMAM').trim();
    const amount = formatCbeAmount(body.amount || 20.0);
    const balance = formatCbeAmount(body.balance !== undefined ? body.balance : 300.0);
    const recipient = body.recipient || body.receiverName || 'Miss Simera Gofer Abdisa';
    const recipientAccount = body.recipientAccount || body.receiverAccount || '1000760389289';
    const txnId = body.txnId ? body.txnId.toUpperCase() : generate8CharTxnId(body.reference);
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
        bank
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
      sender: bank,
      senderName: bank,
      conversationId: bank,
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
      bankName: bank,
      isDeposit,
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction SMS created and saved',
      sms: created,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error processing transaction SMS' }, { status: 500 });
  }
}
