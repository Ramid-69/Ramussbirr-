import { NextRequest, NextResponse } from 'next/server';

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

  return NextResponse.redirect(targetUrl, 302);
}
