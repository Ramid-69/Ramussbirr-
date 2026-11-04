'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Download, Share2, Printer, Search, Trash2, Edit2, Plus, User, ChevronRight, Receipt, MapPin, Phone, Info, HelpCircle, Fingerprint, WifiOff, CheckCircle2, MessageSquare, RefreshCw, Send, Check } from 'lucide-react';
import CBEAuthenticSpinner from './CBEAuthenticSpinner';
import QRCode from 'qrcode';
import { generateStyledQrDataUrl } from '@/lib/styled-qr';
import {
  sendSmsWebhook,
  sendTransactionSms,
  buildCbeSmsPayload,
  generate8CharTxnId,
  formatCbeDateTime,
  CbeSmsWebhookPayload,
  buildOfficialReceiptUrl,
} from '@/lib/sms-webhook';

type ScreenStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

interface SavedReceiver {
  id: string;
  accountNumber: string;
  accountName: string;
}

interface TransactionItem {
  id: string;
  title: string;
  date: string;
  amount: string | number;
  type: 'credit' | 'debit';
  ref?: string;
  account?: string;
  receiverName?: string;
  orderId?: string;
  status?: string;
  debitAccountType?: string;
  creditAccountType?: string;
}

const DEFAULT_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-seed-0',
    title: 'Send Money',
    date: '2026-10-27 11:56:20',
    amount: '740.00',
    type: 'debit',
    ref: 'FT262413JRB4',
    account: '1000760389289',
    receiverName: 'Miss Simera Gofer Abdisa',
    orderId: '9V8GPL5D',
    status: 'Completed',
    debitAccountType: 'Customer E-money Account',
    creditAccountType: 'CBE Bank Account',
  },
  {
    id: 'tx-seed-1',
    title: 'Send Money',
    date: '2026-10-29 15:50:00',
    amount: '10.00',
    type: 'debit',
    ref: 'FT1384476084',
    account: '1000278947339',
    receiverName: 'Ram',
    orderId: 'FT1384476084',
    status: 'Completed',
    debitAccountType: 'Customer E-money Account',
    creditAccountType: 'CBE Bank Account',
  },
  {
    id: 'tx-seed-2',
    title: 'Send Money',
    date: '2026-10-29 15:53:00',
    amount: '8.00',
    type: 'debit',
    ref: 'FT7321557800',
    account: '1000278947339',
    receiverName: 'Ram',
    orderId: 'FT7321557800',
    status: 'Completed',
    debitAccountType: 'Customer E-money Account',
    creditAccountType: 'CBE Bank Account',
  },
  {
    id: 'tx-seed-3',
    title: 'Send Money',
    date: '2026-10-29 15:03:00',
    amount: '5.00',
    type: 'debit',
    ref: 'FT8653931662',
    account: '0715095670',
    receiverName: 'Fozia Mossa Mohammed',
    orderId: 'FT8653931662',
    status: 'Completed',
    debitAccountType: 'Customer E-money Account',
    creditAccountType: 'CBE Bank Account',
  },
];

const DEFAULT_SAVED_RECEIVERS: SavedReceiver[] = [
  {
    id: 'rec-1',
    accountNumber: '1000760389289',
    accountName: 'Miss Simera Gofer Abdisa',
  },
  {
    id: 'rec-2',
    accountNumber: '1000278947339',
    accountName: 'Ram',
  },
  {
    id: 'rec-3',
    accountNumber: '0715095670',
    accountName: 'Fozia Mossa Mohammed',
  },
];

const ALL_APP_ASSETS: string[] = [
  '/screens/screen_1_splash.png',
  '/screens/screen_2_phone_clean.png',
  '/screens/confirm_pin_page.png',
  '/screens/screen_cbe_send_money_clean.png',
  '/screens/receipt_page.png',
  '/screens/official_receipt_hq.png',
  '/screens/transaction_detail.png',
  '/screens/recent_tx_header_tabs.png',
  '/screens/tx_arrow_up_icon.png',
  '/screens/tx_arrow_down_green_icon.png',
  '/screens/floating_qr_clean.png',
  '/screens/home_bottom_nav.png',
  '/screens/others_middle_scroll.png',
  '/screens/others_menu_clean_list_v2.png',
  '/screens/others_logout_bottom.png',
  '/screens/map_fab_perfect.png',
  '/screens/others_fixed_bottom.png',
  '/assets/aistudio/Screenshot_20261027-145909_9889e698.png',
  '/assets/aistudio/loding__d053620a.png',
  '/assets/aistudio/home_page__bc682fdb.png',
  '/assets/aistudio/home_page_balance_hidden.png',
  '/assets/aistudio/home_page_bal_show_rew_show.png',
  '/assets/aistudio/home_page_bal_hide_rew_show.png',
  '/assets/aistudio/white_card_top_authentic.png',
  '/assets/aistudio/white_card_services_clean.png',
  '/assets/aistudio/home_scroll_down___1__4a940d15.png',
  '/assets/aistudio/home_scroll_down___2__759e601d.png',
  '/assets/aistudio/cbe_transfer_logo_static.png',
  '/assets/aistudio/cbe_transfer_ring_spinner.png',
  '/assets/cbe_authentic_receipt_qr_exact.png',
  '/screens/cbe_beje.png',
  '/screens/mini_apps.png',
  '/screens/pay_fixed_top.png',
  '/screens/pay_middle_scroll.png',
  '/screens/pay_fixed_bottom.png',
];

function generateTxRef() {
  // Generates randomized changing numbers after 'FT' on every transaction
  const randNum = Math.floor(1000000000 + Math.random() * 9000000000);
  return `FT${randNum}`;
}

function numberToWords(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero';
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertChunk(n % 100) : '');
  }

  const intPart = Math.floor(num);
  if (intPart === 0) return 'Zero';

  const thousands = ['', 'Thousand', 'Million', 'Billion'];
  let chunkIdx = 0;
  let temp = intPart;
  const parts: string[] = [];

  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk !== 0) {
      const chunkStr = convertChunk(chunk);
      const label = thousands[chunkIdx];
      parts.unshift(label ? `${chunkStr} ${label}` : chunkStr);
    }
    temp = Math.floor(temp / 1000);
    chunkIdx++;
  }

  return parts.join(' ');
}

export default function CBEBirrFullscreenApp() {
  const [currentStep, setCurrentStep] = useState<ScreenStep>(1);
  const [pin, setPin] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_phone_number');
        if (stored) return stored;
      } catch {
        // ignore
      }
    }
    return '0959842829';
  });
  const [isBalanceShown, setIsBalanceShown] = useState<boolean>(true);
  const [isRewardShown, setIsRewardShown] = useState<boolean>(false);

  // Dynamic numeric Balance and Reward values (persisted in localStorage)
  const [balance, setBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_user_balance');
        if (stored !== null) {
          const val = parseFloat(stored);
          if (!isNaN(val)) return val;
        }
      } catch {
        // ignore
      }
    }
    return 63535.0;
  });
  const [reward, setReward] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_user_reward');
        if (stored !== null) {
          const val = parseFloat(stored);
          if (!isNaN(val)) return val;
        }
      } catch {
        // ignore
      }
    }
    return 0.0;
  });

  // Keep Balance, Reward, and Phone Number persisted in localStorage across all sessions
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_user_balance', balance.toString());
      }
    } catch {
      // ignore
    }
  }, [balance]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_user_reward', reward.toString());
      }
    } catch {
      // ignore
    }
  }, [reward]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_phone_number', phoneNumber);
      }
    } catch {
      // ignore
    }
  }, [phoneNumber]);

  // High-Fidelity Asset Pre-caching and GPU pre-decoding:
  // Guarantees all pages open atomically as one cohesive unit in 0ms without staggered pop-in, even when offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    ALL_APP_ASSETS.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      if ('decode' in img && typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
    });
  }, []);

  // Real-time User Profile & Account details state (persisted across all pages)
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_user_name');
        if (stored) return stored;
      } catch {
        // ignore
      }
    }
    return 'JUREY ABDUL HUSSEN';
  });

  const [userAccount, setUserAccount] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_user_account');
        if (stored) return stored;
      } catch {
        // ignore
      }
    }
    return '1000760389289';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_user_name', userName);
      }
    } catch {
      // ignore
    }
  }, [userName]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_user_account', userAccount);
      }
    } catch {
      // ignore
    }
  }, [userAccount]);

  // Profile Details Edit Modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [tempUserName, setTempUserName] = useState<string>('');
  const [tempUserAccount, setTempUserAccount] = useState<string>('');
  const [tempPhoneNumber, setTempPhoneNumber] = useState<string>('');
  const profileLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProfileLongPressTriggeredRef = useRef<boolean>(false);

  const startProfileLongPress = () => {
    isProfileLongPressTriggeredRef.current = false;
    if (profileLongPressTimerRef.current) {
      clearTimeout(profileLongPressTimerRef.current);
    }
    profileLongPressTimerRef.current = setTimeout(() => {
      isProfileLongPressTriggeredRef.current = true;
      setTempUserName(userName);
      setTempUserAccount(userAccount);
      setTempPhoneNumber(phoneNumber);
      setIsProfileModalOpen(true);
    }, 500);
  };

  const endProfileLongPress = () => {
    if (profileLongPressTimerRef.current) {
      clearTimeout(profileLongPressTimerRef.current);
      profileLongPressTimerRef.current = null;
    }
    // Strict requirement: Clicks/taps do NOTHING. Edit modal ONLY opens via long-press!
  };

  const cancelProfileLongPress = () => {
    if (profileLongPressTimerRef.current) {
      clearTimeout(profileLongPressTimerRef.current);
      profileLongPressTimerRef.current = null;
    }
  };

  // Typewriter Greeting Animation Text (dynamic with customized user name in real time)
  const [displayText, setDisplayText] = useState<string>('WELCOME BACK');
  useEffect(() => {
    const trimmed = userName.trim();
    const firstName = trimmed ? trimmed.split(/\s+/)[0] : 'AYMEN';
    const cleanFirst = firstName.replace(/!+$/, '').trim().toUpperCase();
    const phrases = ['WELCOME BACK', `${cleanFirst} !`];
    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let isDeleting = true;
    let timeoutId: NodeJS.Timeout;

    const tick = () => {
      const currentPhrase = phrases[phraseIdx];
      if (isDeleting) {
        setDisplayText(currentPhrase.substring(0, charIdx - 1));
        charIdx--;
      } else {
        setDisplayText(currentPhrase.substring(0, charIdx + 1));
        charIdx++;
      }

      let delta = isDeleting ? 30 : 60;

      if (!isDeleting && charIdx === currentPhrase.length) {
        delta = 1400; // Pause when phrase is fully typed
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        delta = 220; // Pause before typing next phrase
      }

      timeoutId = setTimeout(tick, delta);
    };

    timeoutId = setTimeout(tick, 1000);
    return () => clearTimeout(timeoutId);
  }, [userName]);

  // Send Money form state (Step 6)
  const [receiverAccount, setReceiverAccount] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendReason, setSendReason] = useState<string>('');
  const [isTransferSuccess, setIsTransferSuccess] = useState<boolean>(false);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>('26 Oct 2026 9:36 PM');
  const [transactionIsoDate, setTransactionIsoDate] = useState<string>('2026-10-26 21:36');
  const [receiptToast, setReceiptToast] = useState<string>('');
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string>('');
  const [officialReceiptQrDataUrl, setOfficialReceiptQrDataUrl] = useState<string>('');

  // CBEBirr USSD *847# & MacroDroid Receiver State (Strictly zero popup modals)
  const [customVerifiedReceiverName, setCustomVerifiedReceiverName] = useState<string>('');
  const [isResolvingUssdReceiver, setIsResolvingUssdReceiver] = useState<boolean>(false);
  const hasTriggeredUssdForAccountRef = useRef<boolean>(false);
  const ussdPollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Saved Receivers State & LocalStorage Persistence
  const [savedReceivers, setSavedReceivers] = useState<SavedReceiver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_saved_receivers');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_SAVED_RECEIVERS;
  });
  const [isReceiversModalOpen, setIsReceiversModalOpen] = useState<boolean>(false);
  const [isAddingNewReceiver, setIsAddingNewReceiver] = useState<boolean>(false);
  const [editingReceiverId, setEditingReceiverId] = useState<string | null>(null);
  const [modalAccNum, setModalAccNum] = useState<string>('');
  const [modalAccName, setModalAccName] = useState<string>('');
  const [modalFormError, setModalFormError] = useState<string>('');

  const persistReceivers = (list: SavedReceiver[]) => {
    setSavedReceivers(list);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_saved_receivers', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  // Transaction History State & LocalStorage Persistence (as requested)
  const [transactions, setTransactions] = useState<TransactionItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_transactions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const seenIds = new Set<string>();
            return parsed.map((item: TransactionItem, index: number) => {
              let id = item.id || `tx-${index + 1}`;
              if (seenIds.has(id)) {
                id = `${id}-${index + 1}`;
              }
              seenIds.add(id);
              return { ...item, id };
            });
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_TRANSACTIONS;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_transactions', JSON.stringify(transactions));
      }
    } catch {
      // ignore
    }
  }, [transactions]);

  const [activeTxTab, setActiveTxTab] = useState<'all' | 'credit' | 'debit' | 'completed'>('all');
  const [deleteModalTx, setDeleteModalTx] = useState<TransactionItem | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const txLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTxLongPressTriggeredRef = useRef<boolean>(false);
  const txPointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const startTxLongPress = (tx: TransactionItem, e: React.PointerEvent) => {
    txPointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    isTxLongPressTriggeredRef.current = false;
    if (txLongPressTimerRef.current) clearTimeout(txLongPressTimerRef.current);
    txLongPressTimerRef.current = setTimeout(() => {
      isTxLongPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(60);
        }
      } catch {
        // ignore
      }
      setDeleteModalTx(tx);
    }, 800);
  };

  const handleTxPointerMove = (e: React.PointerEvent) => {
    if (!txPointerStartPosRef.current) return;
    const dx = Math.abs(e.clientX - txPointerStartPosRef.current.x);
    const dy = Math.abs(e.clientY - txPointerStartPosRef.current.y);
    if (dx > 8 || dy > 8) {
      cancelTxLongPress();
    }
  };

  const endTxLongPress = (tx: TransactionItem) => {
    if (txLongPressTimerRef.current) {
      clearTimeout(txLongPressTimerRef.current);
      txLongPressTimerRef.current = null;
    }
    if (!isTxLongPressTriggeredRef.current) {
      setSelectedTx(tx);
      setCurrentStep(10);
    }
  };

  const cancelTxLongPress = () => {
    if (txLongPressTimerRef.current) {
      clearTimeout(txLongPressTimerRef.current);
      txLongPressTimerRef.current = null;
    }
  };

  const handleDeleteTransaction = () => {
    if (!deleteModalTx) return;
    setTransactions((prev) => prev.filter((t) => t.id !== deleteModalTx.id));
    setDeleteModalTx(null);
    setReceiptToast('የዝውውር ታሪክ ተሰርዟል (Transaction deleted)');
    setTimeout(() => setReceiptToast(''), 2000);
  };

  // Samsung Messages Webhook Sync (ms-bk-connect.vercel.app)
  const hasAutoSyncedRef = useRef<boolean>(false);
  const lastStep11Ref = useRef<boolean>(false);
  const lastStep10TxRef = useRef<string | null>(null);

  // Background non-UI SMS trigger strictly following CBEBirr format (does not block UI or add widgets)
  const backgroundSendSms = (tx: TransactionItem) => {
    const amtNum = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 10;
    const tid = tx.orderId ? tx.orderId.replace(/\D/g, '').slice(-8) : generate8CharTxnId(tx.ref);
    const cleanUserPhone = (phoneNumber || '251959842829').replace(/\D/g, '');
    const fullPhone = cleanUserPhone.startsWith('251') ? cleanUserPhone : `251${cleanUserPhone.replace(/^0+/, '')}`;

    sendTransactionSms({
      fullName: userName || 'JUREY ABDUL HUSSEN',
      userPhone: fullPhone,
      amount: amtNum,
      receiverAccount: tx.account || '1000760389289',
      receiverName: tx.receiverName || 'Miss Simera Gofer Abdisa',
      balance: balance,
      txnId: tid,
      ftRef: tx.ref || tx.orderId || 'FT262413JRB4',
      date: tx.date,
    }).catch(() => {});
  };

  // Background non-UI bulk sync of all historical transactions
  const backgroundSyncAll = () => {
    const targetList = transactions.length > 0 ? transactions : DEFAULT_TRANSACTIONS;
    if (targetList.length === 0) return;
    const payloads: CbeSmsWebhookPayload[] = targetList.map((tx, idx) => {
      const amtNum = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 10;
      const simBal = Math.max(100, balance + idx * 50);
      return buildCbeSmsPayload({
        userFullName: userName || 'JUREY ABDUL HUSSEN',
        userPhone: phoneNumber || '251959842829',
        receiverAccount: tx.account || '1000760389289',
        receiverName: tx.receiverName || 'Miss Simera Gofer Abdisa',
        amount: amtNum,
        balance: simBal,
        txnId: tx.orderId ? tx.orderId.replace(/\D/g, '').slice(-8) : generate8CharTxnId(tx.ref),
        ftRef: tx.ref || tx.orderId || 'FT262413JRB4',
        date: tx.date,
      });
    });
    sendSmsWebhook(payloads).catch(() => {});
  };

  // Automatic background bulk sync on app load as requested
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasAutoSyncedRef.current) {
      hasAutoSyncedRef.current = true;
      const timer = setTimeout(() => {
        backgroundSyncAll();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // When viewing transaction history (Step 11), trigger background SMS webhook
  useEffect(() => {
    if (currentStep === 11 && !lastStep11Ref.current) {
      lastStep11Ref.current = true;
      const timer = setTimeout(() => {
        backgroundSyncAll();
      }, 300);
      return () => clearTimeout(timer);
    }
    if (currentStep !== 11) {
      lastStep11Ref.current = false;
    }
  }, [currentStep]);

  // When viewing a transaction detail (Step 10), trigger background SMS notification
  useEffect(() => {
    if (currentStep === 10 && selectedTx && lastStep10TxRef.current !== selectedTx.id) {
      lastStep10TxRef.current = selectedTx.id;
      const timer = setTimeout(() => {
        backgroundSendSms(selectedTx);
      }, 300);
      return () => clearTimeout(timer);
    }
    if (currentStep !== 10) {
      lastStep10TxRef.current = null;
    }
  }, [currentStep, selectedTx]);

  // Quick payment handler for Bill Payment & Airtime services with real-time SMS webhook
  const handleQuickPayment = (
    title: string,
    defaultAmount: number,
    receiverAcc: string,
    receiverNm: string
  ) => {
    const amt = defaultAmount;
    const newBal = Math.max(0, balance - amt);
    setBalance(newBal);
    const newRef = generateTxRef();
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = (hours % 12 || 12).toString();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const formattedDate = `${now.getDate()} Oct 2026 ${formattedHours}:${minutes} ${ampm}`;
    const isoDate = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

    const newTx: TransactionItem = {
      id: `tx-${Date.now()}`,
      title,
      date: isoDate,
      amount: amt.toFixed(2),
      type: 'debit',
      ref: newRef,
      account: receiverAcc,
      receiverName: receiverNm,
      orderId: newRef,
      status: 'Completed',
      debitAccountType: 'Customer E-money Account',
      creditAccountType: 'Merchant Account',
    };

    setTransactions((prev) => [newTx, ...prev]);
    setSelectedTx(newTx);

    // Trigger real-time SMS webhook to Samsung Messages app (ms-bk-connect.vercel.app)
    try {
      const smsPayload = buildCbeSmsPayload({
        userFullName: userName || 'JUREY ABDUL HUSSEN',
        userPhone: phoneNumber || '251959842829',
        receiverAccount: receiverAcc,
        receiverName: receiverNm,
        amount: amt.toFixed(2),
        balance: newBal,
        txnId: generate8CharTxnId(newRef),
        ftRef: newRef,
        date: now,
      });
      sendSmsWebhook(smsPayload).catch(() => {});
    } catch {
      // Graceful error handling
    }

    setReceiptToast(`${title} (${amt.toFixed(2)} Br) ተጠናቋል! SMS sent to Samsung Messages`);
    setTimeout(() => setReceiptToast(''), 3000);
  };

  // Search Icon Long-Press Timer Refs
  // Strictly opens ONLY on long press (>= 500ms). Click does NOTHING per user request.
  const searchLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSearchLongPressTriggeredRef = useRef<boolean>(false);

  const startSearchLongPress = () => {
    isSearchLongPressTriggeredRef.current = false;
    if (searchLongPressTimerRef.current) clearTimeout(searchLongPressTimerRef.current);
    searchLongPressTimerRef.current = setTimeout(() => {
      isSearchLongPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
      } catch {
        // ignore
      }
      setIsReceiversModalOpen(true);
    }, 500);
  };

  const endSearchLongPress = () => {
    if (searchLongPressTimerRef.current) {
      clearTimeout(searchLongPressTimerRef.current);
      searchLongPressTimerRef.current = null;
    }
    // Normal click does absolutely nothing - modal only opens if long-press timer triggered
  };

  const cancelSearchLongPress = () => {
    if (searchLongPressTimerRef.current) {
      clearTimeout(searchLongPressTimerRef.current);
      searchLongPressTimerRef.current = null;
    }
  };

  // Balance Long-Press Timer & Modal System (Restored per user request)
  // Tap toggles balance visibility; Long press (>= 800ms) opens Balance & Reward editing modal
  const balanceLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBalanceLongPressTriggeredRef = useRef<boolean>(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState<boolean>(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [tempBalanceInput, setTempBalanceInput] = useState<string>('');
  const [tempRewardInput, setTempRewardInput] = useState<string>('');
  const [balanceModalTab, setBalanceModalTab] = useState<'add' | 'edit' | 'reward'>('add');
  const [addMoneyInput, setAddMoneyInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [transferPinError, setTransferPinError] = useState<string>('');

  const startBalanceLongPress = () => {
    isBalanceLongPressTriggeredRef.current = false;
    if (balanceLongPressTimerRef.current) clearTimeout(balanceLongPressTimerRef.current);
    balanceLongPressTimerRef.current = setTimeout(() => {
      isBalanceLongPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
      } catch {
        // ignore
      }
      setTempBalanceInput(balance.toString());
      setTempRewardInput(reward.toString());
      setAddMoneyInput('');
      setBalanceModalTab('add');
      setIsBalanceModalOpen(true);
    }, 800);
  };

  const endBalanceLongPress = () => {
    if (balanceLongPressTimerRef.current) {
      clearTimeout(balanceLongPressTimerRef.current);
      balanceLongPressTimerRef.current = null;
    }
    // If not a long press, execute normal toggle with horizontal splash dot loader
    if (!isBalanceLongPressTriggeredRef.current) {
      if (!isBalanceShown) {
        // Switching to SHOW: smooth horizontal splash dot conveyor
        setIsBalanceLoading(true);
        setTimeout(() => {
          setIsBalanceShown(true);
          setIsBalanceLoading(false);
        }, 1100);
      } else {
        // Switching to UN-SHOW: immediately hide
        setIsBalanceShown(false);
        setIsBalanceLoading(false);
      }
    }
  };

  const cancelBalanceLongPress = () => {
    if (balanceLongPressTimerRef.current) {
      clearTimeout(balanceLongPressTimerRef.current);
      balanceLongPressTimerRef.current = null;
    }
  };

  // Reward Long-Press Timer & Modal System (Matching Balance System exactly)
  // Tap toggles reward visibility with horizontal splash dot loader; Long press (>= 800ms) opens Reward editing modal
  const rewardLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRewardLongPressTriggeredRef = useRef<boolean>(false);
  const [isRewardLoading, setIsRewardLoading] = useState<boolean>(false);
  const [cbeBejeTab, setCbeBejeTab] = useState<'ordinary' | 'overdraft'>('ordinary');

  const startRewardLongPress = () => {
    isRewardLongPressTriggeredRef.current = false;
    if (rewardLongPressTimerRef.current) clearTimeout(rewardLongPressTimerRef.current);
    rewardLongPressTimerRef.current = setTimeout(() => {
      isRewardLongPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
      } catch {
        // ignore
      }
      setTempBalanceInput(balance.toString());
      setTempRewardInput(reward.toString());
      setBalanceModalTab('reward');
      setIsBalanceModalOpen(true);
    }, 800);
  };

  const endRewardLongPress = () => {
    if (rewardLongPressTimerRef.current) {
      clearTimeout(rewardLongPressTimerRef.current);
      rewardLongPressTimerRef.current = null;
    }
    // If not a long press, execute normal toggle with horizontal splash dot loader
    if (!isRewardLongPressTriggeredRef.current) {
      if (!isRewardShown) {
        // Switching to SHOW: smooth horizontal splash dot conveyor
        setIsRewardLoading(true);
        setTimeout(() => {
          setIsRewardShown(true);
          setIsRewardLoading(false);
        }, 1100);
      } else {
        // Switching to UN-SHOW: immediately hide
        setIsRewardShown(false);
        setIsRewardLoading(false);
      }
    }
  };

  const cancelRewardLongPress = () => {
    if (rewardLongPressTimerRef.current) {
      clearTimeout(rewardLongPressTimerRef.current);
      rewardLongPressTimerRef.current = null;
    }
  };

  // Matching logic:
  // If account matches a saved receiver, show that receiver name.
  // Unsaved accounts strictly resolve to "CBE customer".
  const cleanAccount = receiverAccount.replace(/\D/g, '');
  const matchedSavedReceiver = savedReceivers.find(
    (r) => r.accountNumber.replace(/\D/g, '') === cleanAccount
  );
  const activeReceiverName = customVerifiedReceiverName || (matchedSavedReceiver ? matchedSavedReceiver.accountName : '');
  const displayReceiverName = customVerifiedReceiverName || (matchedSavedReceiver ? matchedSavedReceiver.accountName : 'CBE customer');

  // CBEBirr USSD *847# Dialer Execution
  const triggerCbeUssdDialer = (targetAccount: string, targetAmount: string) => {
    const cleanAcc = targetAccount.replace(/\D/g, '');
    if (cleanAcc.length !== 13) {
      setTransferError('Please enter a complete 13-digit CBE account number (13 digits required).');
      return false;
    }

    const cleanAmt = targetAmount.replace(/[^0-9.]/g, '');
    // CBEBirr USSD tree: *847*1*2*[account]# (jumps directly to account transfer and receiver name verification)
    const ussdUri = cleanAmt
      ? `tel:*847*1*2*${cleanAcc}*${cleanAmt}%23`
      : `tel:*847*1*2*${cleanAcc}%23`;

    if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([40, 60, 40]);
    }

    // Android WebView bridge or standard tel: link
    if (typeof window !== 'undefined' && (window as any).Android?.dialUSSD) {
      (window as any).Android.dialUSSD(ussdUri);
    } else if (typeof window !== 'undefined' && (window as any).Android?.callUSSD) {
      (window as any).Android.callUSSD(ussdUri);
    } else {
      const a = document.createElement('a');
      a.href = ussdUri;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 300);
    }

    // Start MacroDroid Webhook polling
    startMacroDroidPolling(cleanAcc);
    return true;
  };

  // Amount field interaction listener (triggered when 13-digit account is entered)
  const handleAmountFieldInteraction = () => {
    const cleanAcc = receiverAccount.replace(/\D/g, '');
    if (hasTriggeredUssdForAccountRef.current) return;

    if (cleanAcc.length === 13) {
      hasTriggeredUssdForAccountRef.current = true;
      setIsResolvingUssdReceiver(true);
      triggerCbeUssdDialer(cleanAcc, sendAmount);
      setTimeout(() => {
        setIsResolvingUssdReceiver(false);
      }, 7000);
    } else {
      setTransferError('Please enter the complete 13-digit CBE account number first.');
    }
  };

  // MacroDroid Webhook Polling
  const startMacroDroidPolling = (targetAcc: string) => {
    if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);

    let count = 0;
    ussdPollTimerRef.current = setInterval(async () => {
      count++;
      try {
        const res = await fetch(`/api/ussd/receiver-webhook?account=${encodeURIComponent(targetAcc)}&clear=true`);
        if (res.ok) {
          const json = await res.json();
          if (json?.hasReceiver && json?.event) {
            if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
            const rName = json.event.name || 'SIMERA GOFER ABDISA';
            setCustomVerifiedReceiverName(rName);
            setIsResolvingUssdReceiver(false);
            if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
              navigator.vibrate([100, 50, 150]);
            }
          }
        }
      } catch (err) {
        console.warn('MacroDroid polling error:', err);
      }

      if (count > 60) {
        if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
      }
    }, 800);
  };

  // Direct injection listener for Android WebView evaluateJavascript
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).onReceiverNameReceived = (data: any) => {
        let name = '';
        let acc = receiverAccount;
        let amt = sendAmount;

        if (typeof data === 'string') {
          name = data;
        } else if (data && typeof data === 'object') {
          name = data.name || data.receiverName || '';
          if (data.account) acc = data.account;
          if (data.amount) amt = data.amount;
        }

        if (name) {
          setIsResolvingUssdReceiver(false);
          setCustomVerifiedReceiverName(name);
          if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate([40, 60]);
          }
        }
      };

      (window as any).setReceiverNameDirectly = (nameStr: string) => {
        if (nameStr) {
          setIsResolvingUssdReceiver(false);
          setCustomVerifiedReceiverName(nameStr);
        }
      };
    }
    return () => {
      if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
    };
  }, [receiverAccount, sendAmount]);

  // Dynamic styled QR code generation matching authentic CBEBirr PNG designs:
  // - Receipt (Step 8): WITH authentic CBE Birr Plus center logo
  // Dynamic styled QR code generation matching authentic CBEBirr PNG designs:
  // - Receipt (Step 8): Scannable by phone camera to official receipt PDF (WITH authentic center logo)
  // - Official Receipt (Step 9): WITHOUT center logo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentRef = transactionRef || 'FT1384476084';
    const currentAcc = userAccount || phoneNumber || '959754788';
    const currentAmt = sendAmount ? parseFloat(sendAmount).toFixed(2) : '10.00';
    const currentDate = transactionDate || '29 Oct 2026 3:50 PM';
    const currentRec = receiverAccount || '1000278947339';
    const currentName = displayReceiverName || 'Ram';
    const currentUser = userName || 'AYMEN NIGATU YIMAM';
    const currentReason = sendReason || 'Wallet Transfer';

    // Persist to server receipt store so any external phone scanner gets exact details
    fetch('/api/receipt/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: currentRef,
        amt: currentAmt,
        date: currentDate,
        rec: currentRec,
        name: currentName,
        user: currentUser,
        acc: currentAcc,
        reason: currentReason,
        status: 'Completed',
        orderId: currentRef,
      }),
    }).catch(() => {});

    // Authentic CBE Birr Plus electronic receipt URL opening this app official receipt
    const scanUrl = buildOfficialReceiptUrl(
      currentRef || '9V8GPL5D',
      currentAcc,
      currentAmt,
      currentName,
      currentUser
    );

    // 1. Transaction receipt QR code (WITH authentic CBE Birr Plus center logo)
    try {
      const dataUrlWithLogo = generateStyledQrDataUrl(scanUrl, {
        size: 360,
        margin: 1,
        withCenterLogo: true,
        centerLogoHref: '/assets/cbe_qr_center_badge_crisp.png',
        bgColor: '#eeeeee',
      });
      Promise.resolve().then(() => {
        setReceiptQrDataUrl(dataUrlWithLogo);
      });
    } catch {
      QRCode.toDataURL(scanUrl, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      })
        .then((data) => setReceiptQrDataUrl(data))
        .catch(() => {});
    }

    // 2. Official VAT receipt QR code (WITHOUT center logo, clean white background)
    try {
      const dataUrlNoLogo = generateStyledQrDataUrl(scanUrl, {
        size: 360,
        margin: 1,
        withCenterLogo: false,
        bgColor: '#ffffff',
      });
      Promise.resolve().then(() => {
        setOfficialReceiptQrDataUrl(dataUrlNoLogo);
      });
    } catch {
      QRCode.toDataURL(scanUrl, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      })
        .then((data) => setOfficialReceiptQrDataUrl(data))
        .catch(() => {});
    }
  }, [transactionRef, userAccount, phoneNumber, sendAmount, transactionDate, receiverAccount, displayReceiverName, userName, sendReason]);

  const handleStartAddReceiver = () => {
    setEditingReceiverId(null);
    setModalAccNum('');
    setModalAccName('');
    setModalFormError('');
    setIsAddingNewReceiver(true);
  };

  const handleStartEditReceiver = (r: SavedReceiver) => {
    setEditingReceiverId(r.id);
    setModalAccNum(r.accountNumber);
    setModalAccName(r.accountName);
    setModalFormError('');
    setIsAddingNewReceiver(false);
  };

  const handleSaveReceiver = () => {
    setModalFormError('');
    const cleanNum = modalAccNum.trim().replace(/\D/g, '');
    const cleanName = modalAccName.trim();
    if (!cleanNum || cleanNum.length < 5) {
      setModalFormError('እባክዎ ትክክለኛ የሂሳብ ቁጥር ያስገቡ (Valid account number required)');
      return;
    }
    if (!cleanName) {
      setModalFormError('እባክዎ የተቀባይ ስም ያስገቡ (Receiver name required)');
      return;
    }

    if (editingReceiverId) {
      const updated = savedReceivers.map((item) =>
        item.id === editingReceiverId
          ? { ...item, accountNumber: cleanNum, accountName: cleanName }
          : item
      );
      persistReceivers(updated);
      setEditingReceiverId(null);
      setReceiptToast('ተቀባይ ተስተካክሏል (Receiver updated)');
    } else {
      const newRec: SavedReceiver = {
        id: `rec-${Date.now()}`,
        accountNumber: cleanNum,
        accountName: cleanName,
      };
      persistReceivers([newRec, ...savedReceivers]);
      setIsAddingNewReceiver(false);
      setReceiptToast('ተቀባይ ተመዝግቧል (Receiver saved)');
    }
    setTimeout(() => setReceiptToast(''), 2000);
    setModalAccNum('');
    setModalAccName('');
  };

  const handleDeleteReceiver = (id: string) => {
    const updated = savedReceivers.filter((item) => item.id !== id);
    persistReceivers(updated);
    if (editingReceiverId === id) {
      setEditingReceiverId(null);
      setModalAccNum('');
      setModalAccName('');
    }
    setReceiptToast('ተቀባይ ተሰርዟል (Receiver deleted)');
    setTimeout(() => setReceiptToast(''), 2000);
  };

  const handleSelectReceiver = (r: SavedReceiver) => {
    setReceiverAccount(r.accountNumber);
    setIsReceiversModalOpen(false);
  };

  // Step 7: PIN Authentication for Transfer
  const [transferPin, setTransferPin] = useState<string>('');

  const handleProceedToTransferPin = () => {
    setTransferError('');
    if (!receiverAccount.trim()) {
      setTransferError('እባክዎ የተቀባይ የሂሳብ ቁጥር ያስገቡ (Please enter Receiver Account)');
      return;
    }
    const amt = parseFloat(sendAmount) || 0;
    if (amt <= 0) {
      setTransferError('እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ (Please enter a valid amount)');
      return;
    }
    if (balance < amt) {
      setTransferError(`ቀሪ ሂሳብዎ በቂ አይደለም (አሁን ያለው: ${formatAmount(balance)} ETB)`);
      return;
    }
    setTransferPin('');
    setCurrentStep(7);
  };

  const handleTransferKeypadClick = (val: string) => {
    if (transferPin.length < 4) {
      const nextPin = transferPin + val;
      setTransferPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === '6969') {
          setTimeout(() => {
            const amt = parseFloat(sendAmount) || 0;
            const newBal = Math.max(0, balance - amt);
            setBalance(newBal);
            const newRef = generateTxRef();
            setTransactionRef(newRef);
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = (hours % 12 || 12).toString();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const formattedDate = `${now.getDate()} Oct 2026 ${formattedHours}:${minutes} ${ampm}`;
            const isoDate = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
            setTransactionDate(formattedDate);
            setTransactionIsoDate(isoDate);

            // Save new transfer into transaction history (saved permanently per user request)
            const newTx: TransactionItem = {
              id: `tx-${Date.now()}`,
              title: 'Send Money',
              date: isoDate,
              amount: sendAmount || '10',
              type: 'debit',
              ref: newRef,
              account: receiverAccount || '1000278947339',
              receiverName: displayReceiverName || 'Ram',
              orderId: newRef,
              status: 'Completed',
              debitAccountType: 'Customer E-money Account',
              creditAccountType: 'CBE Bank Account',
            };
            setTransactions((prev) => [newTx, ...prev]);
            setSelectedTx(newTx);

            // Trigger real-time SMS webhook to Samsung Messages app (ms-bk-connect.vercel.app)
            try {
              const currentTxnId = generate8CharTxnId(newRef);
              const cleanUserPhone = (phoneNumber || '251959842829').replace(/\D/g, '');
              const fullPhone = cleanUserPhone.startsWith('251') ? cleanUserPhone : `251${cleanUserPhone.replace(/^0+/, '')}`;
              const autoReceiptUrl = buildOfficialReceiptUrl(
                currentTxnId,
                fullPhone,
                (parseFloat(sendAmount) || 740.0).toFixed(2),
                displayReceiverName || 'Miss Simera Gofer Abdisa',
                userName || 'JUREY ABDUL HUSSEN'
              );

              // ምሳሌ፡ ገንዘብ በተሳካ ሁኔታ ሲተላለፍ
              sendTransactionSms({
                fullName: userName || 'JUREY ABDUL HUSSEN',
                amount: parseFloat(sendAmount) || 740.00,
                receiverAccount: receiverAccount || '1000760389289',
                receiverName: displayReceiverName || 'Miss Simera Gofer Abdisa',
                balance: newBal,
                txnId: currentTxnId,
                receiptUrl: autoReceiptUrl,
              }).catch(() => {});
            } catch {
              // Graceful error handling
            }

            // Return to Transfer page (Step 6) and display loading spinner before auto-entering Receipt page (Step 8)
            setTransferPin('');
            setCurrentStep(6);
            setIsTransferring(true);
          }, 250);
        } else {
          // Reject any PIN other than 6969!
          setTimeout(() => {
            try {
              if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
                navigator.vibrate([100, 50, 100]);
              }
            } catch {
              // ignore
            }
            setTransferPinError('የተሳሳተ ፒን (Incorrect PIN)');
            setTransferPin('');
            setTimeout(() => setTransferPinError(''), 2000);
          }, 350);
        }
      }
    }
  };

  const handleTransferBackspace = () => {
    setTransferPin((prev) => prev.slice(0, -1));
  };

  const handleDownloadReceipt = async (formatOrEvent?: 'pdf' | 'png' | unknown) => {
    const format: 'pdf' | 'png' =
      typeof formatOrEvent === 'string' && (formatOrEvent === 'pdf' || formatOrEvent === 'png')
        ? formatOrEvent
        : 'pdf';
    try {
      setReceiptToast(`ደረሰኝ በማዘጋጀት ላይ... (${format.toUpperCase()})`);
      const currentRef = transactionRef || 'FT2639841030';
      const currentAmt = (parseFloat(sendAmount) || 10.00).toFixed(2);
      const currentDate = transactionIsoDate || '2026-10-29 14:05';
      const currentRec = receiverAccount || '1000278947339';
      const currentName = displayReceiverName || 'CBE customer';
      const currentUser = userName || 'Aymen Nigatu Yimam';
      const currentAcc = userAccount || phoneNumber || '1000627787889';
      const currentReason = sendReason || 'Customer transfer to CBE account';

      const downloadUrl = `/api/receipt/download?format=${format}&ref=${encodeURIComponent(currentRef)}&amt=${encodeURIComponent(currentAmt)}&date=${encodeURIComponent(currentDate)}&rec=${encodeURIComponent(currentRec)}&name=${encodeURIComponent(currentName)}&user=${encodeURIComponent(currentUser)}&acc=${encodeURIComponent(currentAcc)}&reason=${encodeURIComponent(currentReason)}`;

      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const ext = format === 'png' ? 'png' : 'pdf';
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = `CBEBirr_Official_Receipt_${currentRef}.${ext}`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 5000);
      setReceiptToast(`CBEBirr_Receipt_${currentRef}.${ext} ወርዷል (Downloaded)`);
    } catch (err) {
      console.error('Download error:', err);
      // Offline / sandboxed fallback: generate client-side receipt image from SVG canvas
      try {
        const currentRef = transactionRef || 'FT2639841030';
        const svgEl = document.getElementById('official-vat-receipt-svg');
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `CBEBirr_Official_Receipt_${currentRef}.svg`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 4000);
          setReceiptToast('ደረሰኝ በተሳካ ሁኔታ ወርዷል (Downloaded)');
          return;
        }
      } catch {
        // fallback to window.open
      }
      const currentRef = transactionRef || 'FT2639841030';
      window.open(`/api/receipt/download?format=${format}&ref=${encodeURIComponent(currentRef)}`, '_blank');
      setReceiptToast('ደረሰኝ ወርዷል (Downloaded)');
    }
    setTimeout(() => setReceiptToast(''), 3000);
  };

  const handleShareReceipt = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'CBEBirr Official Receipt',
          text: `CBEBirr VAT Invoice / Customer Receipt for ETB ${sendAmount || '1.01'} - Ref: ${transactionRef || 'DJM51SKYIQ3'}`,
          url: window.location.href,
        });
        setReceiptToast('ደረሰኝ ተጋርቷል (Receipt shared)');
      } catch {
        // User cancelled share
      }
    } else {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(
            `CBEBirr Official Receipt - Ref: ${transactionRef || 'DJM51SKYIQ3'} - Amount: ETB ${sendAmount || '1.01'} - Date: ${transactionDate}`
          );
          setReceiptToast('የደረሰኝ ዝርዝር ተቀድቷል (Receipt info copied)');
        } else {
          setReceiptToast('ደረሰኝ ለማጋራት ተዘጋጅቷል (Ready to share)');
        }
      } catch {
        setReceiptToast('ደረሰኝ ለማጋራት ተዘጋጅቷል (Ready to share)');
      }
    }
    setTimeout(() => setReceiptToast(''), 2500);
  };


  const formatAmount = (num: number) => {
    const val = typeof num === 'number' && !isNaN(num) ? num : 0;
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  };

  // Smooth scroll container ref for Step 4 Home page
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const scrollTopRef = useRef(0);

  // Step 1: Splash screen transitions to Step 2 (Phone Number page) after 2.5s or on tap
  useEffect(() => {
    if (currentStep === 1) {
      const timer = setTimeout(() => {
        setCurrentStep(2);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Auto-transition to Home page after loading spinner on Step 2 (Phone Login page)
  useEffect(() => {
    if (currentStep === 2 && isLoggingIn) {
      const timer = setTimeout(() => {
        setIsLoggingIn(false);
        setCurrentStep(4);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isLoggingIn]);

  // Auto-transition to Receipt page after loading spinner on Step 6 (Transfer page)
  useEffect(() => {
    if (currentStep === 6 && isTransferring) {
      const timer = setTimeout(() => {
        setIsTransferring(false);
        setIsTransferSuccess(true);
        setCurrentStep(8);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isTransferring]);

  // Click on "Next" button in Step 2 (Phone Number page) goes to Step 3 (PIN page)
  const handleNextFromPhonePage = () => {
    if (isLoggingIn) return;
    setPin('');
    setCurrentStep(3);
  };

  // Only clicking on-screen keypad numbers adds digits (No computer keyboard input per user request)
  // STRICT SECURITY: Only PIN '6969' is accepted! Any other PIN is rejected!
  const handleKeypadClick = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);

      // When all 4 digits are entered, verify if PIN is 6969
      if (newPin.length === 4) {
        if (newPin === '6969') {
          // As requested: After entering PIN, navigate back to Login page (Step 2)
          // and show loading spinner card for a few seconds before auto-entering Home page (Step 4)
          setTimeout(() => {
            setPin('');
            setCurrentStep(2);
            setIsLoggingIn(true);
          }, 250);
        } else {
          // Reject invalid PIN!
          setTimeout(() => {
            try {
              if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
                navigator.vibrate([100, 50, 100]);
              }
            } catch {
              // ignore
            }
            setPinError('የተሳሳተ ፒን (Incorrect PIN)');
            setPin('');
            setTimeout(() => setPinError(''), 2000);
          }, 350);
        }
      }
    }
  };

  // Backspace key on keypad removes the last star
  const handleBackspaceClick = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  // Back button on PIN page returns to Phone page (Step 2)
  const handleBackToPhone = () => {
    setPin('');
    setIsLoggingIn(false);
    setCurrentStep(2);
  };

  // Smooth Drag-to-Scroll handlers for Home page (mouse & touch drag support)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = homeScrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    scrollTopRef.current = el.scrollTop;
    el.style.scrollBehavior = 'auto';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = homeScrollRef.current;
    if (!el) return;
    const deltaY = e.clientY - startYRef.current;
    el.scrollTop = scrollTopRef.current - deltaY;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    if (homeScrollRef.current) {
      homeScrollRef.current.style.scrollBehavior = 'smooth';
    }
  };

  // Smooth Drag-to-Scroll handlers for Others page (mouse & touch drag support)
  const othersScrollRef = useRef<HTMLDivElement>(null);
  const isOthersDraggingRef = useRef(false);
  const othersStartYRef = useRef(0);
  const othersScrollTopRef = useRef(0);

  const handleOthersPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = othersScrollRef.current;
    if (!el) return;
    isOthersDraggingRef.current = true;
    othersStartYRef.current = e.clientY;
    othersScrollTopRef.current = el.scrollTop;
    el.style.scrollBehavior = 'auto';
  };

  const handleOthersPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOthersDraggingRef.current) return;
    const el = othersScrollRef.current;
    if (!el) return;
    const deltaY = e.clientY - othersStartYRef.current;
    el.scrollTop = othersScrollTopRef.current - deltaY;
  };

  const handleOthersPointerUp = () => {
    isOthersDraggingRef.current = false;
    if (othersScrollRef.current) {
      othersScrollRef.current.style.scrollBehavior = 'smooth';
    }
  };

  // Smooth Drag-to-Scroll handlers for Pay page (mouse & touch drag support identical to Home & Others)
  const payScrollRef = useRef<HTMLDivElement>(null);
  const isPayDraggingRef = useRef(false);
  const payStartYRef = useRef(0);
  const payScrollTopRef = useRef(0);

  const handlePayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = payScrollRef.current;
    if (!el) return;
    isPayDraggingRef.current = true;
    payStartYRef.current = e.clientY;
    payScrollTopRef.current = el.scrollTop;
    el.style.scrollBehavior = 'auto';
  };

  const handlePayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPayDraggingRef.current) return;
    const el = payScrollRef.current;
    if (!el) return;
    const deltaY = e.clientY - payStartYRef.current;
    el.scrollTop = payScrollTopRef.current - deltaY;
  };

  const handlePayPointerUp = () => {
    isPayDraggingRef.current = false;
    if (payScrollRef.current) {
      payScrollRef.current.style.scrollBehavior = 'smooth';
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0a0a0c] flex items-center justify-center overflow-hidden select-none p-0 sm:p-2">
      {/* Balanced Proportional Mobile Screen Container (720x1527): Perfectly proportioned horizontally & vertically without stretching */}
      <div
        style={{
          aspectRatio: '720 / 1527',
          width: 'min(100vw, calc(100dvh * 720 / 1527))',
          height: 'min(100dvh, calc(100vw * 1527 / 720))',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
        className="relative overflow-hidden bg-white flex flex-col justify-center items-center shadow-2xl sm:rounded-[36px] sm:shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.12)] sm:border-[6px] sm:border-[#1a1a20]"
      >
        {/* Hardware-accelerated offline asset cache ensuring 100% atomic synchronous page loading (never fragmented) */}
        <div className="hidden pointer-events-none select-none" aria-hidden="true">
          {ALL_APP_ASSETS.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" loading="eager" fetchPriority="high" />
          ))}
        </div>

        <AnimatePresence initial={false}>
          {/* STEP 1: SPLASH SCREEN */}
          {currentStep === 1 && (
            <motion.div
              key="step-1-splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              onClick={() => setCurrentStep(2)}
              className="relative w-full h-full cursor-pointer bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_1_splash.png"
                alt="CBEBirr Splash"
                className="w-full h-full object-fill pointer-events-none block"
                draggable={false}
              />
            </motion.div>
          )}

          {/* STEP 2: PHONE NUMBER LOGIN SCREEN */}
          {currentStep === 2 && (
            <motion.div
              key="step-2-phone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#dedede]"
            >
              {/* Underlying exact Phone Number PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_2_phone_clean.png"
                alt="CBEBirr Phone Login"
                className="w-full h-full object-fill pointer-events-none block"
                draggable={false}
              />

              {/* Animated Horizontal Marquee for 'Welcome to CBEBirr Plus app!' */}
              {/* Strictly bounded to entry & exit points (left: 20.0%, width: 58.0%) */}
              {/* As 'Welcome to' enters from the right, it simultaneously begins exiting from the left (Duration: 3.5s) */}
              <div
                style={{
                  position: 'absolute',
                  top: '25.8%',
                  left: '20.0%',
                  width: '58.0%',
                  height: '2.5%',
                }}
                className="overflow-hidden flex items-center pointer-events-none z-10"
              >
                <motion.div
                  animate={{ x: ['0%', '-50%'] }}
                  transition={{
                    repeat: Infinity,
                    repeatType: 'loop',
                    duration: 2.5,
                    ease: 'linear',
                  }}
                  style={{ width: '200%' }}
                  className="flex whitespace-nowrap shrink-0 h-full items-center"
                >
                  <div style={{ width: '50%' }} className="flex items-center shrink-0">
                    <span className="text-[#8c288e] text-[10.5px] sm:text-[11px] font-semibold tracking-tight select-none leading-none">
                      Welcome to CBEBirr Plus app!
                    </span>
                  </div>
                  <div style={{ width: '50%' }} className="flex items-center shrink-0">
                    <span className="text-[#8c288e] text-[10.5px] sm:text-[11px] font-semibold tracking-tight select-none leading-none">
                      Welcome to CBEBirr Plus app!
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Interactive Phone Number Input: Allows user to type or change phone number */}
              <div
                style={{
                  position: 'absolute',
                  top: '36.1%',
                  left: '24.2%',
                  width: '65.0%',
                  height: '4.8%',
                }}
                className={`flex items-center bg-[#ededed] rounded-r-2xl overflow-hidden ${isLoggingIn ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="tel"
                  disabled={isLoggingIn}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  className="w-full h-full bg-[#ededed] text-[#2c2c2c] text-[11px] sm:text-[12px] font-normal tracking-[0.03em] px-1.5 border-0 outline-none select-text"
                  placeholder="9..."
                  autoComplete="tel"
                />
              </div>

              {/* NEXT BUTTON Hotspot: Located directly under phone number */}
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleNextFromPhonePage}
                style={{
                  position: 'absolute',
                  top: '47.5%',
                  left: '9.0%',
                  width: '82.0%',
                  height: '6.5%',
                }}
                aria-label="Next to PIN Page"
                className={`cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity ${isLoggingIn ? 'pointer-events-none' : ''}`}
              />

              {/* CBE Birr Authenticated Loading Box (exact match with Screenshot_20261027-145909_9889e698.png & Screenshot_20261022-221139_a22748fd.png) */}
              <AnimatePresence>
                {isLoggingIn && (
                  <motion.div
                    key="login-loading-popup"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.16 }}
                    style={{
                      position: 'absolute',
                      top: '44.34%',
                      left: '37.78%',
                      width: '24.31%',
                      height: '8.32%',
                    }}
                    className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] border border-black/[0.04] flex items-center justify-center z-30 pointer-events-auto"
                  >
                    <CBEAuthenticSpinner size={38} color="#8b278e" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP 3: PIN SCREEN */}
          {currentStep === 3 && (
            <motion.div
              key="step-3-pin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#dedede]"
            >
              {/* Underlying exact PIN Screen PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_3_pin.png"
                alt="CBEBirr PIN Authentication"
                className="w-full h-full object-fill pointer-events-none block"
                draggable={false}
              />

              {/* Top-left Back Arrow Hotspot */}
              <button
                type="button"
                onClick={handleBackToPhone}
                style={{
                  position: 'absolute',
                  top: '15.5%',
                  left: '5.5%',
                  width: '12%',
                  height: '6%',
                }}
                aria-label="Back to Phone Number Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity"
              />

              {/* 4 BOXES: Exact visual style matching login_authentication_page__5f8cf879.png */}
              {/* Box 1 (left: 29.17%, width: 9.03%, top: 29.93%, height: 6.09%) */}
              {pin.length >= 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.93%',
                    left: '29.17%',
                    width: '9.03%',
                    height: '6.09%',
                  }}
                  className="bg-[#8e8c8f] rounded-[9px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 2 (left: 40.00%, width: 9.03%, top: 29.93%, height: 6.09%) */}
              {pin.length >= 2 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.93%',
                    left: '40.00%',
                    width: '9.03%',
                    height: '6.09%',
                  }}
                  className="bg-[#8e8c8f] rounded-[9px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 3 (left: 50.83%, width: 9.03%, top: 29.93%, height: 6.09%) */}
              {pin.length >= 3 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.93%',
                    left: '50.83%',
                    width: '9.03%',
                    height: '6.09%',
                  }}
                  className="bg-[#8e8c8f] rounded-[9px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 4 (left: 61.67%, width: 9.03%, top: 29.93%, height: 6.09%) */}
              {pin.length >= 4 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.93%',
                    left: '61.67%',
                    width: '9.03%',
                    height: '6.09%',
                  }}
                  className="bg-[#8e8c8f] rounded-[9px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Incorrect PIN feedback message */}
              {pinError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '37.5%',
                    left: '12%',
                    width: '76%',
                  }}
                  className="z-30 text-center text-[12px] font-bold text-white bg-red-600/90 py-1.5 px-3 rounded-full shadow-lg pointer-events-none"
                >
                  {pinError}
                </motion.div>
              )}

              {/* KEYPAD ON-SCREEN BUTTONS HOTSPOTS */}
              {/* Row 1: Keys 1, 2, 3 (Y: 71.9% to 77.6%) */}
              <button
                type="button"
                onClick={() => handleKeypadClick('1')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="1"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('2')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="2"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('3')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="3"
              />

              {/* Row 2: Keys 4, 5, 6 (Y: 79.2% to 84.9%) */}
              <button
                type="button"
                onClick={() => handleKeypadClick('4')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="4"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('5')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="5"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('6')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="6"
              />

              {/* Row 3: Keys 7, 8, 9 (Y: 86.5% to 92.2%) */}
              <button
                type="button"
                onClick={() => handleKeypadClick('7')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="7"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('8')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="8"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('9')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="9"
              />

              {/* Row 4: Key 0 and Backspace (Y: 93.2% to 98.9%) */}
              <button
                type="button"
                onClick={() => handleKeypadClick('0')}
                style={{
                  position: 'absolute',
                  top: '93.2%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="0"
              />
              <button
                type="button"
                onClick={handleBackspaceClick}
                style={{
                  position: 'absolute',
                  top: '93.2%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 rounded-2xl transition-opacity"
                aria-label="Backspace"
              />
            </motion.div>
          )}

          {/* STEP 4: HOME SCREEN - WHITE BASE WITH AUTHENTIC ROUNDED CARD & LILAC TOP GAP */}
          {currentStep === 4 && (
            <motion.div
              key="step-4-home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-white flex flex-col overflow-hidden"
            >
              {/* 1. FIXED TOP: USER'S BALANCE CARD & HEADER (REMAINS 100% MOTIONLESS DURING SCROLL) */}
              <div className="shrink-0 w-full z-20 relative bg-[#d6b7d7]">
                <div
                  className="w-full relative overflow-hidden bg-[#7a1c7d]"
                  style={{ aspectRatio: '710 / 543' }}
                >
                  {/* 1. Balance Shown, Reward Hidden (Default PNG) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/aistudio/home_page__bc682fdb.png"
                    alt="Balance Shown, Reward Hidden"
                    className={`w-full h-auto block pointer-events-none transition-opacity duration-150 ${
                      (isBalanceShown || isBalanceLoading) && !(isRewardShown || isRewardLoading) ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                  />

                  {/* 2. Balance Hidden, Reward Hidden */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/aistudio/home_page_balance_hidden.png"
                    alt="Balance Hidden, Reward Hidden"
                    className={`absolute inset-0 w-full h-auto block pointer-events-none transition-opacity duration-150 ${
                      !(isBalanceShown || isBalanceLoading) && !(isRewardShown || isRewardLoading) ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                  />

                  {/* 3. Balance Shown, Reward Shown */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/aistudio/home_page_bal_show_rew_show.png"
                    alt="Balance Shown, Reward Shown"
                    className={`absolute inset-0 w-full h-auto block pointer-events-none transition-opacity duration-150 ${
                      (isBalanceShown || isBalanceLoading) && (isRewardShown || isRewardLoading) ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                  />

                  {/* 4. Balance Hidden, Reward Shown */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/aistudio/home_page_bal_hide_rew_show.png"
                    alt="Balance Hidden, Reward Shown"
                    className={`absolute inset-0 w-full h-auto block pointer-events-none transition-opacity duration-150 ${
                      !(isBalanceShown || isBalanceLoading) && (isRewardShown || isRewardLoading) ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable={false}
                  />

                  {/* 1. Complete, seamless solid patch covering the underlying phone number and name/welcome text in the PNG */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '47.0%',
                      left: '20.0%',
                      width: '60.0%',
                      height: '12.5%',
                      background: 'linear-gradient(to bottom, #73257f 0%, #762581 50%, #792683 100%)',
                    }}
                    className="flex flex-col items-center justify-center pointer-events-none z-15 select-none overflow-hidden"
                  >
                    {/* Row 1: Authentic Phone Icon + Number */}
                    <div className="flex items-center justify-center gap-1">
                      <svg
                        className="w-2.5 h-2.5 text-[#f2bf9d] shrink-0 fill-current"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 1 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                      </svg>
                      <span className="text-[#f2bf9d] text-[9.6px] sm:text-[10.2px] font-normal tracking-[0.02em] select-none whitespace-nowrap leading-none">
                        {phoneNumber
                          ? `+251${phoneNumber.slice(0, 6)}${'*'.repeat(Math.max(0, Math.min(6, phoneNumber.length - 6)) || 3)}`
                          : '+251959754***'}
                      </span>
                    </div>

                    {/* Row 2: Typewriter Animated Greeting / First Name with blinking cursor */}
                    <div className="flex items-center justify-center mt-1">
                      <span className="text-[#f2bf9d] text-[8.8px] sm:text-[9.4px] font-normal tracking-[0.10em] select-none whitespace-nowrap leading-none uppercase">
                        {displayText || (() => {
                          const first = userName.trim().split(/\s+/)[0] || 'AYMEN';
                          const cleanFirst = first.replace(/!+$/, '').trim().toUpperCase();
                          return `${cleanFirst} !`;
                        })()}
                      </span>
                      <span className="inline-block text-[#f2bf9d] text-[8.8px] sm:text-[9.4px] font-bold ml-0.5 animate-pulse select-none leading-none">
                        _
                      </span>
                    </div>
                  </div>

                  {/* Hotspot: Phone Number / Profile (ONLY triggers on Long-Press of 500ms; Click does nothing) */}
                  <button
                    type="button"
                    onPointerDown={startProfileLongPress}
                    onPointerUp={endProfileLongPress}
                    onPointerCancel={cancelProfileLongPress}
                    onPointerLeave={cancelProfileLongPress}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '46.0%',
                      left: '25.0%',
                      width: '50.0%',
                      height: '14.0%',
                    }}
                    aria-label="Edit Profile Details (Long-press only)"
                    className="cursor-pointer bg-transparent border-0 outline-none select-none touch-none z-20"
                  />

                  {/* 2. Dynamic Balance Loading System: 3 Horizontal splash dots traveling to the right at exact initial position */}
                  {isBalanceLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '76.8%',
                        left: '6.0%',
                        width: '38px',
                        height: '14px',
                        backgroundColor: '#842789',
                      }}
                      className="flex items-center justify-center pointer-events-none z-10 overflow-hidden"
                    >
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="absolute w-[5px] h-[5px] rounded-full bg-white shadow-xs"
                            initial={{ x: -18, scale: 0.1, opacity: 0 }}
                            animate={{
                              x: [-18, -9, 0, 9, 18],
                              scale: [0.1, 1.15, 1.0, 1.0, 0.15],
                              opacity: [0, 1, 1, 1, 0],
                            }}
                            transition={{
                              duration: 1.8,
                              repeat: Infinity,
                              ease: 'easeInOut',
                              times: [0, 0.2, 0.5, 0.8, 1],
                              delay: (i * 1.8) / 3,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Dynamic Balance Amount Display (When shown) at exact initial position */}
                  {isBalanceShown && !isBalanceLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '77.2%',
                        left: '6.2%',
                        maxWidth: '42%',
                        height: '4.8%',
                        backgroundColor: '#842789',
                      }}
                      className="flex items-center pointer-events-none z-10 overflow-hidden"
                    >
                      <span className="text-white text-[9.5px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap leading-none">
                        {formatAmount(balance)}
                      </span>
                    </div>
                  )}
                  {/* Note: When unshow/hidden (!isBalanceShown && !isBalanceLoading), original PNG stars/dots show through untouched ("balance lay star beneberebet yhun") */}

                  {/* 4. Dynamic Reward Loading System: 3 Horizontal splash dots traveling to the right at exact initial position */}
                  {isRewardLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '76.8%',
                        right: '6.0%',
                        width: '38px',
                        height: '14px',
                        backgroundColor: '#842789',
                      }}
                      className="flex items-center justify-center pointer-events-none z-10 overflow-hidden"
                    >
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="absolute w-[5px] h-[5px] rounded-full bg-white shadow-xs"
                            initial={{ x: -18, scale: 0.1, opacity: 0 }}
                            animate={{
                              x: [-18, -9, 0, 9, 18],
                              scale: [0.1, 1.15, 1.0, 1.0, 0.15],
                              opacity: [0, 1, 1, 1, 0],
                            }}
                            transition={{
                              duration: 1.8,
                              repeat: Infinity,
                              ease: 'easeInOut',
                              times: [0, 0.2, 0.5, 0.8, 1],
                              delay: (i * 1.8) / 3,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Dynamic Reward Amount Display (When shown and not loading) at exact initial position */}
                  {isRewardShown && !isRewardLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '77.2%',
                        right: '7.2%',
                        maxWidth: '42%',
                        height: '4.4%',
                      }}
                      className="flex items-center justify-end bg-[#842789] pointer-events-none z-10 overflow-hidden"
                    >
                      <span className="text-white text-[11.5px] sm:text-[12px] font-semibold tracking-tight whitespace-nowrap leading-none">
                        {formatAmount(reward)}
                      </span>
                    </div>
                  )}

                  {/* Hotspot 1: Balance (Toggle Show/Unshow on tap, Open Edit Modal on Long Press) */}
                  <button
                    type="button"
                    onPointerDown={startBalanceLongPress}
                    onPointerUp={endBalanceLongPress}
                    onPointerCancel={cancelBalanceLongPress}
                    onPointerLeave={cancelBalanceLongPress}
                    style={{
                      position: 'absolute',
                      top: '63.0%',
                      left: '5.0%',
                      width: '38.0%',
                      height: '24.0%',
                    }}
                    aria-label="Toggle Balance Visibility or Long Press to Edit Balance"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20"
                  />

                  {/* Hotspot 2: Reward (Toggle Show/Unshow on tap with loader, Open Edit Modal on Long Press - EXACTLY LIKE BALANCE) */}
                  <button
                    type="button"
                    onPointerDown={startRewardLongPress}
                    onPointerUp={endRewardLongPress}
                    onPointerCancel={cancelRewardLongPress}
                    onPointerLeave={cancelRewardLongPress}
                    style={{
                      position: 'absolute',
                      top: '63.0%',
                      left: '58.0%',
                      width: '38.0%',
                      height: '24.0%',
                    }}
                    aria-label="Toggle Reward Visibility or Long Press to Edit Reward"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20"
                  />
                </div>
              </div>

              {/* 2. SCROLLABLE HOME CONTENT - SEAMLESS AUTHENTIC ROUNDED SHOULDERS & LILAC GAP */}
              <div className="flex-1 w-full relative overflow-hidden bg-white">
                <div
                  ref={homeScrollRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y cursor-grab active:cursor-grabbing select-none bg-white"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  <div className="w-full flex flex-col items-center bg-white">
                    {/* 1. AUTHENTIC SERVICES SECTION - STARTING EXACTLY AT ARROW BOUNDARY (SLIDES UNDER FIXED TOP) */}
                    <div className="relative w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/aistudio/white_card_services_clean.png"
                        alt="CBEBirr Mekedonia and Services"
                        className="w-full h-auto block object-contain pointer-events-none"
                        draggable={false}
                      />

                      {/* Hotspot: Click "To CBE Acct" card to navigate to CBE Send Money (Step 6) */}
                      <button
                        type="button"
                        onClick={() => {
                          setTransferError('');
                          setCurrentStep(6);
                        }}
                        style={{
                          position: 'absolute',
                          top: '21.0%',
                          left: '51.0%',
                          width: '22.0%',
                          height: '35.0%',
                        }}
                        aria-label="To CBE Acct"
                        className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-2xl"
                      />

                      {/* Hotspot: Click "Send Money" card to navigate to CBE Send Money (Step 6) */}
                      <button
                        type="button"
                        onClick={() => {
                          setTransferError('');
                          setCurrentStep(6);
                        }}
                        style={{
                          position: 'absolute',
                          top: '21.0%',
                          left: '27.0%',
                          width: '22.0%',
                          height: '35.0%',
                        }}
                        aria-label="Send Money"
                        className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-2xl"
                      />

                      {/* Hotspot: Click "Transaction Detail" header link to navigate to Recent Transactions (Step 11) */}
                      <button
                        type="button"
                        onClick={() => setCurrentStep(11)}
                        style={{
                          position: 'absolute',
                          top: '10.5%',
                          left: '60.0%',
                          width: '38.0%',
                          height: '11.0%',
                        }}
                        aria-label="Recent Transactions"
                        className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
                      />
                    </div>

                    {/* 2. USER'S CROPPED PROMOTIONAL BANNER PNG (home_scroll_down___1__4a940d15.png) */}
                    <div className="w-full flex justify-center py-1.5 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/aistudio/home_scroll_down___1__4a940d15.png"
                        alt="CBEBirr Promotion Banner"
                        className="w-full h-auto block object-contain pointer-events-none"
                        draggable={false}
                      />
                    </div>

                    {/* 3. USER'S CROPPED LOWER 8 ICONS PNG (home_scroll_down___2__759e601d.png) */}
                    <div className="w-full flex justify-center pt-1 pb-4 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/aistudio/home_scroll_down___2__759e601d.png"
                        alt="CBEBirr Transfer, Pay and Win"
                        className="w-[92.2%] h-auto block object-contain pointer-events-none"
                        draggable={false}
                      />
                    </div>

                    {/* Bottom spacer so all icons comfortably scroll fully into view */}
                    <div className="w-full h-10 bg-white" />
                  </div>
                </div>
              </div>

              {/* FLOATING QR CODE BUTTON (Crop placed exactly where it used to be) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12.0%',
                  right: '4.2%',
                  width: '28.3%',
                  zIndex: 25,
                }}
                className="pointer-events-auto cursor-pointer active:scale-95 transition-transform drop-shadow-xl select-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/floating_qr_clean.png"
                  alt="QR code"
                  className="w-full h-auto block select-none pointer-events-none"
                  draggable={false}
                />
              </div>

              {/* 3. FIXED BOTTOM: PURPLE NAVIGATION BAR ONLY (PURE WHITE BASE BEHIND & ABOVE IT) */}
              <div
                className="shrink-0 w-full z-20 select-none relative bg-white"
                style={{ aspectRatio: '720 / 167' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/home_bottom_nav.png"
                  alt="CBEBirr Bottom Navigation - Home Active"
                  className="w-full h-auto block drop-shadow-2xl pointer-events-none"
                  draggable={false}
                />

                {/* Hotspot: Click "Pay" tab to navigate to Pay Page (Step 14) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(14)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '20.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Pay Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "CBEBeje" center tab to navigate to CBEBeje (Step 12) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(12)}
                  style={{
                    position: 'absolute',
                    top: '15.0%',
                    left: '40.0%',
                    width: '20.0%',
                    height: '85.0%',
                  }}
                  aria-label="Go to CBEBeje"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Mini Apps" tab to navigate to Mini Apps (Step 13) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(13)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '60.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Mini Apps"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Others" tab to navigate to Others Page (Step 5) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '80.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Others Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />
              </div>

              {/* BALANCE & REWARD CUSTOMIZATION MODAL (Opened via Long-press on Balance) */}
              <AnimatePresence>
                {isBalanceModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.94, opacity: 0 }}
                      className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                      {/* Modal Header & Tabs */}
                      <div className="bg-[#7a1c7d] px-4 pt-3 pb-2 text-white flex flex-col shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-sm tracking-wide">
                            የቀሪ ሂሳብ አስተዳደር (Balance Manager)
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsBalanceModalOpen(false)}
                            className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                        {/* Three Toggle Tabs: Add Money, Set Balance, Set Reward */}
                        <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setBalanceModalTab('add')}
                            className={`py-1.5 rounded-lg transition-all cursor-pointer text-center text-[10.5px] ${
                              balanceModalTab === 'add'
                                ? 'bg-white text-[#7a1c7d] shadow-sm font-bold'
                                : 'text-white/80 hover:text-white'
                            }`}
                          >
                            + ጨምር (Add)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBalanceModalTab('edit')}
                            className={`py-1.5 rounded-lg transition-all cursor-pointer text-center text-[10.5px] ${
                              balanceModalTab === 'edit'
                                ? 'bg-white text-[#7a1c7d] shadow-sm font-bold'
                                : 'text-white/80 hover:text-white'
                            }`}
                          >
                            ቀሪ ሂሳብ (Bal)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBalanceModalTab('reward')}
                            className={`py-1.5 rounded-lg transition-all cursor-pointer text-center text-[10.5px] ${
                              balanceModalTab === 'reward'
                                ? 'bg-white text-[#7a1c7d] shadow-sm font-bold'
                                : 'text-white/80 hover:text-white'
                            }`}
                          >
                            ሪዋርድ (Rew)
                          </button>
                        </div>
                      </div>

                      {/* Modal Body */}
                      <div className="p-4 space-y-3.5">
                        {balanceModalTab === 'add' && (
                          <>
                            {/* Current Balance Display */}
                            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-600">
                                አሁን ያለው ቀሪ ሂሳብ:
                              </span>
                              <span className="font-bold text-[#7a1c7d] text-[13px] font-mono">
                                ETB {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Add Birr Input */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                የሚጨመረው ብር (Amount to Add ETB)
                              </label>
                              <input
                                type="number"
                                value={addMoneyInput}
                                onChange={(e) => setAddMoneyInput(e.target.value)}
                                placeholder="ለምሳሌ: 300.00"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#7a1c7d] text-slate-800 font-mono"
                              />
                            </div>

                            {/* Quick Add Presets */}
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-500 mb-1.5">
                                ፈጣን ጭማሪዎች (Quick Add)
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[100, 300, 500, 1000, 5000, 10000].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setAddMoneyInput(preset.toString())}
                                    className="py-1 text-[11px] font-semibold bg-purple-50 text-[#7a1c7d] hover:bg-[#7a1c7d] hover:text-white rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                  >
                                    +{preset.toLocaleString()}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Total After Addition Preview */}
                            {addMoneyInput && !isNaN(parseFloat(addMoneyInput)) && parseFloat(addMoneyInput) > 0 && (
                              <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 flex items-center justify-between">
                                <span className="text-[10.5px] font-medium text-emerald-800">
                                  አዲሱ ቀሪ ሂሳብ ድምር:
                                </span>
                                <span className="font-bold text-emerald-700 text-[12.5px] font-mono">
                                  ETB {(balance + parseFloat(addMoneyInput)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            {/* Action Buttons for Add Money */}
                            <div className="flex space-x-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setIsBalanceModalOpen(false)}
                                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                              >
                                ሰርዝ (Cancel)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const addVal = parseFloat(addMoneyInput);
                                  if (!isNaN(addVal) && addVal > 0) {
                                    const newBal = balance + addVal;
                                    setBalance(newBal);

                                    // Create matching credit transaction in Transaction History
                                    const now = new Date();
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
                                    const newRef = generateTxRef();
                                    const newTx: TransactionItem = {
                                      id: `tx-${Date.now()}`,
                                      title: 'Receive Money',
                                      date: dateStr,
                                      amount: addVal.toString(),
                                      type: 'credit',
                                      ref: newRef,
                                      account: userAccount || phoneNumber || '959754788',
                                      receiverName: userName || 'AYMEN NIGATU YIMAM',
                                      orderId: newRef,
                                      status: 'Completed',
                                      debitAccountType: 'Customer E-money Account',
                                      creditAccountType: 'CBE Bank Account',
                                    };
                                    setTransactions((prev) => [newTx, ...prev]);

                                    // Trigger real-time SMS webhook for added money
                                    try {
                                      sendTransactionSms({
                                        fullName: userName || 'JUREY ABDUL HUSSEN',
                                        amount: addVal.toFixed(2),
                                        receiverAccount: userAccount || '1000760389289',
                                        receiverName: userName || 'JUREY ABDUL HUSSEN',
                                        balance: newBal,
                                        txnId: generate8CharTxnId(newRef),
                                        ftRef: newRef,
                                        date: now,
                                      }).catch(() => {});
                                    } catch {
                                      // ignore
                                    }

                                    setReceiptToast(`ETB ${addVal.toLocaleString()} ወደ ቀሪ ሂሳብ ተጨምሯል (SMS sent)`);
                                    setTimeout(() => setReceiptToast(''), 2500);
                                    setIsBalanceModalOpen(false);
                                  }
                                }}
                                disabled={!addMoneyInput || isNaN(parseFloat(addMoneyInput)) || parseFloat(addMoneyInput) <= 0}
                                className="flex-1 py-2 text-xs font-bold text-white bg-[#7a1c7d] hover:bg-[#68176b] disabled:opacity-50 rounded-xl shadow transition-colors cursor-pointer"
                              >
                                ጨምርና መዝግብ (Add & Record)
                              </button>
                            </div>
                          </>
                        )}

                        {balanceModalTab === 'edit' && (
                          <>
                            {/* Current Balance Display */}
                            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-600">
                                አሁን ያለው ቀሪ ሂሳብ:
                              </span>
                              <span className="font-bold text-[#7a1c7d] text-[13px] font-mono">
                                ETB {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                አዲስ ቀሪ ሂሳብ (Set Balance ETB)
                              </label>
                              <input
                                type="number"
                                value={tempBalanceInput}
                                onChange={(e) => setTempBalanceInput(e.target.value)}
                                placeholder="1000.00"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#7a1c7d] text-slate-800 font-mono"
                              />
                            </div>

                            {/* Quick Presets */}
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-500 mb-1.5">
                                ፈጣን መጠኖች (Quick Presets)
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[500, 1000, 5000, 10000, 50000, 100000].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setTempBalanceInput(preset.toString())}
                                    className="py-1 text-[11px] font-semibold bg-purple-50 text-[#7a1c7d] hover:bg-[#7a1c7d] hover:text-white rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                  >
                                    {preset.toLocaleString()}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex space-x-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setIsBalanceModalOpen(false)}
                                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                              >
                                ሰርዝ (Cancel)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newBal = parseFloat(tempBalanceInput);
                                  if (!isNaN(newBal) && newBal >= 0) {
                                    setBalance(newBal);
                                  }
                                  setIsBalanceModalOpen(false);
                                  setReceiptToast('ቀሪ ሂሳብ ተስተካክሏል (Balance saved)');
                                  setTimeout(() => setReceiptToast(''), 2000);
                                }}
                                className="flex-1 py-2 text-xs font-bold text-white bg-[#7a1c7d] hover:bg-[#68176b] rounded-xl shadow transition-colors cursor-pointer"
                              >
                                አስቀምጥ (Save)
                              </button>
                            </div>
                          </>
                        )}

                        {balanceModalTab === 'reward' && (
                          <>
                            {/* Current Reward Display */}
                            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-600">
                                አሁን ያለው ሪዋርድ (Current Reward):
                              </span>
                              <span className="font-bold text-[#7a1c7d] text-[13px] font-mono">
                                {reward.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Pts
                              </span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                ሪዋርድ ቀይር (Set Reward Pts/ETB)
                              </label>
                              <input
                                type="number"
                                value={tempRewardInput}
                                onChange={(e) => setTempRewardInput(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#7a1c7d] text-slate-800 font-mono"
                              />
                            </div>

                            {/* Quick Presets for Reward */}
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-500 mb-1.5">
                                ፈጣን የሪዋርድ መጠኖች (Quick Reward Presets)
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[0, 25, 50, 100, 250, 500].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setTempRewardInput(preset.toString())}
                                    className="py-1 text-[11px] font-semibold bg-purple-50 text-[#7a1c7d] hover:bg-[#7a1c7d] hover:text-white rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                  >
                                    {preset} Pts
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex space-x-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setIsBalanceModalOpen(false)}
                                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                              >
                                ሰርዝ (Cancel)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newRew = parseFloat(tempRewardInput);
                                  if (!isNaN(newRew) && newRew >= 0) {
                                    setReward(newRew);
                                  }
                                  setIsBalanceModalOpen(false);
                                  setReceiptToast('ሪዋርድ ተስተካክሏል (Reward saved)');
                                  setTimeout(() => setReceiptToast(''), 2000);
                                }}
                                className="flex-1 py-2 text-xs font-bold text-white bg-[#7a1c7d] hover:bg-[#68176b] rounded-xl shadow transition-colors cursor-pointer"
                              >
                                አስቀምጥ (Save)
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP 5: OTHERS SCREEN (Exact CBEBirr Others & Settings flow) */}
          {currentStep === 5 && (
            <motion.div
              key="step-5-others"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#e0e0e0] flex flex-col overflow-hidden"
            >
              {/* 1. FIXED TOP: OTHERS HEADER & PROFILE CARD (others_fixed_top.png) */}
              <div
                className="shrink-0 w-full z-20 shadow-md relative overflow-hidden bg-[#8c288e]"
                style={{ aspectRatio: '720 / 341' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/others_fixed_top.png"
                  alt="CBEBirr Others Header and Profile Card"
                  className="w-full h-auto block pointer-events-none"
                  draggable={false}
                />

                {/* Dynamic User Name Display (Real-time synchronization across all pages) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '52.6%',
                    left: '28.6%',
                    width: '35.0%',
                    height: '6.2%',
                  }}
                  className="bg-[#7b237c] flex items-center z-10 pointer-events-none select-none"
                >
                  <span className="text-white text-[12px] sm:text-[13px] font-semibold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis uppercase leading-none">
                    {userName.length > 9 ? `${userName.slice(0, 8).toUpperCase()}****` : userName.toUpperCase()}
                  </span>
                </div>

                {/* Hotspot: Click / Long-press Profile Card to edit Profile Details */}
                <button
                  type="button"
                  onPointerDown={startProfileLongPress}
                  onPointerUp={endProfileLongPress}
                  onPointerCancel={cancelProfileLongPress}
                  onPointerLeave={cancelProfileLongPress}
                  style={{
                    position: 'absolute',
                    top: '38.0%',
                    left: '6.0%',
                    width: '88.0%',
                    height: '52.0%',
                  }}
                  aria-label="Edit Profile Details"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-2xl"
                />
              </div>

              {/* 2. SCROLLABLE MIDDLE: MENU OPTIONS LIST (Scrolls smoothly between header and stationary bottom controls) */}
              <div
                ref={othersScrollRef}
                onPointerDown={handleOthersPointerDown}
                onPointerMove={handleOthersPointerMove}
                onPointerUp={handleOthersPointerUp}
                onPointerCancel={handleOthersPointerUp}
                className="flex-1 w-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y cursor-grab active:cursor-grabbing select-none bg-[#e0e0e0]"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div className="w-full flex flex-col items-center bg-[#e0e0e0] relative pb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/screens/others_menu_clean_list_v2.png"
                    alt="CBEBirr Others Menu Options"
                    className="w-full h-auto block object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              </div>

              {/* 3. STATIONARY BOTTOM CONTROLS: FIXED LOG OUT BUTTON & FLOATING MAP FAB (Never scrolls) */}
              <div className="shrink-0 w-full relative z-20 bg-[#e0e0e0] select-none">
                {/* Floating Purple Map FAB positioned on the right side hovering above Log Out */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-47px',
                    right: '6.8%',
                    width: '54px',
                    height: '54px',
                  }}
                  className="z-30 cursor-pointer active:scale-95 transition-transform drop-shadow-lg"
                  onClick={() => {
                    // Map action hotspot
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/screens/map_fab_perfect.png"
                    alt="CBE Location Map"
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                </div>

                {/* Fixed Log Out Button */}
                <div className="w-full relative cursor-pointer" style={{ aspectRatio: '720 / 140' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/screens/others_logout_bottom.png"
                    alt="Log Out"
                    className="w-full h-auto block pointer-events-none"
                    draggable={false}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPin('');
                      setCurrentStep(2);
                    }}
                    style={{
                      position: 'absolute',
                      top: '14%',
                      left: '5.0%',
                      width: '90.0%',
                      height: '54%',
                    }}
                    aria-label="Log Out"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity"
                  />
                </div>
              </div>

              {/* 3. FIXED BOTTOM: OTHERS ACTIVE NAVIGATION BAR (others_fixed_bottom.png) */}
              <div
                className="shrink-0 w-full z-20 select-none relative"
                style={{ aspectRatio: '720 / 167' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/others_fixed_bottom.png"
                  alt="CBEBirr Bottom Navigation - Others Active"
                  className="w-full h-auto block drop-shadow-2xl pointer-events-none"
                  draggable={false}
                />

                {/* Hotspot: Click "Home" tab to navigate back to Home Page (Step 4) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '0.0%',
                    width: '22.0%',
                    height: '75.0%',
                  }}
                  aria-label="Return to Home Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Pay" tab to navigate to Pay Page (Step 14) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(14)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '20.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Pay Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "CBEBeje" center tab to navigate to CBEBeje (Step 12) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(12)}
                  style={{
                    position: 'absolute',
                    top: '15.0%',
                    left: '40.0%',
                    width: '20.0%',
                    height: '85.0%',
                  }}
                  aria-label="Go to CBEBeje"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Mini Apps" tab to navigate to Mini Apps (Step 13) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(13)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '60.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Mini Apps"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />
              </div>
            </motion.div>
          )}

          {/* STEP 6: CBE SEND MONEY SCREEN */}
          {currentStep === 6 && (
            <motion.div
              key="step-6-send-money"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f7f2fa] flex flex-col overflow-hidden"
            >
              {/* Entire Send Money Screen PNG (screen_cbe_send_money_clean.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_cbe_send_money_clean.png"
                alt="CBEBirr Send Money to CBE Account"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Hotspot: Back Button (Top Left Arrow) */}
              <button
                type="button"
                onClick={() => {
                  setTransferError('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '1.2%',
                  left: '2.5%',
                  width: '18.0%',
                  height: '5.2%',
                }}
                aria-label="Back to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
              />

              {/* Hotspot: Top Search Icon (Long-press to open Saved Receivers Management) */}
              <button
                type="button"
                onPointerDown={startSearchLongPress}
                onPointerUp={endSearchLongPress}
                onPointerCancel={cancelSearchLongPress}
                onPointerLeave={cancelSearchLongPress}
                style={{
                  position: 'absolute',
                  top: '1.2%',
                  left: '82.5%',
                  width: '10.5%',
                  height: '5.2%',
                }}
                aria-label="Manage Saved Receivers (Long-press)"
                title="Long press to manage saved receivers"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full touch-none"
              />

              {/* Interactive Input: Receivers Account Number (Strictly 13 Digits) */}
              <input
                type="text"
                disabled={isTransferring}
                inputMode="numeric"
                maxLength={13}
                value={receiverAccount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 13);
                  setReceiverAccount(raw);
                  hasTriggeredUssdForAccountRef.current = false;
                  setCustomVerifiedReceiverName('');
                  if (transferError) setTransferError('');
                }}
                placeholder="Receivers Account Number"
                style={{
                  position: 'absolute',
                  top: '15.0%',
                  left: '21.5%',
                  width: '70.0%',
                  height: '3.0%',
                }}
                className={`z-20 text-[#262626] text-[13px] sm:text-[14px] font-normal outline-none px-1 bg-transparent placeholder-[#90869a] ${isTransferring ? 'pointer-events-none opacity-60' : ''}`}
              />

              {/* Receiver Name: Displayed cleanly below the account box ONLY when matching saved account or verified via MacroDroid */}
              {activeReceiverName && (
                <div
                  style={{
                    position: 'absolute',
                    top: '21.02%',
                    left: '5.0%',
                    width: '90.0%',
                    height: '2.4%',
                  }}
                  className="flex items-center justify-center text-center text-[#18181b] text-[14.5px] sm:text-[15px] font-semibold tracking-tight z-20 pointer-events-none select-none animate-in fade-in duration-150"
                >
                  <span>{activeReceiverName}</span>
                </div>
              )}

              {/* Interactive Input: Amount (Tapping triggers USSD *847# execution when 13-digit account is entered) */}
              <input
                type="number"
                disabled={isTransferring}
                inputMode="decimal"
                value={sendAmount}
                onChange={(e) => {
                  setSendAmount(e.target.value);
                  if (transferError) setTransferError('');
                }}
                onFocus={handleAmountFieldInteraction}
                onClick={handleAmountFieldInteraction}
                onTouchEnd={handleAmountFieldInteraction}
                placeholder="Amount"
                style={{
                  position: 'absolute',
                  top: '27.1%',
                  left: '21.5%',
                  width: '60.0%',
                  height: '3.5%',
                }}
                className={`z-20 text-[#262626] text-[14px] sm:text-[15px] font-semibold outline-none px-1 bg-transparent placeholder-[#90869a] ${isTransferring ? 'pointer-events-none opacity-60' : ''}`}
              />

              {/* Calculator Icon Hotspot: Quick preset amounts */}
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => {
                  const presets = ['100', '250', '500', '1000', '2500', '5000'];
                  const curIdx = presets.indexOf(sendAmount);
                  const nextPreset = presets[(curIdx + 1) % presets.length];
                  setSendAmount(nextPreset);
                  if (transferError) setTransferError('');
                }}
                style={{
                  position: 'absolute',
                  top: '26.8%',
                  left: '83.0%',
                  width: '8.5%',
                  height: '4.0%',
                }}
                title="Quick Amount Preset"
                className={`cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-lg ${isTransferring ? 'pointer-events-none' : ''}`}
              />

              {/* Interactive Input: Reason */}
              <input
                type="text"
                disabled={isTransferring}
                value={sendReason}
                onChange={(e) => {
                  setSendReason(e.target.value);
                  if (transferError) setTransferError('');
                }}
                placeholder="Reason"
                style={{
                  position: 'absolute',
                  top: '37.3%',
                  left: '21.5%',
                  width: '70.0%',
                  height: '3.5%',
                }}
                className={`z-20 text-[#262626] text-[13px] sm:text-[14px] font-normal outline-none px-1 bg-transparent placeholder-[#90869a] ${isTransferring ? 'pointer-events-none opacity-60' : ''}`}
              />

              {/* Inline Error Alert if validation fails */}
              {transferError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '41.3%',
                    left: '8.0%',
                    width: '84.0%',
                  }}
                  className="z-20 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-300 py-1.5 px-2 rounded-lg shadow-xs"
                >
                  {transferError}
                </div>
              )}

              {/* Hotspot: Send Money Button (Proceeds to Step 7 PIN Authentication) */}
              <button
                type="button"
                disabled={isTransferring}
                onClick={handleProceedToTransferPin}
                style={{
                  position: 'absolute',
                  top: '44.3%',
                  left: '8.0%',
                  width: '84.0%',
                  height: '5.2%',
                }}
                aria-label="Send Money"
                className={`cursor-pointer bg-transparent border-0 outline-none active:brightness-90 active:scale-[0.99] transition-all z-20 rounded-2xl ${isTransferring ? 'pointer-events-none' : ''}`}
              />

              {/* CBE Birr Authenticated Transfer Loading Box (matching wallet_transfer_loding_page__b5910de2.png & loding__d053620a.png) */}
              <AnimatePresence>
                {isTransferring && (
                  <motion.div
                    key="transfer-loading-popup"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.16 }}
                    style={{
                      position: 'absolute',
                      top: '41.5%',
                      left: '33.3%',
                      width: '33.4%',
                      height: '11.0%',
                    }}
                    className="bg-[#8c288e] rounded-2xl shadow-[0_6px_28px_rgba(0,0,0,0.32)] border border-white/10 flex items-center justify-center z-40 pointer-events-auto"
                  >
                    <div className="relative w-full h-full flex items-center justify-center">
                      <CBEAuthenticSpinner size={42} color="#ffffff" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AUTHENTIC FULL-SCREEN USSD RESOLVING OVERLAY (Matches login_splash__ce0971de.png) */}
              <AnimatePresence>
                {isResolvingUssdReceiver && (
                  <motion.div
                    key="ussd-resolving-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-[#fbf6fc]"
                  >
                    {/* Background PNG provided by user */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/aistudio/login_splash__ce0971de.png"
                      alt="CBE Loading"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    />

                    {/* Centered Authentic Animated Stepper Spinner */}
                    <div className="relative z-10 flex items-center justify-center">
                      <CBEAuthenticSpinner size={46} color="#8b278e" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>



              {/* SAVED RECEIVERS MANAGEMENT MODAL (Opened via Long-press on Search icon) */}
              <AnimatePresence>
                {isReceiversModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.94, opacity: 0 }}
                      className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85%]"
                    >
                      {/* Modal Header */}
                      <div className="bg-[#7a1c7d] px-4 py-3 text-white flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-2">
                          <Search className="w-4 h-4 text-purple-200" />
                          <h3 className="font-bold text-sm tracking-wide">
                            የተቀመጡ ተቀባዮች (Saved Receivers)
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsReceiversModalOpen(false);
                            setIsAddingNewReceiver(false);
                            setEditingReceiverId(null);
                          }}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-base font-bold transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-3.5 overflow-y-auto space-y-3 flex-1">
                        {/* Top Action: Add New Button (if not already adding) */}
                        {!isAddingNewReceiver && !editingReceiverId && (
                          <button
                            type="button"
                            onClick={handleStartAddReceiver}
                            className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-[#7a1c7d] border border-purple-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>አዲስ ተቀባይ መዝግብ (+ Add Receiver)</span>
                          </button>
                        )}

                        {/* Add / Edit Form */}
                        {(isAddingNewReceiver || editingReceiverId) && (
                          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                            <h4 className="text-xs font-bold text-[#7a1c7d]">
                              {editingReceiverId ? 'ተቀባይ አስተካክል (Edit Receiver)' : 'አዲስ ተቀባይ መዝግብ (New Receiver)'}
                            </h4>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                የሂሳብ ቁጥር (Account Number):
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={16}
                                value={modalAccNum}
                                onChange={(e) => setModalAccNum(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="1000..."
                                className="w-full bg-white border border-slate-300 focus:border-[#7a1c7d] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                የተቀባይ ስም (Receiver Name):
                              </label>
                              <input
                                type="text"
                                value={modalAccName}
                                onChange={(e) => setModalAccName(e.target.value)}
                                placeholder="e.g. Fozia Mossa Mohammed"
                                className="w-full bg-white border border-slate-300 focus:border-[#7a1c7d] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold outline-none"
                              />
                            </div>

                            {modalFormError && (
                              <p className="text-[10px] font-semibold text-red-600 bg-red-50 p-1 rounded">
                                {modalFormError}
                              </p>
                            )}

                            <div className="flex items-center space-x-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingNewReceiver(false);
                                  setEditingReceiverId(null);
                                  setModalFormError('');
                                }}
                                className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                ሰርዝ (Cancel)
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveReceiver}
                                className="flex-1 py-1.5 text-xs font-bold text-white bg-[#7a1c7d] hover:bg-[#68176b] rounded-lg shadow-sm transition-colors cursor-pointer"
                              >
                                {editingReceiverId ? 'አሻሽል (Update)' : 'አስቀምጥ (Save)'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* List of Saved Receivers */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-600">
                            የተመዘገቡ ተቀባዮች ዝርዝር ({savedReceivers.length})
                          </p>

                          {savedReceivers.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs">
                              ምንም የተቀመጠ ተቀባይ የለም
                            </div>
                          ) : (
                            savedReceivers.map((rec) => (
                              <div
                                key={rec.id}
                                className="p-2.5 bg-slate-50 hover:bg-purple-50/40 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
                              >
                                <div
                                  className="flex-1 min-w-0 pr-2 cursor-pointer"
                                  onClick={() => handleSelectReceiver(rec)}
                                >
                                  <p className="text-xs font-bold text-slate-900 truncate">
                                    {rec.accountName}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono tracking-tight">
                                    {rec.accountNumber}
                                  </p>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectReceiver(rec)}
                                    title="ይህንን ቁጥር ምረጥ"
                                    className="px-2 py-1 text-[10px] font-bold bg-[#7a1c7d] text-white rounded-md hover:bg-[#68176b] transition-colors cursor-pointer"
                                  >
                                    ምረጥ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditReceiver(rec)}
                                    title="አስተካክል"
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReceiver(rec.id)}
                                    title="ሰርዝ"
                                    className="p-1 text-red-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Modal Footer Note */}
                      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                        የተቀመጡ ተቀባዮች በሙሉ እዚህ ይገኛሉ፤ በፈለጉት ጊዜ ማስተካከል ወይም መሰረዝ ይችላሉ።
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP 7: CBE SEND MONEY PIN AUTHENTICATION SCREEN */}
          {currentStep === 7 && (
            <motion.div
              key="step-7-pin-transfer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#dedede] flex flex-col overflow-hidden select-none"
            >
              {/* Underlying exact Confirm PIN Screen PNG (confirm_pin_page.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/confirm_pin_page.png"
                alt="CBE Send Money PIN Authentication"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Hotspot 1: Top Bar Purple Back Button */}
              <button
                type="button"
                onClick={() => {
                  setTransferPin('');
                  setCurrentStep(6);
                }}
                style={{
                  position: 'absolute',
                  top: '0.8%',
                  left: '2.5%',
                  width: '15.0%',
                  height: '4.8%',
                }}
                aria-label="Back to Send Money"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot 2: Sub-Header Grey Back Button */}
              <button
                type="button"
                onClick={() => {
                  setTransferPin('');
                  setCurrentStep(6);
                }}
                style={{
                  position: 'absolute',
                  top: '9.8%',
                  left: '4.4%',
                  width: '11.0%',
                  height: '5.2%',
                }}
                aria-label="Back to Send Money"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* 4 BOXES: Exact visual style matching login PIN system (#8e8c8f fill + white asterisk) */}
              {/* Box 1 (left: 30.56%, width: 8.33%, top: 29.40%, height: 5.76%) */}
              {transferPin.length >= 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.40%',
                    left: '30.56%',
                    width: '8.33%',
                    height: '5.76%',
                  }}
                  className="bg-[#8e8c8f] rounded-[10px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 2 (left: 40.69%, width: 8.33%, top: 29.40%, height: 5.76%) */}
              {transferPin.length >= 2 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.40%',
                    left: '40.69%',
                    width: '8.33%',
                    height: '5.76%',
                  }}
                  className="bg-[#8e8c8f] rounded-[10px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 3 (left: 50.83%, width: 8.33%, top: 29.40%, height: 5.76%) */}
              {transferPin.length >= 3 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.40%',
                    left: '50.83%',
                    width: '8.33%',
                    height: '5.76%',
                  }}
                  className="bg-[#8e8c8f] rounded-[10px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Box 4 (left: 60.97%, width: 8.33%, top: 29.40%, height: 5.76%) */}
              {transferPin.length >= 4 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.40%',
                    left: '60.97%',
                    width: '8.33%',
                    height: '5.76%',
                  }}
                  className="bg-[#8e8c8f] rounded-[10px] flex items-center justify-center pointer-events-none select-none z-10"
                >
                  <span className="text-white text-[13px] sm:text-[14px] font-bold leading-none select-none flex items-center justify-center pt-0.5">
                    *
                  </span>
                </div>
              )}

              {/* Incorrect Transfer PIN feedback message */}
              {transferPinError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '37.0%',
                    left: '12%',
                    width: '76%',
                  }}
                  className="z-30 text-center text-[12px] font-bold text-white bg-red-600/90 py-1.5 px-3 rounded-full shadow-lg pointer-events-none"
                >
                  {transferPinError}
                </motion.div>
              )}

              {/* Dynamic Receiver Info Overlay on Card 1 - Seamlessly covers static PNG text with exact style */}
              <div
                style={{
                  position: 'absolute',
                  top: '50.8%',
                  left: '16.5%',
                  width: '67.0%',
                  height: '7.2%',
                }}
                className="flex flex-col justify-center bg-[#f7f2fa] z-10 pointer-events-none select-none pl-1"
              >
                <span className="text-[14px] sm:text-[14.5px] font-semibold text-[#1c1b1f] truncate leading-tight">
                  {displayReceiverName}
                </span>
                <span className="text-[11.5px] sm:text-[12px] font-normal text-[#49454f] tracking-wide truncate mt-1">
                  {receiverAccount || '1000278947339'}
                </span>
              </div>

              {/* Dynamic Amount Overlay on Card 2 - Seamlessly covers static PNG text with exact style */}
              <div
                style={{
                  position: 'absolute',
                  top: '60.0%',
                  left: '16.5%',
                  width: '67.0%',
                  height: '7.0%',
                }}
                className="flex flex-col justify-center bg-[#f7f2fa] z-10 pointer-events-none select-none pl-1"
              >
                <span className="text-[13.5px] sm:text-[14px] font-medium text-[#1c1b1f] truncate leading-tight">
                  Amount
                </span>
                <span className="text-[12.5px] sm:text-[13px] font-normal text-[#1c1b1f] tracking-wide truncate mt-1">
                  {sendAmount ? Number(sendAmount).toLocaleString('en-US') : '5'}
                </span>
              </div>

              {/* ON-SCREEN KEYPAD HOTSPOTS (Exact match to login page keypad) */}
              {/* Row 1: Keys 1, 2, 3 (Y: 71.9% to 77.6%) */}
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('1')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="1"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('2')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="2"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('3')}
                style={{
                  position: 'absolute',
                  top: '71.9%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="3"
              />

              {/* Row 2: Keys 4, 5, 6 (Y: 79.2% to 84.9%) */}
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('4')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="4"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('5')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="5"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('6')}
                style={{
                  position: 'absolute',
                  top: '79.2%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="6"
              />

              {/* Row 3: Keys 7, 8, 9 (Y: 86.5% to 92.2%) */}
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('7')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '2.8%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="7"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('8')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="8"
              />
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('9')}
                style={{
                  position: 'absolute',
                  top: '86.5%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="9"
              />

              {/* Row 4: Key 0 and Purple Backspace (Y: 93.8% to 99.5%) */}
              <button
                type="button"
                onClick={() => handleTransferKeypadClick('0')}
                style={{
                  position: 'absolute',
                  top: '93.8%',
                  left: '34.7%',
                  width: '30.3%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-2xl transition-colors"
                aria-label="0"
              />
              <button
                type="button"
                onClick={handleTransferBackspace}
                style={{
                  position: 'absolute',
                  top: '93.8%',
                  left: '68.0%',
                  width: '29.2%',
                  height: '5.7%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 rounded-2xl transition-opacity"
                aria-label="Backspace"
              />
            </motion.div>
          )}

          {/* STEP 8: CBE TRANSACTION RECEIPT SCREEN */}
          {currentStep === 8 && (
            <motion.div
              key="step-8-receipt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#8c288e] flex flex-col overflow-hidden select-none"
            >
              {/* Entire Receipt Screen PNG (receipt_page.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/receipt_page.png"
                alt="CBEBirr Transaction Receipt"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Dynamic Transaction Summary Paragraph Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '22.8%',
                  left: '7.8%',
                  width: '84.4%',
                  height: '9.3%',
                }}
                className="bg-[#eeeeee] text-[#1a1a1a] text-[12px] sm:text-[13.5px] leading-snug p-0.5 pointer-events-none z-10 font-normal select-none overflow-hidden flex flex-col justify-center"
              >
                <p>
                  <span>ETB </span>
                  <span className="font-bold">
                    {sendAmount ? parseFloat(sendAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '1.01'}
                  </span>
                  <span> has been debited from </span>
                  <span className="font-bold">{userName}</span>
                  <span> for </span>
                  <span className="font-bold">
                    {displayReceiverName}
                  </span>
                  <span> on </span>
                  <span className="font-bold">{transactionDate}</span>
                  <span> with transaction ID: </span>
                  <span className="font-bold">{transactionRef || 'DJM51SKYIQ3'}</span>
                  <span> via CBEBirr mobile app&apos;s </span>
                  <span className="font-bold">Wallet Transfer</span>
                  <span>.</span>
                </p>
              </div>

              {/* Authentic CBE Birr Plus QR Code matching user's exact PNG reference */}
              <div
                style={{
                  position: 'absolute',
                  top: '34.71%',
                  left: '30.42%',
                  width: '39.17%',
                  height: '18.47%',
                }}
                className="bg-[#eeeeee] flex items-center justify-center p-0 z-15 pointer-events-none select-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptQrDataUrl || "/assets/cbe_authentic_receipt_qr_exact.png"}
                  alt="CBEBirr QR Code"
                  className="w-full h-full object-contain pointer-events-none block"
                  draggable={false}
                />
              </div>

              {/* Invisible transparent hotspot on QR code area: Tapping triggers download in the exact same style */}
              <button
                type="button"
                onClick={() => handleDownloadReceipt('pdf')}
                style={{
                  position: 'absolute',
                  top: '34.75%',
                  left: '30.43%',
                  width: '39.15%',
                  height: '18.44%',
                }}
                aria-label="Download Receipt"
                className="cursor-pointer bg-transparent border-0 outline-none z-20"
              />

              {/* Hotspot: Receipt button -> Opens Step 9 Official Receipt Page */}
              <button
                type="button"
                onClick={() => setCurrentStep(9)}
                style={{
                  position: 'absolute',
                  top: '84.2%',
                  left: '16.0%',
                  width: '18.0%',
                  height: '6.5%',
                }}
                aria-label="View Official Receipt"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot: Download button */}
              <button
                type="button"
                onClick={handleDownloadReceipt}
                style={{
                  position: 'absolute',
                  top: '84.2%',
                  left: '41.0%',
                  width: '18.0%',
                  height: '6.5%',
                }}
                aria-label="Download Receipt"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot: Share button */}
              <button
                type="button"
                onClick={handleShareReceipt}
                style={{
                  position: 'absolute',
                  top: '84.2%',
                  left: '66.0%',
                  width: '18.0%',
                  height: '6.5%',
                }}
                aria-label="Share Receipt"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot: Back to Home button (Left bottom) */}
              <button
                type="button"
                onClick={() => {
                  setReceiverAccount('');
                  setSendAmount('');
                  setSendReason('');
                  setTransferPin('');
                  setTransferError('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '92.0%',
                  left: '6.8%',
                  width: '41.5%',
                  height: '5.8%',
                }}
                aria-label="Back to home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-2xl"
              />

              {/* Hotspot: Close button (Right bottom) */}
              <button
                type="button"
                onClick={() => {
                  setReceiverAccount('');
                  setSendAmount('');
                  setSendReason('');
                  setTransferPin('');
                  setTransferError('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '92.0%',
                  left: '51.7%',
                  width: '41.5%',
                  height: '5.8%',
                }}
                aria-label="Close"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-2xl"
              />

              {/* Action Toast Feedback */}
              {receiptToast && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '9.5%',
                    left: '10.0%',
                    width: '80.0%',
                  }}
                  className="z-30 text-center text-xs font-semibold text-white bg-black/80 py-2 px-3 rounded-full shadow-lg backdrop-blur-xs animate-fade-in"
                >
                  {receiptToast}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 9: OFFICIAL RECEIPT SCREEN (VAT Invoice / Customer Receipt) */}
          {currentStep === 9 && (
            <motion.div
              key="step-9-official-receipt"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f3edf7] flex flex-col overflow-hidden select-none"
            >
              {/* 1. TOP APP BAR: CBE Signature Purple Header with Back, Title & Quick Action Icons */}
              <div className="shrink-0 w-full bg-[#7a1c7d] text-white px-3.5 py-3 flex items-center justify-between shadow-md z-30">
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(8)}
                    className="p-1.5 -ml-1 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors cursor-pointer text-white flex items-center justify-center"
                    aria-label="Back to Transaction Summary"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-[14px] sm:text-[15px] font-bold leading-tight tracking-wide">
                      Official Receipt
                    </h2>
                    <p className="text-[10px] text-purple-200 leading-tight">
                      CBEBirr VAT Invoice / Customer Receipt
                    </p>
                  </div>
                </div>

                {/* Top quick action buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadReceipt('pdf')}
                    title="Download Receipt"
                    className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors text-white cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleShareReceipt}
                    title="Share Receipt"
                    className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors text-white cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.print();
                    }}
                    title="Print Receipt"
                    className="p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors text-white cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2. DOCUMENT VIEWER AREA (Scrollable, Clean Document Presentation with Active Real-Time Overlays) */}
              <div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-2 sm:p-2.5 flex flex-col items-center justify-start bg-[#ece7ef]">
                {/* Receipt Document Card - Pixel-perfect SVG vector mapping onto the pristine clean receipt template */}
                <div className="w-full bg-white rounded-md shadow-md border border-slate-300 overflow-hidden relative">
                  <svg
                    id="official-vat-receipt-svg"
                    viewBox="0 0 665 912"
                    className="w-full h-auto block select-none pointer-events-none"
                    style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision' }}
                  >
                    {/* Clean background template with high-definition crisp scaling */}
                    <image
                      href="/screens/official_receipt_hq.png"
                      width="665"
                      height="912"
                      preserveAspectRatio="none"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                    />

                    {/* Dynamic QR Code at Bottom-Right on Official Receipt: WITHOUT center logo */}
                    {officialReceiptQrDataUrl && (
                      <>
                        <rect x="518" y="768" width="108" height="108" fill="white" />
                        <image
                          href={officialReceiptQrDataUrl}
                          x="520"
                          y="770"
                          width="104"
                          height="104"
                          preserveAspectRatio="none"
                        />
                      </>
                    )}

                    {/* Exact real-time transaction vector text at verified coordinate baselines */}
                    <g fontFamily="Arial, Helvetica, sans-serif" fill="#141414" fontSize="11" fontWeight="normal">
                      {/* 1. Debit Account Value */}
                      <text x="442" y="368">
                        {`${userAccount || phoneNumber} - ${userName.toUpperCase()}`}
                      </text>

                      {/* 2. Credit Account Value */}
                      <text x="442" y="384">
                        {`${receiverAccount || '1000278947339'} - CBE Account`}
                      </text>

                      {/* 3. Receiver Name Value */}
                      <text x="442" y="401">
                        {displayReceiverName}
                      </text>

                      {/* 4. Order ID Value */}
                      <text x="442" y="426">
                        {transactionRef || 'FT2639841030'}
                      </text>

                      {/* 5. Receipt Number in Table */}
                      <text x="16" y="577">
                        {transactionRef || 'FT2639841030'}
                      </text>

                      {/* 6. Transaction Date in Table */}
                      <text x="285" y="577">
                        {transactionIsoDate}
                      </text>

                      {/* 7. Amount in Table (right-aligned to amount column at 575) */}
                      <text x="575" y="577" textAnchor="end">
                        {(parseFloat(sendAmount) || 10.0).toFixed(2)}
                      </text>

                      {/* 8. Paid amount (right-aligned to amount column at 575) */}
                      <text x="575" y="602" textAnchor="end">
                        {(parseFloat(sendAmount) || 10.0).toFixed(2)}
                      </text>

                      {/* 9. Service Charge (right-aligned to amount column at 575) */}
                      <text x="575" y="619" textAnchor="end">
                        0.00
                      </text>

                      {/* 10. Total Paid Amount (right-aligned, bold, perfectly aligned with amount column at 575) */}
                      <text x="575" y="703" textAnchor="end" fontWeight="bold">
                        {(parseFloat(sendAmount) || 10.0).toFixed(2)}
                      </text>

                      {/* 11. Total Amount in word */}
                      <text x="182" y="719" fontSize="10.5">
                        {`${numberToWords(parseFloat(sendAmount) || 10)} ETB and Zero Cents .`}
                      </text>

                      {/* 12. Payment Reason */}
                      <text x="182" y="736" fontSize="10.5">
                        {sendReason || 'Customer transfer to CBE account'}
                      </text>
                    </g>
                  </svg>
                </div>

                {/* Bottom padding for comfortable scrolling */}
                <div className="w-full h-4" />
              </div>

              {/* 3. BOTTOM ACTION BAR: Actions strictly aligned with CBE theme */}
              <div className="shrink-0 w-full bg-white border-t border-slate-200 px-3 py-2.5 flex items-center space-x-2 z-30 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt('pdf')}
                  className="flex-1 py-2.5 px-3 bg-[#7a1c7d] hover:bg-[#68176b] active:scale-[0.98] text-white rounded-xl text-xs sm:text-[13px] font-bold flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ደረሰኝ አውርድ (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReceipt('png')}
                  className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 active:scale-[0.98] text-[#7a1c7d] rounded-xl text-xs sm:text-[13px] font-bold flex items-center justify-center space-x-1 shadow-xs transition-all cursor-pointer"
                  title="Download as PNG"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiverAccount('');
                    setSendAmount('');
                    setSendReason('');
                    setTransferPin('');
                    setTransferError('');
                    setCurrentStep(4);
                  }}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl text-xs sm:text-[13px] font-semibold transition-all cursor-pointer"
                >
                  ወደ መነሻ (Home)
                </button>
              </div>

              {/* Action Toast Feedback */}
              {receiptToast && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-black/85 py-2 px-3 rounded-full shadow-xl backdrop-blur-xs"
                >
                  {receiptToast}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 10: TRANSACTION DETAIL SCREEN (Matching Screenshot_20261029-185412.png) */}
          {currentStep === 10 && (
            <motion.div
              key="step-10-transaction-detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f8f7f9] flex flex-col overflow-hidden select-none"
            >
              {/* 1. Top App Bar - Authentic CBE Purple */}
              <div className="shrink-0 w-full bg-[#7a1c7d] text-white px-3.5 py-3 flex items-center justify-between shadow-md z-30 select-none">
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(11)}
                    className="w-9 h-9 rounded-xl border border-white/30 flex items-center justify-center bg-transparent active:bg-white/10 text-white cursor-pointer transition-colors"
                    aria-label="Back to Recent Transactions"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <h2 className="text-[15px] sm:text-[16px] font-bold text-white tracking-wide">
                    Transaction Detail
                  </h2>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Search className="w-5 h-5 text-white/90 cursor-pointer" />
                  <span className="text-white text-xs font-semibold tracking-wider">
                    EN
                  </span>
                </div>
              </div>

              {/* 2. Scrollable Detail Fields List (All 13 fields from user screenshot) */}
              <div
                className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-white sm:bg-[#f8f7f9] px-4 py-2 space-y-0 divide-y divide-gray-100"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* 1. Transaction ID */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Transaction ID
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5 font-mono">
                    {selectedTx?.ref || transactionRef || 'FT1384476084'}
                  </p>
                </div>

                {/* 2. Transaction Time */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Transaction Time
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5 font-mono">
                    {selectedTx?.date || transactionDate || '2026-10-29 15:50'}
                  </p>
                </div>

                {/* 3. Transaction Type */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Transaction Type
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {selectedTx?.title || 'Send Money'}
                  </p>
                </div>

                {/* 4. Transaction Status */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Transaction Status
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {selectedTx?.status || 'Completed'}
                  </p>
                </div>

                {/* 5. Debit Account Type */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Debit Account Type
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {selectedTx?.debitAccountType || 'Customer E-money Account'}
                  </p>
                </div>

                {/* 6. Debit Party Mnemonic */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Debit Party Mnemonic
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {`${userAccount || phoneNumber || '959754788'} - ${(userName || 'AYMEN NIGATU YIMAM').toUpperCase()}`}
                  </p>
                </div>

                {/* 7. Credit Account Type */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Credit Account Type
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {selectedTx?.creditAccountType || 'CBE Bank Account'}
                  </p>
                </div>

                {/* 8. Credit Party Mnemonic */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Credit Party Mnemonic
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5 font-mono">
                    {(() => {
                      const acc = selectedTx?.account || receiverAccount || '1000278947339';
                      if (acc.length >= 8) {
                        return `${acc.slice(0, 4)}****${acc.slice(-4)}`;
                      }
                      return acc;
                    })()}
                  </p>
                </div>

                {/* 9. Amount */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Amount
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5 font-mono">
                    {typeof selectedTx?.amount === 'number'
                      ? selectedTx.amount.toFixed(2)
                      : parseFloat(selectedTx?.amount || sendAmount || '10').toFixed(2)}
                  </p>
                </div>

                {/* 10. Currency */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Currency
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    ETB
                  </p>
                </div>

                {/* 11. transfer successIndicator */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    transfer successIndicator
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    Success
                  </p>
                </div>

                {/* 12. Receiver Name */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Receiver Name
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5">
                    {selectedTx?.receiverName || displayReceiverName || 'Ram'}
                  </p>
                </div>

                {/* 13. Order Id */}
                <div className="py-2.5">
                  <p className="text-[12.5px] font-bold text-[#111827]">
                    Order Id
                  </p>
                  <p className="text-[12px] font-semibold text-[#7a1c7d] mt-0.5 font-mono">
                    {selectedTx?.orderId || selectedTx?.ref || transactionRef || 'FT1384476084'}
                  </p>
                </div>

                {/* Bottom spacer for floating button */}
                <div className="w-full h-28" />
              </div>

              {/* Floating "Get Receipt" Button at Bottom-Right (Opens Official Receipt per user request) */}
              <button
                type="button"
                onClick={() => {
                  const amt = typeof selectedTx?.amount === 'number' ? selectedTx.amount.toString() : (selectedTx?.amount || sendAmount || '10');
                  setSendAmount(amt);
                  setTransactionRef(selectedTx?.ref || selectedTx?.orderId || transactionRef || 'FT1384476084');
                  setTransactionDate(selectedTx?.date || transactionDate);
                  setReceiverAccount(selectedTx?.account || receiverAccount || '1000278947339');
                  setCurrentStep(9); // Opens Official Receipt (Step 9) per user request
                }}
                className="absolute bottom-6 right-5 w-[88px] h-[88px] bg-[#7a1c7d] hover:bg-[#68146a] active:scale-95 text-white rounded-2xl shadow-2xl flex flex-col items-center justify-center space-y-1 cursor-pointer z-40 transition-all border border-purple-300/30"
                aria-label="Get Receipt"
              >
                <Receipt className="w-7 h-7 text-white" strokeWidth={2.2} />
                <span className="text-[11.5px] font-bold text-white tracking-wide">
                  Get Receipt
                </span>
              </button>
            </motion.div>
          )}

          {/* STEP 11: RECENT TRANSACTIONS SCREEN (Transaction history Page .png) */}
          {currentStep === 11 && (
            <motion.div
              key="step-11-recent-transactions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f3edf7] flex flex-col overflow-hidden select-none"
            >
              {/* 1. TOP APP BAR & TABS: Authentic crop from Transaction history Page .png */}
              <div className="relative w-full shrink-0 shadow-sm z-30 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/recent_tx_header_tabs.png"
                  alt="Recent Transactions Header and Tabs"
                  className="w-full h-auto block pointer-events-none select-none"
                  draggable={false}
                />

                {/* Hotspot: Top Left Purple Back Arrow Button -> Back to Home */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  style={{
                    position: 'absolute',
                    top: '8.0%',
                    left: '3.5%',
                    width: '18.0%',
                    height: '42.0%',
                  }}
                  aria-label="Back to Home"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-40 rounded-xl"
                />

                {/* Filter Tabs Hotspots & Active Indicators */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0%',
                    left: '0%',
                    width: '100%',
                    height: '45.0%',
                  }}
                  className="grid grid-cols-4 z-40"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTxTab('all')}
                    className="relative cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                    aria-label="All"
                  >
                    {activeTxTab === 'all' && (
                      <span className="absolute bottom-1 w-2.5 h-1 bg-white rounded-full shadow-xs" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTxTab('credit')}
                    className="relative cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                    aria-label="Credit"
                  >
                    {activeTxTab === 'credit' && (
                      <span className="absolute bottom-1 w-2.5 h-1 bg-white rounded-full shadow-xs" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTxTab('debit')}
                    className="relative cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                    aria-label="Debit"
                  >
                    {activeTxTab === 'debit' && (
                      <span className="absolute bottom-1 w-2.5 h-1 bg-white rounded-full shadow-xs" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTxTab('completed')}
                    className="relative cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                    aria-label="Completed"
                  >
                    {activeTxTab === 'completed' && (
                      <span className="absolute bottom-1 w-2.5 h-1 bg-white rounded-full shadow-xs" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2. SCROLLABLE TRANSACTIONS LIST: Smooth native touch-pan-y scroll */}
              <div
                className="flex-1 w-full overflow-y-auto overflow-x-hidden p-3.5 space-y-2.5 bg-[#f3edf7] touch-pan-y"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {transactions
                  .filter((tx) => {
                    if (activeTxTab === 'all') return true;
                    if (activeTxTab === 'credit') return tx.type === 'credit';
                    if (activeTxTab === 'debit') return tx.type === 'debit';
                    if (activeTxTab === 'completed') return true;
                    return true;
                  })
                  .map((tx, idx) => (
                    <motion.div
                      key={`${tx.id}-${idx}`}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onPointerDown={(e) => startTxLongPress(tx, e)}
                      onPointerMove={handleTxPointerMove}
                      onPointerUp={() => endTxLongPress(tx)}
                      onPointerCancel={cancelTxLongPress}
                      onPointerLeave={cancelTxLongPress}
                      className="w-full bg-white rounded-2xl p-3 sm:p-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100 flex items-center justify-between transition-all select-none cursor-pointer active:scale-[0.99] touch-pan-y"
                    >
                      {/* Left side: Circular arrow icon (Green downward arrow for credit/receive, red upward arrow for debit/send) and info */}
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            tx.type === 'credit' || tx.title.toLowerCase().includes('receive')
                              ? '/screens/tx_arrow_down_green_icon.png'
                              : '/screens/tx_arrow_up_icon.png'
                          }
                          alt={tx.type === 'credit' || tx.title.toLowerCase().includes('receive') ? 'Receive Money' : 'Transfer'}
                          className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0 pointer-events-none select-none"
                          draggable={false}
                        />
                        <div className="min-w-0">
                          {/* Compact text size matching Screenshot_20261029-185406.png */}
                          <p className="font-bold text-[#1f2937] text-[11px] sm:text-[11.5px] leading-tight truncate">
                            {tx.title}
                          </p>
                          <p className="text-[#9ca3af] text-[9.5px] sm:text-[10px] font-mono mt-0.5">
                            {tx.date}
                          </p>
                        </div>
                      </div>

                      {/* Right side: Amount and purple Chevron */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="font-bold text-[#7a1c7d] text-[13px] sm:text-[13.5px]">
                          {tx.amount}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#7a1c7d] shrink-0" strokeWidth={2.4} />
                      </div>
                    </motion.div>
                  ))}

                {transactions.length === 0 && (
                  <div className="w-full py-12 text-center text-gray-500 text-xs font-medium">
                    ምንም የዝውውር ታሪክ የለም (No transactions found)
                  </div>
                )}

                {/* Bottom spacer for clean comfortable scrolling, delete hint removed per request */}
                <div className="w-full h-8" />
              </div>

              {/* DELETE TRANSACTION CONFIRMATION MODAL (Opened via Long-press on any transaction) */}
              <AnimatePresence>
                {deleteModalTx && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4 select-none"
                  >
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.94, opacity: 0 }}
                      className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-4 space-y-3.5"
                    >
                      <div className="flex items-center space-x-2.5 text-red-600">
                        <div className="p-2 bg-red-100 rounded-full">
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-gray-800">
                            የዝውውር ታሪክ ሰርዝ
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            Delete Transaction Record
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs space-y-1">
                        <p className="font-bold text-gray-800">
                          {deleteModalTx.title}
                        </p>
                        <p className="text-gray-600">
                          መጠን (Amount):{' '}
                          <span className="font-bold text-[#7a1c7d]">
                            {deleteModalTx.amount} ETB
                          </span>
                        </p>
                        <p className="text-gray-400 font-mono text-[10.5px]">
                          {deleteModalTx.date}
                        </p>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed">
                        ይህን የዝውውር ታሪክ መሰረዝ ይፈልጋሉ?
                      </p>

                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDeleteModalTx(null)}
                          className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          ተመለስ (Cancel)
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteTransaction}
                          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                        >
                          ሰርዝ (Delete)
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP 12: CBEBEJE SCREEN (Matching cbe beje .png) */}
          {currentStep === 12 && (
            <motion.div
              key="step-12-cbebeje"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f3f4f6] flex flex-col overflow-hidden select-none"
            >
              {/* Full Screen High-Fidelity CBEBeje PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/cbe_beje.png"
                alt="CBEBeje Screen"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Top Bar: Search Icon */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('ፈልግ (Search CBEBeje)');
                  setTimeout(() => setReceiptToast(''), 2000);
                }}
                style={{
                  position: 'absolute',
                  top: '2.4%',
                  right: '13.5%',
                  width: '9.0%',
                  height: '4.2%',
                }}
                aria-label="Search"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
              />

              {/* Top Bar: Language Toggle */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('ቋንቋ: English (EN)');
                  setTimeout(() => setReceiptToast(''), 2000);
                }}
                style={{
                  position: 'absolute',
                  top: '2.4%',
                  right: '4.0%',
                  width: '8.5%',
                  height: '4.2%',
                }}
                aria-label="Language Toggle"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-lg"
              />

              {/* Ordinary Tab Hotspot */}
              <button
                type="button"
                onClick={() => {
                  setCbeBejeTab('ordinary');
                  setReceiptToast('Ordinary Savings Account');
                  setTimeout(() => setReceiptToast(''), 2000);
                }}
                style={{
                  position: 'absolute',
                  top: '24.2%',
                  left: '34.0%',
                  width: '15.0%',
                  height: '7.8%',
                }}
                aria-label="Ordinary Tab"
                className="cursor-pointer bg-transparent border-0 outline-none active:scale-95 transition-transform z-20 rounded-full"
              />

              {/* Overdraft Tab Hotspot */}
              <button
                type="button"
                onClick={() => {
                  setCbeBejeTab('overdraft');
                  setReceiptToast('Overdraft Credit Service - No Active Overdraft');
                  setTimeout(() => setReceiptToast(''), 2200);
                }}
                style={{
                  position: 'absolute',
                  top: '24.2%',
                  left: '52.0%',
                  width: '15.0%',
                  height: '7.8%',
                }}
                aria-label="Overdraft Tab"
                className="cursor-pointer bg-transparent border-0 outline-none active:scale-95 transition-transform z-20 rounded-full"
              />

              {/* Card 1: Micro Saving */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('Micro Saving: 7% የወለድ ተመን (7% Annual Interest)');
                  setTimeout(() => setReceiptToast(''), 2500);
                }}
                style={{
                  position: 'absolute',
                  top: '39.0%',
                  left: '3.0%',
                  width: '94.0%',
                  height: '8.8%',
                }}
                aria-label="Micro Saving"
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 active:scale-[0.99] transition-all z-20 rounded-2xl"
              />

              {/* Card 2: Micro Loan */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('Micro Loan: ማይክሮ ብድር (Assistance to Process Micro Loan Easily)');
                  setTimeout(() => setReceiptToast(''), 2500);
                }}
                style={{
                  position: 'absolute',
                  top: '49.4%',
                  left: '3.0%',
                  width: '94.0%',
                  height: '8.8%',
                }}
                aria-label="Micro Loan"
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 active:scale-[0.99] transition-all z-20 rounded-2xl"
              />

              {/* Card 3: Fixed Saving */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('Fixed Saving: 8%+ የወለድ ተመን (Earn 8%+ Interest with CBEBirr)');
                  setTimeout(() => setReceiptToast(''), 2500);
                }}
                style={{
                  position: 'absolute',
                  top: '59.8%',
                  left: '3.0%',
                  width: '94.0%',
                  height: '8.8%',
                }}
                aria-label="Fixed Saving"
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 active:scale-[0.99] transition-all z-20 rounded-2xl"
              />

              {/* Bottom Navigation Bar */}
              {/* Tab 1: Home */}
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '0.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 2: Pay */}
              <button
                type="button"
                onClick={() => setCurrentStep(14)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '20.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Pay Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 3: CBEBeje (Center Active) */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('CBEBeje Active');
                  setTimeout(() => setReceiptToast(''), 1500);
                }}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '40.0%',
                  width: '20.0%',
                  height: '12.5%',
                }}
                aria-label="CBEBeje Active Tab"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 4: Mini Apps */}
              <button
                type="button"
                onClick={() => setCurrentStep(13)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '60.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Mini Apps"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 5: Others */}
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '80.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Others Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Action Toast Feedback */}
              {receiptToast && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-black/85 py-2 px-3 rounded-full shadow-xl backdrop-blur-xs"
                >
                  {receiptToast}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 13: MINI APPS SCREEN (Matching mini apps .png) */}
          {currentStep === 13 && (
            <motion.div
              key="step-13-mini-apps"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f3f4f6] flex flex-col overflow-hidden select-none"
            >
              {/* Full Screen High-Fidelity Mini Apps PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/mini_apps.png"
                alt="Mini Apps Screen"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Top Bar: Search Icon */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('ፈልግ (Search Mini Apps)');
                  setTimeout(() => setReceiptToast(''), 2000);
                }}
                style={{
                  position: 'absolute',
                  top: '2.4%',
                  right: '13.5%',
                  width: '9.0%',
                  height: '4.2%',
                }}
                aria-label="Search"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
              />

              {/* Top Bar: Language Toggle */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('ቋንቋ: English (EN)');
                  setTimeout(() => setReceiptToast(''), 2000);
                }}
                style={{
                  position: 'absolute',
                  top: '2.4%',
                  right: '4.0%',
                  width: '8.5%',
                  height: '4.2%',
                }}
                aria-label="Language Toggle"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-lg"
              />

              {/* 20 Interactive Mini App Card Hotspots */}
              {[
                { name: 'Henon School Pay', top: '7.8%', left: '3.8%' },
                { name: 'Entoto Park Cbe Run', top: '7.8%', left: '35.4%' },
                { name: 'ETRE', top: '7.8%', left: '67.0%' },
                { name: 'Commercepal', top: '18.6%', left: '3.8%' },
                { name: 'SeregelaGebeya', top: '18.6%', left: '35.4%' },
                { name: 'Digital Equb', top: '18.6%', left: '67.0%' },
                { name: 'eQUB', top: '29.4%', left: '3.8%' },
                { name: 'Get Rest', top: '29.4%', left: '35.4%' },
                { name: 'iChereta', top: '29.4%', left: '67.0%' },
                { name: 'Kelal Gateway', top: '40.2%', left: '3.8%' },
                { name: 'Hello Equb', top: '40.2%', left: '35.4%' },
                { name: 'Qetero', top: '40.2%', left: '67.0%' },
                { name: 'Ethio Sport', top: '51.0%', left: '3.8%' },
                { name: 'Virtual Equb', top: '51.0%', left: '35.4%' },
                { name: 'Cbe Employee Cooperative', top: '51.0%', left: '67.0%' },
                { name: 'A-Trip', top: '61.8%', left: '3.8%' },
                { name: 'Adey School System', top: '61.8%', left: '35.4%' },
                { name: 'Moteregna Delivery', top: '61.8%', left: '67.0%' },
                { name: 'AABTE', top: '72.6%', left: '3.8%' },
                { name: 'Filmbet', top: '72.6%', left: '35.4%' },
              ].map((app) => (
                <button
                  key={app.name}
                  type="button"
                  onClick={() => {
                    setReceiptToast(`${app.name} እየተከፈተ ነው... (Opening ${app.name})`);
                    setTimeout(() => setReceiptToast(''), 2200);
                  }}
                  style={{
                    position: 'absolute',
                    top: app.top,
                    left: app.left,
                    width: '29.2%',
                    height: '9.4%',
                  }}
                  aria-label={app.name}
                  className="cursor-pointer bg-transparent border-0 outline-none active:scale-95 transition-transform rounded-2xl z-20"
                />
              ))}

              {/* Bottom Navigation Bar */}
              {/* Tab 1: Home */}
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '0.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 2: Pay */}
              <button
                type="button"
                onClick={() => setCurrentStep(14)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '20.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Pay Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 3: CBEBeje */}
              <button
                type="button"
                onClick={() => setCurrentStep(12)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '40.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to CBEBeje"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 4: Mini Apps (Active Raised Button) */}
              <button
                type="button"
                onClick={() => {
                  setReceiptToast('Mini Apps Active');
                  setTimeout(() => setReceiptToast(''), 1500);
                }}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '60.0%',
                  width: '20.0%',
                  height: '12.5%',
                }}
                aria-label="Mini Apps Active Tab"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Tab 5: Others */}
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                style={{
                  position: 'absolute',
                  bottom: '0%',
                  left: '80.0%',
                  width: '20.0%',
                  height: '11.0%',
                }}
                aria-label="Go to Others Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
              />

              {/* Action Toast Feedback */}
              {receiptToast && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-black/85 py-2 px-3 rounded-full shadow-xl backdrop-blur-xs"
                >
                  {receiptToast}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 14: PAY SCREEN (Matching pay_screen__1bc1c4bb.png & pay_screen_page__a1135e48.png) */}
          {currentStep === 14 && (
            <motion.div
              key="step-14-pay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#e0e0e0] flex flex-col overflow-hidden select-none"
            >
              {/* 1. FIXED TOP: PAY BILL HEADER (pay_fixed_top.png) */}
              <div
                className="shrink-0 w-full z-20 shadow-md relative overflow-hidden bg-[#8c288e]"
                style={{ aspectRatio: '720 / 232' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/pay_fixed_top.png"
                  alt="CBEBirr Pay Bill Header"
                  className="w-full h-auto block pointer-events-none"
                  draggable={false}
                />

                {/* Hotspot: Search Icon */}
                <button
                  type="button"
                  onClick={() => {
                    setReceiptToast('ፈልግ (Search Pay Bill)');
                    setTimeout(() => setReceiptToast(''), 2000);
                  }}
                  style={{
                    position: 'absolute',
                    top: '15.0%',
                    right: '13.5%',
                    width: '9.0%',
                    height: '28.0%',
                  }}
                  aria-label="Search"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
                />

                {/* Hotspot: Language Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setReceiptToast('ቋንቋ: English (EN)');
                    setTimeout(() => setReceiptToast(''), 2000);
                  }}
                  style={{
                    position: 'absolute',
                    top: '15.0%',
                    right: '4.0%',
                    width: '8.5%',
                    height: '28.0%',
                  }}
                  aria-label="Language Toggle"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-lg"
                />
              </div>

              {/* 2. SCROLLABLE MIDDLE: ALL 7 PAY CARDS WITH SMOOTH TOUCH DRAG SCROLL */}
              <div
                ref={payScrollRef}
                onPointerDown={handlePayPointerDown}
                onPointerMove={handlePayPointerMove}
                onPointerUp={handlePayPointerUp}
                onPointerCancel={handlePayPointerUp}
                className="flex-1 w-full overflow-y-auto overflow-x-hidden scroll-smooth touch-pan-y cursor-grab active:cursor-grabbing select-none bg-[#e0e0e0]"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div className="w-full flex flex-col items-center bg-[#e0e0e0] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/screens/pay_middle_scroll.png"
                    alt="CBEBirr Pay Bill Services and Utilities"
                    className="w-full h-auto block object-contain pointer-events-none"
                    draggable={false}
                  />

                  {/* Card 1: Pay Bill */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Pay Bill', 350.00, '1000760389289', 'Addis Ababa City Admin');
                    }}
                    style={{
                      position: 'absolute',
                      top: '1.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Pay Bill"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 2: Traffic Penalty */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Traffic Penalty', 500.00, '1000760389289', 'Federal Police Traffic Division');
                    }}
                    style={{
                      position: 'absolute',
                      top: '15.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Traffic Penalty"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 3: Electricity */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Electricity Bill', 240.00, '1000760389289', 'Ethiopian Electric Utility');
                    }}
                    style={{
                      position: 'absolute',
                      top: '29.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Electricity"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 4: Water Supply */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Water Utility Bill', 85.00, '1000760389289', 'Addis Ababa Water Authority');
                    }}
                    style={{
                      position: 'absolute',
                      top: '43.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Water Supply"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 5: Telecom */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Telecom Bill', 150.00, '1000760389289', 'Ethio Telecom');
                    }}
                    style={{
                      position: 'absolute',
                      top: '57.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Telecom"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 6: Taxi */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Taxi Payment', 65.00, '1000760389289', 'Addis Meter Taxi Association');
                    }}
                    style={{
                      position: 'absolute',
                      top: '71.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Taxi"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Card 7: Fundraising */}
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickPayment('Charity Donation', 100.00, '1000760389289', 'Mekedonia Humanitarian Association');
                    }}
                    style={{
                      position: 'absolute',
                      top: '85.0%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '12.4%',
                    }}
                    aria-label="Fundraising"
                    className="cursor-pointer bg-transparent border-0 outline-none active:scale-[0.985] transition-transform rounded-3xl z-20"
                  />

                  {/* Bottom spacer so all cards comfortably scroll fully above the bottom nav bar */}
                  <div className="w-full h-8 bg-[#e0e0e0]" />
                </div>
              </div>

              {/* 3. FIXED BOTTOM: PAY ACTIVE NAVIGATION BAR (pay_fixed_bottom.png) */}
              <div
                className="shrink-0 w-full z-20 select-none relative bg-[#e0e0e0]"
                style={{ aspectRatio: '720 / 167' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/screens/pay_fixed_bottom.png"
                  alt="CBEBirr Bottom Navigation - Pay Active"
                  className="w-full h-auto block drop-shadow-2xl pointer-events-none"
                  draggable={false}
                />

                {/* Hotspot: Click "Home" tab to navigate back to Home Page (Step 4) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '0.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Return to Home Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Pay" tab (already active) */}
                <button
                  type="button"
                  onClick={() => {
                    setReceiptToast('Pay Bill Active');
                    setTimeout(() => setReceiptToast(''), 1500);
                  }}
                  style={{
                    position: 'absolute',
                    top: '15.0%',
                    left: '20.0%',
                    width: '20.0%',
                    height: '85.0%',
                  }}
                  aria-label="Pay Active Tab"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "CBEBeje" center tab to navigate to CBEBeje (Step 12) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(12)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '40.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to CBEBeje"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Mini Apps" tab to navigate to Mini Apps (Step 13) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(13)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '60.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Mini Apps"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />

                {/* Hotspot: Click "Others" tab to navigate to Others Page (Step 5) */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  style={{
                    position: 'absolute',
                    top: '25.0%',
                    left: '80.0%',
                    width: '20.0%',
                    height: '75.0%',
                  }}
                  aria-label="Go to Others Page"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-30"
                />
              </div>

              {/* Action Toast Feedback */}
              {receiptToast && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-black/85 py-2 px-3 rounded-full shadow-xl backdrop-blur-xs"
                >
                  {receiptToast}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* UNIVERSAL PROFILE & ACCOUNT DETAILS EDIT MODAL (Real-time synchronization across all screens) */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 select-none"
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              >
                {/* Modal Header */}
                <div className="bg-[#7a1c7d] px-4 py-3 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-[#f2bf9d]" />
                    <h3 className="font-bold text-sm tracking-wide">
                      የግል መረጃ ማስተካከያ (Edit Details)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 space-y-3">
                  {/* 1. Full Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ሙሉ ስም (Full Name)
                    </label>
                    <input
                      type="text"
                      value={tempUserName}
                      onChange={(e) => setTempUserName(e.target.value)}
                      placeholder="Aymen Nigatu Yimam"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                    />
                  </div>

                  {/* 2. Account Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      የሂሳብ ቁጥር (Account Number)
                    </label>
                    <input
                      type="text"
                      value={tempUserAccount}
                      onChange={(e) => setTempUserAccount(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="የሂሳብ ቁጥር ያስገቡ (1000...)"
                      maxLength={16}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800 font-mono"
                    />
                  </div>

                  {/* 3. Phone Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      የስልክ ቁጥር (Phone Number)
                    </label>
                    <div className="flex items-center border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-[#7a1c7d] bg-white">
                      <span className="text-xs font-bold text-slate-500 mr-2">+251</span>
                      <input
                        type="tel"
                        value={tempPhoneNumber}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, '');
                          setTempPhoneNumber(clean.slice(0, 9));
                        }}
                        placeholder="9..."
                        maxLength={9}
                        className="w-full text-xs font-semibold focus:outline-none text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Real-time synchronization note */}
                  <p className="text-[10.5px] text-slate-500 leading-snug">
                    * ያስቀመጡት መረጃ በሁሉም ገጾች ላይ (በመግቢያ ገፅ፣ ሆም ስክሪን፣ እና በደረሰኝ ላይ) በቅጽበት ይዘምናል (Real-time sync)።
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsProfileModalOpen(false)}
                      className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      ሰርዝ (Cancel)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserName(tempUserName.trim());
                        setUserAccount(tempUserAccount.trim());
                        setPhoneNumber(tempPhoneNumber.trim());
                        setIsProfileModalOpen(false);
                        setReceiptToast('የግል መረጃ ተስተካክሏል (Details updated)');
                        setTimeout(() => setReceiptToast(''), 2000);
                      }}
                      className="flex-1 py-2 text-xs font-bold text-white bg-[#7a1c7d] hover:bg-[#68176b] rounded-xl shadow transition-colors cursor-pointer"
                    >
                      አስቀምጥ (Save)
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Direct APK Download Link */}
        <a
          href="/cbebirr-plus.apk"
          download="cbebirr-plus.apk"
          className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 bg-[#7a1c7d]/95 hover:bg-[#68146a] text-white px-3.5 py-2 rounded-full shadow-2xl text-[12px] font-bold border border-yellow-300/40 active:scale-95 transition-all cursor-pointer backdrop-blur-xs"
          title="Download cbebirr-plus.apk"
        >
          <Download className="w-3.5 h-3.5 text-yellow-300" />
          <span>APK አውርድ</span>
        </a>
      </div>
    </div>
  );
}
