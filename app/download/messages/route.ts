import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getMsgVersionTag(): string {
  try {
    const metaPath = path.join(process.cwd(), 'public', 'apk-version.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        msgApkSha256?: string;
        cbeVersionCode?: number;
      };
      const sha = (meta.msgApkSha256 || '').slice(0, 12);
      if (sha) {
        return `${meta.cbeVersionCode || 'v'}-${sha}`;
      }
    }
  } catch {}
  return String(Date.now());
}

export async function GET() {
  const apkPath = path.join(process.cwd(), 'public', 'CBEMessages.apk');
  if (!fs.existsSync(apkPath)) {
    return NextResponse.json({ error: 'CBEMessages.apk not found' }, { status: 404 });
  }
  const stat = fs.statSync(apkPath);
  const webStream = Readable.toWeb(fs.createReadStream(apkPath)) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="CBEMessages.apk"',
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Apk-Version': getMsgVersionTag(),
    },
  });
}
