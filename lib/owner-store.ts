import fs from 'node:fs';
import {
  DeviceClient,
  DevicePlatform,
  DeviceSyncResponse,
  DeviceTransaction,
  OwnerDashboardSnapshot,
  OwnerGlobalConfig,
  OwnerNotification,
  isDeviceOnline,
} from './owner-types';
import {
  fsDeleteDocument,
  fsGetDocument,
  fsListCollection,
  fsSetDocument,
  isFirestoreServerConfigured,
} from './firestore-admin';

const LOCAL_STORE_FILE = '/tmp/.owner_control_store.json';
const SYSTEM_OWNER_ID = 'system_owner';

function sanitizeId(raw: string, fallback = 'unknown_id'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || fallback;
}

function clampStr(raw: unknown, maxLen: number, fallback = ''): string {
  const s = raw === undefined || raw === null ? fallback : String(raw);
  return s.trim().slice(0, maxLen);
}

function safeNum(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

interface StoreState {
  devices: Map<string, DeviceClient>;
  transactions: Map<string, DeviceTransaction>;
  notifications: Map<string, OwnerNotification>;
  globalConfig: OwnerGlobalConfig;
  lastFirestoreSyncMs: number;
}

const DEFAULT_GLOBAL_CONFIG: OwnerGlobalConfig = {
  configId: 'global',
  globalLocked: false,
  globalLockMessage: 'This application has been temporarily locked by the administrator.',
  updatedBy: 'system',
  updatedAtMs: 0,
};

const g = globalThis as unknown as { __ownerStore?: StoreState };

if (!g.__ownerStore) {
  g.__ownerStore = {
    devices: new Map(),
    transactions: new Map(),
    notifications: new Map(),
    globalConfig: { ...DEFAULT_GLOBAL_CONFIG },
    lastFirestoreSyncMs: 0,
  };
}

const state = g.__ownerStore;

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(LOCAL_STORE_FILE)) return;
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.devices)) {
      for (const d of parsed.devices) {
        if (d?.deviceId) state.devices.set(d.deviceId, d);
      }
    }
    if (Array.isArray(parsed.transactions)) {
      for (const t of parsed.transactions) {
        if (t?.txId) state.transactions.set(t.txId, t);
      }
    }
    if (Array.isArray(parsed.notifications)) {
      for (const n of parsed.notifications) {
        if (n?.notifId) state.notifications.set(n.notifId, n);
      }
    }
    if (parsed.globalConfig?.configId === 'global') {
      if (
        parsed.globalConfig.updatedAtMs >= state.globalConfig.updatedAtMs
      ) {
        state.globalConfig = parsed.globalConfig;
      }
    }
  } catch {
    // ignore
  }
}

function saveToDisk(): void {
  try {
    const payload = {
      devices: Array.from(state.devices.values()).slice(-250),
      transactions: Array.from(state.transactions.values()).slice(-500),
      notifications: Array.from(state.notifications.values()).slice(-200),
      globalConfig: state.globalConfig,
    };
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(payload), 'utf8');
  } catch {
    // ignore
  }
}

loadFromDisk();

async function syncFromFirestoreIfAvailable(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && now - state.lastFirestoreSyncMs < 4000) {
    return isFirestoreServerConfigured();
  }

  const [fsConfig, fsDevices, fsTxs, fsNotifs] = await Promise.all([
    fsGetDocument<Record<string, unknown>>('owner_config', 'global'),
    fsListCollection<Record<string, unknown>>('devices', 200),
    fsListCollection<Record<string, unknown>>('device_transactions', 300),
    fsListCollection<Record<string, unknown>>('owner_notifications', 150),
  ]);

  let syncedAny = false;

  if (fsConfig && fsConfig.configId === 'global') {
    syncedAny = true;
    const remoteUpdated = safeNum(fsConfig.updatedAtMs, 0);
    if (remoteUpdated >= state.globalConfig.updatedAtMs) {
      state.globalConfig = {
        configId: 'global',
        globalLocked: Boolean(fsConfig.globalLocked),
        globalLockMessage: clampStr(
          fsConfig.globalLockMessage,
          240,
          DEFAULT_GLOBAL_CONFIG.globalLockMessage
        ),
        updatedBy: (fsConfig.updatedBy as OwnerGlobalConfig['updatedBy']) || 'system',
        updatedAtMs: remoteUpdated,
      };
    }
  }

  if (fsDevices) {
    syncedAny = true;
    for (const d of fsDevices) {
      const id = sanitizeId(String(d.deviceId || ''));
      if (!id) continue;
      const existing = state.devices.get(id);
      const remoteSeen = safeNum(d.lastSeenAtMs, 0);
      const remoteUpdated = safeNum(d.updatedAtMs, remoteSeen);
      if (!existing || remoteUpdated >= (existing.updatedAtMs || existing.lastSeenAtMs)) {
        state.devices.set(id, {
          deviceId: id,
          deviceName: clampStr(d.deviceName, 120, 'Android Device'),
          platform: (['android-apk', 'web-pwa', 'web'].includes(String(d.platform))
            ? d.platform
            : 'web') as DevicePlatform,
          appVersion: clampStr(d.appVersion, 40, '1.0.0'),
          userName: clampStr(d.userName, 120, 'Unknown User'),
          phoneNumber: clampStr(d.phoneNumber, 32, ''),
          userAccount: clampStr(d.userAccount, 64, ''),
          balance: safeNum(d.balance, 0),
          isLocked: Boolean(d.isLocked),
          lockReason: clampStr(d.lockReason, 240, ''),
          lastSeenAtMs: remoteSeen,
          createdAtMs: safeNum(d.createdAtMs, remoteSeen),
          updatedAtMs: remoteUpdated,
        });
      }
    }
  }

  if (fsTxs) {
    syncedAny = true;
    for (const t of fsTxs) {
      const txId = sanitizeId(String(t.txId || ''));
      if (!txId) continue;
      state.transactions.set(txId, {
        txId,
        deviceId: sanitizeId(String(t.deviceId || 'unknown')),
        deviceName: clampStr(t.deviceName, 120, 'Device'),
        senderName: clampStr(t.senderName, 120, 'User'),
        senderPhone: clampStr(t.senderPhone, 32, ''),
        senderAccount: clampStr(t.senderAccount, 64, ''),
        title: clampStr(t.title, 80, 'Transfer'),
        txType: t.txType === 'credit' ? 'credit' : 'debit',
        amount: safeNum(t.amount, 0),
        totalDeducted: safeNum(t.totalDeducted, safeNum(t.amount, 0)),
        balanceAfter: safeNum(t.balanceAfter, 0),
        recipientName: clampStr(t.recipientName, 120, ''),
        recipientAccount: clampStr(t.recipientAccount, 64, ''),
        destBank: clampStr(t.destBank, 80, '') || undefined,
        transferLabel: clampStr(t.transferLabel, 80, 'CBE'),
        ref: clampStr(t.ref, 64, txId),
        reason: clampStr(t.reason, 200, ''),
        status: (['Completed', 'Pending', 'Failed'].includes(String(t.status))
          ? t.status
          : 'Completed') as DeviceTransaction['status'],
        createdAtMs: safeNum(t.createdAtMs, Date.now()),
      });
    }
  }

  if (fsNotifs) {
    syncedAny = true;
    for (const n of fsNotifs) {
      const notifId = sanitizeId(String(n.notifId || ''));
      if (!notifId) continue;
      state.notifications.set(notifId, {
        notifId,
        targetDeviceId: sanitizeId(String(n.targetDeviceId || 'all'), 'all'),
        title: clampStr(n.title, 100, 'Notice'),
        message: clampStr(n.message, 500, ''),
        durationSeconds: Math.max(1, Math.min(86400, safeNum(n.durationSeconds, 30))),
        sentBy: n.sentBy === 'telegram' ? 'telegram' : 'app_0069',
        createdAtMs: safeNum(n.createdAtMs, Date.now()),
        expiresAtMs: safeNum(n.expiresAtMs, Date.now() + 30_000),
      });
    }
  }

  if (syncedAny) {
    state.lastFirestoreSyncMs = now;
    saveToDisk();
  }
  return syncedAny;
}

export async function syncDeviceHeartbeat(input: {
  deviceId: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  userName?: string;
  phoneNumber?: string;
  userAccount?: string;
  balance?: number | string;
  offline?: boolean;
}): Promise<{
  syncResponse: DeviceSyncResponse;
  device: DeviceClient;
  isNewDevice: boolean;
  profileChangedSummary?: string;
}> {
  loadFromDisk();
  await syncFromFirestoreIfAvailable(false);

  const nowMs = Date.now();
  const deviceId = sanitizeId(input.deviceId, `dev_${nowMs}`);
  const prev = state.devices.get(deviceId);
  const isNewDevice = !prev;

  const nextUserName = clampStr(input.userName, 120, prev?.userName || 'AYMEN NIGATU YIMAM');
  const nextPhone = clampStr(input.phoneNumber, 32, prev?.phoneNumber || '');
  const nextAccount = clampStr(input.userAccount, 64, prev?.userAccount || '');
  const nextBalance =
    input.balance !== undefined ? safeNum(input.balance, prev?.balance || 0) : (prev?.balance ?? 0);

  let profileChangedSummary: string | undefined;
  if (prev) {
    const diffs: string[] = [];
    if (nextUserName && nextUserName !== prev.userName) {
      diffs.push(`Name: "${prev.userName}" → "${nextUserName}"`);
    }
    if (nextPhone && nextPhone !== prev.phoneNumber) {
      diffs.push(`Phone: "${prev.phoneNumber || '-'}" → "${nextPhone}"`);
    }
    if (nextAccount && nextAccount !== prev.userAccount) {
      diffs.push(`Account: "${prev.userAccount || '-'}" → "${nextAccount}"`);
    }
    if (Math.abs(nextBalance - prev.balance) >= 0.01) {
      diffs.push(`Balance: ${prev.balance.toFixed(2)} → ${nextBalance.toFixed(2)} ETB`);
    }
    if (diffs.length > 0) {
      profileChangedSummary = diffs.join('\n');
    }
  }

  const nextDevice: DeviceClient = {
    deviceId,
    deviceName: clampStr(input.deviceName, 120, prev?.deviceName || 'Android Device'),
    platform: (['android-apk', 'web-pwa', 'web'].includes(String(input.platform))
      ? input.platform
      : (prev?.platform || 'web')) as DevicePlatform,
    appVersion: clampStr(input.appVersion, 40, prev?.appVersion || '1.0.85'),
    userName: nextUserName,
    phoneNumber: nextPhone,
    userAccount: nextAccount,
    balance: nextBalance,
    isLocked: prev?.isLocked ?? false,
    lockReason: prev?.lockReason || '',
    lastSeenAtMs: input.offline ? Math.max(0, nowMs - 120_000) : nowMs,
    createdAtMs: prev?.createdAtMs || nowMs,
    updatedAtMs: nowMs,
  };

  state.devices.set(deviceId, nextDevice);
  saveToDisk();

  // Persist to Firestore in background
  const nowIso = new Date(nowMs).toISOString();
  fsSetDocument('devices', deviceId, {
    deviceId: nextDevice.deviceId,
    deviceName: nextDevice.deviceName,
    platform: nextDevice.platform,
    appVersion: nextDevice.appVersion,
    userName: nextDevice.userName,
    phoneNumber: nextDevice.phoneNumber,
    userAccount: nextDevice.userAccount,
    balance: nextDevice.balance,
    isLocked: nextDevice.isLocked,
    lockReason: nextDevice.lockReason || '',
    lastSeenAtMs: nextDevice.lastSeenAtMs,
    ownerId: SYSTEM_OWNER_ID,
    createdAt: new Date(nextDevice.createdAtMs || nowMs),
    updatedAt: new Date(nowMs),
    createdAtMs: nextDevice.createdAtMs || nowMs,
    updatedAtMs: nowMs,
    updatedAtIso: nowIso,
  }).catch(() => {});

  const activeNotifs = Array.from(state.notifications.values())
    .filter(
      (n) =>
        n.expiresAtMs > nowMs &&
        (n.targetDeviceId === 'all' || n.targetDeviceId === deviceId)
    )
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const effectiveLocked = Boolean(state.globalConfig.globalLocked || nextDevice.isLocked);
  const lockMessage = nextDevice.isLocked
    ? (nextDevice.lockReason || 'This device has been locked by the administrator.')
    : (state.globalConfig.globalLockMessage || DEFAULT_GLOBAL_CONFIG.globalLockMessage);

  return {
    syncResponse: {
      success: true,
      deviceId,
      globalLocked: state.globalConfig.globalLocked,
      deviceLocked: nextDevice.isLocked,
      effectiveLocked,
      lockMessage,
      notifications: activeNotifs,
      serverTimeMs: nowMs,
    },
    device: { ...nextDevice, isOnline: isDeviceOnline(nextDevice.lastSeenAtMs, nowMs) },
    isNewDevice,
    profileChangedSummary,
  };
}

export async function logDeviceTransaction(input: {
  txId?: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  senderName?: string;
  senderPhone?: string;
  senderAccount?: string;
  title?: string;
  txType?: 'debit' | 'credit';
  amount: number | string;
  totalDeducted?: number | string;
  balanceAfter?: number | string;
  recipientName?: string;
  recipientAccount?: string;
  destBank?: string;
  transferLabel?: string;
  ref?: string;
  reason?: string;
  status?: 'Completed' | 'Pending' | 'Failed';
}): Promise<{ tx: DeviceTransaction; device: DeviceClient }> {
  loadFromDisk();
  await syncFromFirestoreIfAvailable(false);

  const nowMs = Date.now();
  const deviceId = sanitizeId(input.deviceId, `dev_${nowMs}`);
  const prevDev = state.devices.get(deviceId);

  const balanceAfter =
    input.balanceAfter !== undefined
      ? safeNum(input.balanceAfter, prevDev?.balance || 0)
      : (prevDev?.balance || 0);

  const updatedDevice: DeviceClient = {
    deviceId,
    deviceName: clampStr(input.deviceName, 120, prevDev?.deviceName || 'Android Device'),
    platform: (['android-apk', 'web-pwa', 'web'].includes(String(input.platform))
      ? input.platform
      : (prevDev?.platform || 'web')) as DevicePlatform,
    appVersion: clampStr(input.appVersion, 40, prevDev?.appVersion || '1.0.85'),
    userName: clampStr(input.senderName, 120, prevDev?.userName || 'AYMEN NIGATU YIMAM'),
    phoneNumber: clampStr(input.senderPhone, 32, prevDev?.phoneNumber || ''),
    userAccount: clampStr(input.senderAccount, 64, prevDev?.userAccount || ''),
    balance: balanceAfter,
    isLocked: prevDev?.isLocked ?? false,
    lockReason: prevDev?.lockReason || '',
    lastSeenAtMs: nowMs,
    createdAtMs: prevDev?.createdAtMs || nowMs,
    updatedAtMs: nowMs,
  };
  state.devices.set(deviceId, updatedDevice);

  const txId = sanitizeId(input.txId || `tx_${nowMs}_${Math.random().toString(36).slice(2, 7)}`);
  const amtNum = safeNum(input.amount, 0);
  const totalNum = input.totalDeducted !== undefined ? safeNum(input.totalDeducted, amtNum) : amtNum;
  const tx: DeviceTransaction = {
    txId,
    deviceId,
    deviceName: updatedDevice.deviceName,
    senderName: updatedDevice.userName,
    senderPhone: updatedDevice.phoneNumber,
    senderAccount: updatedDevice.userAccount,
    title: clampStr(input.title, 80, 'Send Money'),
    txType: input.txType === 'credit' ? 'credit' : 'debit',
    amount: amtNum,
    totalDeducted: totalNum,
    balanceAfter,
    recipientName: clampStr(input.recipientName, 120, 'Recipient'),
    recipientAccount: clampStr(input.recipientAccount, 64, ''),
    destBank: clampStr(input.destBank, 80, '') || undefined,
    transferLabel: clampStr(input.transferLabel, 80, input.destBank || 'CBE'),
    ref: clampStr(input.ref, 64, txId),
    reason: clampStr(input.reason, 200, 'Transfer'),
    status: (['Completed', 'Pending', 'Failed'].includes(String(input.status))
      ? input.status
      : 'Completed') as DeviceTransaction['status'],
    createdAtMs: nowMs,
  };

  state.transactions.set(txId, tx);
  saveToDisk();

  // Persist both to Firestore
  await Promise.all([
    fsSetDocument('devices', deviceId, {
      ...updatedDevice,
      ownerId: SYSTEM_OWNER_ID,
      createdAt: new Date(updatedDevice.createdAtMs || nowMs),
      updatedAt: new Date(nowMs),
    }),
    fsSetDocument('device_transactions', txId, {
      txId: tx.txId,
      deviceId: tx.deviceId,
      deviceName: tx.deviceName,
      senderName: tx.senderName,
      senderPhone: tx.senderPhone,
      senderAccount: tx.senderAccount,
      title: tx.title,
      txType: tx.txType,
      amount: tx.amount,
      totalDeducted: tx.totalDeducted,
      balanceAfter: tx.balanceAfter,
      recipientName: tx.recipientName,
      recipientAccount: tx.recipientAccount,
      ...(tx.destBank ? { destBank: tx.destBank } : {}),
      transferLabel: tx.transferLabel,
      ref: tx.ref,
      reason: tx.reason,
      status: tx.status,
      ownerId: SYSTEM_OWNER_ID,
      createdAtMs: tx.createdAtMs,
      createdAt: new Date(nowMs),
    }),
  ]).catch(() => {});

  return { tx, device: updatedDevice };
}

export async function setGlobalLock(
  locked: boolean,
  updatedBy: 'telegram' | 'app_0069',
  message?: string
): Promise<OwnerGlobalConfig> {
  loadFromDisk();
  await syncFromFirestoreIfAvailable(false);
  const nowMs = Date.now();
  const next: OwnerGlobalConfig = {
    configId: 'global',
    globalLocked: locked,
    globalLockMessage: clampStr(
      message,
      240,
      locked
        ? 'Application temporarily locked by the owner.'
        : 'Application unlocked.'
    ),
    updatedBy,
    updatedAtMs: nowMs,
  };
  state.globalConfig = next;
  saveToDisk();

  await fsSetDocument('owner_config', 'global', {
    ...next,
    ownerId: SYSTEM_OWNER_ID,
    createdAt: new Date(nowMs),
    updatedAt: new Date(nowMs),
  }).catch(() => {});

  return next;
}

export async function setDeviceLock(
  deviceIdInput: string,
  locked: boolean,
  reason?: string
): Promise<DeviceClient | null> {
  loadFromDisk();
  await syncFromFirestoreIfAvailable(true);
  const deviceId = sanitizeId(deviceIdInput);
  const dev = state.devices.get(deviceId);
  if (!dev) return null;

  const nowMs = Date.now();
  const next: DeviceClient = {
    ...dev,
    isLocked: locked,
    lockReason: locked
      ? clampStr(reason, 240, 'This device has been locked by the administrator.')
      : '',
    updatedAtMs: nowMs,
  };
  state.devices.set(deviceId, next);
  saveToDisk();

  await fsSetDocument('devices', deviceId, {
    ...next,
    ownerId: SYSTEM_OWNER_ID,
    createdAt: new Date(next.createdAtMs || nowMs),
    updatedAt: new Date(nowMs),
  }).catch(() => {});

  return { ...next, isOnline: isDeviceOnline(next.lastSeenAtMs, nowMs) };
}

export async function createOwnerNotification(input: {
  targetDeviceId: string; // 'all' or deviceId
  title?: string;
  message: string;
  durationSeconds: number;
  sentBy: 'telegram' | 'app_0069';
}): Promise<OwnerNotification> {
  loadFromDisk();
  const nowMs = Date.now();
  const dur = Math.max(1, Math.min(86400, Math.round(input.durationSeconds || 30)));
  const notifId = sanitizeId(`notif_${nowMs}_${Math.random().toString(36).slice(2, 7)}`);
  const target = input.targetDeviceId === 'all' ? 'all' : sanitizeId(input.targetDeviceId, 'all');

  const notif: OwnerNotification = {
    notifId,
    targetDeviceId: target,
    title: clampStr(input.title, 100, 'CBEBirr Notice'),
    message: clampStr(input.message, 500, 'Notification'),
    durationSeconds: dur,
    sentBy: input.sentBy,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + dur * 1000,
  };

  state.notifications.set(notifId, notif);
  saveToDisk();

  await fsSetDocument('owner_notifications', notifId, {
    ...notif,
    ownerId: SYSTEM_OWNER_ID,
    createdAt: new Date(nowMs),
  }).catch(() => {});

  return notif;
}

export async function removeDeviceRecord(deviceIdInput: string): Promise<boolean> {
  loadFromDisk();
  const deviceId = sanitizeId(deviceIdInput);
  const existed = state.devices.delete(deviceId);
  saveToDisk();
  await fsDeleteDocument('devices', deviceId).catch(() => {});
  return existed;
}

export async function clearNotificationsHistory(): Promise<void> {
  loadFromDisk();
  const ids = Array.from(state.notifications.keys());
  state.notifications.clear();
  saveToDisk();
  await Promise.all(ids.map((id) => fsDeleteDocument('owner_notifications', id))).catch(() => {});
}

export async function getOwnerDashboardSnapshot(forceSync = true): Promise<OwnerDashboardSnapshot> {
  loadFromDisk();
  const fsSynced = await syncFromFirestoreIfAvailable(forceSync);
  const nowMs = Date.now();

  const devices = Array.from(state.devices.values())
    .map((d) => ({
      ...d,
      isOnline: isDeviceOnline(d.lastSeenAtMs, nowMs),
    }))
    .sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.lastSeenAtMs - a.lastSeenAtMs;
    });

  const transactions = Array.from(state.transactions.values())
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, 200);

  const notifications = Array.from(state.notifications.values())
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, 50);

  return {
    devices,
    transactions,
    notifications,
    globalConfig: state.globalConfig,
    storageMode: fsSynced ? 'firestore' : 'local-cache',
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    serverTimeMs: nowMs,
  };
}
