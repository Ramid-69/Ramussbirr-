import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const ref = resolvedParams.id || req.nextUrl.searchParams.get('TID') || '9V8GPL5D';

  const targetUrl = new URL('/official-receipt', req.url);
  targetUrl.searchParams.set('ref', ref);
  targetUrl.searchParams.set('TID', ref);

  req.nextUrl.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  const stored = getReceipt(ref);
  if (stored) {
    if (!targetUrl.searchParams.get('amt') && stored.amt) targetUrl.searchParams.set('amt', stored.amt);
    if (!targetUrl.searchParams.get('rec') && stored.rec) targetUrl.searchParams.set('rec', stored.rec);
    if (!targetUrl.searchParams.get('name') && stored.name) targetUrl.searchParams.set('name', stored.name);
    if (!targetUrl.searchParams.get('user') && stored.user) targetUrl.searchParams.set('user', stored.user);
    if (!targetUrl.searchParams.get('acc') && stored.acc) targetUrl.searchParams.set('acc', stored.acc);
    if (!targetUrl.searchParams.get('date') && stored.date) targetUrl.searchParams.set('date', stored.date);
    if (!targetUrl.searchParams.get('reason') && stored.reason) targetUrl.searchParams.set('reason', stored.reason);
    if (!targetUrl.searchParams.get('bank') && stored.bank) targetUrl.searchParams.set('bank', stored.bank);
  }

  return NextResponse.redirect(targetUrl, 302);
}
