import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthorizedChatId,
  getTelegramWebhookInfo,
  handleTelegramWebhookUpdate,
} from '@/lib/owner-telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const webhookInfo = configured ? await getTelegramWebhookInfo() : null;
  return NextResponse.json({
    ok: true,
    configured,
    authorizedChatId: getAuthorizedChatId(),
    webhookUrl: webhookInfo?.result?.url || null,
    pendingUpdates: webhookInfo?.result?.pending_update_count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: true });
    }
    await handleTelegramWebhookUpdate(update);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
