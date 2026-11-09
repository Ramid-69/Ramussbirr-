'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Plus,
  Trash2,
  Phone,
  Video,
  Image as ImageIcon,
  Camera,
  Smile,
  Mic,
  Send,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Download,
  Share2,
  X,
  Volume2,
  MicOff,
  PhoneOff,
  Copy,
  RefreshCw,
  Sliders,
  Sparkles,
  Smartphone,
  Shield,
  Layers,
  FileText,
  User,
  Users,
  MessageSquare,
  Bell,
  Pin,
  CheckCircle2,
} from 'lucide-react';
import { SmsMessage, ConversationSummary, MASTER_API_KEY, BANK_API_KEYS } from '@/lib/sms-types';
import { nativeBridge } from '@/lib/nativeBridge';
import QRCode from 'qrcode';
import { downloadReceiptPdfUniversally } from '@/lib/client-receipt-pdf';
import OfficialReceiptView, { OfficialReceiptData } from './OfficialReceiptView';

interface SamsungMessagesAppProps {
  onClose?: () => void;
  initialConversationId?: string;
}

// Native system notification and phone vibration (uses phone's native system tone, no artificial audio synth)
function triggerSystemNotification(title: string, body: string) {
  try {
    // 1. Hardware vibration using phone's native vibration motor
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([180, 80, 180]);
    }
    // 2. Android WebView Native Bridge
    if (typeof window !== 'undefined' && (window as any).Android?.notify) {
      (window as any).Android.notify(title, body);
      return;
    }
    // 3. System Notification API (plays device's configured notification sound)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/assets/cbe_qr_center_badge_crisp.png',
          badge: '/assets/cbe_qr_center_badge_crisp.png',
          tag: 'cbe-sms-system-alert',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, {
              body,
              icon: '/assets/cbe_qr_center_badge_crisp.png',
              badge: '/assets/cbe_qr_center_badge_crisp.png',
              tag: 'cbe-sms-system-alert',
            });
          }
        });
      }
    }
  } catch {}
}

export default function SamsungMessagesApp({ onClose, initialConversationId }: SamsungMessagesAppProps) {
  // Navigation / View State
  const [activeTab, setActiveTab] = useState<'conversations' | 'contacts'>('conversations');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Personal' | 'Banking' | 'Transactions'>('All');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Messages & Conversations Data
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentMessages, setCurrentMessages] = useState<SmsMessage[]>([]);
  const [allMessagesCount, setAllMessagesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Selection / Multi-delete mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  // Dropdown Menu State
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

  // Hidden Developer Settings ("Hide Setting")
  const [showDevSettings, setShowDevSettings] = useState(false);

  // Official CBE Receipt Modal State
  const [activeReceiptModalData, setActiveReceiptModalData] = useState<OfficialReceiptData | null>(null);

  // Calling Modal State
  const [callingContact, setCallingContact] = useState<{ name: string; isVideo?: boolean } | null>(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Input & Messaging
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Device Profile & Settings
  const [deviceId, setDeviceId] = useState('dev_galaxy_a12');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Test form state in Developer Settings
  const [devFullName, setDevFullName] = useState('AYMEN NIGATU YIMAM');
  const [devAmount, setDevAmount] = useState('300.00');
  const [devReceiverName, setDevReceiverName] = useState('SANI AHMED MOHAMMED');
  const [devReceiverAcc, setDevReceiverAcc] = useState('1000440979843');
  const [devBalance, setDevBalance] = useState('3.99');
  const [devDepositAmount, setDevDepositAmount] = useState('500.00');
  const [devDepositBalance, setDevDepositBalance] = useState('503.99');

  // Android Default SMS App Dialog matching user screenshot (image.png)
  const [showDefaultSmsDialog, setShowDefaultSmsDialog] = useState(false);
  const [selectedDefaultApp, setSelectedDefaultApp] = useState<'assistant' | 'current' | 'cbe_messages' | 'third_party'>('cbe_messages');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef<number>(0);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const hasPrompted = localStorage.getItem('has_prompted_default_sms_app');
        if (!hasPrompted) {
          setShowDefaultSmsDialog(true);
        }
      }
    } catch {}
  }, []);

  // Show Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Fetch conversations and messages from backend
  const fetchMessagesData = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch(`/api/sms/messages?deviceId=${deviceId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setConversations(data.conversations || []);
        setAllMessagesCount(data.count || 0);

        // If new messages arrived while polling, trigger system notification
        if (isPolling && previousMessageCountRef.current > 0 && data.count > previousMessageCountRef.current) {
          triggerSystemNotification('New Message', 'New SMS received');
        }
        previousMessageCountRef.current = data.count || 0;

        if (activeConversationId) {
          const convMsgs = (data.messages || []).filter(
            (m: SmsMessage) => m.conversationId.trim().toLowerCase() === activeConversationId.trim().toLowerCase()
          );
          setCurrentMessages(convMsgs);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, deviceId]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadInitialMessages = async () => {
      try {
        const res = await fetch(`/api/sms/messages?deviceId=${deviceId}`);
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (data && data.success && isMounted) {
          setConversations(data.conversations || []);
          setAllMessagesCount(data.count || 0);
          previousMessageCountRef.current = data.count || 0;
          if (activeConversationId) {
            const convMsgs = (data.messages || []).filter(
              (m: SmsMessage) => m.conversationId.trim().toLowerCase() === activeConversationId.trim().toLowerCase()
            );
            setCurrentMessages(convMsgs);
          }
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId, deviceId]);

  // Real-time polling loop (every 2.5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessagesData(true);
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchMessagesData]);

  // Scroll to bottom when new messages arrive in active conversation
  useEffect(() => {
    if (activeConversationId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages, activeConversationId]);

  // Filter conversations according to category and search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Category filter
      if (selectedCategory === 'Personal' && c.isBank) return false;
      if (selectedCategory === 'Banking' && !c.isBank) return false;
      if (selectedCategory === 'Transactions' && c.id !== 'CBEBirr' && c.id !== '127' && c.id !== 'Safaricom') {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.senderName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
      }
      return true;
    });
  }, [conversations, selectedCategory, searchQuery]);

  // Contacts seed list for Contacts Tab
  const CONTACTS_LIST = useMemo(
    () => [
      { name: 'A A', phone: '+251911223344', note: 'Friend', initial: 'A', color: '#10b981' },
      { name: 'Abdu Siraj Siraj', phone: '0965848508', note: 'CBE Sender', initial: 'A', color: '#3b82f6' },
      { name: 'BeepCall710', phone: '710', note: 'Service', initial: 'B', color: '#64748b' },
      { name: 'CBEBirr Customer Care', phone: '951', note: 'Bank', initial: 'C', color: '#7a1c7d' },
      { name: 'Fayyee Lammeessa Didhaa', phone: '0715095670', note: 'M-PESA Recipient', initial: 'F', color: '#e60000' },
      { name: 'ጅብሪል', phone: '+251912345678', note: 'Contact', initial: 'ጅ', color: '#8b5cf6' },
      { name: 'My 😘', phone: '+251959754788', note: 'Favorite', initial: 'M', color: '#10b981' },
      { name: 'Miss Simera Gofer Abdisa', phone: '1000760389289', note: 'CBE Recipient', initial: 'M', color: '#ec4899' },
      { name: 'SANI AHMED MOHAMMED', phone: '1000440979843', note: 'CBE Recipient', initial: 'S', color: '#f59e0b' },
      { name: 'Safaricom Ethiopia', phone: '700', note: 'Carrier', initial: 'S', color: '#e60000' },
      { name: 'telebirr (Ethio telecom)', phone: '127', note: 'Mobile Money', initial: 'T', color: '#009fe3' },
    ],
    []
  );

  // Send message inside current conversation
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConversationId || isSending) return;
    setIsSending(true);

    try {
      const newOutgoingMsg: Partial<SmsMessage> = {
        conversationId: activeConversationId,
        sender: 'You',
        senderName: 'You',
        text: inputText.trim(),
        isOutgoing: true,
        status: 'delivered',
        deviceId,
      };

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOutgoingMsg),
      });

      if (res.ok) {
        setInputText('');
        fetchMessagesData();
      }
    } catch {
      showToast('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Open conversation
  const handleOpenConversation = (id: string) => {
    setActiveConversationId(id);
    setIsSelectionMode(false);
    setSelectedMsgIds(new Set());
    const convMsgs = conversations.find((c) => c.id === id);
    if (convMsgs) {
      // Mark read locally
      convMsgs.unreadCount = 0;
    }
  };

  // Toggle selection
  const handleToggleSelectMessage = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Delete selected messages
  const handleDeleteSelected = async () => {
    if (selectedMsgIds.size === 0) return;
    try {
      const res = await fetch('/api/sms/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedMsgIds) }),
      });
      if (res.ok) {
        showToast(`Deleted ${selectedMsgIds.size} message(s)`);
        setIsSelectionMode(false);
        setSelectedMsgIds(new Set());
        fetchMessagesData();
      }
    } catch {
      showToast('Error deleting messages');
    }
  };

  // Trigger Instant CBEBirr Transfer Test
  const handleTriggerCbeTransfer = async () => {
    try {
      const res = await fetch('/api/sms/cbebirr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: devFullName,
          amount: devAmount,
          recipient: devReceiverName,
          recipientAccount: devReceiverAcc,
          balance: devBalance,
          deviceId,
        }),
      });
      if (res.ok) {
        triggerSystemNotification('CBEBirr', `Transferred ${devAmount} Br to ${devReceiverName}`);
        showToast('Real-time CBEBirr SMS created and saved!');
        fetchMessagesData();
      }
    } catch {
      showToast('Failed to trigger CBEBirr test');
    }
  };

  // Trigger Instant Birr Deposit Test
  const handleTriggerBirrDeposit = async () => {
    try {
      const res = await fetch('/api/sms/cbebirr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: devDepositAmount,
          balance: devDepositBalance,
          isDeposit: true,
          deviceId,
        }),
      });
      if (res.ok) {
        triggerSystemNotification('CBEBirr', `Deposited ${devDepositAmount} Br to CBE Birr`);
        showToast('Real-time Birr Deposit SMS created and saved!');
        fetchMessagesData();
      }
    } catch {
      showToast('Failed to trigger deposit test');
    }
  };

  // Reset queue to authentic seeds
  const handleResetQueue = async () => {
    try {
      const res = await fetch('/api/sms/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) {
        showToast('Reset queue to authentic screenshots');
        fetchMessagesData();
      }
    } catch {
      showToast('Failed to reset');
    }
  };

  // Extract real-time transaction details dynamically from any SMS message
  const extractReceiptDataFromMsg = (msg: SmsMessage): OfficialReceiptData => {
    const text = msg.text || '';

    // 1. Try URL parameters first
    let urlParams: URLSearchParams | null = null;
    const urlMatch = text.match(/https?:\/\/[^\s]+/i) || (msg.receiptUrl ? [msg.receiptUrl] : null);
    if (urlMatch) {
      try {
        const cleanUrl = urlMatch[0].replace(/[.,;:)]+$/, '');
        const u = new URL(cleanUrl);
        urlParams = u.searchParams;
      } catch {}
    }

    // Reference / TID
    let ref = msg.reference || msg.txnId || (urlParams?.get('TID') || urlParams?.get('ref') || '');
    if (!ref) {
      const tidMatch =
        text.match(/Txn\s*ID\s*[:\s]*([A-Za-z0-9,]+)/i) ||
        text.match(/receipt\s*number\s*([A-Za-z0-9]+)/i) ||
        text.match(/በደረሰኝ\s*ቁጥር\s*([A-Za-z0-9]+)/) ||
        text.match(/\b(FT[0-9A-Z]{10,14})\b/i) ||
        text.match(/\b(DJ[0-9A-Z]{8,12})\b/i) ||
        text.match(/\b(DCWD[0-9A-Z]{4,8})\b/i);
      if (tidMatch) {
        ref = tidMatch[1].split(',')[0].trim();
      }
    }
    if (!ref) {
      ref = 'FT262413JRB4';
    }

    // Amount
    let amt = msg.amount || urlParams?.get('amt') || '';
    if (!amt) {
      const amtMatch =
        text.match(/transferred\s*\(?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*\)?\s*,?\s*Br/i) ||
        text.match(/deposited\s*\[?([0-9]+(?:\.[0-9]{1,2})?)\]?\s*Br/i) ||
        text.match(/made\s*([0-9]+(?:\.[0-9]{1,2})?)\s*Br/i) ||
        text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*Br/i);
      if (amtMatch) {
        amt = amtMatch[1];
      }
    }
    if (!amt || isNaN(parseFloat(amt))) amt = '10.00';

    // Recipient Account & Recipient Name
    let rec = msg.recipientAccount || urlParams?.get('rec') || '';
    let name = msg.recipient || urlParams?.get('name') || '';

    if (!rec || !name) {
      const toMatch = text.match(/to\s+([0-9]{9,16})\s*[-–]\s*([^(.]+?)(?:\s*\(Transfer\)|\s+on\s+|\.|\s+with)/i);
      if (toMatch) {
        if (!rec) rec = toMatch[1].trim();
        if (!name) name = toMatch[2].trim();
      }
    }

    if (!rec || !name) {
      const accMatch = text.match(/Account\s*Number\s*([0-9]{9,16})\s*[-–]\s*([^(.]+?)(?:\s+on\s+|\.|\s+with)/i);
      if (accMatch) {
        if (!rec) rec = accMatch[1].trim();
        if (!name) name = accMatch[2].trim();
      }
    }

    if (!rec || !name) {
      const amhMatch = text.match(/ከ\s+([0-9]{9,16})\s*[-–]\s*([^(.]+?)(?:\s+በቀን|\.|\s+በደረሰኝ)/);
      if (amhMatch) {
        if (!rec) rec = amhMatch[1].trim();
        if (!name) name = amhMatch[2].trim();
      }
    }

    if (!rec) rec = '1000760389289';
    if (!name) name = 'Miss Simera Gofer Abdisa';

    // Customer / Payer Name
    let user = msg.fullName || urlParams?.get('user') || '';
    if (!user) {
      const dearMatch = text.match(/Dear\s+([A-Za-z\s]+?),/i);
      if (dearMatch && !dearMatch[1].toLowerCase().includes('customer')) {
        user = dearMatch[1].trim();
      }
    }
    if (!user) user = 'AYMEN NIGATU YIMAM';

    // Payer Phone / Account
    let acc = urlParams?.get('PH') || urlParams?.get('acc') || '';
    if (!acc) {
      const phMatch = text.match(/PH=([+0-9]+)/i);
      if (phMatch) acc = phMatch[1];
    }
    if (!acc) acc = '0959754788';

    // Date
    let date = msg.date || urlParams?.get('date') || '';
    if (!date) {
      const onMatch =
        text.match(/on\s+(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/i) ||
        text.match(/በቀን\s+(\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)/);
      if (onMatch) {
        date = onMatch[1].trim();
      }
    }
    if (!date) date = '2026-10-29 12:40:02';

    // Bank
    let bank = msg.bankName || urlParams?.get('bank') || '';
    if (text.includes('MPESA') || text.includes('M-PESA')) bank = 'MPESA';
    if (text.includes('telebirr')) bank = 'telebirr';

    // Reason
    let reason = urlParams?.get('reason') || '';
    if (!reason) {
      if (msg.isDeposit || text.toLowerCase().includes('deposit') || text.toLowerCase().includes('deposited')) {
        reason = 'Deposit to CBE Birr account';
      } else if (bank) {
        reason = `Transfer to ${bank}`;
      } else {
        reason = 'Customer transfer to CBE account';
      }
    }

    // Fees & VAT
    let serviceCharge = urlParams?.get('fee') || urlParams?.get('serviceCharge') || '';
    let vat = urlParams?.get('vat') || '';
    let totalPaid = urlParams?.get('totalPaid') || '';

    if (text.includes('Services Charge') || text.includes('Service Charge')) {
      const feeMatch = text.match(/(?:Services|Service)\s*Charge\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      if (feeMatch) serviceCharge = feeMatch[1];
    }
    if (text.includes('Tax') || text.includes('VAT')) {
      const vatMatch = text.match(/(?:Tax|VAT)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      if (vatMatch && !vatMatch[1].includes('15')) vat = vatMatch[1];
    }

    return {
      ref,
      amt,
      rec,
      name,
      user,
      acc,
      date,
      reason,
      bank,
      serviceCharge: serviceCharge || '0.00',
      vat: vat || '0.00',
      totalPaid: totalPaid || amt,
    };
  };

  // Open Official Receipt directly in Browser tab matching user requirement
  const handleOpenReceiptFromMsg = (msg: SmsMessage) => {
    const data = extractReceiptDataFromMsg(msg);
    const params = new URLSearchParams({
      TID: data.ref,
      ref: data.ref,
      PH: data.acc || '',
    });
    if (data.amt) params.set('amt', data.amt);
    if (data.name) params.set('name', data.name);
    if (data.user) params.set('user', data.user);
    if (data.rec) params.set('rec', data.rec);
    if (data.date) params.set('date', data.date);
    if (data.reason) params.set('reason', data.reason);
    if (data.bank) params.set('bank', data.bank);
    if (data.serviceCharge) params.set('fee', data.serviceCharge);
    if (data.vat) params.set('vat', data.vat);
    if (data.totalPaid) params.set('totalPaid', data.totalPaid);

    const browserReceiptUrl = `/aureceipt?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.open(browserReceiptUrl, '_blank');
    }
  };

  // Copy working official receipt link to clipboard
  const handleCopyReceiptLink = (msg: SmsMessage) => {
    const data = extractReceiptDataFromMsg(msg);
    const params = new URLSearchParams({
      TID: data.ref,
      ref: data.ref,
      PH: data.acc || '',
    });
    if (data.amt) params.set('amt', data.amt);
    if (data.name) params.set('name', data.name);
    if (data.user) params.set('user', data.user);
    if (data.rec) params.set('rec', data.rec);
    if (data.date) params.set('date', data.date);
    if (data.reason) params.set('reason', data.reason);
    if (data.bank) params.set('bank', data.bank);
    if (data.serviceCharge) params.set('fee', data.serviceCharge);
    if (data.vat) params.set('vat', data.vat);
    if (data.totalPaid) params.set('totalPaid', data.totalPaid);

    const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/aureceipt?${params.toString()}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Official receipt link copied to clipboard!');
      }).catch(() => {
        showToast('Link copied!');
      });
    } else {
      showToast('Official receipt link copied!');
    }
  };

  const handleConfirmDefaultSms = () => {
    try {
      localStorage.setItem('has_prompted_default_sms_app', 'true');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      if (typeof window !== 'undefined' && (window as any).Android?.setDefaultSms) {
        (window as any).Android.setDefaultSms();
      }
    } catch {}
    setShowDefaultSmsDialog(false);
    showToast('Messages set as default SMS app');
  };

  // Parse and render rich text with blue clickable underlines for accounts, dates, phone numbers, and receipt links
  const renderRichText = (text: string, msg: SmsMessage) => {
    const isCbe = msg.conversationId === 'CBEBirr' || msg.isBank;

    // Clean legacy shorturl.at feedback link
    const cleanedText = text
      .replace(/For your feedback please click the link https:\/\/shorturl\.at\/[^\s]+/gi, '')
      .replace(/For invoice\s+https:\/\/cbepay1\.cbe\.com\.et\/aureceipt/gi, 'Thank You! CBEBirr transaction Receipt. Com https://cbepay1.cbe.com.et/aureceipt');

    // Detect URL or specific patterns
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = cleanedText.split(urlRegex);

    return (
      <div className="leading-relaxed break-words whitespace-pre-wrap select-text">
        {parts.map((part, idx) => {
          if (part.match(urlRegex)) {
            const isReceipt =
              part.includes('cbepay1.cbe.com.et') ||
              part.includes('cbetransaction.cbe') ||
              part.includes('aureceipt') ||
              part.includes('receipt') ||
              part.includes('shorturl.at');

            if (isReceipt || isCbe) {
              const data = extractReceiptDataFromMsg(msg);
              const tid = data.ref || 'DJT61TBG';
              let ph = '+251959754788';
              if (data.acc) {
                const digits = data.acc.replace(/\D/g, '');
                if (digits.startsWith('251')) ph = `+${digits}`;
                else if (digits.startsWith('0')) ph = `+251${digits.slice(1)}`;
                else ph = `+251${digits}`;
              }
              const displayUrl = `https://cbepay1.cbe.com.et/aureceipt?TID=${tid}&PH=${ph}`;

              const params = new URLSearchParams({
                TID: tid,
                ref: tid,
                PH: ph,
              });
              if (data.amt) params.set('amt', data.amt);
              if (data.name) params.set('name', data.name);
              if (data.user) params.set('user', data.user);
              if (data.rec) params.set('rec', data.rec);
              if (data.date) params.set('date', data.date);
              if (data.reason) params.set('reason', data.reason);
              if (data.bank) params.set('bank', data.bank);
              if (data.serviceCharge) params.set('fee', data.serviceCharge);
              if (data.vat) params.set('vat', data.vat);
              if (data.totalPaid) params.set('totalPaid', data.totalPaid);

              const workingBrowserUrl = `/aureceipt?${params.toString()}`;

              return (
                <a
                  key={idx}
                  href={workingBrowserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-[#0381FE] underline font-medium cursor-pointer active:opacity-75 inline"
                >
                  {displayUrl}
                </a>
              );
            }

            return (
              <a
                key={idx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#0381FE] underline font-medium cursor-pointer active:opacity-75 inline"
              >
                {part}
              </a>
            );
          }

          // Highlight phone numbers, dates, and transaction IDs with underline
          return (
            <span key={idx}>
              {part.split(/(\b\d{9,13}\b|\b\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?\b|\b[A-Z0-9]{8,12}\b|\*\d+[*#])/g).map((subPart, sIdx) => {
                if (
                  subPart.match(/^\d{9,13}$/) ||
                  subPart.match(/^\d{2}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}/) ||
                  subPart.match(/^[A-Z0-9]{8,12}$/) ||
                  subPart.match(/^\*\d+[*#]/)
                ) {
                  return (
                    <span
                      key={sIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (subPart.length === 8 || subPart.startsWith('FT') || subPart.startsWith('DJ')) {
                          handleOpenReceiptFromMsg(msg);
                        } else {
                          nativeBridge.showToast?.(`Tapped: ${subPart}`);
                        }
                      }}
                      className="text-[#0381FE] underline font-medium cursor-pointer"
                    >
                      {subPart}
                    </span>
                  );
                }
                return subPart;
              })}
            </span>
          );
        })}
      </div>
    );
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const curlCommand = `curl -X POST "${currentOrigin}/api/sms/cbebirr" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: Ram69" \\
  -d '{
    "fullName": "AYMEN NIGATU YIMAM",
    "amount": "300.00",
    "recipient": "SANI AHMED MOHAMMED",
    "recipientAccount": "1000440979843",
    "balance": "3.99"
  }'`;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col w-full h-full select-none overflow-hidden font-sans transition-colors duration-200 ${
        darkMode ? 'bg-[#121212] text-white' : 'bg-white text-[#111827]'
      }`}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1f]/90 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-medium flex items-center gap-2 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-[#0381FE]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW 1: CONVERSATION LIST & CONTACTS DIRECTORY */}
      {!activeConversationId && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Bar with One UI Collapsible Header */}
          <div className={`shrink-0 px-5 pt-3 pb-2 transition-colors ${darkMode ? 'bg-[#121212]' : 'bg-white'}`}>
            <div className="flex items-center justify-between h-10">
              {/* Back to CBEBirr App button (when embedded) */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white rounded-full active:scale-95 transition-transform"
                title="Return to CBEBirr Banking App"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-1.5 relative">
                <button
                  type="button"
                  onClick={() => setIsSearching(!isSearching)}
                  className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full active:scale-95 transition-all"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsTopMenuOpen(!isTopMenuOpen)}
                  className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full active:scale-95 transition-all"
                  aria-label="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu matching Screenshot */}
                <AnimatePresence>
                  {isTopMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className={`absolute right-0 top-12 w-56 rounded-3xl shadow-2xl py-2 z-50 border transition-colors ${
                        darkMode ? 'bg-[#1E1E1E] border-slate-800 text-slate-200' : 'bg-white border-slate-100 text-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectionMode(true);
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          showToast('Categories editor');
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Edit categories
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          showToast('No starred messages');
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Starred messages
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          showToast('Trash is empty');
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Trash
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDefaultSmsDialog(true);
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                      >
                        <span>Default SMS app</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">
                          System
                        </span>
                      </button>
                      <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                      {/* Hidden Developer Settings trigger ("Hide Setting") */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowDevSettings(true);
                          setIsTopMenuOpen(false);
                        }}
                        className="w-full text-left px-5 py-2.5 text-sm font-semibold text-[#0381FE] hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between"
                      >
                        <span>Developer Settings</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-bold">
                          Ram69
                        </span>
                      </button>

                      {/* Dark mode toggle */}
                      <button
                        type="button"
                        onClick={() => setDarkMode(!darkMode)}
                        className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {darkMode ? 'Light Theme' : 'Dark Theme'}
                      </button>

                      {onClose && (
                        <button
                          type="button"
                          onClick={onClose}
                          className="w-full text-left px-5 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        >
                          Return to CBEBirr App
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Large One UI Header Title */}
            <div className="pt-2 pb-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Messages</h1>
            </div>

            {/* Search Input (conditionally visible) */}
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 mb-2"
              >
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages, senders, accounts..."
                    className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')}>
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Category Tabs: "All", "Personal", "Banking / OTP", "Transactions" */}
            <div className="flex items-center gap-6 mt-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none pb-1">
              {(['All', 'Personal', 'Banking', 'Transactions'] as const).map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`relative pb-2 text-sm font-semibold transition-colors shrink-0 ${
                      isActive
                        ? 'text-[#0381FE] font-bold'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <span>{cat === 'Banking' ? 'Banking / OTP' : cat}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeCategoryIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0381FE] rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selection Mode Top Banner */}
          {isSelectionMode && (
            <div className="shrink-0 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {selectedMsgIds.size} selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMsgIds.size === conversations.length) {
                      setSelectedMsgIds(new Set());
                    } else {
                      setSelectedMsgIds(new Set(conversations.map((c) => c.id)));
                    }
                  }}
                  className="text-xs font-semibold text-[#0381FE]"
                >
                  {selectedMsgIds.size === conversations.length ? 'Deselect all' : 'Select all'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedMsgIds(new Set());
                  }}
                  className="text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Conversations or Contacts */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {activeTab === 'conversations' ? (
              <div className="divide-y divide-slate-100/60 dark:divide-slate-800/60 pb-20">
                {isLoading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Loading conversations...</div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">No messages found</div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = selectedMsgIds.has(conv.id);

                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          if (isSelectionMode) {
                            handleToggleSelectMessage(conv.id);
                          } else {
                            handleOpenConversation(conv.id);
                          }
                        }}
                        className={`flex items-center gap-3.5 px-5 py-3.5 cursor-pointer active:bg-slate-50 dark:active:bg-slate-900 transition-colors ${
                          isSelected ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        {/* Selection Checkbox */}
                        {isSelectionMode && (
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        )}

                        {/* Round Avatar matching Samsung One UI */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm"
                          style={{ backgroundColor: conv.avatarColor || '#64748b' }}
                        >
                          {conv.id === 'CBEBirr' ? (
                            <span className="text-xs font-black tracking-tighter">CBE</span>
                          ) : conv.id === 'Safaricom' ? (
                            <span className="text-xs font-black">SAF</span>
                          ) : conv.id === '127' ? (
                            <span className="text-xs font-black">127</span>
                          ) : conv.avatarLetter ? (
                            conv.avatarLetter
                          ) : (
                            <User className="w-6 h-6 text-white" />
                          )}
                        </div>

                        {/* Middle Text Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className="font-bold text-[15px] truncate text-slate-900 dark:text-slate-100">
                              {conv.senderName}
                            </h3>
                            <span className="text-xs text-slate-400 shrink-0 ml-2">{conv.lastTimestamp}</span>
                          </div>
                          <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate leading-snug">
                            {conv.lastMessage}
                          </p>
                        </div>

                        {/* Unread Orange Count Badge matching Screenshot */}
                        {conv.unreadCount > 0 && !isSelectionMode && (
                          <div className="w-5 h-5 rounded-full bg-[#f97316] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* CONTACTS DIRECTORY TAB (A-Z INDEXED) */
              <div className="p-4 space-y-4 pb-20">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Contacts Directory</div>
                <div className="space-y-1">
                  {CONTACTS_LIST.map((contact, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: contact.color }}
                        >
                          {contact.initial}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{contact.name}</div>
                          <div className="text-xs text-slate-400">{contact.phone} • {contact.note}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCallingContact({ name: contact.name })}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-full"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenConversation(contact.name)}
                          className="p-2 text-[#0381FE] hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-full"
                          title="Message"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating Action Button: New Message (Squircle in bottom right) */}
          {!isSelectionMode && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                const newRecipient = prompt('Enter recipient number or name: (e.g. CBEBirr, 0959754788)');
                if (newRecipient) {
                  handleOpenConversation(newRecipient.trim());
                }
              }}
              className="fixed bottom-20 right-5 z-40 w-14 h-14 rounded-full bg-white dark:bg-slate-800 text-[#0381FE] shadow-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Compose new message"
            >
              <MessageSquare className="w-6 h-6 stroke-[2.2]" />
            </motion.button>
          )}

          {/* Bottom Bar: Delete Action if Selection Mode */}
          {isSelectionMode ? (
            <div className="shrink-0 h-16 bg-white dark:bg-[#121212] border-t border-slate-100 dark:border-slate-800 flex items-center justify-around px-6 z-40">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedMsgIds.size === 0}
                className="flex flex-col items-center gap-1 text-red-500 disabled:opacity-40"
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-xs font-semibold">Delete</span>
              </button>
            </div>
          ) : (
            /* Bottom Navigation Tabs: "Conversations" (badge 25) & "Contacts" */
            <div className="shrink-0 h-16 bg-white dark:bg-[#121212] border-t border-slate-100 dark:border-slate-800 flex items-center justify-around px-8 z-40">
              <button
                type="button"
                onClick={() => setActiveTab('conversations')}
                className="relative flex items-center gap-1.5 py-1 text-sm font-bold text-black dark:text-white"
              >
                <span>Conversations</span>
                <span className="w-4 h-4 rounded-full bg-[#f97316] text-white text-[10px] font-bold flex items-center justify-center">
                  25
                </span>
                {activeTab === 'conversations' && (
                  <motion.div
                    layoutId="activeBottomTabIndicator"
                    className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-full"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contacts')}
                className="relative py-1 text-sm font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <span>Contacts</span>
                {activeTab === 'contacts' && (
                  <motion.div
                    layoutId="activeBottomTabIndicator"
                    className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-full"
                  />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CHAT CONVERSATION VIEW (Inside a specific thread) */}
      {activeConversationId && (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#e5e9f0]/40 dark:bg-[#121212]">
          {/* Top Bar matching Screenshot */}
          <div className="shrink-0 px-4 py-3 bg-white dark:bg-[#1E1E1E] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm z-30">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveConversationId(null);
                  fetchMessagesData();
                }}
                className="p-1 -ml-1 text-slate-700 dark:text-slate-200 rounded-full active:scale-95 transition-transform"
                aria-label="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0">
                {activeConversationId === 'CBEBirr' ? (
                  <span className="text-xs font-black text-[#7a1c7d]">CBE</span>
                ) : (
                  <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                )}
              </div>

              {/* Title & Dropdown */}
              <div className="min-w-0 flex items-center gap-1">
                <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
                  {activeConversationId}
                </h2>
              </div>
            </div>

            {/* Right Action Icons: Call, Video, Trash, More */}
            <div className="flex items-center gap-1 relative">
              <button
                type="button"
                onClick={() => setCallingContact({ name: activeConversationId, isVideo: false })}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                title="Audio Call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCallingContact({ name: activeConversationId, isVideo: true })}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                title="Video Call"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Delete all messages in ${activeConversationId}?`)) {
                    const idsToDelete = currentMessages.map((m) => m.id);
                    await fetch('/api/sms/messages', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids: idsToDelete }),
                    });
                    showToast('Thread deleted');
                    setActiveConversationId(null);
                    fetchMessagesData();
                  }
                }}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                title="Delete thread"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                title="Menu"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Chat 3-dot menu matching Screenshot */}
              <AnimatePresence>
                {isChatMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className={`absolute right-0 top-12 w-60 rounded-3xl shadow-2xl py-2 z-50 border transition-colors ${
                      darkMode ? 'bg-[#1E1E1E] border-slate-800 text-slate-200' : 'bg-white border-slate-100 text-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectionMode(true);
                        setIsChatMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Trash2 className="w-4 h-4 text-slate-500" />
                      <span>Delete messages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Search inside conversation');
                        setIsChatMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <Search className="w-4 h-4 text-slate-500" />
                      <span>Search messages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Notification sound updated');
                        setIsChatMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div>Notification sound</div>
                      <div className="text-[11px] text-slate-400">Set a custom notification sound.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Category (.)');
                        setIsChatMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div>Category</div>
                      <div className="text-[11px] text-blue-500 font-bold">.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Customize chat room background');
                        setIsChatMenuOpen(false);
                      }}
                      className="w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                    >
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <span>Customize chat room</span>
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <div className="flex items-center justify-around py-2 px-4">
                      <button
                        type="button"
                        onClick={() => showToast('Muted notifications')}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        title="Mute"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => showToast('Pinned to top')}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        title="Pin"
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No messages yet in this conversation</div>
            ) : (
              currentMessages.map((msg, index) => {
                const isCbe = msg.conversationId === 'CBEBirr' || msg.isBank;
                const hasReceiptLink =
                  Boolean(msg.receiptUrl) ||
                  msg.text.includes('cbepay1.cbe.com.et') ||
                  msg.text.includes('cbetransaction.cbe') ||
                  msg.text.includes('aureceipt') ||
                  msg.text.includes('official-receipt') ||
                  msg.text.includes('shorturl.at') ||
                  msg.text.includes('Txn ID') ||
                  msg.text.includes('ደረሰኝ ቁጥር') ||
                  msg.text.includes('transferred') ||
                  msg.text.includes('deposited');

                return (
                  <div key={msg.id} className="space-y-1">
                    {/* Date Pill Divider (if applicable) */}
                    {index === 0 || (index > 0 && currentMessages[index - 1].timestamp !== msg.timestamp) ? (
                      <div className="text-center my-3">
                        <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 px-3 py-1 bg-white/70 dark:bg-slate-800/70 rounded-full shadow-xs">
                          {msg.date ? new Date(msg.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Thursday, October 29'}
                        </span>
                      </div>
                    ) : null}

                    {/* Chat Bubble Container */}
                    <div className={`flex flex-col ${msg.isOutgoing ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl shadow-xs text-sm sm:text-[14.5px] transition-all ${
                          msg.isOutgoing
                            ? 'bg-[#0381FE] text-white rounded-tr-xs'
                            : darkMode
                            ? 'bg-[#1E1E1E] text-slate-100 rounded-tl-xs'
                            : 'bg-white text-slate-900 rounded-tl-xs'
                        }`}
                      >
                        {/* Bubble Message Text with Clickable Links */}
                        {renderRichText(msg.text, msg)}

                        {/* Interactive CBE Official Receipt Bottom Action Button matching user screenshot ("View all >") */}
                        {hasReceiptLink && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptFromMsg(msg)}
                              className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-bold text-[#0381FE] hover:bg-blue-50/70 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" />
                                <span>Open Official CBE Receipt in Browser</span>
                              </span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyReceiptLink(msg)}
                              className="w-full flex items-center justify-between py-1.5 px-2 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                <span>Copy Official Receipt Link</span>
                              </span>
                              <span className="text-[10px] text-slate-400">Share / Paste</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Message Timestamp */}
                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Rich Message Input Bar matching Screenshot */}
          <div className="shrink-0 p-3 bg-white dark:bg-[#1E1E1E] border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => showToast('Attach photo from Gallery')}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              title="Gallery"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => showToast('Camera access simulation')}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              title="Camera"
            >
              <Camera className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                const sample = prompt('Send test banking action: 1: Transfer, 2: Deposit');
                if (sample === '2') {
                  handleTriggerBirrDeposit();
                } else {
                  handleTriggerCbeTransfer();
                }
              }}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
              title="Add attachment"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Pill-shaped text input */}
            <div className="flex-1 flex items-center bg-[#f1f3f4] dark:bg-slate-800 rounded-full px-4 py-2 border border-transparent focus-within:border-[#0381FE]">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Text message"
                className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setInputText((prev) => prev + ' 😊')}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            {/* Microphone Voice Note Recorder or Send Arrow Button */}
            {inputText.trim() ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={handleSendMessage}
                disabled={isSending}
                className="w-10 h-10 rounded-full bg-[#0381FE] text-white flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-transform"
                title="Send SMS"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  nativeBridge.vibrate?.(40);
                  showToast('Hold to record voice note (Simulated)');
                }}
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                title="Voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: AUTHENTIC CBE OFFICIAL VAT RECEIPT (100% Identical to Banking App Step 9 & Official Download System) */}
      <AnimatePresence>
        {activeReceiptModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="w-full max-w-2xl max-h-[96vh] overflow-y-auto rounded-3xl shadow-2xl relative bg-[#ece7ef] border border-purple-900/20"
            >
              <OfficialReceiptView
                initialData={activeReceiptModalData}
                isModal
                onClose={() => setActiveReceiptModalData(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: HIDDEN DEVELOPER SETTINGS ("Hide Setting") */}
      <AnimatePresence>
        {showDevSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-[#1E1E1E] text-slate-900 dark:text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 dark:border-slate-700"
            >
              {/* Header */}
              <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-[#0381FE]" />
                  <div>
                    <h3 className="font-bold text-base">Developer Settings & SMS Engine</h3>
                    <p className="text-xs text-slate-400">Hidden Control Panel • Master Key: {MASTER_API_KEY}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDevSettings(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto text-xs sm:text-sm">
                {/* 1. Webhook URL & Curl Generator */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-[#0381FE]" />
                      <span>Live SMS Webhook Endpoint</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(curlCommand);
                        setCopiedCurl(true);
                        showToast('Curl command copied to clipboard!');
                        setTimeout(() => setCopiedCurl(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold rounded-lg text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto select-all">
                    POST {currentOrigin}/api/sms/cbebirr
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Send real-time SMS payloads with header <code className="text-[#0381FE]">x-api-key: Ram69</code>
                  </div>
                </div>

                {/* 2. Instant CBEBirr Transfer Test Trigger */}
                <div className="p-4 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-200/60 dark:border-purple-900/50 space-y-3">
                  <div className="font-bold text-[#7a1c7d] dark:text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Instant CBEBirr Transfer SMS Trigger</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Payer Name
                      </label>
                      <input
                        type="text"
                        value={devFullName}
                        onChange={(e) => setDevFullName(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Amount (Br)
                      </label>
                      <input
                        type="text"
                        value={devAmount}
                        onChange={(e) => setDevAmount(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-semibold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Receiver Name
                      </label>
                      <input
                        type="text"
                        value={devReceiverName}
                        onChange={(e) => setDevReceiverName(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Receiver Account
                      </label>
                      <input
                        type="text"
                        value={devReceiverAcc}
                        onChange={(e) => setDevReceiverAcc(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 text-xs font-semibold font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerCbeTransfer}
                    className="w-full py-2.5 bg-[#7a1c7d] hover:bg-[#68146a] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Authentic CBEBirr Transfer SMS Now</span>
                  </button>
                </div>

                {/* 3. Instant Birr Deposit Test Trigger */}
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/50 space-y-3">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Instant Birr Deposit SMS Trigger</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Deposited Amount (Br)
                      </label>
                      <input
                        type="text"
                        value={devDepositAmount}
                        onChange={(e) => setDevDepositAmount(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-semibold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                        Updated Balance (Br)
                      </label>
                      <input
                        type="text"
                        value={devDepositBalance}
                        onChange={(e) => setDevDepositBalance(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-semibold font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerBirrDeposit}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Deposit SMS</span>
                  </button>
                </div>

                {/* 4. Device Profile Switcher */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-[#0381FE]" />
                    <span>Target Device Profile</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div><strong>Device:</strong> Galaxy A12 (SM-A127F/DS)</div>
                    <div><strong>Phone:</strong> 0959754788</div>
                    <div><strong>SIM 1:</strong> Ethio telecom</div>
                    <div><strong>SIM 2:</strong> Safaricom Ethiopia</div>
                  </div>
                </div>

                {/* 5. APK Direct Download Button */}
                <div className="pt-1">
                  <a
                    href="/download/apk"
                    download="SamsungMessages.apk"
                    className="w-full py-3 bg-[#0381FE] hover:bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md transition-all block text-center"
                  >
                    <Download className="w-4 h-4 inline" />
                    <span>Download SamsungMessages.apk (Android)</span>
                  </a>
                </div>

                {/* 6. Queue Management / Reset */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetQueue}
                    className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to Screenshots Seeds</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Clear entire message queue?')) {
                        await fetch('/api/sms/messages', { method: 'DELETE' });
                        showToast('Cleared all messages');
                        fetchMessagesData();
                      }
                    }}
                    className="py-2.5 px-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: ONE UI CALLING SCREEN */}
      <AnimatePresence>
        {callingContact && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-between p-8"
          >
            <div className="pt-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[#0381FE] flex items-center justify-center text-3xl font-bold shadow-2xl mb-4 animate-pulse">
                {callingContact.name.slice(0, 1).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold">{callingContact.name}</h2>
              <p className="text-sm text-slate-400 mt-1">Calling via Ethio telecom SIM 1...</p>
            </div>

            {/* Controls */}
            <div className="w-full max-w-xs space-y-6 pb-12">
              <div className="flex items-center justify-around">
                <button
                  type="button"
                  onClick={() => setIsCallMuted(!isCallMuted)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${
                    isCallMuted ? 'bg-red-600' : 'bg-slate-800'
                  }`}
                >
                  <MicOff className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${
                    isSpeakerOn ? 'bg-[#0381FE]' : 'bg-slate-800'
                  }`}
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setCallingContact(null)}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            </div>
        )}
      </AnimatePresence>

      {/* MODAL: ANDROID DEFAULT SMS APP PERMISSION DIALOG (Matching image.png) */}
      <AnimatePresence>
        {showDefaultSmsDialog && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 120 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 120 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-sm bg-white dark:bg-[#1E1F22] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col border-t border-slate-100 dark:border-slate-800"
            >
              {/* Top blue chat icon */}
              <div className="w-12 h-12 mx-auto mb-3.5 flex items-center justify-center rounded-2xl bg-[#0062FF] text-white shadow-md">
                <MessageSquare className="w-6 h-6 fill-white text-white" />
              </div>

              {/* Title */}
              <h3 className="text-[17px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] text-center mb-6 px-2 leading-snug">
                Set Messages as your default SMS app?
              </h3>

              {/* Radio Items List matching screenshot */}
              <div className="space-y-4">
                {/* 1. Call Assistant */}
                <div
                  onClick={() => setSelectedDefaultApp('assistant')}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#188038] flex items-center justify-center text-white shrink-0 shadow-sm">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                      Call Assistant
                    </span>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-[#747775] dark:border-slate-500 flex items-center justify-center">
                    {selectedDefaultApp === 'assistant' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0062FF]" />
                    )}
                  </div>
                </div>

                {/* 2. Messages (Current default) */}
                <div
                  onClick={() => setSelectedDefaultApp('current')}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#1A73E8] flex items-center justify-center text-white shrink-0 shadow-sm">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                        Messages
                      </span>
                      <span className="text-[12px] text-[#747775] dark:text-slate-400">
                        Current default
                      </span>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-[#747775] dark:border-slate-500 flex items-center justify-center">
                    {selectedDefaultApp === 'current' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0062FF]" />
                    )}
                  </div>
                </div>

                {/* 3. Messages (Droplet icon - Selected in user screenshot) */}
                <div
                  onClick={() => setSelectedDefaultApp('cbe_messages')}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#004ECB] flex items-center justify-center text-white shrink-0 shadow-sm">
                      <MessageSquare className="w-5 h-5 fill-white text-white" />
                    </div>
                    <span className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                      Messages
                    </span>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-[#0062FF] flex items-center justify-center">
                    {selectedDefaultApp === 'cbe_messages' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0062FF]" />
                    )}
                  </div>
                </div>

                {/* 4. Messages (Cyan square) */}
                <div
                  onClick={() => setSelectedDefaultApp('third_party')}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#0288D1] flex items-center justify-center text-white shrink-0 shadow-sm">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[15px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                      Messages
                    </span>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-[#747775] dark:border-slate-500 flex items-center justify-center">
                    {selectedDefaultApp === 'third_party' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0062FF]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-6 mt-7 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDefaultSmsDialog(false)}
                  className="text-[14px] font-bold text-[#1F1F1F] dark:text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDefaultSms}
                  className="text-[14px] font-bold text-[#0062FF] hover:text-blue-700 transition-colors"
                >
                  Set as default
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
