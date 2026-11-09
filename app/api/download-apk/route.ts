import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const app = searchParams.get('app');
  const filename = app === 'messages' || app === 'samsung' ? 'SamsungMessages.apk' : 'cbebirr-plus.apk';

  const apkPath = path.join(process.cwd(), 'public', filename);
  if (!fs.existsSync(apkPath)) {
    return new NextResponse('APK file not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(apkPath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length.toString(),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
