import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const targetUrl = new URL('/official-receipt', req.url);
  searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  return NextResponse.redirect(targetUrl, 302);
}
