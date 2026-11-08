import { NextRequest, NextResponse } from 'next/server';
import { smsStore } from '@/lib/sms-store';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || 'dev_galaxy_a12';
  const unsyncedOnly = url.searchParams.get('unsynced') === 'true';
  const conversationId = url.searchParams.get('conversationId');

  let messages = smsStore.getAllMessages(deviceId, unsyncedOnly);
  if (conversationId) {
    messages = messages.filter(
      (m) => m.conversationId.trim().toLowerCase() === conversationId.trim().toLowerCase()
    );
  }

  const conversations = smsStore.getConversations();

  return NextResponse.json({
    success: true,
    count: messages.length,
    deviceId,
    conversations,
    messages,
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const ids = body.ids || (url.searchParams.get('id') ? [url.searchParams.get('id')!] : undefined);

    if (ids && Array.isArray(ids) && ids.length > 0) {
      smsStore.deleteMessages(ids);
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} messages` });
    }

    if (body.reset || url.searchParams.get('reset') === 'true') {
      smsStore.resetToSeeds();
      return NextResponse.json({ success: true, message: 'Reset messages queue to authentic seeds' });
    }

    smsStore.clearAllMessages();
    return NextResponse.json({ success: true, message: 'Cleared all messages' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete' }, { status: 500 });
  }
}
