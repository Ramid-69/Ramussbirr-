import { NextRequest, NextResponse } from 'next/server';
import { logDeviceTransaction } from '@/lib/owner-store';
import { notifyOwnerTransaction } from '@/lib/owner-telegram';

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
    const deviceId = String(body.deviceId || req.headers.get('x-device-id') || 'unknown_device').trim();

    const { tx, device } = await logDeviceTransaction({
      txId: body.txId,
      deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      appVersion: body.appVersion,
      senderName: body.senderName,
      senderPhone: body.senderPhone,
      senderAccount: body.senderAccount,
      title: body.title,
      txType: body.txType,
      amount: body.amount ?? 0,
      totalDeducted: body.totalDeducted,
      balanceAfter: body.balanceAfter,
      recipientName: body.recipientName,
      recipientAccount: body.recipientAccount,
      destBank: body.destBank,
      transferLabel: body.transferLabel,
      ref: body.ref,
      reason: body.reason,
      status: body.status,
    });

    // Push instant real-time transaction alert to owner's Telegram
    notifyOwnerTransaction(tx, device).catch(() => {});

    return NextResponse.json(
      { success: true, txId: tx.txId, deviceId: tx.deviceId },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Transaction telemetry failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
