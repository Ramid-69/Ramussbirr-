import { NextRequest, NextResponse } from 'next/server';
import { getReceipt, extractReceiptRef, ORIGINAL_QR_TID } from '@/lib/receipt-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') || '';
  const ref =
    req.nextUrl.searchParams.get('ref') ||
    req.nextUrl.searchParams.get('TID') ||
    req.nextUrl.searchParams.get('tid') ||
    (rawUrl ? extractReceiptRef(rawUrl) : '') ||
    ORIGINAL_QR_TID;

  const receipt = getReceipt(ref);
  return NextResponse.json(receipt, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

