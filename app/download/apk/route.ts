import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetApp = searchParams.get('app') || 'messages';
  const filename = targetApp === 'cbebirr' ? 'cbebirr-plus.apk' : 'SamsungMessages.apk';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost && !forwardedHost.includes('0.0.0.0') ? `${forwardedProto}://${forwardedHost}` : 'http://localhost:3000';
  return NextResponse.redirect(new URL(`/${filename}`, host), 302);
}
