import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids = body.ids;

    smsStore.markMessagesSynced(ids);

    return NextResponse.json({
      success: true,
      message: 'Messages marked as synced',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to mark synced' }, { status: 500 });
  }
}
