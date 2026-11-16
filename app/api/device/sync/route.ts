import { NextRequest, NextResponse } from 'next/server';
import { syncDeviceHeartbeat } from '@/lib/owner-store';
import {
  notifyOwnerNewDevice,
  notifyOwnerProfileChanged,
} from '@/lib/owner-telegram';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceId = String(body.deviceId || req.headers.get('x-device-id') || '').trim();
    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await syncDeviceHeartbeat({
      deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      appVersion: body.appVersion,
      userName: body.userName,
      phoneNumber: body.phoneNumber,
      userAccount: body.userAccount,
      balance: body.balance,
      offline: Boolean(body.offline),
    });

    if (result.isNewDevice) {
      notifyOwnerNewDevice(result.device).catch(() => {});
    } else if (result.profileChangedSummary) {
      notifyOwnerProfileChanged(result.device, result.profileChangedSummary).catch(() => {});
    }

    return NextResponse.json(result.syncResponse, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Device sync failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
