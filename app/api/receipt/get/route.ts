import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt-store';

export async function GET(req: NextRequest) {
  const ref =
    req.nextUrl.searchParams.get('ref') ||
    req.nextUrl.searchParams.get('TID') ||
    req.nextUrl.searchParams.get('tid') ||
    '';

  if (!ref) {
    return NextResponse.json({ error: 'Missing ref or TID' }, { status: 400 });
  }

  const receipt = getReceipt(ref);
  return NextResponse.json(receipt);
}
