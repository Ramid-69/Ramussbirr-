import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const app = searchParams.get('app');
    const isMessages = app === 'messages' || app === 'samsung';
    const filename = isMessages ? 'SamsungMessages.apk' : 'cbebirr-plus.apk';
    const outputName = isMessages ? 'SamsungMessages.apk' : 'CBEBirrPlus.apk';

    const filePath = path.join(process.cwd(), 'public', filename);
    if (!fs.existsSync(filePath)) {
      return new NextResponse('APK file not found', { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${outputName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return new NextResponse(`Error: ${err?.message || 'Failed to download'}`, { status: 500 });
  }
}
