import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getVersionTag(isMessages: boolean): string {
  try {
    const metaPath = path.join(process.cwd(), 'public', 'apk-version.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        cbeApkSha256?: string;
        msgApkSha256?: string;
        cbeVersionCode?: number;
      };
      const sha = (isMessages ? meta.msgApkSha256 : meta.cbeApkSha256)?.slice(0, 12);
      if (sha) {
        return `${meta.cbeVersionCode || 'v'}-${sha}`;
      }
    }
  } catch {}
  return String(Date.now());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const app = searchParams.get('app');
  const isMessages = app === 'messages' || app === 'samsung';
  const filename = isMessages ? 'SamsungMessages.apk' : 'cbebirr-plus.apk';
  const target = new URL(`/${filename}?v=${encodeURIComponent(getVersionTag(isMessages))}`, req.url);
  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
