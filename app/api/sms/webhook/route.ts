import { NextRequest, NextResponse } from 'next/server';

const REMOTE_WEBHOOK_URL = 'https://ms-bk-connect.vercel.app/api/sms/webhook';
const API_KEY = 'Ram69';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const deviceId = req.headers.get('x-device-id') || 'all';
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-device-id': deviceId,
    };

    let finalPayload = payload;
    if (payload && typeof payload === 'object') {
      if (Array.isArray(payload)) {
        finalPayload = payload.map((p) => ({
          senderName: p.senderName || 'CBEBirr',
          deviceId: p.deviceId || deviceId,
          ...p,
        }));
      } else {
        finalPayload = {
          senderName: payload.senderName || 'CBEBirr',
          deviceId: payload.deviceId || deviceId,
          ...payload,
        };
      }
    }
    const bodyStr = JSON.stringify(finalPayload);

    // Forward directly to remote webhook
    const res = await fetch(REMOTE_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(6000),
    });

    let data: any = null;
    if (res.ok) {
      data = await res.json().catch(() => ({}));
    }

    const count = data?.count || (Array.isArray(payload) ? payload.length : 1);

    return NextResponse.json({
      success: true,
      message: data?.message || `Sent ${count} SMS message(s) to webhook`,
      count,
      remote: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to dispatch SMS webhook',
      },
      { status: 500 }
    );
  }
}
