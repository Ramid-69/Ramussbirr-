import { NextRequest, NextResponse } from 'next/server';

const REMOTE_WEBHOOK_URL = 'https://ms-bk-connect.vercel.app/api/sms/webhook';
const API_KEY = 'Ram69';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const response = await fetch(REMOTE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          message: data?.message || 'Remote webhook rejected request',
          data,
        },
        { status: response.status }
      );
    }

    const count = data?.count || (Array.isArray(payload) ? payload.length : 1);

    return NextResponse.json({
      success: true,
      message: data?.message || `Sent ${count} SMS message(s) to Samsung Messages app`,
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
