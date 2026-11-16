'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Cloud,
  Lock,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Smartphone,
  Trash2,
  Unlock,
  User,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  DeviceClient,
  OwnerDashboardSnapshot,
  formatRelativeTime,
} from '@/lib/owner-types';
import {
  connectTelegramBotWebhook,
  fetchOwnerSnapshot,
  getOrCreateOwnerDeviceId,
  postOwnerAction,
} from '@/lib/owner-telemetry';
import {
  OperationType,
  getFirebaseClient,
  handleFirestoreError,
  signInOwnerWithGoogle,
  signOutOwner,
} from '@/lib/firebase-client';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface OwnerControlDashboardProps {
  onClose: () => void;
  onRemoteLockChange?: (locked: boolean, message: string) => void;
}

export default function OwnerControlDashboard({
  onClose,
  onRemoteLockChange,
}: OwnerControlDashboardProps) {
  const [activeTab, setActiveTab] = useState<'devices' | 'transactions' | 'notify'>('devices');
  const [snapshot, setSnapshot] = useState<OwnerDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyKey, setBusyKey] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filters
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [globalLockMsgInput, setGlobalLockMsgInput] = useState<string>(
    'This application is temporarily suspended by the administrator.'
  );

  // Notification composer state
  const [notifTarget, setNotifTarget] = useState<string>('all');
  const [notifTitle, setNotifTitle] = useState<string>('CBEBirr');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [notifDurationVal, setNotifDurationVal] = useState<string>('30');
  const [notifDurationUnit, setNotifDurationUnit] = useState<'sec' | 'min'>('sec');

  // Firebase Auth Web Admin Sync (when running in standard browser)
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [fbDevices, setFbDevices] = useState<DeviceClient[]>([]);

  const myDeviceId = useMemo(() => getOrCreateOwnerDeviceId(), []);
  const isApkEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location?.origin?.includes('appassets.androidplatform.net') ||
      window.location?.protocol === 'file:'
    );
  }, []);

  const flashBanner = useCallback((type: 'ok' | 'err', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchOwnerSnapshot();
      setSnapshot(data);
      if (data.globalConfig?.globalLockMessage) {
        setGlobalLockMsgInput(data.globalConfig.globalLockMessage);
      }
    } catch (err: any) {
      if (!silent) {
        flashBanner('err', err?.message || 'Failed to load owner data');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [flashBanner]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadSnapshot(false);
    }, 0);
    const id = setInterval(() => {
      void loadSnapshot(true);
    }, 5000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [loadSnapshot]);

  // Listen to Firebase Auth state and real-time Firestore devices collection when signed in on Web
  useEffect(() => {
    try {
      const { auth } = getFirebaseClient();
      const unsubAuth = onAuthStateChanged(auth, (user) => {
        setFbUser(user);
        if (!user || !user.emailVerified) {
          setFbDevices([]);
        }
      });
      return () => unsubAuth();
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!fbUser || !fbUser.emailVerified) {
      return;
    }
    try {
      const { db } = getFirebaseClient();
      const q = query(collection(db, 'devices'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const rows: DeviceClient[] = [];
          snap.forEach((d) => {
            const val = d.data() as DeviceClient;
            if (val?.deviceId) rows.push(val);
          });
          setFbDevices(rows);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'devices');
          } catch {
            // Non-admin user signed in
          }
        }
      );
      return () => unsub();
    } catch {
      return undefined;
    }
  }, [fbUser]);

  const devicesList = useMemo(() => {
    const apiDevices = snapshot?.devices || [];
    if (fbDevices.length === 0) return apiDevices;
    const map = new Map<string, DeviceClient>();
    for (const d of fbDevices) map.set(d.deviceId, d);
    for (const d of apiDevices) map.set(d.deviceId, d);
    return Array.from(map.values()).sort((a, b) => b.lastSeenAtMs - a.lastSeenAtMs);
  }, [snapshot, fbDevices]);

  const onlineCount = useMemo(
    () => devicesList.filter((d) => d.isOnline).length,
    [devicesList]
  );

  const filteredTransactions = useMemo(() => {
    const list = snapshot?.transactions || [];
    if (deviceFilter === 'all') return list;
    return list.filter((t) => t.deviceId === deviceFilter);
  }, [snapshot, deviceFilter]);

  const handleGlobalLockToggle = async () => {
    const currentlyLocked = Boolean(snapshot?.globalConfig?.globalLocked);
    setBusyKey('global_lock');
    try {
      const action = currentlyLocked ? 'unlock_all' : 'lock_all';
      await postOwnerAction({
        action,
        message: globalLockMsgInput.trim() || undefined,
      });
      await loadSnapshot(true);
      onRemoteLockChange?.(!currentlyLocked, globalLockMsgInput.trim());
      flashBanner(
        'ok',
        currentlyLocked
          ? 'Unlocked for all devices'
          : 'App locked globally for all devices'
      );
    } catch (err: any) {
      flashBanner('err', err?.message || 'Lock toggle failed');
    } finally {
      setBusyKey('');
    }
  };

  const handleDeviceLockToggle = async (dev: DeviceClient) => {
    setBusyKey(`lock_${dev.deviceId}`);
    try {
      const action = dev.isLocked ? 'unlock_device' : 'lock_device';
      await postOwnerAction({
        action,
        deviceId: dev.deviceId,
      });
      await loadSnapshot(true);
      if (dev.deviceId === myDeviceId) {
        onRemoteLockChange?.(!dev.isLocked, dev.lockReason || '');
      }
      flashBanner(
        'ok',
        dev.isLocked
          ? `Unlocked ${dev.deviceName}`
          : `Locked ${dev.deviceName}`
      );
    } catch (err: any) {
      flashBanner('err', err?.message || 'Device lock update failed');
    } finally {
      setBusyKey('');
    }
  };

  const handleDeleteDevice = async (dev: DeviceClient) => {
    setBusyKey(`del_${dev.deviceId}`);
    try {
      await postOwnerAction({ action: 'delete_device', deviceId: dev.deviceId });
      await loadSnapshot(true);
      flashBanner('ok', `Removed ${dev.deviceName}`);
    } catch (err: any) {
      flashBanner('err', err?.message || 'Remove failed');
    } finally {
      setBusyKey('');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = notifMessage.trim();
    if (!msg) {
      flashBanner('err', 'Please write a notification message');
      return;
    }
    const rawNum = parseFloat(notifDurationVal) || 30;
    const durationSeconds = Math.max(
      1,
      Math.min(86400, Math.round(notifDurationUnit === 'min' ? rawNum * 60 : rawNum))
    );

    setBusyKey('send_notif');
    try {
      await postOwnerAction({
        action: 'send_notification',
        targetDeviceId: notifTarget,
        title: notifTitle.trim() || 'CBEBirr',
        message: msg,
        durationSeconds,
      });
      setNotifMessage('');
      await loadSnapshot(true);
      flashBanner(
        'ok',
        `Notification dispatched (${durationSeconds}s) → ${notifTarget === 'all' ? 'All Devices' : notifTarget}`
      );
    } catch (err: any) {
      flashBanner('err', err?.message || 'Failed to dispatch notification');
    } finally {
      setBusyKey('');
    }
  };

  const handleConnectTelegram = async () => {
    setBusyKey('tg_setup');
    try {
      const res = await connectTelegramBotWebhook();
      flashBanner('ok', `Telegram Bot active: ${res.webhookUrl}`);
    } catch (err: any) {
      flashBanner('err', err?.message || 'Set TELEGRAM_BOT_TOKEN in server env first');
    } finally {
      setBusyKey('');
    }
  };

  const handleGoogleSyncClick = async () => {
    setBusyKey('fb_auth');
    try {
      if (fbUser) {
        await signOutOwner();
        flashBanner('ok', 'Signed out of Cloud Admin Sync');
      } else {
        await signInOwnerWithGoogle();
        flashBanner('ok', 'Cloud Admin Sync active');
      }
    } catch (err: any) {
      flashBanner('err', err?.message || 'Cloud sign-in unavailable in this WebView');
    } finally {
      setBusyKey('');
    }
  };

  const serverNow = snapshot?.serverTimeMs || 0;
  const globalLocked = Boolean(snapshot?.globalConfig?.globalLocked);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="absolute inset-0 z-[90] bg-[#0e1621] text-slate-100 flex flex-col overflow-hidden select-none"
    >
      {/* Telegram-style Header */}
      <div className="bg-[#17212b] border-b border-white/10 px-3.5 pt-3 pb-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
              aria-label="Exit Owner Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#5eb5f7] shrink-0" />
                <h1 className="text-[14px] font-bold text-white truncate">
                  Owner Command Center
                </h1>
              </div>
              <p className="text-[10.5px] text-[#7f91a4] truncate">
                {onlineCount} online • {devicesList.length} devices •{' '}
                {snapshot?.storageMode === 'firestore' ? 'Firestore Sync' : 'Live Server Cache'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isApkEnv && (
              <button
                type="button"
                onClick={handleGoogleSyncClick}
                disabled={busyKey === 'fb_auth'}
                title={fbUser ? `Signed in: ${fbUser.email}` : 'Sign in for Cloud Sync'}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                  fbUser
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>{fbUser ? 'Cloud' : 'Auth'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={busyKey === 'tg_setup'}
              title="Verify / Register Telegram Bot Webhook"
              className="px-2 py-1.5 rounded-lg bg-[#2b5278] hover:bg-[#346492] text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Bot className="w-3 h-3" />
              <span>{busyKey === 'tg_setup' ? '...' : 'Bot'}</span>
            </button>

            <button
              type="button"
              onClick={() => loadSnapshot(false)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-200 cursor-pointer"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Toast inside dashboard */}
        <AnimatePresence>
          {statusBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center justify-between gap-2 ${
                statusBanner.type === 'ok'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
              }`}
            >
              <span className="truncate">{statusBanner.text}</span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Master Global App Lock Bar */}
        <div
          className={`mt-2.5 rounded-xl p-2.5 border transition-colors ${
            globalLocked
              ? 'bg-rose-950/50 border-rose-500/40'
              : 'bg-[#202b36] border-white/10'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {globalLocked ? (
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold text-white leading-tight">
                  {globalLocked ? 'GLOBAL LOCK: ACTIVE' : 'All Devices Open'}
                </p>
                <p className="text-[10px] text-[#8b9bb0] truncate">
                  {globalLocked
                    ? 'Every device is blocked until unlocked'
                    : 'Tap to close/lock app on every connected phone'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGlobalLockToggle}
              disabled={busyKey === 'global_lock'}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                globalLocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {globalLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{globalLocked ? 'Unlock All' : 'Lock All'}</span>
            </button>
          </div>

          <input
            type="text"
            value={globalLockMsgInput}
            onChange={(e) => setGlobalLockMsgInput(e.target.value)}
            placeholder="Custom lock screen message..."
            maxLength={200}
            className="mt-2 w-full bg-[#17212b] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-[#5eb5f7]"
          />
        </div>

        {/* Telegram-style Tabs */}
        <div className="grid grid-cols-3 gap-1.5 mt-2.5 bg-[#0e1621] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'devices'
                ? 'bg-[#2b5278] text-white'
                : 'text-[#8b9bb0] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Devices ({devicesList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'transactions'
                ? 'bg-[#2b5278] text-white'
                : 'text-[#8b9bb0] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Txns ({snapshot?.transactions?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notify')}
            className={`py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'notify'
                ? 'bg-[#2b5278] text-white'
                : 'text-[#8b9bb0] hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notify</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {activeTab === 'devices' && (
          <>
            {devicesList.length === 0 ? (
              <div className="bg-[#17212b] border border-white/10 rounded-2xl p-6 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-[#5eb5f7] mx-auto opacity-80" />
                <p className="text-[13px] font-semibold text-white">No Devices Yet</p>
                <p className="text-[11px] text-[#7f91a4]">
                  Every phone that opens the app online will appear here with real-time status & balance.
                </p>
              </div>
            ) : (
              devicesList.map((dev, index) => {
                const isMe = dev.deviceId === myDeviceId;
                return (
                  <div
                    key={dev.deviceId}
                    className="bg-[#17212b] border border-white/10 rounded-2xl p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                            #{index + 1}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              dev.isOnline
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {dev.isOnline ? (
                              <Wifi className="w-2.5 h-2.5" />
                            ) : (
                              <WifiOff className="w-2.5 h-2.5" />
                            )}
                            {dev.isOnline
                              ? 'ONLINE'
                              : `OFFLINE • ${formatRelativeTime(dev.lastSeenAtMs, serverNow)}`}
                          </span>
                          {isMe && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#2b5278] text-[#90cdf4]">
                              THIS DEVICE
                            </span>
                          )}
                          {dev.isLocked && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-600/30 text-rose-200">
                              LOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] font-bold text-white mt-1 truncate">
                          {dev.deviceName}
                        </p>
                        <p className="text-[10px] text-[#7f91a4] font-mono truncate">
                          {dev.deviceId} • {dev.platform} v{dev.appVersion}
                        </p>
                      </div>

                      {!isMe && !dev.isOnline && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(dev)}
                          disabled={busyKey === `del_${dev.deviceId}`}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer shrink-0"
                          title="Remove stale device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* App Profile Details Inside This Device */}
                    <div className="bg-[#0e1621] rounded-xl p-2.5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-[#5eb5f7] shrink-0" />
                        <span className="text-slate-200 truncate font-medium">
                          {dev.userName || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-[#5eb5f7] shrink-0" />
                        <span className="text-slate-200 truncate font-mono">
                          {dev.phoneNumber || dev.userAccount || '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-[#8b9bb0]">Balance:</span>
                        <span className="text-emerald-300 font-bold font-mono">
                          {Number(dev.balance || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          ETB
                        </span>
                      </div>
                    </div>

                    {/* Per-Device Actions */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeviceLockToggle(dev)}
                        disabled={busyKey === `lock_${dev.deviceId}`}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          dev.isLocked
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600/85 hover:bg-rose-600 text-white'
                        }`}
                      >
                        {dev.isLocked ? (
                          <Unlock className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        <span>{dev.isLocked ? 'Unlock' : 'Lock'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNotifTarget(dev.deviceId);
                          setActiveTab('notify');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-[#2b5278] hover:bg-[#356696] text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3 h-3" />
                        <span>Notify</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeviceFilter(dev.deviceId);
                          setActiveTab('transactions');
                        }}
                        className="py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Activity className="w-3 h-3" />
                        <span>Txns</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <>
            <div className="bg-[#17212b] border border-white/10 rounded-xl p-2 flex items-center gap-2">
              <span className="text-[11px] text-[#8b9bb0] shrink-0">Device:</span>
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="flex-1 bg-[#0e1621] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none"
              >
                <option value="all">All Devices ({snapshot?.transactions?.length || 0})</option>
                {devicesList.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceName} — {d.userName}
                  </option>
                ))}
              </select>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="bg-[#17212b] border border-white/10 rounded-2xl p-6 text-center space-y-2">
                <Activity className="w-8 h-8 text-[#5eb5f7] mx-auto opacity-80" />
                <p className="text-[13px] font-semibold text-white">No Transactions Found</p>
                <p className="text-[11px] text-[#7f91a4]">
                  Real-time transfers from any device will appear here immediately.
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <div
                  key={tx.txId}
                  className="bg-[#17212b] border border-white/10 rounded-2xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#2b5278]/70 text-[#90cdf4] truncate">
                      {tx.transferLabel} • {tx.title}
                    </span>
                    <span
                      className={`text-[13px] font-bold font-mono shrink-0 ${
                        tx.txType === 'credit' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {tx.txType === 'credit' ? '+' : '-'}
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>

                  <p className="text-[11.5px] text-white font-medium">
                    {tx.senderName} → {tx.recipientName}{' '}
                    <span className="text-[#7f91a4] font-mono">({tx.recipientAccount || '-'})</span>
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-[#8b9bb0]">
                    <span className="truncate">
                      📱 {tx.deviceName} ({tx.deviceId})
                    </span>
                    <span className="shrink-0">
                      {formatRelativeTime(tx.createdAtMs, serverNow)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#8b9bb0] pt-1 border-t border-white/5">
                    <span className="font-mono">Ref: {tx.ref}</span>
                    <span>
                      Bal After: <b className="text-emerald-300">{tx.balanceAfter.toFixed(2)} ETB</b>
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'notify' && (
          <div className="space-y-3">
            <form
              onSubmit={handleSendNotification}
              className="bg-[#17212b] border border-white/10 rounded-2xl p-3 space-y-3"
            >
              <div>
                <label className="block text-[11px] font-semibold text-[#8b9bb0] mb-1">
                  Target Device
                </label>
                <select
                  value={notifTarget}
                  onChange={(e) => setNotifTarget(e.target.value)}
                  className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-2.5 py-2 text-[12px] text-white outline-none"
                >
                  <option value="all">📢 All Devices ({devicesList.length})</option>
                  {devicesList.map((d, idx) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      #{idx + 1} {d.isOnline ? '🟢' : '🔴'} {d.deviceName} ({d.userName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8b9bb0] mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  maxLength={90}
                  placeholder="CBEBirr"
                  className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-2.5 py-2 text-[12px] text-white outline-none focus:border-[#5eb5f7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8b9bb0] mb-1">
                  Message Text
                </label>
                <textarea
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  rows={3}
                  maxLength={480}
                  placeholder="Write notification message to appear as notification banner..."
                  className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-2.5 py-2 text-[12px] text-white outline-none focus:border-[#5eb5f7] resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#8b9bb0] mb-1">
                  Visible Duration (Auto-disappears after timer)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: '10s', val: '10', unit: 'sec' as const },
                    { label: '30s', val: '30', unit: 'sec' as const },
                    { label: '1m', val: '1', unit: 'min' as const },
                    { label: '2m', val: '2', unit: 'min' as const },
                    { label: '5m', val: '5', unit: 'min' as const },
                    { label: '15m', val: '15', unit: 'min' as const },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setNotifDurationVal(preset.val);
                        setNotifDurationUnit(preset.unit);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer border ${
                        notifDurationVal === preset.val && notifDurationUnit === preset.unit
                          ? 'bg-[#2b5278] border-[#5eb5f7] text-white'
                          : 'bg-[#0e1621] border-white/10 text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={notifDurationVal}
                    onChange={(e) => setNotifDurationVal(e.target.value)}
                    className="bg-[#0e1621] border border-white/10 rounded-xl px-2.5 py-1.5 text-[12px] text-white outline-none font-mono"
                  />
                  <select
                    value={notifDurationUnit}
                    onChange={(e) =>
                      setNotifDurationUnit(e.target.value === 'min' ? 'min' : 'sec')
                    }
                    className="bg-[#0e1621] border border-white/10 rounded-xl px-2.5 py-1.5 text-[12px] text-white outline-none"
                  >
                    <option value="sec">Seconds</option>
                    <option value="min">Minutes</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={busyKey === 'send_notif' || !notifMessage.trim()}
                className="w-full py-2.5 rounded-xl bg-[#2b5278] hover:bg-[#356696] disabled:opacity-50 text-white font-bold text-[12.5px] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {busyKey === 'send_notif' ? 'Sending...' : 'Send Notification Banner'}
                </span>
              </button>
            </form>

            {/* Dispatched Notifications History */}
            {(snapshot?.notifications?.length || 0) > 0 && (
              <div className="bg-[#17212b] border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5eb5f7]" />
                    Recent Alerts ({snapshot?.notifications?.length})
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await postOwnerAction({ action: 'clear_notifications' });
                      await loadSnapshot(true);
                    }}
                    className="text-[10px] text-rose-300 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {snapshot?.notifications?.slice(0, 10).map((n) => {
                  const isActive = n.expiresAtMs > serverNow;
                  return (
                    <div
                      key={n.notifId}
                      className="bg-[#0e1621] rounded-xl p-2 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white truncate">{n.title}</span>
                        <span
                          className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {isActive ? 'Active' : 'Expired'} • {n.durationSeconds}s
                        </span>
                      </div>
                      <p className="text-slate-300 break-words">{n.message}</p>
                      <p className="text-[9.5px] text-[#7f91a4]">
                        Target: {n.targetDeviceId} • via {n.sentBy} •{' '}
                        {formatRelativeTime(n.createdAtMs, serverNow)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
