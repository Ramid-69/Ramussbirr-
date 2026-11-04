import { NextRequest, NextResponse } from 'next/server';

interface ReceiverEvent {
  account: string;
  name: string;
  amount?: string;
  rawText?: string;
  timestamp: number;
}

// In-memory store for recent receiver events (retained for 10 minutes)
const receiverStore: Map<string, ReceiverEvent> = new Map();
let latestEvent: ReceiverEvent | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Support flexible field names from MacroDroid HTTP Post Action
    const name = (
      body.name ||
      body.receiverName ||
      body.fullName ||
      body.recipient ||
      body.customerName ||
      ''
    ).trim();

    let account = (
      body.account ||
      body.accountNumber ||
      body.receiverAccount ||
      body.acc ||
      ''
    ).replace(/\D/g, '');

    const amount = (body.amount || body.amt || '').toString().trim();
    const rawText = (body.text || body.message || body.ussdText || '').trim();

    if (!name && !rawText) {
      return NextResponse.json(
        { success: false, error: 'Recipient name or ussdText is required' },
        { status: 400 }
      );
    }

    // Extract receiver name from CBEBirr USSD text (e.g. "AccountName : FOZIA MOSSA  MOHAMMED")
    let resolvedName = name;
    if (!resolvedName && rawText) {
      const match =
        rawText.match(/Account\s*Name\s*:\s*([A-Za-z\u1200-\u137F\s]+?)(?:\r?\n|Bank\s*Account|1\s*OK|0\s*Cancel|$)/i) ||
        rawText.match(/(?:Transfer\s+to|ወደ|ለ)\s+([A-Za-z\u1200-\u137F\s]+?)(?:\?|\.|\r?\n|\s*\d:|$)/i) ||
        rawText.match(/\b([A-Z]{3,15}\s+[A-Z]{3,15}(?:\s+[A-Z]{3,15})?)\b/);

      if (match && match[1]) {
        const candidate = match[1].replace(/\s+/g, ' ').trim();
        if (!candidate.toLowerCase().includes('bank account') && !candidate.toLowerCase().includes('accountname')) {
          resolvedName = candidate;
        }
      }
    }

    if (!account && rawText) {
      const accMatch = rawText.match(/Bank\s*Account\s*:\s*(\d{10,16})/i);
      if (accMatch && accMatch[1]) {
        account = accMatch[1];
      }
    }

    const event: ReceiverEvent = {
      account,
      name: resolvedName,
      amount,
      rawText,
      timestamp: Date.now(),
    };

    latestEvent = event;
    if (account) {
      receiverStore.set(account, event);
    }

    return NextResponse.json({
      success: true,
      message: `Receiver name [${resolvedName}] received and broadcasted successfully`,
      data: event,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process receiver webhook' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account = (searchParams.get('account') || '').replace(/\D/g, '');
  const clear = searchParams.get('clear') === 'true';

  let found: ReceiverEvent | null = null;

  if (account && receiverStore.has(account)) {
    found = receiverStore.get(account)!;
    if (clear) receiverStore.delete(account);
  } else if (latestEvent && Date.now() - latestEvent.timestamp < 300000) {
    found = latestEvent;
    if (clear) latestEvent = null;
  }

  return NextResponse.json({
    success: true,
    hasReceiver: !!found,
    event: found,
  });
}
