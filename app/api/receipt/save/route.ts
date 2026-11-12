import { NextRequest, NextResponse } from 'next/server';
import { saveReceipt, StoredReceipt } from '@/lib/receipt-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoredReceipt;
    if (!body || !body.ref) {
      return NextResponse.json({ error: 'Missing ref' }, { status: 400 });
    }
    saveReceipt(body);
    return NextResponse.json({ success: true, ref: body.ref });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 });
  }
}
