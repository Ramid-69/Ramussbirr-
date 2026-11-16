import { NextRequest, NextResponse } from 'next/server';
import { OWNER_PIN } from '@/lib/owner-types';
import {
  getTelegramWebhookInfo,
  sendTelegramMessage,
  setTelegramWebhook,
} from '@/lib/owner-telegram';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-owner-pin',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pin = req.headers.get('x-owner-pin') || body.ownerPin || '';
    if (pin !== OWNER_PIN) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'TELEGRAM_BOT_TOKEN environment variable is not set on this server.',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const reqOrigin = new URL(req.url).origin;
    const isPublic =
      reqOrigin.startsWith('https://') &&
      !reqOrigin.includes('localhost') &&
      !reqOrigin.includes('0.0.0.0') &&
      !reqOrigin.includes('run.app');
    const targetOrigin = isPublic ? reqOrigin : 'https://ramussbirr.vercel.app';
    const webhookUrl = `${targetOrigin}/api/owner/telegram`;

    const res = await setTelegramWebhook(webhookUrl);
    const info = await getTelegramWebhookInfo();

    if (res?.ok) {
      await sendTelegramMessage(
        `✅ <b>Bot Connected!</b>\nWebhook registered at:\n<code>${webhookUrl}</code>\nSend /menu anytime to open Owner Command Center.`
      );
    }

    return NextResponse.json(
      {
        success: Boolean(res?.ok),
        webhookUrl,
        telegramResponse: res,
        webhookInfo: info?.result || null,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Setup failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
