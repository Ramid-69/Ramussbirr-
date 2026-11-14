import { NextRequest, NextResponse } from 'next/server';
import { saveReceipt, StoredReceipt } from '@/lib/receipt-store';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StoredReceipt;
    if (!body || !body.ref) {
      return NextResponse.json({ error: 'Missing ref' }, { status: 400, headers: CORS_HEADERS });
    }
    saveReceipt(body);
    return NextResponse.json({ success: true, ref: body.ref }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500, headers: CORS_HEADERS });
  }
}

