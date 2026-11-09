import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const app = searchParams.get('app');
  const filename = app === 'messages' || app === 'samsung' ? 'SamsungMessages.apk' : 'cbebirr-plus.apk';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost && !forwardedHost.includes('0.0.0.0') ? `${forwardedProto}://${forwardedHost}` : 'http://localhost:3000';
  return NextResponse.redirect(new URL(`/${filename}`, host), 302);
}
