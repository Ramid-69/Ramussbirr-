import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt-store';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const targetUrl = new URL('/official-receipt', req.url);

  searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  const ref =
    searchParams.get('TID') ||
    searchParams.get('ref') ||
    searchParams.get('tid') ||
    '';

  if (ref) {
    const stored = getReceipt(ref);
    if (stored) {
      if (!targetUrl.searchParams.get('ref')) targetUrl.searchParams.set('ref', stored.ref);
      if (!targetUrl.searchParams.get('TID')) targetUrl.searchParams.set('TID', stored.ref);
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
  }

  return NextResponse.redirect(targetUrl, 302);
}
