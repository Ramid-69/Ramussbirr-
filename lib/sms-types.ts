export interface SmsMessage {
  id: string;
  conversationId: string; // e.g. "CBEBirr", "Safaricom", "127", "34000", "994", "My 😘"
  sender: string;
  senderName: string;
  text: string;
  timestamp: string; // "12:40 PM", "Nov 4", etc.
  date: string; // ISO or "2026-10-29 12:40:02"
  isOutgoing: boolean;
  status: 'delivered' | 'read' | 'pending';
  isBank: boolean;
  bankName?: string;
  amount?: string;
  balance?: string;
  recipient?: string;
  recipientAccount?: string;
  fullName?: string;
  reference?: string;
  txnId?: string;
  receiptUrl?: string;
  deviceId?: string;
  synced?: boolean;
  isDeposit?: boolean;
  createdAt?: number;
}

export interface ConversationSummary {
  id: string;
  senderName: string;
  lastMessage: string;
  lastTimestamp: string;
  lastDate: string;
  unreadCount: number;
  avatarColor?: string;
  avatarLetter?: string;
  isBank?: boolean;
  isContact?: boolean;
}

export const MASTER_API_KEY = 'Ram69';

export const BANK_API_KEYS: Record<string, string> = {
  'Ram69': 'All Banks (Master)',
  'cbe-api-key': 'Commercial Bank of Ethiopia',
  'cbebirr-api-key': 'CBEBirr Mobile Money',
  'telebirr-api-key': 'telebirr (Ethio telecom)',
  'mpesa-api-key': 'Safaricom M-PESA',
  'boa-api-key': 'Bank of Abyssinia',
  'awash-api-key': 'Awash Bank',
  'dashen-api-key': 'Dashen Bank',
  'sinqe-api-key': 'Sinqe Bank',
  'coop-api-key': 'Cooperative Bank of Oromia',
  'oromia-api-key': 'Oromia Bank',
};
