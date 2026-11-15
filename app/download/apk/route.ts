import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getVersionTag(isCbe: boolean): string {
  try {
    const metaPath = path.join(process.cwd(), 'public', 'apk-version.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        cbeApkSha256?: string;
        msgApkSha256?: string;
        cbeVersionCode?: number;
      };
      const sha = (isCbe ? meta.cbeApkSha256 : meta.msgApkSha256)?.slice(0, 12);
      if (sha) {
        return `${meta.cbeVersionCode || 'v'}-${sha}`;
      }
    }
  } catch {}
  return String(Date.now());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetApp = searchParams.get('app') || 'messages';
  const isCbe = targetApp === 'cbe' || targetApp === 'cbebirr' || targetApp === 'banking';
  const filename = isCbe ? 'cbebirr-plus.apk' : 'CBEMessages.apk';
  const target = new URL(`/${filename}?v=${encodeURIComponent(getVersionTag(isCbe))}`, req.url);
  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
