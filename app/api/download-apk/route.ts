import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const apkPath = path.join(process.cwd(), 'public', 'cbebirr-plus.apk');
  if (!fs.existsSync(apkPath)) {
    return new NextResponse('APK file not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(apkPath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="cbebirr-plus.apk"',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
