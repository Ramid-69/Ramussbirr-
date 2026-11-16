'use client';

import {
  DevicePlatform,
  DeviceSyncResponse,
  OWNER_PIN,
  OwnerDashboardSnapshot,
  OwnerNotification,
  getOwnerApiBaseUrl,
} from './owner-types';

const DEVICE_ID_STORAGE_KEY = 'cbebirr_owner_device_id';
const LOCK_CACHE_KEY = 'cbebirr_remote_lock_cache';
const SEEN_NOTIFS_KEY = 'cbebirr_seen_owner_notifs';

export interface CachedLockState {
  locked: boolean;
  message: string;
  updatedAtMs: number;
}

export function getOrCreateOwnerDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_\-]{6,64}$/.test(existing)) {
      return existing;
    }
    const rand = Math.random().toString(36).slice(2, 8);
    const ts = Date.now().toString(36).slice(-5);
    const created = `dev_${ts}${rand}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'dev_browser_tmp';
  }
}

export function detectDeviceInfo(): {
  deviceName: string;
  platform: DevicePlatform;
  appVersion: string;
} {
  if (typeof window === 'undefined') {
    return { deviceName: 'Server', platform: 'web', appVersion: '1.0.85' };
  }
  const ua = navigator.userAgent || '';
  const isApk =
    window.location?.origin?.includes('appassets.androidplatform.net') ||
    window.location?.protocol === 'file:' ||
    Boolean((window as any).AndroidBridge || (window as any).AndroidSMSBridge || (window as any).Android);

  const isPwa =
    !isApk &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as any).standalone));

  const platform: DevicePlatform = isApk ? 'android-apk' : isPwa ? 'web-pwa' : 'web';

  let model = '';
  const androidModelMatch = ua.match(/Android\s+[^;)]+;\s*([^;)]+?)(?:\s+Build\/|[;)])/i);
  if (androidModelMatch?.[1]) {
    const candidate = androidModelMatch[1].trim();
    model = candidate === 'K' || candidate.length <= 1 ? 'Android Phone' : candidate;
  } else if (/Android/i.test(ua)) {
    model = 'Android Phone';
  } else if (/iPhone|iPad/i.test(ua)) {
    model = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Windows/i.test(ua)) {
    model = 'Windows PC';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    model = 'Mac';
  } else if (/Linux/i.test(ua)) {
    model = 'Linux';
  } else {
    model = 'Web Device';
  }

  const tag = platform === 'android-apk' ? 'APK' : platform === 'web-pwa' ? 'PWA' : 'Web';
  const deviceName = `${model} (${tag})`.slice(0, 115);

  return {
    deviceName,
    platform,
    appVersion: '1.0.87',
  };
}

export function getCachedLockState(): CachedLockState {
  if (typeof window === 'undefined') {
    return { locked: false, message: '', updatedAtMs: 0 };
  }
  try {
    const raw = localStorage.getItem(LOCK_CACHE_KEY);
    if (!raw) return { locked: false, message: '', updatedAtMs: 0 };
    const parsed = JSON.parse(raw);
    return {
      locked: Boolean(parsed.locked),
      message: String(parsed.message || ''),
      updatedAtMs: Number(parsed.updatedAtMs) || 0,
    };
  } catch {
    return { locked: false, message: '', updatedAtMs: 0 };
  }
}

function saveCachedLockState(next: CachedLockState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCK_CACHE_KEY, JSON.stringify(next));
  } catch {}
}

export function getSeenNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_NOTIFS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markNotificationSeen(notifId: string): void {
  if (typeof window === 'undefined' || !notifId) return;
  try {
    const set = getSeenNotificationIds();
    set.add(notifId);
    const list = Array.from(set).slice(-120);
    localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(list));
  } catch {}
}

export async function syncDeviceTelemetry(profile: {
  userName: string;
  phoneNumber: string;
  userAccount: string;
  balance: number;
}): Promise<{
  lockState: CachedLockState;
  newNotifications: OwnerNotification[];
} | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      lockState: getCachedLockState(),
      newNotifications: [],
    };
  }

  const deviceId = getOrCreateOwnerDeviceId();
  const info = detectDeviceInfo();
  const baseUrl = getOwnerApiBaseUrl();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

  try {
    const res = await fetch(`${baseUrl}/api/device/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        deviceId,
        deviceName: info.deviceName,
        platform: info.platform,
        appVersion: info.appVersion,
        userName: profile.userName,
        phoneNumber: profile.phoneNumber,
        userAccount: profile.userAccount,
        balance: profile.balance,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as DeviceSyncResponse;
    if (!data?.success) return null;

    const lockState: CachedLockState = {
      locked: Boolean(data.effectiveLocked),
      message: data.lockMessage || 'App locked by administrator.',
      updatedAtMs: Date.now(),
    };
    saveCachedLockState(lockState);

    const seen = getSeenNotificationIds();
    const refNowMs = Number(data.serverTimeMs) || Date.now();
    const newNotifications = (data.notifications || []).filter((n) => {
      if (!n?.notifId || seen.has(n.notifId)) return false;
      const deliveryDeadlineMs = Math.max(n.expiresAtMs || 0, (n.createdAtMs || 0) + 3_600_000);
      return deliveryDeadlineMs > refNowMs;
    });

    return { lockState, newNotifications };
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function sendOfflineBeacon(profile: {
  userName: string;
  phoneNumber: string;
  userAccount: string;
  balance: number;
}): void {
  if (typeof window === 'undefined' || !navigator.sendBeacon) return;
  try {
    const deviceId = getOrCreateOwnerDeviceId();
    const info = detectDeviceInfo();
    const baseUrl = getOwnerApiBaseUrl();
    const blob = new Blob(
      [
        JSON.stringify({
          deviceId,
          deviceName: info.deviceName,
          platform: info.platform,
          appVersion: info.appVersion,
          userName: profile.userName,
          phoneNumber: profile.phoneNumber,
          userAccount: profile.userAccount,
          balance: profile.balance,
          offline: true,
        }),
      ],
      { type: 'application/json' }
    );
    navigator.sendBeacon(`${baseUrl}/api/device/sync`, blob);
  } catch {}
}

export async function reportDeviceTransaction(params: {
  txId?: string;
  senderName: string;
  senderPhone: string;
  senderAccount: string;
  title: string;
  txType: 'debit' | 'credit';
  amount: number;
  totalDeducted?: number;
  balanceAfter: number;
  recipientName: string;
  recipientAccount: string;
  destBank?: string;
  transferLabel: string;
  ref: string;
  reason: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const deviceId = getOrCreateOwnerDeviceId();
  const info = detectDeviceInfo();
  const baseUrl = getOwnerApiBaseUrl();

  try {
    await fetch(`${baseUrl}/api/device/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        ...params,
        deviceId,
        deviceName: info.deviceName,
        platform: info.platform,
        appVersion: info.appVersion,
        status: 'Completed',
      }),
    });
  } catch {}
}

export async function fetchOwnerSnapshot(): Promise<OwnerDashboardSnapshot> {
  const baseUrl = getOwnerApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/owner/control`, {
    method: 'GET',
    headers: {
      'x-owner-pin': OWNER_PIN,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Owner dashboard request failed (${res.status})`);
  }
  return res.json();
}

export async function postOwnerAction(payload: Record<string, unknown>): Promise<any> {
  const baseUrl = getOwnerApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/owner/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-pin': OWNER_PIN,
    },
    body: JSON.stringify({
      ...payload,
      ownerPin: OWNER_PIN,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Action failed (${res.status})`);
  }
  return data;
}

export async function connectTelegramBotWebhook(): Promise<any> {
  const baseUrl = getOwnerApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/owner/telegram/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-pin': OWNER_PIN,
    },
    body: JSON.stringify({ ownerPin: OWNER_PIN }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Webhook registration failed');
  }
  return data;
}
