import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function readHashedPageChunk(): string {
  try {
    const manifestPath = path.join(process.cwd(), '.next', 'app-build-manifest.json');
    if (!fs.existsSync(manifestPath)) return '';
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as { pages?: Record<string, string[]> };
    const pageAssets = parsed?.pages?.['/page'] || [];
    const match = pageAssets.find((item) => /static\/chunks\/app\/page-[0-9a-f]+\.js$/i.test(item));
    return match ? path.basename(match) : '';
  } catch {
    return '';
  }
}

export async function GET() {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '';
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || '';
  const pageChunk = readHashedPageChunk();
  const buildSignature = [commitSha, deploymentId, pageChunk].filter(Boolean).join(':') || 'live';

  return NextResponse.json(
    {
      buildSignature,
      commitSha,
      deploymentId,
      pageChunk,
      ts: Date.now(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
