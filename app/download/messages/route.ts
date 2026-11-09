import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost && !forwardedHost.includes('0.0.0.0') ? `${forwardedProto}://${forwardedHost}` : 'http://localhost:3000';
  return NextResponse.redirect(new URL('/SamsungMessages.apk', host), 302);
}
