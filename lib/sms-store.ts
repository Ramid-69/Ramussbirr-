import fs from 'fs';
import path from 'path';
import { saveReceipt, StoredReceipt } from './receipt-store';

import {
  SmsMessage,
  ConversationSummary,
  MASTER_API_KEY,
  BANK_API_KEYS,
} from './sms-types';

export type { SmsMessage, ConversationSummary };
export { MASTER_API_KEY, BANK_API_KEYS };

const SMS_STORE_FILE = path.join(process.cwd(), '.sms_store.json');
const TMP_SMS_STORE_FILE = '/tmp/.sms_store.json';

// Real-time dynamic messages only - no hardcoded mock seeds from PNGs
const INITIAL_SMS_SEEDS: SmsMessage[] = [];

class SmsStore {
  private messages: SmsMessage[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.messages = [...INITIAL_SMS_SEEDS];

    // Try load persisted messages from disk
    const targets = [SMS_STORE_FILE, TMP_SMS_STORE_FILE];
    for (const f of targets) {
      try {
        if (fs.existsSync(f)) {
          const raw = fs.readFileSync(f, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // merge avoiding duplicate ids
            const map = new Map<string, SmsMessage>();
            for (const m of this.messages) map.set(m.id, m);
            for (const m of parsed) map.set(m.id, m);
            this.messages = Array.from(map.values());
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    // Sanitize any CBEBirr messages to ensure authentic cbepay1 link and +251 phone
    this.messages = this.messages.map((m) => {
      if (m.conversationId === 'All Banks' || m.sender === 'All Banks' || m.senderName === 'All Banks') {
        m.conversationId = 'CBEBirr';
        m.sender = 'CBEBirr';
        m.senderName = 'CBEBirr';
        m.bankName = 'CBEBirr';
        m.deviceId = 'all';
      }
      if (m.conversationId === 'CBEBirr' || m.sender === 'CBEBirr' || m.isBank) {
        let cleanedText = m.text
          .replace(/For your feedback please click the link https:\/\/shorturl\.at\/[^\s]+/gi, '')
          .replace(/For invoice\s+https:\/\/cbepay1\.cbe\.com\.et\/aureceipt/gi, 'Thank You! CBEBirr transaction Receipt. Com https://cbepay1.cbe.com.et/aureceipt')
          .replace(/PH=\+?959842829/gi, 'PH=+251959754788')
          .replace(/PH=0959754788/gi, 'PH=+251959754788')
          .trim();
        let cleanedUrl = m.receiptUrl;
        if (cleanedUrl) {
          cleanedUrl = cleanedUrl
            .replace(/PH=\+?959842829/gi, 'PH=+251959754788')
            .replace(/PH=0959754788/gi, 'PH=+251959754788');
        }
        return {
          ...m,
          text: cleanedText,
          receiptUrl: cleanedUrl,
        };
      }
      return m;
    });

    this.initialized = true;
  }

  private persist() {
    try {
      const data = JSON.stringify(this.messages, null, 2);
      try {
        fs.writeFileSync(SMS_STORE_FILE, data, 'utf-8');
      } catch {}
      try {
        fs.writeFileSync(TMP_SMS_STORE_FILE, data, 'utf-8');
      } catch {}
    } catch {
      // ignore
    }
  }

  public getAllMessages(deviceId?: string, unsyncedOnly?: boolean): SmsMessage[] {
    this.init();
    let res = [...this.messages];
    if (deviceId && deviceId !== 'all') {
      res = res.filter(
        (m) => !m.deviceId || m.deviceId === 'all' || m.deviceId === 'dev_galaxy_a12' || m.deviceId === deviceId
      );
    }
    if (unsyncedOnly) {
      res = res.filter((m) => !m.synced);
    }
    return res.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public getConversationMessages(conversationId: string): SmsMessage[] {
    this.init();
    const cleanId = conversationId.trim().toLowerCase();
    return this.messages
      .filter((m) => m.conversationId.trim().toLowerCase() === cleanId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public getConversations(): ConversationSummary[] {
    this.init();
    const map = new Map<string, SmsMessage[]>();

    for (const m of this.messages) {
      const key = m.conversationId || m.senderName || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }

    const summaries: ConversationSummary[] = [];

    // Colors for avatars
    const colorMap: Record<string, string> = {
      'CBEBirr': '#7a1c7d',
      'Safaricom': '#e60000',
      '127': '#009fe3',
      'My 😘': '#10b981',
      '34000': '#64748b',
      '994': '#0284c7',
      '•': '#2563eb',
      '251994': '#0284c7',
      '131': '#f59e0b',
      'ጅብሪል': '#8b5cf6',
      'BeepCall710': '#64748b',
      'A A': '#10b981',
      '+251708279538': '#6b7280',
      'EoC': '#6b7280',
      'CallSign': '#6b7280',
    };

    for (const [key, msgs] of map.entries()) {
      msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = msgs[msgs.length - 1];
      const unreadCount = msgs.filter((m) => !m.isOutgoing && m.status !== 'read').length;

      let avatarLetter = key.slice(0, 1).toUpperCase();
      if (key === 'My 😘') avatarLetter = 'M';
      if (key === '•') avatarLetter = '•';

      summaries.push({
        id: key,
        senderName: key,
        lastMessage: last.text,
        lastTimestamp: last.timestamp,
        lastDate: last.date,
        unreadCount,
        avatarColor: colorMap[key] || '#64748b',
        avatarLetter,
        isBank: msgs.some((m) => m.isBank),
        isContact: ['My 😘', 'A A', 'ጅብሪል', '•'].includes(key),
      });
    }

    // Sort by latest message date descending
    return summaries.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }

  public addMessage(msgInput: Partial<SmsMessage>): SmsMessage {
    this.init();

    // Deduplicate by transaction ID (txnId) so existing transactions are never duplicated
    if (msgInput.txnId) {
      const cleanTxn = msgInput.txnId.trim().toUpperCase();
      const existing = this.messages.find(
        (m) => m.txnId && m.txnId.trim().toUpperCase() === cleanTxn
      );
      if (existing) {
        return existing;
      }
    }

    const now = new Date();
    const id = msgInput.id || `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let senderName = msgInput.senderName || msgInput.sender || 'CBEBirr';
    let conversationId = msgInput.conversationId || senderName;
    if (conversationId === 'All Banks' || senderName === 'All Banks' || conversationId.toLowerCase().includes('cbe')) {
      conversationId = 'CBEBirr';
      senderName = 'CBEBirr';
    }
    const dateStr = msgInput.date || now.toISOString();

    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const timestamp = msgInput.timestamp || `${hour12}:${mins} ${ampm}`;

    const newMsg: SmsMessage = {
      id,
      conversationId,
      sender: msgInput.sender === 'All Banks' ? 'CBEBirr' : (msgInput.sender || senderName),
      senderName,
      text: msgInput.text || '',
      timestamp,
      date: dateStr,
      isOutgoing: !!msgInput.isOutgoing,
      status: msgInput.status || 'delivered',
      isBank: msgInput.isBank ?? ['CBEBirr', '127', 'Safaricom'].includes(conversationId),
      bankName: msgInput.bankName || (conversationId === 'CBEBirr' ? 'CBEBirr' : undefined),
      amount: msgInput.amount,
      balance: msgInput.balance,
      recipient: msgInput.recipient,
      recipientAccount: msgInput.recipientAccount,
      fullName: msgInput.fullName,
      reference: msgInput.reference,
      txnId: msgInput.txnId,
      receiptUrl: msgInput.receiptUrl,
      deviceId: msgInput.deviceId || 'all',
      synced: msgInput.synced ?? false,
      isDeposit: msgInput.isDeposit,
    };

    // If it's a CBEBirr transaction with a TID, also register it in receipt-store
    if (newMsg.txnId) {
      const storedRec: StoredReceipt = {
        ref: newMsg.reference || newMsg.txnId,
        amt: newMsg.amount || '0.00',
        date: newMsg.date,
        rec: newMsg.recipientAccount || '1000760389289',
        name: newMsg.recipient || 'Miss Simera Gofer Abdisa',
        user: newMsg.fullName || 'AYMEN NIGATU YIMAM',
        acc: '959754788',
        reason: newMsg.isDeposit ? 'Deposit to CBE Birr' : 'Customer transfer to CBE account',
        status: 'Completed',
        orderId: newMsg.txnId,
      };
      try {
        saveReceipt(storedRec);
      } catch {}
    }

    this.messages.push(newMsg);
    this.persist();
    return newMsg;
  }

  public markMessagesSynced(ids?: string[]): void {
    this.init();
    if (!ids || ids.length === 0) {
      this.messages.forEach((m) => (m.synced = true));
    } else {
      const set = new Set(ids);
      this.messages.forEach((m) => {
        if (set.has(m.id)) m.synced = true;
      });
    }
    this.persist();
  }

  public markConversationRead(conversationId: string): void {
    this.init();
    const cleanId = conversationId.trim().toLowerCase();
    this.messages.forEach((m) => {
      if (m.conversationId.trim().toLowerCase() === cleanId) {
        m.status = 'read';
      }
    });
    this.persist();
  }

  public deleteMessages(ids: string[]): void {
    this.init();
    const set = new Set(ids);
    this.messages = this.messages.filter((m) => !set.has(m.id));
    this.persist();
  }

  public clearAllMessages(): void {
    this.init();
    this.messages = [];
    this.persist();
  }

  public resetToSeeds(): void {
    this.messages = [...INITIAL_SMS_SEEDS];
    this.persist();
  }

  public validateApiKey(apiKey?: string | null): { valid: boolean; bank?: string; isMaster?: boolean } {
    if (!apiKey) return { valid: false };
    const clean = apiKey.trim();
    if (clean === MASTER_API_KEY) {
      return { valid: true, isMaster: true, bank: 'All Banks' };
    }
    if (BANK_API_KEYS[clean]) {
      return { valid: true, isMaster: false, bank: BANK_API_KEYS[clean] };
    }
    return { valid: false };
  }
}

export const smsStore = new SmsStore();
