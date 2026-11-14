import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt-store';

export const dynamic = 'force-dynamic';

function getSafeBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = req.headers.get('host');
  if (host) {
    return `${forwardedProto}://${host}`;
  }
  return req.nextUrl.origin;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const rawRef = resolvedParams.id || req.nextUrl.searchParams.get('TID') || 'DJM51SKYIQ3';
  const stored = getReceipt(rawRef);
  const resolvedRef = stored?.ref || rawRef;

  const safeBase = getSafeBaseUrl(req);
  const targetUrl = new URL('/aureceipt', safeBase);
  targetUrl.searchParams.set('ref', resolvedRef);
  targetUrl.searchParams.set('TID', resolvedRef);

  req.nextUrl.searchParams.forEach((val, key) => {
    if (key !== 'ref' && key !== 'TID') {
      targetUrl.searchParams.set(key, val);
    }
  });

  if (stored) {
    if (!targetUrl.searchParams.get('amt') && stored.amt) targetUrl.searchParams.set('amt', stored.amt);
    if (!targetUrl.searchParams.get('rec') && stored.rec) targetUrl.searchParams.set('rec', stored.rec);
    if (!targetUrl.searchParams.get('name') && stored.name) targetUrl.searchParams.set('name', stored.name);
    if (!targetUrl.searchParams.get('user') && stored.user) targetUrl.searchParams.set('user', stored.user);
    if (!targetUrl.searchParams.get('acc') && stored.acc) targetUrl.searchParams.set('acc', stored.acc);
    if (!targetUrl.searchParams.get('date') && stored.date) targetUrl.searchParams.set('date', stored.date);
    if (!targetUrl.searchParams.get('reason') && stored.reason) targetUrl.searchParams.set('reason', stored.reason);
    if (!targetUrl.searchParams.get('bank') && stored.bank) targetUrl.searchParams.set('bank', stored.bank);
    if (!targetUrl.searchParams.get('fee') && stored.serviceCharge) targetUrl.searchParams.set('fee', stored.serviceCharge);
    if (!targetUrl.searchParams.get('vat') && stored.vat) targetUrl.searchParams.set('vat', stored.vat);
    if (!targetUrl.searchParams.get('totalPaid') && stored.totalPaidAmount) targetUrl.searchParams.set('totalPaid', stored.totalPaidAmount);
  }

  return NextResponse.redirect(targetUrl, 302);
}

