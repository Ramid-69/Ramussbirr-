import { NextRequest, NextResponse } from 'next/server';
import { OWNER_PIN } from '@/lib/owner-types';
import {
  clearNotificationsHistory,
  createOwnerNotification,
  getOwnerDashboardSnapshot,
  removeDeviceRecord,
  setDeviceLock,
  setGlobalLock,
} from '@/lib/owner-store';
import { sendTelegramMessage } from '@/lib/owner-telegram';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-owner-pin',
  'Cache-Control': 'no-store',
};

function isAuthorized(req: NextRequest, bodyPin?: unknown): boolean {
  const headerPin = req.headers.get('x-owner-pin') || '';
  const queryPin = new URL(req.url).searchParams.get('pin') || '';
  return headerPin === OWNER_PIN || queryPin === OWNER_PIN || bodyPin === OWNER_PIN;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: CORS_HEADERS }
    );
  }
  const snapshot = await getOwnerDashboardSnapshot(true);
  return NextResponse.json({ success: true, ...snapshot }, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!isAuthorized(req, body.ownerPin)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const action = String(body.action || '');

    if (action === 'lock_all' || action === 'unlock_all') {
      const locked = action === 'lock_all';
      const config = await setGlobalLock(locked, 'app_0069', body.message);
      sendTelegramMessage(
        locked
          ? `🔒 <b>ALL devices LOCKED</b> via App Owner (<code>0069</code>).`
          : `🔓 <b>ALL devices UNLOCKED</b> via App Owner (<code>0069</code>).`
      ).catch(() => {});
      return NextResponse.json({ success: true, globalConfig: config }, { headers: CORS_HEADERS });
    }

    if (action === 'lock_device' || action === 'unlock_device') {
      const locked = action === 'lock_device';
      const device = await setDeviceLock(String(body.deviceId || ''), locked, body.reason);
      if (!device) {
        return NextResponse.json(
          { success: false, error: 'Device not found' },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      const esc = (s: string) =>
        String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      sendTelegramMessage(
        `${locked ? '🔒 LOCKED' : '🔓 UNLOCKED'} device <b>${esc(device.deviceName)}</b> (<code>${esc(device.deviceId)}</code>) via App Owner (<code>0069</code>).`
      ).catch(() => {});
      return NextResponse.json({ success: true, device }, { headers: CORS_HEADERS });
    }

    if (action === 'send_notification') {
      const msg = String(body.message || '').trim();
      if (!msg) {
        return NextResponse.json(
          { success: false, error: 'Notification message is required' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const dur = Math.max(1, Math.min(86400, Number(body.durationSeconds) || 30));
      const notif = await createOwnerNotification({
        targetDeviceId: String(body.targetDeviceId || 'all'),
        title: String(body.title || 'CBEBirr'),
        message: msg,
        durationSeconds: dur,
        sentBy: 'app_0069',
      });
      const esc = (s: string) =>
        String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      sendTelegramMessage(
        `📢 <b>Notification sent via App Owner (<code>0069</code>)</b>\nTarget: <code>${esc(notif.targetDeviceId)}</code> • Duration: ${notif.durationSeconds}s\nMessage: ${esc(notif.message)}`
      ).catch(() => {});
      return NextResponse.json({ success: true, notification: notif }, { headers: CORS_HEADERS });
    }

    if (action === 'delete_device') {
      const deleted = await removeDeviceRecord(String(body.deviceId || ''));
      return NextResponse.json({ success: true, deleted }, { headers: CORS_HEADERS });
    }

    if (action === 'clear_notifications') {
      await clearNotificationsHistory();
      return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Control action failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
