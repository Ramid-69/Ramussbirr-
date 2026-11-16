import {
  DEFAULT_TELEGRAM_OWNER_CHAT_ID,
  DeviceClient,
  DeviceTransaction,
  formatRelativeTime,
  parseDurationToSeconds,
} from './owner-types';
import {
  createOwnerNotification,
  getOwnerDashboardSnapshot,
  setDeviceLock,
  setGlobalLock,
} from './owner-store';

function getBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

export function getAuthorizedChatId(): string {
  return (process.env.TELEGRAM_OWNER_CHAT_ID || DEFAULT_TELEGRAM_OWNER_CHAT_ID).trim();
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function callTelegramApi(method: string, body: Record<string, unknown>): Promise<any> {
  const token = getBotToken();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || 'Telegram request failed' };
  }
}

export async function sendTelegramMessage(
  text: string,
  replyMarkup?: Record<string, unknown>,
  chatId = getAuthorizedChatId()
): Promise<any> {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function setTelegramWebhook(webhookUrl: string): Promise<any> {
  return callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  });
}

export async function getTelegramWebhookInfo(): Promise<any> {
  const token = getBotToken();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || 'Failed to inspect webhook' };
  }
}

function buildMainMenuKeyboard(globalLocked: boolean) {
  return {
    inline_keyboard: [
      [
        { text: '📱 Devices (Online / Offline)', callback_data: 'dev_list' },
        { text: '💸 Recent Transactions', callback_data: 'tx_all' },
      ],
      [
        globalLocked
          ? { text: '🔓 Unlock ALL Devices', callback_data: 'global_unlock' }
          : { text: '🔒 Lock ALL Devices', callback_data: 'global_lock' },
        { text: '📢 Notify ALL Devices', callback_data: 'notify_all_prompt' },
      ],
      [{ text: '🔄 Refresh Status', callback_data: 'refresh_menu' }],
    ],
  };
}

function formatDeviceShortLine(d: DeviceClient, idx: number, nowMs: number): string {
  const statusIcon = d.isOnline ? '🟢 ONLINE' : `🔴 OFFLINE (${formatRelativeTime(d.lastSeenAtMs, nowMs)})`;
  const lockIcon = d.isLocked ? '🔒 LOCKED' : '🔓 ACTIVE';
  return (
    `<b>#${idx + 1}</b> ${statusIcon} | ${lockIcon}\n` +
    `📱 <b>${escapeHtml(d.deviceName)}</b> (<code>${escapeHtml(d.deviceId)}</code>)\n` +
    `👤 ${escapeHtml(d.userName)} | 📞 ${escapeHtml(d.phoneNumber || '-')}\n` +
    `💰 Balance: <b>${d.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB</b>`
  );
}

export async function notifyOwnerNewDevice(device: DeviceClient): Promise<void> {
  if (!getBotToken()) return;
  const text =
    `🆕 <b>New Device Connected</b>\n\n` +
    `📱 <b>Device:</b> ${escapeHtml(device.deviceName)} (${escapeHtml(device.platform)})\n` +
    `🆔 <code>${escapeHtml(device.deviceId)}</code>\n` +
    `👤 <b>App Name:</b> ${escapeHtml(device.userName)}\n` +
    `📞 <b>Phone:</b> ${escapeHtml(device.phoneNumber || '-')}\n` +
    `💳 <b>Account:</b> ${escapeHtml(device.userAccount || '-')}\n` +
    `💰 <b>Balance:</b> ${device.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`;

  await sendTelegramMessage(text, {
    inline_keyboard: [
      [
        { text: '🔍 Inspect Device', callback_data: `dev_view:${device.deviceId}` },
        {
          text: device.isLocked ? '🔓 Unlock' : '🔒 Lock Device',
          callback_data: `${device.isLocked ? 'dev_unlock' : 'dev_lock'}:${device.deviceId}`,
        },
      ],
      [{ text: '📩 Send Notification', callback_data: `dev_notify:${device.deviceId}` }],
    ],
  });
}

export async function notifyOwnerProfileChanged(
  device: DeviceClient,
  diffSummary: string
): Promise<void> {
  if (!getBotToken()) return;
  const text =
    `✏️ <b>Device Details Updated</b>\n\n` +
    `📱 <b>Device:</b> ${escapeHtml(device.deviceName)} (<code>${escapeHtml(device.deviceId)}</code>)\n` +
    `<pre>${escapeHtml(diffSummary)}</pre>\n` +
    `👤 ${escapeHtml(device.userName)} | 📞 ${escapeHtml(device.phoneNumber || '-')}\n` +
    `💰 Balance: <b>${device.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB</b>`;

  await sendTelegramMessage(text, {
    inline_keyboard: [
      [
        { text: '🔍 Inspect Device', callback_data: `dev_view:${device.deviceId}` },
        { text: '📩 Notify Device', callback_data: `dev_notify:${device.deviceId}` },
      ],
    ],
  });
}

export async function notifyOwnerTransaction(
  tx: DeviceTransaction,
  device: DeviceClient
): Promise<void> {
  if (!getBotToken()) return;
  const sign = tx.txType === 'credit' ? '+' : '-';
  const text =
    `💸 <b>Real-Time Transaction Alert</b>\n\n` +
    `📱 <b>Device:</b> ${escapeHtml(device.deviceName)} (<code>${escapeHtml(tx.deviceId)}</code>)\n` +
    `👤 <b>Sender:</b> ${escapeHtml(tx.senderName)} (${escapeHtml(tx.senderPhone || '-')})\n` +
    `🏷️ <b>Type:</b> ${escapeHtml(tx.title)} — <b>${escapeHtml(tx.transferLabel)}</b>\n` +
    `💵 <b>Amount:</b> ${sign}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB\n` +
    `🎯 <b>Recipient:</b> ${escapeHtml(tx.recipientName)} (${escapeHtml(tx.recipientAccount || '-')})\n` +
    (tx.destBank ? `🏦 <b>Bank/Wallet:</b> ${escapeHtml(tx.destBank)}\n` : '') +
    `🔖 <b>Ref:</b> <code>${escapeHtml(tx.ref)}</code>\n` +
    `📝 <b>Reason:</b> ${escapeHtml(tx.reason || '-')}\n` +
    `💰 <b>Balance After:</b> ${tx.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`;

  await sendTelegramMessage(text, {
    inline_keyboard: [
      [
        { text: '📜 Device Txns', callback_data: `dev_tx:${tx.deviceId}` },
        {
          text: device.isLocked ? '🔓 Unlock Device' : '🔒 Lock Device',
          callback_data: `${device.isLocked ? 'dev_unlock' : 'dev_lock'}:${tx.deviceId}`,
        },
      ],
      [
        { text: '📩 Notify This Device', callback_data: `dev_notify:${tx.deviceId}` },
        { text: '📱 All Devices', callback_data: 'dev_list' },
      ],
    ],
  });
}

function resolveDeviceRef(ref: string, devices: DeviceClient[]): DeviceClient | undefined {
  const clean = ref.trim();
  if (clean.startsWith('#')) {
    const idx = parseInt(clean.slice(1), 10) - 1;
    if (idx >= 0 && idx < devices.length) return devices[idx];
  }
  const asNum = /^\d+$/.test(clean) ? parseInt(clean, 10) - 1 : -1;
  if (asNum >= 0 && asNum < devices.length) return devices[asNum];
  return devices.find(
    (d) =>
      d.deviceId.toLowerCase() === clean.toLowerCase() ||
      d.deviceId.toLowerCase().includes(clean.toLowerCase()) ||
      d.userName.toLowerCase().includes(clean.toLowerCase()) ||
      d.phoneNumber.includes(clean)
  );
}

async function sendMainMenu(chatId: string): Promise<void> {
  const snap = await getOwnerDashboardSnapshot(true);
  const onlineCount = snap.devices.filter((d) => d.isOnline).length;
  const lockedCount = snap.devices.filter((d) => d.isLocked).length;

  const text =
    `🛡️ <b>CBEBirr Owner Command Center</b>\n\n` +
    `📱 <b>Devices:</b> ${snap.devices.length} total (🟢 ${onlineCount} online, 🔴 ${snap.devices.length - onlineCount} offline)\n` +
    `🔒 <b>Global Lock:</b> ${snap.globalConfig.globalLocked ? '🔴 LOCKED FOR ALL' : '🟢 OPEN'}\n` +
    `🔐 <b>Per-Device Locks:</b> ${lockedCount} locked\n` +
    `💸 <b>Transactions Logged:</b> ${snap.transactions.length}\n\n` +
    `<b>Commands:</b>\n` +
    `• <code>/devices</code> — List all devices & status\n` +
    `• <code>/tx</code> — View recent transactions\n` +
    `• <code>/lockall [reason]</code> | <code>/unlockall</code>\n` +
    `• <code>/lock #1</code> | <code>/unlock #1</code>\n` +
    `• <code>/notify all 30s Your message</code>\n` +
    `• <code>/notify #1 2m Your message</code>`;

  await sendTelegramMessage(
    text,
    buildMainMenuKeyboard(snap.globalConfig.globalLocked),
    chatId
  );
}

async function sendDevicesList(chatId: string): Promise<void> {
  const snap = await getOwnerDashboardSnapshot(true);
  if (snap.devices.length === 0) {
    await sendTelegramMessage(
      '📱 No devices registered yet. Open the app on any phone while online and it will appear automatically.',
      buildMainMenuKeyboard(snap.globalConfig.globalLocked),
      chatId
    );
    return;
  }

  const lines = snap.devices
    .slice(0, 15)
    .map((d, idx) => formatDeviceShortLine(d, idx, snap.serverTimeMs));

  const keyboardRows: Array<Array<{ text: string; callback_data: string }>> = [];
  snap.devices.slice(0, 8).forEach((d, idx) => {
    keyboardRows.push([
      {
        text: `#${idx + 1} ${d.isOnline ? '🟢' : '🔴'} ${d.userName.slice(0, 16)}`,
        callback_data: `dev_view:${d.deviceId}`,
      },
      {
        text: d.isLocked ? '🔓 Unlock' : '🔒 Lock',
        callback_data: `${d.isLocked ? 'dev_unlock' : 'dev_lock'}:${d.deviceId}`,
      },
      {
        text: '📩 Notify',
        callback_data: `dev_notify:${d.deviceId}`,
      },
    ]);
  });
  keyboardRows.push([
    { text: '🏠 Main Menu', callback_data: 'refresh_menu' },
    { text: '🔄 Refresh', callback_data: 'dev_list' },
  ]);

  await sendTelegramMessage(
    `📱 <b>Registered Devices (${snap.devices.length})</b>\n\n${lines.join('\n\n')}`,
    { inline_keyboard: keyboardRows },
    chatId
  );
}

async function sendDeviceInspect(chatId: string, deviceId: string): Promise<void> {
  const snap = await getOwnerDashboardSnapshot(true);
  const d = snap.devices.find((x) => x.deviceId === deviceId);
  if (!d) {
    await sendTelegramMessage(`❌ Device not found: <code>${escapeHtml(deviceId)}</code>`, undefined, chatId);
    return;
  }
  const devTxs = snap.transactions.filter((t) => t.deviceId === d.deviceId).slice(0, 5);
  const txText =
    devTxs.length === 0
      ? '<i>No transactions logged from this device yet.</i>'
      : devTxs
          .map(
            (t) =>
              `• <b>${t.amount.toFixed(2)} ETB</b> → ${escapeHtml(t.recipientName)} (${escapeHtml(t.transferLabel)}) • <code>${escapeHtml(t.ref)}</code>`
          )
          .join('\n');

  const statusText = d.isOnline
    ? '🟢 ONLINE NOW'
    : `🔴 OFFLINE (last seen ${formatRelativeTime(d.lastSeenAtMs, snap.serverTimeMs)})`;

  const text =
    `🔍 <b>Device Details</b>\n\n` +
    `📱 <b>Device:</b> ${escapeHtml(d.deviceName)} (${escapeHtml(d.platform)} v${escapeHtml(d.appVersion)})\n` +
    `🆔 <code>${escapeHtml(d.deviceId)}</code>\n` +
    `📡 <b>Status:</b> ${statusText}\n` +
    `🔐 <b>Lock:</b> ${d.isLocked ? '🔒 LOCKED' : '🔓 ACTIVE'}${snap.globalConfig.globalLocked ? ' (⚠️ Global Lock ON)' : ''}\n` +
    `👤 <b>Name:</b> ${escapeHtml(d.userName)}\n` +
    `📞 <b>Phone:</b> ${escapeHtml(d.phoneNumber || '-')}\n` +
    `💳 <b>Account:</b> ${escapeHtml(d.userAccount || '-')}\n` +
    `💰 <b>Balance:</b> ${d.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB\n\n` +
    `💸 <b>Latest Device Transactions:</b>\n${txText}`;

  await sendTelegramMessage(
    text,
    {
      inline_keyboard: [
        [
          {
            text: d.isLocked ? '🔓 Unlock Device' : '🔒 Lock Device',
            callback_data: `${d.isLocked ? 'dev_unlock' : 'dev_lock'}:${d.deviceId}`,
          },
          { text: '📩 Send Notification', callback_data: `dev_notify:${d.deviceId}` },
        ],
        [
          { text: '📜 All Txns (Device)', callback_data: `dev_tx:${d.deviceId}` },
          { text: '⬅️ All Devices', callback_data: 'dev_list' },
        ],
      ],
    },
    chatId
  );
}

async function sendTransactionsList(chatId: string, filterDeviceId?: string): Promise<void> {
  const snap = await getOwnerDashboardSnapshot(true);
  const filtered = filterDeviceId
    ? snap.transactions.filter((t) => t.deviceId === filterDeviceId)
    : snap.transactions;

  if (filtered.length === 0) {
    await sendTelegramMessage(
      '💸 No transactions recorded yet.',
      { inline_keyboard: [[{ text: '⬅️ Back to Menu', callback_data: 'refresh_menu' }]] },
      chatId
    );
    return;
  }

  const lines = filtered.slice(0, 12).map((t, idx) => {
    const sign = t.txType === 'credit' ? '+' : '-';
    return (
      `<b>#${idx + 1}</b> ${sign}${t.amount.toFixed(2)} ETB • <b>${escapeHtml(t.transferLabel)}</b>\n` +
      `   📱 ${escapeHtml(t.deviceName)} (<code>${escapeHtml(t.deviceId)}</code>)\n` +
      `   👤 ${escapeHtml(t.senderName)} → ${escapeHtml(t.recipientName)} (${escapeHtml(t.recipientAccount)})\n` +
      `   🔖 <code>${escapeHtml(t.ref)}</code> • ${formatRelativeTime(t.createdAtMs, snap.serverTimeMs)}`
    );
  });

  await sendTelegramMessage(
    `💸 <b>${filterDeviceId ? 'Device ' : ''}Transactions (${filtered.length})</b>\n\n${lines.join('\n\n')}`,
    {
      inline_keyboard: [
        [
          { text: '📱 Devices', callback_data: 'dev_list' },
          { text: '🏠 Main Menu', callback_data: 'refresh_menu' },
        ],
      ],
    },
    chatId
  );
}

export async function handleTelegramWebhookUpdate(update: any): Promise<{ ok: boolean }> {
  const authorizedChatId = getAuthorizedChatId();

  // 1. Handle Inline Button Callbacks
  if (update?.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message?.chat?.id || cq.from?.id || '');
    const data = String(cq.data || '');

    if (chatId !== authorizedChatId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: '⛔ Unauthorized',
        show_alert: true,
      });
      return { ok: true };
    }

    await callTelegramApi('answerCallbackQuery', { callback_query_id: cq.id });

    if (data === 'refresh_menu') {
      await sendMainMenu(chatId);
    } else if (data === 'dev_list') {
      await sendDevicesList(chatId);
    } else if (data === 'tx_all') {
      await sendTransactionsList(chatId);
    } else if (data === 'global_lock') {
      await setGlobalLock(true, 'telegram');
      await sendTelegramMessage('🔒 <b>ALL devices are now LOCKED globally.</b>', undefined, chatId);
      await sendMainMenu(chatId);
    } else if (data === 'global_unlock') {
      await setGlobalLock(false, 'telegram');
      await sendTelegramMessage('🔓 <b>ALL devices are now UNLOCKED globally.</b>', undefined, chatId);
      await sendMainMenu(chatId);
    } else if (data === 'notify_all_prompt') {
      await sendTelegramMessage(
        `📢 <b>Send Notification to ALL Devices</b> [TARGET:all]\n\n` +
          `Reply to this message with duration + text:\n` +
          `<code>30s | Message here</code>  or  <code>2m | Message here</code>\n` +
          `<i>(If you omit duration, it displays for 30 seconds by default.)</i>`,
        { force_reply: true, selective: true },
        chatId
      );
    } else if (data.startsWith('dev_view:')) {
      await sendDeviceInspect(chatId, data.slice('dev_view:'.length));
    } else if (data.startsWith('dev_tx:')) {
      await sendTransactionsList(chatId, data.slice('dev_tx:'.length));
    } else if (data.startsWith('dev_lock:')) {
      const id = data.slice('dev_lock:'.length);
      const dev = await setDeviceLock(id, true);
      await sendTelegramMessage(
        dev
          ? `🔒 Device <b>${escapeHtml(dev.deviceName)}</b> (<code>${escapeHtml(dev.deviceId)}</code>) is now <b>LOCKED</b>.`
          : `❌ Device not found.`,
        undefined,
        chatId
      );
      if (dev) await sendDeviceInspect(chatId, id);
    } else if (data.startsWith('dev_unlock:')) {
      const id = data.slice('dev_unlock:'.length);
      const dev = await setDeviceLock(id, false);
      await sendTelegramMessage(
        dev
          ? `🔓 Device <b>${escapeHtml(dev.deviceName)}</b> (<code>${escapeHtml(dev.deviceId)}</code>) is now <b>UNLOCKED</b>.`
          : `❌ Device not found.`,
        undefined,
        chatId
      );
      if (dev) await sendDeviceInspect(chatId, id);
    } else if (data.startsWith('dev_notify:')) {
      const id = data.slice('dev_notify:'.length);
      await sendTelegramMessage(
        `📩 <b>Send Notification to Device</b> [TARGET:${escapeHtml(id)}]\n\n` +
          `Reply to this message with duration + text:\n` +
          `<code>30s | Message here</code>  or  <code>2m | Message here</code>\n` +
          `<i>(Default duration is 30 seconds if omitted.)</i>`,
        { force_reply: true, selective: true },
        chatId
      );
    }
    return { ok: true };
  }

  // 2. Handle Text Commands & ForceReply Prompts
  const msg = update?.message;
  if (!msg) return { ok: true };
  const chatId = String(msg.chat?.id || '');
  if (chatId !== authorizedChatId) {
    await sendTelegramMessage('⛔ Unauthorized access.', undefined, chatId);
    return { ok: true };
  }

  const text = String(msg.text || '').trim();

  // Check if replying to a [TARGET:...] notification prompt
  const replyText = String(msg.reply_to_message?.text || '');
  const targetMatch = replyText.match(/\[TARGET:([^\]]+)\]/);
  if (targetMatch && text && !text.startsWith('/')) {
    const targetDeviceId = targetMatch[1].trim();
    let durationSeconds = 30;
    let body = text;
    if (text.includes('|')) {
      const [durPart, ...rest] = text.split('|');
      const parsed = parseDurationToSeconds(durPart.trim());
      if (parsed) {
        durationSeconds = parsed;
        body = rest.join('|').trim() || text;
      }
    } else {
      const spaceTokens = text.split(/\s+/);
      const parsedFirst = parseDurationToSeconds(spaceTokens[0]);
      if (parsedFirst && spaceTokens.length > 1) {
        durationSeconds = parsedFirst;
        body = spaceTokens.slice(1).join(' ').trim();
      }
    }

    const notif = await createOwnerNotification({
      targetDeviceId,
      title: 'CBEBirr',
      message: body,
      durationSeconds,
      sentBy: 'telegram',
    });

    await sendTelegramMessage(
      `✅ <b>Notification Sent!</b>\n` +
        `🎯 <b>Target:</b> <code>${escapeHtml(notif.targetDeviceId)}</code>\n` +
        `⏱️ <b>Duration:</b> ${notif.durationSeconds}s\n` +
        `💬 <b>Message:</b> ${escapeHtml(notif.message)}`,
      undefined,
      chatId
    );
    return { ok: true };
  }

  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = (cmdRaw || '').toLowerCase().split('@')[0];

  if (cmd === '/start' || cmd === '/menu' || cmd === '/help') {
    await sendMainMenu(chatId);
  } else if (cmd === '/devices') {
    await sendDevicesList(chatId);
  } else if (cmd === '/tx') {
    const snap = await getOwnerDashboardSnapshot(true);
    const filter = args[0] ? resolveDeviceRef(args[0], snap.devices)?.deviceId || args[0] : undefined;
    await sendTransactionsList(chatId, filter);
  } else if (cmd === '/lockall') {
    const reason = args.join(' ').trim() || undefined;
    await setGlobalLock(true, 'telegram', reason);
    await sendTelegramMessage('🔒 <b>ALL devices are now LOCKED globally.</b>', undefined, chatId);
  } else if (cmd === '/unlockall') {
    await setGlobalLock(false, 'telegram');
    await sendTelegramMessage('🔓 <b>ALL devices are now UNLOCKED globally.</b>', undefined, chatId);
  } else if (cmd === '/lock' || cmd === '/unlock') {
    const isLock = cmd === '/lock';
    const snap = await getOwnerDashboardSnapshot(true);
    if (!args[0]) {
      await sendTelegramMessage(
        `Usage: <code>${cmd} #1</code> or <code>${cmd} &lt;deviceId&gt;</code>`,
        undefined,
        chatId
      );
      return { ok: true };
    }
    const target = resolveDeviceRef(args[0], snap.devices);
    if (!target) {
      await sendTelegramMessage(`❌ Device not found: <code>${escapeHtml(args[0])}</code>`, undefined, chatId);
      return { ok: true };
    }
    const reason = args.slice(1).join(' ').trim() || undefined;
    const updated = await setDeviceLock(target.deviceId, isLock, reason);
    await sendTelegramMessage(
      updated
        ? `${isLock ? '🔒 LOCKED' : '🔓 UNLOCKED'}: <b>${escapeHtml(updated.deviceName)}</b> (<code>${escapeHtml(updated.deviceId)}</code>)`
        : '❌ Update failed.',
      undefined,
      chatId
    );
  } else if (cmd === '/notify' || cmd === '/notify_all') {
    const snap = await getOwnerDashboardSnapshot(true);
    let targetId = 'all';
    let durRaw = '30s';
    let msgBody = '';

    if (cmd === '/notify_all') {
      if (args.length >= 2 && parseDurationToSeconds(args[0])) {
        durRaw = args[0];
        msgBody = args.slice(1).join(' ');
      } else {
        msgBody = args.join(' ');
      }
    } else {
      if (args.length < 2) {
        await sendTelegramMessage(
          `Usage:\n<code>/notify all 30s Hello everyone</code>\n<code>/notify #1 2m Please check balance</code>`,
          undefined,
          chatId
        );
        return { ok: true };
      }
      const targetArg = args[0];
      if (targetArg.toLowerCase() === 'all') {
        targetId = 'all';
      } else {
        const dev = resolveDeviceRef(targetArg, snap.devices);
        if (!dev) {
          await sendTelegramMessage(`❌ Device not found: <code>${escapeHtml(targetArg)}</code>`, undefined, chatId);
          return { ok: true };
        }
        targetId = dev.deviceId;
      }

      if (args.length >= 3 && parseDurationToSeconds(args[1])) {
        durRaw = args[1];
        msgBody = args.slice(2).join(' ');
      } else {
        msgBody = args.slice(1).join(' ');
      }
    }

    if (!msgBody.trim()) {
      await sendTelegramMessage('❌ Notification message cannot be empty.', undefined, chatId);
      return { ok: true };
    }

    const durSec = parseDurationToSeconds(durRaw) || 30;
    const notif = await createOwnerNotification({
      targetDeviceId: targetId,
      title: 'CBEBirr',
      message: msgBody,
      durationSeconds: durSec,
      sentBy: 'telegram',
    });

    await sendTelegramMessage(
      `✅ <b>Notification Dispatched!</b>\n` +
        `🎯 <b>Target:</b> <code>${escapeHtml(notif.targetDeviceId)}</code>\n` +
        `⏱️ <b>Duration:</b> ${notif.durationSeconds}s\n` +
        `💬 <b>Message:</b> ${escapeHtml(notif.message)}`,
      undefined,
      chatId
    );
  } else {
    await sendMainMenu(chatId);
  }

  return { ok: true };
}
