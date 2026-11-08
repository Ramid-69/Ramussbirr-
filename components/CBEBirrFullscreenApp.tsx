'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Download, Share2, Printer, Search, Trash2, Edit2, Plus, User, ChevronRight, Receipt, MapPin, Phone, Info, HelpCircle, Fingerprint, WifiOff, CheckCircle2, MessageSquare, RefreshCw, Send, Check, X } from 'lucide-react';
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
import { downloadReceiptPdfUniversally } from '@/lib/client-receipt-pdf';
import SamsungMessagesApp from './SamsungMessagesApp';

type ScreenStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

interface SavedReceiver {
  id: string;
  accountNumber: string;
  accountName: string;
}

export interface BankItem {
  id: string;
  name: string;
  image: string;
  shortName?: string;
}

export interface SavedBankReceiver {
  id: string;
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

const ALL_BANKS: BankItem[] = [
  { id: 'abay', name: 'Abay Bank', image: '/assets/banks/bank_abay.png' },
  { id: 'addis_intl', name: 'Addis International Bank', image: '/assets/banks/bank_addis_international.png' },
  { id: 'ahadu', name: 'Ahadu Bank', image: '/assets/banks/bank_ahadu.png' },
  { id: 'amhara', name: 'Amhara Bank', image: '/assets/banks/bank_amhara.png' },
  { id: 'awash', name: 'Awash International Bank', image: '/assets/banks/bank_awash.png' },
  { id: 'abyssinia', name: 'Bank of Abyssinia', image: '/assets/banks/bank_abyssinia.png' },
  { id: 'berhan', name: 'Berhan International Bank', image: '/assets/banks/bank_berhan.png' },
  { id: 'bunna', name: 'Bunna International Bank', image: '/assets/banks/bank_bunna.png' },
  { id: 'cooperative_oromia', name: 'Cooperative Bank of Oromia', image: '/assets/banks/bank_cooperative_oromia.png' },
  { id: 'dashen', name: 'Dashen Bank', image: '/assets/banks/bank_dashen.png' },
  { id: 'debub_global', name: 'Debub Global bank', image: '/assets/banks/bank_debub_global.png' },
  { id: 'enat', name: 'Enat Bank', image: '/assets/banks/bank_enat.png' },
  { id: 'gada', name: 'Gada Bank', image: '/assets/banks/bank_gada.png' },
  { id: 'goh_betoch', name: 'Goh Betoch', image: '/assets/banks/bank_goh_betoch.png' },
  { id: 'hibret', name: 'Hibret Bank', image: '/assets/banks/bank_hibret.png' },
  { id: 'hijira', name: 'Hijira Bank', image: '/assets/banks/bank_hijira.png' },
  { id: 'lion', name: 'Lion Bank(P2P switched)', image: '/assets/banks/bank_lion.png' },
  { id: 'nib', name: 'Nib International Bank', image: '/assets/banks/bank_nib.png' },
  { id: 'nisr_microfinance', name: 'Nisr Micro Finance', image: '/assets/banks/bank_nisr_microfinance.png' },
  { id: 'omo', name: 'Omo Bank', image: '/assets/banks/bank_omo.png' },
  { id: 'oromia', name: 'Oromia Bank', image: '/assets/banks/bank_oromia.png' },
  { id: 'rammis', name: 'Rammis Bank', image: '/assets/banks/bank_rammis.png' },
  { id: 'sahal', name: 'Sahal Bank', image: '/assets/banks/bank_sahal.png' },
  { id: 'sidama', name: 'Sidama Bank', image: '/assets/banks/bank_sidama.png' },
  { id: 'siinqee', name: 'Siinqee Bank', image: '/assets/banks/bank_siinqee.png' },
  { id: 'siket', name: 'Siket Bank', image: '/assets/banks/bank_siket.png' },
  { id: 'tsedey', name: 'Tsedey Bank', image: '/assets/banks/bank_tsedey.png' },
  { id: 'tsehay', name: 'Tsehay Bank', image: '/assets/banks/bank_tsehay.png' },
  { id: 'wegagen', name: 'Wegagen Bank', image: '/assets/banks/bank_wegagen.png' },
  { id: 'zamzam', name: 'ZamZam Bank', image: '/assets/banks/bank_zamzam.png' },
  { id: 'zemen', name: 'Zemen Bank', image: '/assets/banks/bank_zemen.png' },
];

const DEFAULT_SAVED_BANK_RECEIVERS: SavedBankReceiver[] = [
  {
    id: 'bank-rec-1',
    bankId: 'awash',
    bankName: 'Awash International Bank',
    accountNumber: '01320847291000',
    accountName: 'KEMAL AHMED OMAR',
  },
  {
    id: 'bank-rec-2',
    bankId: 'abyssinia',
    bankName: 'Bank of Abyssinia',
    accountNumber: '849201948201',
    accountName: 'TIGIST ABERA HAILE',
  },
  {
    id: 'bank-rec-3',
    bankId: 'dashen',
    bankName: 'Dashen Bank',
    accountNumber: '5029481029384',
    accountName: 'YONAS BEKELE WORKU',
  },
];

export interface WalletItem {
  id: string;
  name: string;
  image: string;
}

export interface SavedWalletReceiver {
  id: string;
  walletId: string;
  walletName: string;
  accountNumber: string;
  accountName: string;
}

const ALL_WALLETS: WalletItem[] = [
  { id: 'wallet_nisir', name: 'Nisir Micro Finance', image: '/assets/wallets/wallet_nisir.png' },
  { id: 'wallet_halal_pay', name: 'Halal Pay', image: '/assets/wallets/wallet_halal_pay.png' },
  { id: 'wallet_vision_fund', name: 'Vision Fund MF', image: '/assets/wallets/wallet_vision_fund.png' },
  { id: 'wallet_yaya', name: 'Yaya Wallet', image: '/assets/wallets/wallet_yaya.png' },
  { id: 'wallet_vitabirr', name: 'VitaBirr Financial Services SC', image: '/assets/wallets/wallet_vitabirr.png' },
  { id: 'wallet_decsi', name: 'DECSI-Microfinance', image: '/assets/wallets/wallet_decsi.png' },
  { id: 'wallet_hcash', name: 'H-CASH', image: '/assets/wallets/wallet_hcash.png' },
  { id: 'wallet_sahay_pay', name: 'SAHAY PAY', image: '/assets/wallets/wallet_sahay_pay.png' },
  { id: 'wallet_amigos_saccos', name: 'Amigos SACCOS Ltd', image: '/assets/wallets/wallet_amigos_saccos.png' },
  { id: 'wallet_kacha_dfs', name: 'Kacha DFS', image: '/assets/wallets/wallet_kacha_dfs.png' },
  { id: 'wallet_kaafi_mf', name: 'KAAFI Micro Finance', image: '/assets/wallets/wallet_kaafi_mf.png' },
  { id: 'wallet_rays_mf', name: 'Rays Micro Finance', image: '/assets/wallets/wallet_rays_mf.png' },
  { id: 'wallet_coopay_ebirr', name: 'Coopay E-Birr', image: '/assets/wallets/wallet_coopay_ebirr.png' },
  { id: 'wallet_metemamen_mfi', name: 'Metemamen MFI', image: '/assets/wallets/wallet_metemamen_mfi.png' },
  { id: 'wallet_dire_mf', name: 'DIRE Micro Finance', image: '/assets/wallets/wallet_dire_mf.png' },
  { id: 'wallet_sahal_mfi', name: 'Sahal MFI', image: '/assets/wallets/wallet_sahal_mfi.png' },
  { id: 'wallet_telebirr', name: 'TELEBIRR', image: '/assets/wallets/wallet_telebirr.png' },
  { id: 'wallet_ahadu_ebirr', name: 'Ahadu E-Birr', image: '/assets/wallets/wallet_ahadu_ebirr.png' },
  { id: 'wallet_nib_ebirr', name: 'NIB EBIRR', image: '/assets/wallets/wallet_nib_ebirr.png' },
  { id: 'wallet_digaf_mf', name: 'Digaf Micro Credit Provider S.C', image: '/assets/wallets/wallet_digaf_mf.png' },
  { id: 'wallet_wegagen_ebirr', name: 'Wegagen E-Birr', image: '/assets/wallets/wallet_wegagen_ebirr.png' },
  { id: 'wallet_one_mf', name: 'One Micro Finance', image: '/assets/wallets/wallet_one_mf.png' },
  { id: 'wallet_dedebit_mfi', name: 'Dedebit MFI', image: '/assets/wallets/wallet_dedebit_mfi.png' },
  { id: 'wallet_mpesa', name: 'MPESA', image: '/assets/wallets/wallet_mpesa.png' },
  { id: 'wallet_yehulu_saccos', name: 'Yehulu SACCOS', image: '/assets/wallets/wallet_yehulu_saccos.png' },
];

const DEFAULT_SAVED_WALLET_RECEIVERS: SavedWalletReceiver[] = [
  {
    id: 'wallet-rec-1',
    walletId: 'wallet_telebirr',
    walletName: 'TELEBIRR',
    accountNumber: '0911223344',
    accountName: 'ABDI KEBEDE TOLOSA',
  },
  {
    id: 'wallet-rec-2',
    walletId: 'wallet_mpesa',
    walletName: 'MPESA',
    accountNumber: '0711998877',
    accountName: 'HELEN GIRMA ALEMU',
  },
  {
    id: 'wallet-rec-3',
    walletId: 'wallet_coopay_ebirr',
    walletName: 'Coopay E-Birr',
    accountNumber: '0922334455',
    accountName: 'MOHAMMED ALI HASSAN',
  },
];


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
  bank?: string;
  serviceCharge?: string | number;
  vat?: string | number;
  totalCharges?: string | number;
  totalPaidAmount?: string | number;
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

const DEFAULT_SAVED_ACCOUNT_RECEIVERS: SavedReceiver[] = [
  {
    id: 'acc-rec-0',
    accountNumber: '1000355447788',
    accountName: 'Fayyee Lammeessa Didhaa',
  },
  {
    id: 'acc-rec-1',
    accountNumber: '1000760389289',
    accountName: 'Miss Simera Gofer Abdisa',
  },
  {
    id: 'acc-rec-2',
    accountNumber: '1000278947339',
    accountName: 'Ram',
  },
];

const DEFAULT_SAVED_PHONE_RECEIVERS: SavedReceiver[] = [
  {
    id: 'phone-rec-0',
    accountNumber: '0959597544',
    accountName: 'Ram',
  },
  {
    id: 'phone-rec-1',
    accountNumber: '0715095670',
    accountName: 'Fozia Mossa Mohammed',
  },
];

const ALL_APP_ASSETS: string[] = [
  '/screens/screen_send_money_phone.png',
  '/screens/send_money_options_popup_rounded.png',
  '/screens/screen_1_splash.png',
  '/screens/screen_splash_2.png',
  '/screens/screen_2_phone_clean.png',
  '/screens/screen_3_pin.png',
  '/screens/screen_transfer_pin_clean.png',
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
  '/assets/eye_open_icon.png',
  '/assets/eye_off_icon.png',
  '/assets/next_button_active.png',
  '/assets/banners/cbe_banner_card_1.png',
  '/assets/banners/cbe_banner_card_2.png',
  '/assets/banners/cbe_banner_card_3.png',
  '/assets/banners/cbe_banner_card_4.png',
  '/assets/banners/cbe_banner_card_5.png',
  '/assets/banners/cbe_banner_dots_1.png',
  '/assets/banners/cbe_banner_dots_2.png',
  '/assets/banners/cbe_banner_dots_3.png',
  '/assets/banners/cbe_banner_dots_4.png',
  '/assets/banners/cbe_banner_dots_5.png',
  '/screens/cbe_beje.png',
  '/screens/mini_apps.png',
  '/screens/pay_fixed_top.png',
  '/screens/pay_middle_scroll.png',
  '/screens/pay_fixed_bottom.png',
  '/assets/banks/screen_bank_transfer_base.png',
  '/assets/banks/sheet_header.png',
  '/assets/wallets/screen_wallet_transfer_base.png',
  '/assets/wallets/sheet_header.png',
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

function amountToWords(num: number): string {
  const intPart = Math.floor(num);
  const centsPart = Math.round((num - intPart) * 100);
  const intWords = numberToWords(intPart);
  const centsWords = centsPart > 0 ? numberToWords(centsPart) : 'Zero';
  return `${intWords} ETB and ${centsWords} Cents .`;
}

export default function CBEBirrFullscreenApp() {
  const [currentStep, setCurrentStep] = useState<ScreenStep>(1);
  const [officialReceiptBackStep, setOfficialReceiptBackStep] = useState<ScreenStep>(8);
  const [splashStep, setSplashStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState<string>('');
  const [showLoginPin, setShowLoginPin] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_phone_number');
        if (stored) {
          let clean = stored.replace(/\D/g, '');
          if (clean.startsWith('0')) clean = clean.slice(1);
          if (!clean.startsWith('9')) clean = '9' + clean;
          return clean.slice(0, 9);
        }
      } catch {
        // ignore
      }
    }
    return '959754788';
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
    return 'Aymen Nigatu Yimam';
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
    return '0959754788';
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
  const [transactionRef, setTransactionRef] = useState<string>('FT262413JRB4');
  const [transactionDate, setTransactionDate] = useState<string>('27 Oct 2026 11:56 AM');
  const [transactionIsoDate, setTransactionIsoDate] = useState<string>('2026-10-27 11:56:20');
  const [transactionServiceCharge, setTransactionServiceCharge] = useState<number>(0);
  const [transactionVat, setTransactionVat] = useState<number>(0);
  const [transactionTotalCharges, setTransactionTotalCharges] = useState<number>(0);
  const [transactionTotalDeductions, setTransactionTotalDeductions] = useState<number>(0);
  const [receiptToast, setReceiptToast] = useState<string>('');
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string>('');
  const [officialReceiptQrDataUrl, setOfficialReceiptQrDataUrl] = useState<string>('');

  // CBEBirr USSD *847# & MacroDroid Receiver State (Strictly zero popup modals)
  const [customVerifiedReceiverName, setCustomVerifiedReceiverName] = useState<string>('');
  const [isResolvingUssdReceiver, setIsResolvingUssdReceiver] = useState<boolean>(false);
  const hasTriggeredUssdForAccountRef = useRef<boolean>(false);
  const ussdPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ussdSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Transfer Source State ('cbe_account' | 'phone_number' | 'other_banks' | 'other_wallets')
  const [transferSource, setTransferSource] = useState<'cbe_account' | 'phone_number' | 'other_banks' | 'other_wallets'>('cbe_account');
  const [transferPin, setTransferPin] = useState<string>('');
  const [showTransferPin, setShowTransferPin] = useState<boolean>(false);
  const [phoneReceiverNumber, setPhoneReceiverNumber] = useState<string>('');
  const [phoneReceiverName, setPhoneReceiverName] = useState<string>('');
  const [phoneSendAmount, setPhoneSendAmount] = useState<string>('');
  const [phoneReason, setPhoneReason] = useState<string>('');
  const [phoneTransferError, setPhoneTransferError] = useState<string>('');
  const [isPhoneTransferring, setIsPhoneTransferring] = useState<boolean>(false);
  const [isSendMoneyMenuOpen, setIsSendMoneyMenuOpen] = useState<boolean>(false);

  // Step 16: Bank Transfer (Transfer to Other Banks) State
  const [selectedBank, setSelectedBank] = useState<BankItem | null>(null);
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankReceiverName, setBankReceiverName] = useState<string>('');
  const [bankAmount, setBankAmount] = useState<string>('');
  const [bankReason, setBankReason] = useState<string>('');
  const [bankTransferError, setBankTransferError] = useState<string>('');
  const [isBankTransferring, setIsBankTransferring] = useState<boolean>(false);
  const [isSelectBankSheetOpen, setIsSelectBankSheetOpen] = useState<boolean>(false);
  const [bankSearchTerm, setBankSearchTerm] = useState<string>('');
  const [isSavedBankModalOpen, setIsSavedBankModalOpen] = useState<boolean>(false);
  const [isAddSavedBankModalOpen, setIsAddSavedBankModalOpen] = useState<boolean>(false);
  const [savedBankReceivers, setSavedBankReceivers] = useState<SavedBankReceiver[]>(DEFAULT_SAVED_BANK_RECEIVERS);
  const [newBankReceiverAcc, setNewBankReceiverAcc] = useState<string>('');
  const [newBankReceiverName, setNewBankReceiverName] = useState<string>('');
  const [newBankReceiverBankId, setNewBankReceiverBankId] = useState<string>('awash');

  const filteredBanks = useMemo(() => {
    if (!bankSearchTerm.trim()) return ALL_BANKS;
    const term = bankSearchTerm.toLowerCase().trim();
    return ALL_BANKS.filter(
      (b) => b.name.toLowerCase().includes(term) || b.id.toLowerCase().includes(term)
    );
  }, [bankSearchTerm]);

  // Step 17: Wallet Transfer (Transfer to Other Wallet & Micro Finance) State
  const [selectedWallet, setSelectedWallet] = useState<WalletItem | null>(null);
  const [walletAccountNumber, setWalletAccountNumber] = useState<string>('');
  const [walletReceiverName, setWalletReceiverName] = useState<string>('');
  const [walletAmount, setWalletAmount] = useState<string>('');
  const [walletReason, setWalletReason] = useState<string>('');
  const [walletTransferError, setWalletTransferError] = useState<string>('');
  const [isWalletTransferring, setIsWalletTransferring] = useState<boolean>(false);
  const [isSelectWalletSheetOpen, setIsSelectWalletSheetOpen] = useState<boolean>(false);
  const [walletSearchTerm, setWalletSearchTerm] = useState<string>('');
  const [isSavedWalletModalOpen, setIsSavedWalletModalOpen] = useState<boolean>(false);
  const [isAddSavedWalletModalOpen, setIsAddSavedWalletModalOpen] = useState<boolean>(false);
  const [savedWalletReceivers, setSavedWalletReceivers] = useState<SavedWalletReceiver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cbe_saved_wallet_receivers');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_SAVED_WALLET_RECEIVERS;
  });
  const [newWalletReceiverAcc, setNewWalletReceiverAcc] = useState<string>('');
  const [newWalletReceiverName, setNewWalletReceiverName] = useState<string>('');
  const [newWalletReceiverWalletId, setNewWalletReceiverWalletId] = useState<string>('wallet_telebirr');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbe_saved_wallet_receivers', JSON.stringify(savedWalletReceivers));
      }
    } catch {}
  }, [savedWalletReceivers]);

  const filteredWallets = useMemo(() => {
    if (!walletSearchTerm.trim()) return ALL_WALLETS;
    const term = walletSearchTerm.toLowerCase().trim();
    return ALL_WALLETS.filter(
      (w) => w.name.toLowerCase().includes(term) || w.id.toLowerCase().includes(term)
    );
  }, [walletSearchTerm]);

  // Step 16 & 17 Transfer Confirmation Bottom Sheet State (Matches User Screenshots)
  const [isBankConfirmOpen, setIsBankConfirmOpen] = useState<boolean>(false);
  const [isWalletConfirmOpen, setIsWalletConfirmOpen] = useState<boolean>(false);

  // Authentic Calculator Modal State (Matches calculator .png, Screenshot_20261108-002518.png, calculator page .png)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [calculatorTarget, setCalculatorTarget] = useState<'cbe_account' | 'phone_number' | 'other_banks' | 'other_wallets'>('cbe_account');
  const [calculatorExpression, setCalculatorExpression] = useState<string>('');
  const [calculatorDisplay, setCalculatorDisplay] = useState<string>('0');
  const [calculatorLiveResult, setCalculatorLiveResult] = useState<string | null>(null);

  const evaluateCalculatorMath = (expr: string): string | null => {
    try {
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
      const tokens = sanitized.match(/(\d+\.?\d*|[-+*/])/g);
      if (!tokens || tokens.length < 3) return null;
      const last = tokens[tokens.length - 1];
      if (['+', '-', '*', '/'].includes(last)) return null;

      const intermediate: (number | string)[] = [];
      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i];
        if (token === '*' || token === '/') {
          const prev = Number(intermediate.pop());
          const next = Number(tokens[i + 1]);
          if (isNaN(prev) || isNaN(next)) return null;
          if (token === '/' && next === 0) return '0';
          intermediate.push(token === '*' ? prev * next : prev / next);
          i += 2;
        } else {
          intermediate.push(isNaN(Number(token)) ? token : Number(token));
          i++;
        }
      }

      let res = Number(intermediate[0]);
      if (isNaN(res)) return null;
      let j = 1;
      while (j < intermediate.length) {
        const op = intermediate[j];
        const next = Number(intermediate[j + 1]);
        if (isNaN(next)) return null;
        if (op === '+') res += next;
        else if (op === '-') res -= next;
        j += 2;
      }
      if (isNaN(res) || !isFinite(res)) return null;
      const rounded = Math.round(res * 100000000) / 100000000;
      return rounded.toString();
    } catch {
      return null;
    }
  };

  const openCalculator = (target: 'cbe_account' | 'phone_number' | 'other_banks' | 'other_wallets', currentVal: string) => {
    setCalculatorTarget(target);
    const clean = (currentVal || '').trim();
    if (clean && !isNaN(parseFloat(clean))) {
      setCalculatorDisplay(clean);
      setCalculatorExpression(clean);
      setCalculatorLiveResult(null);
    } else {
      setCalculatorDisplay('0');
      setCalculatorExpression('');
      setCalculatorLiveResult(null);
    }
    setIsCalculatorOpen(true);
  };

  const handleCalcDigit = (digit: string) => {
    setCalculatorExpression((prev) => {
      let nextExpr = prev;
      if (!prev || prev === '0') {
        nextExpr = digit;
      } else {
        nextExpr = prev + digit;
      }
      const evalRes = evaluateCalculatorMath(nextExpr);
      setCalculatorLiveResult(evalRes);
      setCalculatorDisplay(nextExpr);
      return nextExpr;
    });
  };

  const handleCalcOperator = (op: string) => {
    setCalculatorExpression((prev) => {
      let base = prev;
      if (!base) {
        base = calculatorLiveResult || calculatorDisplay || '0';
      }
      const lastChar = base.slice(-1);
      if (['+', '-', '×', '÷'].includes(lastChar)) {
        base = base.slice(0, -1);
      }
      const nextExpr = base + op;
      setCalculatorDisplay(nextExpr);
      setCalculatorLiveResult(null);
      return nextExpr;
    });
  };

  const handleCalcDecimal = () => {
    setCalculatorExpression((prev) => {
      if (!prev) {
        setCalculatorDisplay('0.');
        return '0.';
      }
      const parts = prev.split(/[+\-×÷]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return prev;
      const nextExpr = prev + '.';
      setCalculatorDisplay(nextExpr);
      return nextExpr;
    });
  };

  const handleCalcToggleSign = () => {
    setCalculatorExpression((prev) => {
      if (!prev || prev === '0') return '0';
      if (/^-?\d+\.?\d*$/.test(prev)) {
        const toggled = prev.startsWith('-') ? prev.slice(1) : '-' + prev;
        setCalculatorDisplay(toggled);
        setCalculatorLiveResult(null);
        return toggled;
      }
      return prev;
    });
  };

  const handleCalcClear = () => {
    setCalculatorExpression('');
    setCalculatorDisplay('0');
    setCalculatorLiveResult(null);
  };

  const handleCalcBackspace = () => {
    setCalculatorExpression((prev) => {
      if (!prev || prev.length <= 1) {
        setCalculatorDisplay('0');
        setCalculatorLiveResult(null);
        return '';
      }
      const nextExpr = prev.slice(0, -1);
      const evalRes = evaluateCalculatorMath(nextExpr);
      setCalculatorLiveResult(evalRes);
      setCalculatorDisplay(nextExpr);
      return nextExpr;
    });
  };

  const handleCalcEquals = () => {
    if (calculatorLiveResult !== null) {
      setCalculatorDisplay(calculatorLiveResult);
      setCalculatorExpression(calculatorLiveResult);
      setCalculatorLiveResult(null);
    } else {
      const evalRes = evaluateCalculatorMath(calculatorExpression);
      if (evalRes !== null) {
        setCalculatorDisplay(evalRes);
        setCalculatorExpression(evalRes);
        setCalculatorLiveResult(null);
      }
    }
  };

  const handleCalcInsert = () => {
    const rawVal = calculatorLiveResult !== null ? calculatorLiveResult : (calculatorExpression || calculatorDisplay || '0');
    const parsedNum = Math.abs(parseFloat(rawVal) || 0);
    const finalVal = parsedNum === 0 ? '' : parsedNum.toString();

    if (calculatorTarget === 'cbe_account') {
      setSendAmount(finalVal);
      if (transferError) setTransferError('');
    } else if (calculatorTarget === 'phone_number') {
      setPhoneSendAmount(finalVal);
      if (phoneTransferError) setPhoneTransferError('');
    } else if (calculatorTarget === 'other_banks') {
      setBankAmount(finalVal);
      setBankTransferError('');
    } else if (calculatorTarget === 'other_wallets') {
      setWalletAmount(finalVal);
      setWalletTransferError('');
    }
    setIsCalculatorOpen(false);
  };

  // Dynamic fee calculation matching authentic CBE charges & user screenshots:
  // e.g. 1 ETB -> Service Charge: 0.005 ETB, Disaster: 0 ETB, Tax: 0.00075 ETB, Total charges: 0.006 ETB, Total Deductions: 1.01 ETB
  const calculateTransferFees = useCallback((rawAmount: string | number) => {
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
    if (amount <= 0) {
      return {
        amount: 0,
        serviceCharge: 0,
        serviceChargeFormatted: '0 ETB',
        disasterFund: 0,
        disasterFundFormatted: '0 ETB',
        taxAmount: 0,
        taxAmountFormatted: '0 ETB',
        totalCharges: 0,
        totalChargesFormatted: '0 ETB',
        totalDeductions: 0,
        totalDeductionsFormatted: '0 ETB',
      };
    }
    const serviceCharge = Math.max(0.005, +(amount * 0.005).toFixed(5));
    const disasterFund = 0;
    const taxAmount = +(serviceCharge * 0.15).toFixed(5);
    const rawTotalCharges = serviceCharge + disasterFund + taxAmount;
    const totalCharges = +(rawTotalCharges).toFixed(3);
    const totalDeductions = +(amount + rawTotalCharges).toFixed(2);

    return {
      amount,
      serviceCharge,
      serviceChargeFormatted: `${serviceCharge} ETB`,
      disasterFund,
      disasterFundFormatted: `${disasterFund} ETB`,
      taxAmount,
      taxAmountFormatted: `${taxAmount} ETB`,
      totalCharges,
      totalChargesFormatted: `${totalCharges.toFixed(3)} ETB`,
      totalDeductions,
      totalDeductionsFormatted: `${totalDeductions.toFixed(2)} ETB`,
    };
  }, []);

  // 5 Promotional Banners Horizontal Sliding Carousel (Swipeable, Real-time Drag, Smooth Auto-slide)
  const [activeBannerIndex, setActiveBannerIndex] = useState<number>(0);
  const [bannerDragDelta, setBannerDragDelta] = useState<number>(0);
  const [isBannerDragging, setIsBannerDragging] = useState<boolean>(false);
  const bannerDragStartXRef = useRef<number | null>(null);
  const bannerDragStartYRef = useRef<number | null>(null);
  const bannerAutoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBannerUserInteractingRef = useRef<boolean>(false);

  // Helper to open CBE Account Transfer page (Step 6) completely clean (no pre-filled data)
  const openCbeAccountTransfer = useCallback(() => {
    setTransferError('');
    setReceiverAccount('');
    setCustomVerifiedReceiverName('');
    setSendAmount('');
    setSendReason('');
    setTransferPin('');
    setTransferSource('cbe_account');
    setCurrentStep(6);
  }, []);

  // Helper to open Phone Transfer page (Step 15) completely clean (no pre-filled data)
  const openPhoneTransfer = useCallback(() => {
    setIsSendMoneyMenuOpen(false);
    setPhoneTransferError('');
    setPhoneReceiverNumber('');
    setPhoneReceiverName('');
    setPhoneSendAmount('');
    setPhoneReason('');
    setTransferPin('');
    setTransferSource('phone_number');
    setCurrentStep(15);
  }, []);

  // Helper to open Other Bank Transfer page (Step 16) completely clean (no pre-filled data)
  const openOtherBanksTransfer = useCallback(() => {
    setBankTransferError('');
    setSelectedBank(null);
    setBankAccountNumber('');
    setBankReceiverName('');
    setBankAmount('');
    setBankReason('');
    setTransferPin('');
    setTransferSource('other_banks');
    setCurrentStep(16);
  }, []);

  // Helper to open Other Wallet & Micro Finance Transfer page (Step 17) completely clean
  const openOtherWalletsTransfer = useCallback(() => {
    setWalletTransferError('');
    setSelectedWallet(null);
    setWalletAccountNumber('');
    setWalletReceiverName('');
    setWalletAmount('');
    setWalletReason('');
    setTransferPin('');
    setTransferSource('other_wallets');
    setCurrentStep(17);
  }, []);

  // Stable Viewport Height System: Prevents phone keyboard from compressing/squishing the app
  // When mobile keyboard appears, window.innerHeight drops, but the app locks its dimensions so it stays exactly in place
  const lastKnownFullHeightRef = useRef<number>(0);
  const lastKnownWidthRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measureHeight = () => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;

      // Check if virtual keyboard is active:
      // 1) Focused element is input/textarea
      // 2) Width hasn't changed but height dropped significantly (>140px)
      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      const isKeyboardOpen =
        isInputFocused ||
        (lastKnownWidthRef.current === curW &&
          lastKnownFullHeightRef.current > 0 &&
          curH < lastKnownFullHeightRef.current - 140);

      if (!isKeyboardOpen && curH > 200) {
        lastKnownFullHeightRef.current = curH;
        lastKnownWidthRef.current = curW;
        document.documentElement.style.setProperty('--stable-app-height', `${curH}px`);
      }
    };

    measureHeight();

    window.addEventListener('resize', measureHeight);
    window.addEventListener('orientationchange', () => {
      setTimeout(measureHeight, 150);
      setTimeout(measureHeight, 350);
    });

    return () => {
      window.removeEventListener('resize', measureHeight);
    };
  }, []);

  useEffect(() => {
    const startAutoScroll = () => {
      if (bannerAutoScrollTimerRef.current) clearInterval(bannerAutoScrollTimerRef.current);
      // Lengthened interval as requested (12 seconds)
      bannerAutoScrollTimerRef.current = setInterval(() => {
        if (!isBannerUserInteractingRef.current) {
          setActiveBannerIndex((prev) => (prev + 1) % 5);
        }
      }, 12000);
    };

    startAutoScroll();
    return () => {
      if (bannerAutoScrollTimerRef.current) clearInterval(bannerAutoScrollTimerRef.current);
    };
  }, []);

  const handleBannerPointerDown = (e: React.PointerEvent) => {
    isBannerUserInteractingRef.current = true;
    bannerDragStartXRef.current = e.clientX;
    setIsBannerDragging(true);
    setBannerDragDelta(0);
  };

  const handleBannerPointerMove = (e: React.PointerEvent) => {
    if (bannerDragStartXRef.current !== null) {
      const delta = e.clientX - bannerDragStartXRef.current;
      setBannerDragDelta(delta);
    }
  };

  const handleBannerPointerUp = () => {
    if (bannerDragStartXRef.current !== null) {
      const delta = bannerDragDelta;
      if (delta < -40) {
        // swipe left -> next banner
        setActiveBannerIndex((prev) => (prev + 1) % 5);
      } else if (delta > 40) {
        // swipe right -> previous banner
        setActiveBannerIndex((prev) => (prev - 1 + 5) % 5);
      }
    }
    bannerDragStartXRef.current = null;
    setIsBannerDragging(false);
    setBannerDragDelta(0);
    setTimeout(() => {
      isBannerUserInteractingRef.current = false;
    }, 5000);
  };

  // 1. Saved Account Receivers (Step 6 CBE Account Transfer page only)
  const [savedAccountReceivers, setSavedAccountReceivers] = useState<SavedReceiver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_saved_account_receivers');
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
    return DEFAULT_SAVED_ACCOUNT_RECEIVERS;
  });

  const persistAccountReceivers = (list: SavedReceiver[]) => {
    setSavedAccountReceivers(list);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_saved_account_receivers', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  // 2. Saved Phone Receivers / Contacts (Step 15 Phone Number Send Money page only)
  const [savedPhoneReceivers, setSavedPhoneReceivers] = useState<SavedReceiver[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cbebirr_saved_phone_receivers');
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
    return DEFAULT_SAVED_PHONE_RECEIVERS;
  });

  const persistPhoneReceivers = (list: SavedReceiver[]) => {
    setSavedPhoneReceivers(list);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cbebirr_saved_phone_receivers', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  const [isReceiversModalOpen, setIsReceiversModalOpen] = useState<boolean>(false);
  const [isAddingNewReceiver, setIsAddingNewReceiver] = useState<boolean>(false);
  const [editingReceiverId, setEditingReceiverId] = useState<string | null>(null);
  const [modalAccNum, setModalAccNum] = useState<string>('');
  const [modalAccName, setModalAccName] = useState<string>('');
  const [modalFormError, setModalFormError] = useState<string>('');

  // Hidden Samsung Messages App Trigger State (Opened exclusively on long-press of Search Icon on Others Page)
  const [showSamsungMessages, setShowSamsungMessages] = useState<boolean>(false);
  const [cbeNotice, setCbeNotice] = useState<string | null>(null);
  const [isHoldingSearch, setIsHoldingSearch] = useState<boolean>(false);
  const searchLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSearchLongPressTriggeredRef = useRef<boolean>(false);

  const showCbeNotice = useCallback((msg: string) => {
    setCbeNotice(msg);
    setTimeout(() => {
      setCbeNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const handleSearchPointerDown = (e?: React.SyntheticEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    isSearchLongPressTriggeredRef.current = false;
    setIsHoldingSearch(true);
    if (searchLongPressTimerRef.current) {
      clearTimeout(searchLongPressTimerRef.current);
    }
    searchLongPressTimerRef.current = setTimeout(() => {
      isSearchLongPressTriggeredRef.current = true;
      setIsHoldingSearch(false);
      try {
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([60, 40, 60]);
        }
      } catch {}
      setShowSamsungMessages(true);
    }, 550);
  };

  const handleSearchPointerUp = (e?: React.SyntheticEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsHoldingSearch(false);
    if (searchLongPressTimerRef.current) {
      clearTimeout(searchLongPressTimerRef.current);
      searchLongPressTimerRef.current = null;
    }
    if (!isSearchLongPressTriggeredRef.current) {
      showCbeNotice('Search (Hold for 0.5s to open Messages app)');
    }
  };

  const handleSearchPointerCancel = (e?: React.SyntheticEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsHoldingSearch(false);
    if (searchLongPressTimerRef.current) {
      clearTimeout(searchLongPressTimerRef.current);
      searchLongPressTimerRef.current = null;
    }
  };

  // Legacy Chatbot Long-Press Handlers (Also kept active)
  const handleChatbotPointerDown = handleSearchPointerDown;
  const handleChatbotPointerUp = handleSearchPointerUp;
  const handleChatbotPointerCancel = handleSearchPointerCancel;

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
  const backgroundSendSms = useCallback((tx: TransactionItem) => {
    const amtNum = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 10;
    const tid = tx.orderId ? tx.orderId.replace(/\D/g, '').slice(-8) : generate8CharTxnId(tx.ref);
    const cleanUserPhone = (phoneNumber || '251959842829').replace(/\D/g, '');
    const fullPhone = cleanUserPhone.startsWith('251') ? cleanUserPhone : `251${cleanUserPhone.replace(/^0+/, '')}`;

    sendTransactionSms({
      fullName: userName || 'AYMEN NIGATU YIMAM',
      userPhone: fullPhone,
      amount: amtNum,
      receiverAccount: tx.account || '1000760389289',
      receiverName: tx.receiverName || 'Miss Simera Gofer Abdisa',
      balance: balance,
      txnId: tid,
      ftRef: tx.ref || tx.orderId || 'FT262413JRB4',
      date: tx.date,
      isDeposit: tx.type === 'credit',
      reason: tx.title,
      bank: tx.bank,
    }).catch(() => {});
  }, [phoneNumber, userName, balance]);

  // Background non-UI bulk sync of all historical transactions
  const backgroundSyncAll = useCallback(() => {
    const targetList = transactions.length > 0 ? transactions : DEFAULT_TRANSACTIONS;
    if (targetList.length === 0) return;
    const payloads: CbeSmsWebhookPayload[] = targetList.map((tx, idx) => {
      const amtNum = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount)) || 10;
      const simBal = Math.max(100, balance + idx * 50);
      return buildCbeSmsPayload({
        userFullName: userName || 'AYMEN NIGATU YIMAM',
        userPhone: phoneNumber || '251959842829',
        receiverAccount: tx.account || '1000760389289',
        receiverName: tx.receiverName || 'Miss Simera Gofer Abdisa',
        amount: amtNum,
        balance: simBal,
        txnId: tx.orderId ? tx.orderId.replace(/\D/g, '').slice(-8) : generate8CharTxnId(tx.ref),
        ftRef: tx.ref || tx.orderId || 'FT262413JRB4',
        date: tx.date,
        isDeposit: tx.type === 'credit',
        reason: tx.title,
        bank: tx.bank,
      });
    });
    sendSmsWebhook(payloads).catch(() => {});
  }, [transactions, balance, userName, phoneNumber]);

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
  }, [backgroundSyncAll]);

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
  }, [currentStep, backgroundSyncAll]);

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
  }, [currentStep, selectedTx, backgroundSendSms]);

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

    // Persist receipt in server store for official receipt link resolution
    try {
      fetch('/api/receipt/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: newRef,
          amt: amt.toFixed(2),
          date: isoDate,
          rec: receiverAcc,
          name: receiverNm,
          user: userName || 'AYMEN NIGATU YIMAM',
          acc: userAccount || phoneNumber || '959754788',
          reason: title || 'Bill Payment',
          status: 'Completed',
          orderId: generate8CharTxnId(newRef),
        }),
      }).catch(() => {});
    } catch {}

    // Trigger real-time SMS webhook to Samsung Messages app (ms-bk-connect.vercel.app)
    try {
      const smsPayload = buildCbeSmsPayload({
        userFullName: userName || 'AYMEN NIGATU YIMAM',
        userPhone: phoneNumber || '251959842829',
        receiverAccount: receiverAcc,
        receiverName: receiverNm,
        amount: amt.toFixed(2),
        balance: newBal,
        txnId: generate8CharTxnId(newRef),
        ftRef: newRef,
        date: now,
        reason: title || 'Bill Payment',
      });
      sendSmsWebhook(smsPayload).catch(() => {});
    } catch {
      // Graceful error handling
    }

    setReceiptToast(`${title} (${amt.toFixed(2)} Br) ተጠናቋል! SMS sent to Samsung Messages`);
    setTimeout(() => setReceiptToast(''), 3000);
  };

  // Receiver Search Icon Long-Press Timer Refs (for steps 16/17 saved accounts modal)
  // Strictly opens ONLY on long press (>= 500ms). Click does NOTHING per user request.
  const receiverSearchLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isReceiverSearchLongPressTriggeredRef = useRef<boolean>(false);

  const startSearchLongPress = () => {
    isReceiverSearchLongPressTriggeredRef.current = false;
    if (receiverSearchLongPressTimerRef.current) clearTimeout(receiverSearchLongPressTimerRef.current);
    receiverSearchLongPressTimerRef.current = setTimeout(() => {
      isReceiverSearchLongPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
      } catch {
        // ignore
      }
      if (currentStep === 16) {
        if (selectedBank) {
          setNewBankReceiverBankId(selectedBank.id);
        }
        setIsSavedBankModalOpen(true);
      } else if (currentStep === 17) {
        if (selectedWallet) {
          setNewWalletReceiverWalletId(selectedWallet.id);
        }
        setIsSavedWalletModalOpen(true);
      } else {
        setIsReceiversModalOpen(true);
      }
    }, 500);
  };

  const endSearchLongPress = () => {
    if (receiverSearchLongPressTimerRef.current) {
      clearTimeout(receiverSearchLongPressTimerRef.current);
      receiverSearchLongPressTimerRef.current = null;
    }
    // Normal click does absolutely nothing - modal only opens if long-press timer triggered
  };

  const cancelSearchLongPress = () => {
    if (receiverSearchLongPressTimerRef.current) {
      clearTimeout(receiverSearchLongPressTimerRef.current);
      receiverSearchLongPressTimerRef.current = null;
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
  const matchedSavedReceiver = savedAccountReceivers.find(
    (r) => r.accountNumber.replace(/\D/g, '') === cleanAccount
  );
  const activeReceiverName = customVerifiedReceiverName || (matchedSavedReceiver ? matchedSavedReceiver.accountName : '');
  const displayReceiverName = customVerifiedReceiverName || (matchedSavedReceiver ? matchedSavedReceiver.accountName : '');

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

    // Android WebView bridge (Runs silently in background - "ussd run yemiadergew metayet yelebetm")
    if (typeof window !== 'undefined' && (window as any).Android?.dialUSSD) {
      (window as any).Android.dialUSSD(ussdUri);
    } else if (typeof window !== 'undefined' && (window as any).Android?.callUSSD) {
      (window as any).Android.callUSSD(ussdUri);
    }

    // Start MacroDroid Webhook polling
    startMacroDroidPolling(cleanAcc);
    return true;
  };

  // Amount field interaction listener (triggered when 13-digit account is entered)
  // USSD runs ONLY if the account is NOT saved!
  const handleAmountFieldInteraction = () => {
    const cleanAcc = receiverAccount.replace(/\D/g, '');
    if (hasTriggeredUssdForAccountRef.current) return;

    // Check if account is saved
    const isSaved = savedAccountReceivers.some(
      (r) => r.accountNumber.replace(/\D/g, '') === cleanAcc
    );
    if (isSaved) {
      // Never run USSD for saved account
      hasTriggeredUssdForAccountRef.current = true;
      return;
    }

    if (cleanAcc.length === 13) {
      hasTriggeredUssdForAccountRef.current = true;
      setIsResolvingUssdReceiver(true);
      triggerCbeUssdDialer(cleanAcc, sendAmount);
      // Wait for receiver name to be resolved; generous safety timeout so loading NEVER cuts off early while USSD is running
      if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
      ussdSafetyTimeoutRef.current = setTimeout(() => {
        setCustomVerifiedReceiverName((prev) => prev || '');
        setIsResolvingUssdReceiver(false);
      }, 12000);
    } else {
      setTransferError('Please enter the complete 13-digit CBE account number first.');
    }
  };

  // MacroDroid Webhook Polling (Fast 300ms cycle for instant receiver resolution)
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
            if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
            const rName = json.event.name || 'SIMERA GOFER ABDISA';
            // 1. Immediately set receiver name into field
            setCustomVerifiedReceiverName(rName);
            // 2. Wait until carrier USSD runner has completely cancelled and vanished before hiding loading
            setTimeout(() => {
              setIsResolvingUssdReceiver(false);
            }, 1000);
            if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
              navigator.vibrate([100, 50, 150]);
            }
          }
        }
      } catch (err) {
        console.warn('MacroDroid polling error:', err);
      }

      if (count > 40) {
        if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
      }
    }, 300);
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
          if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
          if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
          // 1. Immediately set receiver name into field
          setCustomVerifiedReceiverName(name);
          // 2. Wait until carrier USSD runner has completely cancelled and disappeared before hiding loading
          setTimeout(() => {
            setIsResolvingUssdReceiver(false);
          }, 1100);
          if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate([40, 60]);
          }
        }
      };

      (window as any).setReceiverNameDirectly = (nameStr: string) => {
        if (nameStr) {
          if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
          if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
          setCustomVerifiedReceiverName(nameStr);
          setTimeout(() => {
            setIsResolvingUssdReceiver(false);
          }, 1100);
        }
      };

      (window as any).onUssdCompleted = (nameStr?: string) => {
        if (nameStr) {
          setCustomVerifiedReceiverName(nameStr);
        }
        if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
        if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
        setTimeout(() => {
          setIsResolvingUssdReceiver(false);
        }, 500);
      };
    }
    return () => {
      if (ussdPollTimerRef.current) clearInterval(ussdPollTimerRef.current);
      if (ussdSafetyTimeoutRef.current) clearTimeout(ussdSafetyTimeoutRef.current);
    };
  }, [receiverAccount, sendAmount]);

  // Dynamic styled QR code generation matching authentic CBEBirr PNG designs:
  // - Receipt (Step 8): WITH authentic CBE Birr Plus center logo
  // Dynamic styled QR code generation matching authentic CBEBirr PNG designs:
  // - Receipt (Step 8): Scannable by phone camera to official receipt PDF (WITH authentic center logo)
  // - Official Receipt (Step 9): WITHOUT center logo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeTx = selectedTx || (transactions.length > 0 ? transactions[0] : null);
    const isPhone = transferSource === 'phone_number' || (activeTx?.account && (activeTx.account.startsWith('09') || activeTx.account.startsWith('07')));
    const currentRef = activeTx?.ref || activeTx?.orderId || transactionRef || 'FT262413JRB4';
    const currentAcc = userAccount || phoneNumber || '0959754788';
    const currentAmt = (parseFloat(activeTx?.amount ? String(activeTx.amount) : (isPhone ? phoneSendAmount : sendAmount)) || 10.00).toFixed(2);
    const currentDate = activeTx?.date || transactionDate || '2026-10-27 11:56:20';
    const currentRec = activeTx?.account || (isPhone ? phoneReceiverNumber : receiverAccount) || '1000760389289';
    const currentName = activeTx?.receiverName || (isPhone ? (phoneReceiverName || '') : (displayReceiverName || '')) || '';
    const currentUser = userName || 'AYMEN NIGATU YIMAM';
    const currentReason = activeTx?.title
      ? (activeTx.title === 'Bank Transfer' ? 'Transfer to Other Bank' : (activeTx.title === 'Wallet Transfer' ? 'Wallet Transfer' : 'Customer transfer to CBE account'))
      : (isPhone ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'));
    const currentBank = activeTx?.bank || (transferSource === 'other_banks' && selectedBank ? selectedBank.name : undefined);
    const currentFee = activeTx?.serviceCharge ? String(activeTx.serviceCharge) : undefined;
    const currentVat = activeTx?.vat ? String(activeTx.vat) : undefined;
    const currentTotalPaid = activeTx?.totalPaidAmount ? String(activeTx.totalPaidAmount) : undefined;

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
        bank: currentBank,
        serviceCharge: currentFee,
        vat: currentVat,
        totalPaidAmount: currentTotalPaid,
      }),
    }).catch(() => {});

    // Authentic CBE Birr Plus electronic receipt URL with all real-time transaction parameters
    const scanUrl = buildOfficialReceiptUrl(
      currentRef,
      currentAcc,
      currentAmt,
      currentName,
      currentUser,
      currentRec,
      currentDate,
      currentReason,
      currentBank,
      currentFee,
      currentVat,
      currentTotalPaid
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
  }, [
    selectedTx,
    transactions,
    transactionRef,
    userAccount,
    phoneNumber,
    sendAmount,
    phoneSendAmount,
    transactionDate,
    receiverAccount,
    phoneReceiverNumber,
    displayReceiverName,
    phoneReceiverName,
    userName,
    sendReason,
    phoneReason,
    transferSource,
    selectedBank,
  ]);

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
    const isPhoneContext = currentStep === 15 || transferSource === 'phone_number';
    setModalFormError('');
    const cleanNum = modalAccNum.trim().replace(/\D/g, '');
    const cleanName = modalAccName.trim();
    if (isPhoneContext) {
      if (!cleanNum || cleanNum.length < 9) {
        setModalFormError('እባክዎ ትክክለኛ የስልክ ቁጥር ያስገቡ (09... ወይም 07...)');
        return;
      }
    } else {
      if (!cleanNum || cleanNum.length < 10) {
        setModalFormError('እባክዎ ትክክለኛ የ 13 ዲጂት CBE ሂሳብ ቁጥር ያስገቡ');
        return;
      }
    }
    if (!cleanName) {
      setModalFormError('እባክዎ የተቀባይ ስም ያስገቡ (Receiver name required)');
      return;
    }

    if (isPhoneContext) {
      if (editingReceiverId) {
        const updated = savedPhoneReceivers.map((item) =>
          item.id === editingReceiverId
            ? { ...item, accountNumber: cleanNum, accountName: cleanName }
            : item
        );
        persistPhoneReceivers(updated);
        setEditingReceiverId(null);
        setReceiptToast('ስልክ ቁጥር ተስተካክሏል (Contact updated)');
      } else {
        const newRec: SavedReceiver = {
          id: `phone-rec-${Date.now()}`,
          accountNumber: cleanNum,
          accountName: cleanName,
        };
        persistPhoneReceivers([newRec, ...savedPhoneReceivers]);
        setIsAddingNewReceiver(false);
        setReceiptToast('ስልክ ቁጥር ተመዝግቧል (Contact saved)');
      }
    } else {
      if (editingReceiverId) {
        const updated = savedAccountReceivers.map((item) =>
          item.id === editingReceiverId
            ? { ...item, accountNumber: cleanNum, accountName: cleanName }
            : item
        );
        persistAccountReceivers(updated);
        setEditingReceiverId(null);
        setReceiptToast('የሂሳብ ቁጥር ተስተካክሏል (Account updated)');
      } else {
        const newRec: SavedReceiver = {
          id: `acc-rec-${Date.now()}`,
          accountNumber: cleanNum,
          accountName: cleanName,
        };
        persistAccountReceivers([newRec, ...savedAccountReceivers]);
        setIsAddingNewReceiver(false);
        setReceiptToast('የሂሳብ ቁጥር ተመዝግቧል (Account saved)');
      }
    }
    setTimeout(() => setReceiptToast(''), 2000);
    setModalAccNum('');
    setModalAccName('');
  };

  const handleDeleteReceiver = (id: string) => {
    const isPhoneContext = currentStep === 15 || transferSource === 'phone_number';
    if (isPhoneContext) {
      const updated = savedPhoneReceivers.filter((item) => item.id !== id);
      persistPhoneReceivers(updated);
    } else {
      const updated = savedAccountReceivers.filter((item) => item.id !== id);
      persistAccountReceivers(updated);
    }
    if (editingReceiverId === id) {
      setEditingReceiverId(null);
      setModalAccNum('');
      setModalAccName('');
    }
    setReceiptToast('ተቀባይ ተሰርዟል (Receiver deleted)');
    setTimeout(() => setReceiptToast(''), 2000);
  };

  const handleSelectReceiver = (r: SavedReceiver) => {
    if (currentStep === 15 || transferSource === 'phone_number') {
      setPhoneReceiverNumber(r.accountNumber);
      setPhoneReceiverName(r.accountName);
      if (phoneTransferError) setPhoneTransferError('');
    } else {
      setReceiverAccount(r.accountNumber);
      setCustomVerifiedReceiverName(r.accountName);
      if (transferError) setTransferError('');
    }
    setIsReceiversModalOpen(false);
  };

  // Step 7: PIN Authentication for Transfer
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
    setTransferSource('cbe_account');
    setTransferPin('');
    setCurrentStep(7);
  };

  const handleProceedToBankTransferPin = () => {
    setBankTransferError('');
    if (!selectedBank) {
      setBankTransferError('እባክዎ መጀመሪያ ባንክ ይምረጡ (Please select a destination bank first)');
      return;
    }
    const cleanAcc = bankAccountNumber.trim();
    if (!cleanAcc || cleanAcc.length < 5) {
      setBankTransferError('እባክዎ ትክክለኛ የባንክ ሂሳብ ቁጥር ያስገቡ (Please enter valid Bank Account)');
      return;
    }
    const amt = parseFloat(bankAmount) || 0;
    if (amt <= 0) {
      setBankTransferError('እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ (Please enter a valid amount)');
      return;
    }
    const fees = calculateTransferFees(amt);
    if (balance < fees.totalDeductions) {
      setBankTransferError(`ቀሪ ሂሳብዎ በቂ አይደለም (አሁን ያለው: ${formatAmount(balance)} ETB, የሚያስፈልገው: ${fees.totalDeductionsFormatted})`);
      return;
    }
    // Open Confirmation Bottom Sheet per user request
    setIsBankConfirmOpen(true);
  };

  const handleConfirmBankTransfer = () => {
    setIsBankConfirmOpen(false);
    setIsBankTransferring(true);
    setTimeout(() => {
      setIsBankTransferring(false);
      setTransferSource('other_banks');
      setTransferPin('');
      setCurrentStep(7);
    }, 700);
  };

  const handleProceedToWalletTransferPin = () => {
    setWalletTransferError('');
    if (!selectedWallet) {
      setWalletTransferError('እባክዎ መጀመሪያ ዋሌት ይምረጡ (Please select a destination wallet first)');
      return;
    }
    const cleanAcc = walletAccountNumber.trim();
    if (!cleanAcc || cleanAcc.length < 4) {
      setWalletTransferError('እባክዎ ትክክለኛ የዋሌት ቁጥር ያስገቡ (Please enter valid Wallet Account)');
      return;
    }
    const amt = parseFloat(walletAmount) || 0;
    if (amt <= 0) {
      setWalletTransferError('እባክዎ ትክክለኛ የገንዘብ መጠን ያስገቡ (Please enter a valid amount)');
      return;
    }
    const fees = calculateTransferFees(amt);
    if (balance < fees.totalDeductions) {
      setWalletTransferError(`ቀሪ ሂሳብዎ በቂ አይደለም (አሁን ያለው: ${formatAmount(balance)} ETB, የሚያስፈልገው: ${fees.totalDeductionsFormatted})`);
      return;
    }
    // Open Confirmation Bottom Sheet per user request
    setIsWalletConfirmOpen(true);
  };

  const handleConfirmWalletTransfer = () => {
    setIsWalletConfirmOpen(false);
    setIsWalletTransferring(true);
    setTimeout(() => {
      setIsWalletTransferring(false);
      setTransferSource('other_wallets');
      setTransferPin('');
      setCurrentStep(7);
    }, 700);
  };

  const handleTransferKeypadClick = (val: string) => {
    if (transferPin.length < 4) {
      setTransferPin((prev) => prev + val);
      setTransferPinError('');
    }
  };

  const handleClearTransferPinClick = () => {
    setTransferPin('');
    setTransferPinError('');
  };

  const handleTransferBackspace = () => {
    setTransferPin((prev) => prev.slice(0, -1));
    setTransferPinError('');
  };

  const handleBackFromTransferPin = () => {
    setTransferPin('');
    setShowTransferPin(false);
    setTransferPinError('');
    if (transferSource === 'phone_number') {
      setCurrentStep(15);
    } else if (transferSource === 'other_banks') {
      setCurrentStep(16);
    } else if (transferSource === 'other_wallets') {
      setCurrentStep(17);
    } else {
      setCurrentStep(6);
    }
  };

  const handleProceedToTransferSubmit = () => {
    if (transferPin.length !== 4) return;
    if (transferPin === '6969') {
      setTimeout(() => {
        const isPhone = transferSource === 'phone_number';
        const isOtherBanks = transferSource === 'other_banks';
        const isOtherWallets = transferSource === 'other_wallets';
        const rawAmt = isOtherBanks
          ? parseFloat(bankAmount)
          : (isOtherWallets
            ? parseFloat(walletAmount)
            : (isPhone ? parseFloat(phoneSendAmount) : parseFloat(sendAmount)));
        const amt = isNaN(rawAmt) || rawAmt <= 0 ? 10 : rawAmt;
        const feeInfo = (isOtherBanks || isOtherWallets) ? calculateTransferFees(amt) : null;
        const totalDeducted = feeInfo ? feeInfo.totalDeductions : amt;
        setTransactionServiceCharge(feeInfo ? feeInfo.serviceCharge : 0);
        setTransactionVat(feeInfo ? feeInfo.taxAmount : 0);
        setTransactionTotalCharges(feeInfo ? feeInfo.totalCharges : 0);
        setTransactionTotalDeductions(totalDeducted);

        const newBal = Math.max(0, balance - totalDeducted);
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

        const activeAccount = isOtherBanks
          ? (bankAccountNumber || '01320847291000')
          : (isOtherWallets
            ? (walletAccountNumber || '0911223344')
            : (isPhone
              ? (phoneReceiverNumber || '0959597544')
              : (receiverAccount || '1000278947339')));
        const activeReceiverName = isOtherBanks
          ? (bankReceiverName || '')
          : (isOtherWallets
            ? (walletReceiverName || '')
            : (isPhone
              ? (phoneReceiverName || '')
              : (displayReceiverName || '')));
        const activeCreditAccountType = isOtherBanks
          ? (selectedBank ? selectedBank.name : 'Other Bank Account')
          : (isOtherWallets
            ? (selectedWallet ? `${selectedWallet.name} Account` : 'Other Wallet Account')
            : (isPhone
              ? 'Customer E-money Account'
              : 'CBE Bank Account'));

        // Save new transfer into transaction history (saved permanently per user request)
        const newTx: TransactionItem = {
          id: `tx-${Date.now()}`,
          title: isOtherBanks ? 'Bank Transfer' : (isOtherWallets ? 'Wallet Transfer' : 'Send Money'),
          date: isoDate,
          amount: amt.toFixed(2),
          type: 'debit',
          ref: newRef,
          account: activeAccount,
          receiverName: activeReceiverName,
          orderId: newRef,
          status: 'Completed',
          debitAccountType: 'Customer E-money Account',
          creditAccountType: activeCreditAccountType,
          bank: isOtherBanks && selectedBank ? selectedBank.name : (isOtherWallets && selectedWallet ? selectedWallet.name : undefined),
          serviceCharge: feeInfo ? feeInfo.serviceCharge.toString() : '0.00',
          vat: feeInfo ? feeInfo.taxAmount.toString() : '0.00',
          totalCharges: feeInfo ? feeInfo.totalCharges.toString() : '0.00',
          totalPaidAmount: totalDeducted.toFixed(2),
        };
        setTransactions((prev) => [newTx, ...prev]);
        setSelectedTx(newTx);

        // Also persist in server receipt-store
        try {
          fetch('/api/receipt/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ref: newRef,
              amt: amt.toFixed(2),
              date: isoDate,
              rec: activeAccount,
              name: activeReceiverName,
              user: userName || 'AYMEN NIGATU YIMAM',
              acc: userAccount || phoneNumber || '959754788',
              reason: isOtherBanks
                ? (bankReason || 'Transfer to Other Bank')
                : (isOtherWallets
                  ? (walletReason || 'Wallet Transfer')
                  : (isPhone ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'))),
              bank: isOtherBanks && selectedBank ? selectedBank.name : (isOtherWallets && selectedWallet ? selectedWallet.name : undefined),
              status: 'Completed',
              orderId: newRef,
              serviceCharge: feeInfo ? feeInfo.serviceCharge.toString() : '0.00',
              vat: feeInfo ? feeInfo.taxAmount.toString() : '0.00',
              totalCharges: feeInfo ? feeInfo.totalCharges.toString() : '0.00',
              totalPaidAmount: totalDeducted.toFixed(2),
            }),
          }).catch(() => {});
        } catch {}

        // Trigger real-time SMS webhook to Samsung Messages app (ms-bk-connect.vercel.app)
        try {
          const currentTxnId = generate8CharTxnId(newRef);
          const cleanUserPhone = (phoneNumber || '251959842829').replace(/\D/g, '');
          const fullPhone = cleanUserPhone.startsWith('251') ? cleanUserPhone : `251${cleanUserPhone.replace(/^0+/, '')}`;
          const autoReceiptUrl = buildOfficialReceiptUrl(
            currentTxnId,
            fullPhone,
            amt.toFixed(2),
            activeReceiverName,
            userName || 'AYMEN NIGATU YIMAM',
            activeAccount,
            isoDate,
            isOtherBanks
              ? (bankReason || 'Transfer to Other Bank')
              : (isOtherWallets
                ? (walletReason || 'Wallet Transfer')
                : (isPhone ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'))),
            isOtherBanks && selectedBank ? selectedBank.name : (isOtherWallets && selectedWallet ? selectedWallet.name : undefined),
            feeInfo ? feeInfo.serviceCharge.toString() : undefined,
            feeInfo ? feeInfo.taxAmount.toString() : undefined,
            totalDeducted.toFixed(2)
          );

          sendTransactionSms({
            fullName: userName || 'AYMEN NIGATU YIMAM',
            userPhone: fullPhone,
            amount: amt,
            receiverAccount: activeAccount,
            receiverName: activeReceiverName,
            balance: newBal,
            txnId: currentTxnId,
            ftRef: newRef,
            receiptUrl: autoReceiptUrl,
            date: now,
            reason: isOtherBanks
              ? (bankReason || 'Transfer to Other Bank')
              : (isOtherWallets
                ? (walletReason || 'Wallet Transfer')
                : (isPhone ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'))),
            bank: isOtherBanks && selectedBank ? selectedBank.name : (isOtherWallets && selectedWallet ? selectedWallet.name : undefined),
          }).catch(() => {});
        } catch {
          // Graceful error handling
        }

        // Return to originating transfer page and display loading spinner before auto-entering Receipt page (Step 8)
        setTransferPin('');
        setShowTransferPin(false);
        if (isOtherBanks) {
          setCurrentStep(16);
          setIsBankTransferring(true);
        } else if (isOtherWallets) {
          setCurrentStep(17);
          setIsWalletTransferring(true);
        } else if (isPhone) {
          setCurrentStep(15);
          setIsPhoneTransferring(true);
        } else {
          setCurrentStep(6);
          setIsTransferring(true);
        }
      }, 150);
    } else {
      // Reject any PIN other than 6969!
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
    }
  };

  const handleDownloadReceipt = async (formatOrEvent?: 'pdf' | 'png' | unknown) => {
    const format: 'pdf' | 'png' =
      typeof formatOrEvent === 'string' && (formatOrEvent === 'pdf' || formatOrEvent === 'png')
        ? formatOrEvent
        : 'pdf';
    try {
      const activeTx = selectedTx || (transactions.length > 0 ? transactions[0] : null);
      const isPhone = transferSource === 'phone_number' || (activeTx?.account && (activeTx.account.startsWith('09') || activeTx.account.startsWith('07')));
      const currentRef = activeTx?.ref || activeTx?.orderId || transactionRef || 'FT262413JRB4';
      const currentAmt = (parseFloat(activeTx?.amount ? String(activeTx.amount) : (isPhone ? phoneSendAmount : sendAmount)) || 10.00).toFixed(2);
      const currentDate = activeTx?.date || transactionIsoDate || '2026-10-27 11:56:20';
      const currentRec = activeTx?.account || (isPhone ? (phoneReceiverNumber || '0959597544') : (receiverAccount || '1000760389289'));
      const currentName = activeTx?.receiverName || (isPhone ? (phoneReceiverName || '') : (displayReceiverName || '')) || '';
      const currentUser = userName || 'AYMEN NIGATU YIMAM';
      const currentAcc = userAccount || phoneNumber || '0959754788';
      const currentReason = activeTx?.title
        ? (activeTx.title === 'Bank Transfer' ? 'Transfer to Other Bank' : (activeTx.title === 'Wallet Transfer' ? 'Wallet Transfer' : 'Customer transfer to CBE account'))
        : (isPhone ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'));
      const currentBank = activeTx?.bank || (transferSource === 'other_banks' && selectedBank ? selectedBank.name : '');
      const currentFee = activeTx?.serviceCharge ? String(activeTx.serviceCharge) : '';
      const currentVat = activeTx?.vat ? String(activeTx.vat) : '';
      const currentTotal = activeTx?.totalPaidAmount ? String(activeTx.totalPaidAmount) : '';

      if (format === 'pdf') {
        await downloadReceiptPdfUniversally(
          {
            ref: currentRef,
            amt: currentAmt,
            date: currentDate,
            rec: currentRec,
            name: currentName,
            user: currentUser,
            acc: currentAcc,
            reason: currentReason,
            bank: currentBank,
            serviceCharge: currentFee,
            vat: currentVat,
            totalPaid: currentTotal,
          },
          (msg) => setReceiptToast(msg)
        );
        setTimeout(() => setReceiptToast(''), 3500);
        return;
      }

      // If PNG image requested
      setReceiptToast('ደረሰኝ በማዘጋጀት ላይ... (PNG)');
      const downloadUrl = `/api/receipt/download?format=png&ref=${encodeURIComponent(currentRef)}&amt=${encodeURIComponent(currentAmt)}&date=${encodeURIComponent(currentDate)}&rec=${encodeURIComponent(currentRec)}&name=${encodeURIComponent(currentName)}&user=${encodeURIComponent(currentUser)}&acc=${encodeURIComponent(currentAcc)}&reason=${encodeURIComponent(currentReason)}${currentBank ? `&bank=${encodeURIComponent(currentBank)}` : ''}`;

      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const blob = await res.blob();
      const fileName = `CBEBirr_Official_Receipt_${currentRef}.png`;

      // Android native check
      if (typeof window !== 'undefined' && (window as any).Android?.saveBase64Pdf) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = (reader.result as string).split(',')[1];
          if (b64) (window as any).Android.saveBase64Pdf(b64, fileName);
        };
        reader.readAsDataURL(blob);
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 4000);
      setReceiptToast(`CBEBirr_Receipt_${currentRef}.png ወርዷል`);
    } catch (err) {
      console.error('Download error:', err);
      setReceiptToast('ደረሰኝ ማውረድ አልተቻለም');
    }
    setTimeout(() => setReceiptToast(''), 3500);
  };

  const handleShareReceipt = async () => {
    const activeTx = selectedTx || (transactions.length > 0 ? transactions[0] : null);
    const isPhone = transferSource === 'phone_number' || (activeTx?.account && (activeTx.account.startsWith('09') || activeTx.account.startsWith('07')));
    const currentRef = activeTx?.ref || activeTx?.orderId || transactionRef || 'FT262413JRB4';
    const currentAmt = (parseFloat(activeTx?.amount ? String(activeTx.amount) : (isPhone ? phoneSendAmount : sendAmount)) || 10.00).toFixed(2);
    const currentDate = activeTx?.date || transactionDate || '2026-10-27 11:56:20';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'CBEBirr Official Receipt',
          text: `CBEBirr VAT Invoice / Customer Receipt for ETB ${currentAmt} - Ref: ${currentRef}`,
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
            `CBEBirr Official Receipt - Ref: ${currentRef} - Amount: ETB ${currentAmt} - Date: ${currentDate}`
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

  // Step 1 - Splash screen 1: Transitions to Splash screen 2 after 2.2s (or on tap)
  useEffect(() => {
    if (currentStep === 1 && splashStep === 1) {
      const timer = setTimeout(() => {
        setSplashStep(2);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, splashStep]);

  // Step 1 - Splash screen 2: Faster duration (1.3s, per user request: "tnsh feten ybel") then enters Step 2 (Phone Login)
  useEffect(() => {
    if (currentStep === 1 && splashStep === 2) {
      const timer = setTimeout(() => {
        setCurrentStep(2);
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [currentStep, splashStep]);

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
  // Auto-saves transfer receiver account so subsequent transfers skip USSD!
  useEffect(() => {
    if (currentStep === 6 && isTransferring) {
      const timer = setTimeout(() => {
        setIsTransferring(false);
        setIsTransferSuccess(true);

        // Auto-save this transfer account into savedAccountReceivers if not already saved!
        const cleanAcc = receiverAccount.replace(/\D/g, '');
        if (cleanAcc.length === 13) {
          const recName = activeReceiverName || customVerifiedReceiverName || displayReceiverName || '';
          if (recName) {
            const alreadySaved = savedAccountReceivers.some(
              (r) => r.accountNumber.replace(/\D/g, '') === cleanAcc
            );
            if (!alreadySaved) {
              const newSaved: SavedReceiver = {
                id: `acc-rec-${Date.now()}`,
                accountNumber: cleanAcc,
                accountName: recName,
              };
              persistAccountReceivers([...savedAccountReceivers, newSaved]);
            }
          }
        }

        setCurrentStep(8);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isTransferring, receiverAccount, activeReceiverName, customVerifiedReceiverName, displayReceiverName, savedAccountReceivers]);

  // Auto-transition to Receipt page after loading spinner on Step 15 (Phone Number Send Money page)
  useEffect(() => {
    if (currentStep === 15 && isPhoneTransferring) {
      const timer = setTimeout(() => {
        setIsPhoneTransferring(false);
        setIsTransferSuccess(true);

        const cleanPhone = phoneReceiverNumber.replace(/\D/g, '');
        if (cleanPhone.length >= 9) {
          const recName = phoneReceiverName || '';
          if (recName) {
            const formattedPhone = cleanPhone.startsWith('0') ? cleanPhone : `0${cleanPhone.replace(/^251/, '')}`;
            const alreadySaved = savedPhoneReceivers.some(
              (r) => r.accountNumber.replace(/\D/g, '') === cleanPhone
            );
            if (!alreadySaved) {
              const newSaved: SavedReceiver = {
                id: `phone-rec-${Date.now()}`,
                accountNumber: formattedPhone,
                accountName: recName,
              };
              persistPhoneReceivers([...savedPhoneReceivers, newSaved]);
            }
          }
        }

        setCurrentStep(8);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isPhoneTransferring, phoneReceiverNumber, phoneReceiverName, savedPhoneReceivers]);

  // Auto-transition to Receipt page after loading spinner on Step 16 (Bank Transfer page)
  useEffect(() => {
    if (currentStep === 16 && isBankTransferring) {
      const timer = setTimeout(() => {
        setIsBankTransferring(false);
        setIsTransferSuccess(true);

        // Auto-save this transfer into savedBankReceivers only if a verified name exists
        const cleanAcc = bankAccountNumber.trim();
        if (cleanAcc && selectedBank && bankReceiverName) {
          const recName = bankReceiverName;
          const alreadySaved = savedBankReceivers.some(
            (r) => r.accountNumber === cleanAcc && r.bankId === selectedBank.id
          );
          if (!alreadySaved) {
            const newSaved: SavedBankReceiver = {
              id: `bank-rec-${Date.now()}`,
              bankId: selectedBank.id,
              bankName: selectedBank.name,
              accountNumber: cleanAcc,
              accountName: recName,
            };
            setSavedBankReceivers((prev) => [newSaved, ...prev]);
          }
        }

        setCurrentStep(8);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isBankTransferring, bankAccountNumber, selectedBank, bankReceiverName, savedBankReceivers]);

  // Auto-transition to Receipt page after loading spinner on Step 17 (Wallet Transfer page)
  useEffect(() => {
    if (currentStep === 17 && isWalletTransferring) {
      const timer = setTimeout(() => {
        setIsWalletTransferring(false);
        setIsTransferSuccess(true);

        // Auto-save this transfer into savedWalletReceivers only if a verified name exists
        const cleanAcc = walletAccountNumber.trim();
        if (cleanAcc && selectedWallet && walletReceiverName) {
          const recName = walletReceiverName;
          const alreadySaved = savedWalletReceivers.some(
            (r) => r.accountNumber === cleanAcc && r.walletId === selectedWallet.id
          );
          if (!alreadySaved) {
            const newSaved: SavedWalletReceiver = {
              id: `wallet-rec-${Date.now()}`,
              walletId: selectedWallet.id,
              walletName: selectedWallet.name,
              accountNumber: cleanAcc,
              accountName: recName,
            };
            setSavedWalletReceivers((prev) => [newSaved, ...prev]);
          }
        }

        setCurrentStep(8);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isWalletTransferring, walletAccountNumber, selectedWallet, walletReceiverName, savedWalletReceivers]);

  // Click on "Next" button in Step 2 (Phone Number page) goes to Step 3 (PIN page)
  const handleNextFromPhonePage = () => {
    if (isLoggingIn) return;
    setPin('');
    setShowLoginPin(false);
    setPinError('');
    setCurrentStep(3);
  };

  // Only clicking on-screen keypad numbers adds digits (No computer keyboard input per user request)
  // STRICT SECURITY: Only PIN '6969' is accepted! Any other PIN is rejected!
  const handleKeypadClick = (val: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + val);
      setPinError('');
    }
  };

  // Clear button clears all entered digits
  const handleClearPinClick = () => {
    setPin('');
    setPinError('');
  };

  // Backspace key on keypad removes the last digit
  const handleBackspaceClick = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError('');
  };

  // Explicit Next button click submission per user requirement:
  // "pin kasgebaw buhala gdeta next malet alebgn"
  const handleNextFromPinPage = () => {
    if (pin.length !== 4) return;
    if (pin === '6969') {
      setTimeout(() => {
        setPin('');
        setShowLoginPin(false);
        setCurrentStep(2);
        setIsLoggingIn(true);
      }, 150);
    } else {
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
    }
  };

  // Back button on PIN page returns to Phone page (Step 2)
  const handleBackToPhone = () => {
    setPin('');
    setShowLoginPin(false);
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

  // Smooth Drag-to-Scroll handlers for Step 7 Other Bank / Wallet PIN screen
  const step7ScrollRef = useRef<HTMLDivElement>(null);
  const isStep7DraggingRef = useRef(false);
  const step7StartYRef = useRef(0);
  const step7ScrollTopRef = useRef(0);

  const handleStep7PointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = step7ScrollRef.current;
    if (!el) return;
    isStep7DraggingRef.current = true;
    step7StartYRef.current = e.clientY;
    step7ScrollTopRef.current = el.scrollTop;
    el.style.scrollBehavior = 'auto';
  };

  const handleStep7PointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStep7DraggingRef.current) return;
    const el = step7ScrollRef.current;
    if (!el) return;
    const deltaY = e.clientY - step7StartYRef.current;
    el.scrollTop = step7ScrollTopRef.current - deltaY;
  };

  const handleStep7PointerUp = () => {
    isStep7DraggingRef.current = false;
    if (step7ScrollRef.current) {
      step7ScrollRef.current.style.scrollBehavior = 'smooth';
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0a0a0c] flex items-center justify-center overflow-hidden select-none p-0 sm:p-2">
      {/* Balanced Proportional Mobile Screen Container (720x1527): Perfectly proportioned horizontally & vertically without stretching */}
      <div
        style={{
          aspectRatio: '720 / 1527',
          width: 'min(100vw, calc(var(--stable-app-height, 100vh) * 720 / 1527))',
          height: 'min(var(--stable-app-height, 100vh), calc(100vw * 1527 / 720))',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
        className="relative overflow-hidden bg-white flex flex-col justify-center items-center shadow-2xl sm:rounded-[36px] sm:shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.12)] sm:border-[6px] sm:border-[#1a1a20]"
      >

        <AnimatePresence initial={false}>
          {/* STEP 1 - SUB-STEP 1: FIRST SPLASH SCREEN (Original circle token) */}
          {currentStep === 1 && splashStep === 1 && (
            <motion.div
              key="step-1-splash-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              onClick={() => setSplashStep(2)}
              className="relative w-full h-full cursor-pointer bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_1_splash.png"
                alt="CBEBirr Splash 1"
                className="w-full h-full object-fill pointer-events-none block"
                draggable={false}
              />
            </motion.div>
          )}

          {/* STEP 1 - SUB-STEP 2: SECOND SPLASH SCREEN (Welcome to CBEBirr + CBE Birr Plus badge) */}
          {currentStep === 1 && splashStep === 2 && (
            <motion.div
              key="step-1-splash-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              onClick={() => setCurrentStep(2)}
              className="relative w-full h-full cursor-pointer bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_splash_2.png"
                alt="Welcome to CBEBirr"
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
                  top: '25.6%',
                  left: '20.0%',
                  width: '58.0%',
                  height: '2.8%',
                }}
                className="overflow-hidden flex items-center pointer-events-none z-10"
              >
                <motion.div
                  animate={{ x: ['0%', '-50%'] }}
                  transition={{
                    repeat: Infinity,
                    repeatType: 'loop',
                    duration: 2.8,
                    ease: 'linear',
                  }}
                  style={{ width: '200%' }}
                  className="flex whitespace-nowrap shrink-0 h-full items-center"
                >
                  <div style={{ width: '50%' }} className="flex items-center shrink-0">
                    <span className="text-[#8c288e] text-[12.5px] sm:text-[13px] font-bold tracking-tight select-none leading-none">
                      Welcome to CBEBirr Plus app!
                    </span>
                  </div>
                  <div style={{ width: '50%' }} className="flex items-center shrink-0">
                    <span className="text-[#8c288e] text-[12.5px] sm:text-[13px] font-bold tracking-tight select-none leading-none">
                      Welcome to CBEBirr Plus app!
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Interactive Phone Number Input: Allows user to type or change phone number */}
              <div
                style={{
                  position: 'absolute',
                  top: '36.2%',
                  left: '24.2%',
                  width: '65.0%',
                  height: '4.6%',
                }}
                className={`flex items-center bg-[#ebe8ec] rounded-r-2xl overflow-hidden ${isLoggingIn ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="tel"
                  disabled={isLoggingIn}
                  value={phoneNumber}
                  onChange={(e) => {
                    let clean = e.target.value.replace(/\D/g, '');
                    if (clean.startsWith('0')) clean = clean.slice(1);
                    if (!clean.startsWith('9')) clean = '9' + clean;
                    clean = clean.slice(0, 9);
                    setPhoneNumber(clean);
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('cbebirr_phone_number', clean);
                      }
                    } catch {}
                  }}
                  className="w-full h-full bg-[#ebe8ec] text-[#222222] text-[13.5px] sm:text-[14px] font-medium tracking-[0.03em] px-2.5 border-0 outline-none select-text flex items-center leading-normal"
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
                className={`cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 ${isLoggingIn ? 'pointer-events-none' : ''}`}
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
                    <div className="relative w-9 h-9 flex items-center justify-center pointer-events-none select-none">
                      {/* Authentic CBE dots turning on & off sequentially in turn (chaser animation) */}
                      <CBEAuthenticSpinner size={36} color="#8b278e" speed={0.95} />
                    </div>
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
              className="relative w-full h-full bg-[#c7cbd0] flex flex-col overflow-hidden select-none"
            >
              {/* Underlying exact PIN Screen PNG */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_3_pin.png"
                alt="CBEBirr PIN Authentication"
                className="w-full h-full object-fill pointer-events-none block select-none"
                draggable={false}
              />

              {/* Hotspot: Top Purple Chevron-Down (Back to Phone page) */}
              <button
                type="button"
                onClick={handleBackToPhone}
                style={{
                  position: 'absolute',
                  top: '6.8%',
                  left: '44.0%',
                  width: '12.0%',
                  height: '4.8%',
                }}
                aria-label="Back to Phone Number Page"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
              />

              {/* Center Input Display (PIN placeholder or stars or numbers) */}
              <div
                style={{
                  position: 'absolute',
                  top: '25.41%',
                  left: '26.0%',
                  width: '46.0%',
                  height: '5.83%',
                }}
                className="z-20 flex items-center justify-center pointer-events-none select-none"
              >
                {!pin ? (
                  <span className="text-[#8e8c8f] font-normal text-[15px] sm:text-[16px] tracking-normal">
                    PIN
                  </span>
                ) : showLoginPin ? (
                  <span className="text-[#1c1b1f] font-bold text-[17px] sm:text-[18px] tracking-[4px]">
                    {pin}
                  </span>
                ) : (
                  <span className="text-[#1c1b1f] font-bold text-[22px] sm:text-[24px] tracking-[6px] pt-1">
                    {'*'.repeat(pin.length)}
                  </span>
                )}
              </div>

              {/* Eye Icon Toggle Button (Show/Hide PIN) */}
              <button
                type="button"
                onClick={() => setShowLoginPin((prev) => !prev)}
                style={{
                  position: 'absolute',
                  top: '26.2%',
                  left: '73.0%',
                  width: '8.5%',
                  height: '4.2%',
                }}
                aria-label={showLoginPin ? "Hide PIN" : "Show PIN"}
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 flex items-center justify-center p-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={showLoginPin ? "/assets/eye_open_icon.png" : "/assets/eye_off_icon.png"}
                  alt={showLoginPin ? "Show PIN" : "Hide PIN"}
                  className="w-full h-full object-contain pointer-events-none select-none block"
                  draggable={false}
                />
              </button>

              {/* Incorrect PIN feedback message */}
              {pinError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '32.5%',
                    left: '12%',
                    width: '76%',
                  }}
                  className="z-30 text-center text-[12px] font-bold text-white bg-red-600/90 py-1.5 px-3 rounded-full shadow-lg pointer-events-none"
                >
                  {pinError}
                </motion.div>
              )}

              {/* KEYPAD ON-SCREEN BUTTONS HOTSPOTS */}
              {/* Row 1: Keys 1, 2, 3 */}
              <button
                type="button"
                onClick={() => handleKeypadClick('1')}
                style={{
                  position: 'absolute',
                  top: '62.61%',
                  left: '2.78%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="1"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('2')}
                style={{
                  position: 'absolute',
                  top: '62.61%',
                  left: '35.28%',
                  width: '29.44%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="2"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('3')}
                style={{
                  position: 'absolute',
                  top: '62.61%',
                  left: '67.92%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="3"
              />

              {/* Row 2: Keys 4, 5, 6 */}
              <button
                type="button"
                onClick={() => handleKeypadClick('4')}
                style={{
                  position: 'absolute',
                  top: '69.42%',
                  left: '2.78%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="4"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('5')}
                style={{
                  position: 'absolute',
                  top: '69.42%',
                  left: '35.28%',
                  width: '29.44%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="5"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('6')}
                style={{
                  position: 'absolute',
                  top: '69.42%',
                  left: '67.92%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="6"
              />

              {/* Row 3: Keys 7, 8, 9 */}
              <button
                type="button"
                onClick={() => handleKeypadClick('7')}
                style={{
                  position: 'absolute',
                  top: '76.23%',
                  left: '2.78%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="7"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('8')}
                style={{
                  position: 'absolute',
                  top: '76.23%',
                  left: '35.28%',
                  width: '29.44%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="8"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('9')}
                style={{
                  position: 'absolute',
                  top: '76.23%',
                  left: '67.92%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="9"
              />

              {/* Row 4: Keys Clear, 0, Backspace */}
              <button
                type="button"
                onClick={handleClearPinClick}
                style={{
                  position: 'absolute',
                  top: '83.04%',
                  left: '2.78%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="Clear"
              />
              <button
                type="button"
                onClick={() => handleKeypadClick('0')}
                style={{
                  position: 'absolute',
                  top: '83.04%',
                  left: '35.28%',
                  width: '29.44%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="0"
              />
              <button
                type="button"
                onClick={handleBackspaceClick}
                style={{
                  position: 'absolute',
                  top: '83.04%',
                  left: '67.92%',
                  width: '29.31%',
                  height: '6.42%',
                }}
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl transition-colors z-20"
                aria-label="Backspace"
              />

              {/* Active Next Button Image (Shown ONLY when exactly 4 digits entered) */}
              {pin.length === 4 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '89.91%',
                    left: '3.06%',
                    width: '93.89%',
                    height: '7.47%',
                  }}
                  className="pointer-events-none select-none z-10 animate-in fade-in duration-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/next_button_active.png"
                    alt="Next Button Active"
                    className="w-full h-full object-fill pointer-events-none select-none block rounded-2xl"
                    draggable={false}
                  />
                </div>
              )}

              {/* Next Button Hotspot (Clickable only when pin.length === 4) */}
              <button
                type="button"
                onClick={handleNextFromPinPage}
                disabled={pin.length < 4}
                style={{
                  position: 'absolute',
                  top: '89.91%',
                  left: '3.06%',
                  width: '93.89%',
                  height: '7.47%',
                }}
                aria-label="Next"
                className={`border-0 outline-none rounded-2xl z-20 transition-all ${
                  pin.length === 4
                    ? 'cursor-pointer bg-transparent active:opacity-75'
                    : 'cursor-not-allowed bg-transparent'
                }`}
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
                    onPointerDown={startProfileLongPress}
                    onPointerUp={endProfileLongPress}
                    onPointerCancel={cancelProfileLongPress}
                    onPointerLeave={cancelProfileLongPress}
                    style={{
                      position: 'absolute',
                      top: '47.0%',
                      left: '20.0%',
                      width: '60.0%',
                      height: '12.5%',
                      background: 'linear-gradient(to bottom, #72227d 0%, #74237f 50%, #772582 100%)',
                    }}
                    className="flex flex-col items-center justify-center z-20 select-none overflow-hidden cursor-pointer active:scale-[0.99] transition-transform pointer-events-auto"
                    title="Long-press to edit profile and details"
                  >
                    {/* Row 1: Authentic Phone Icon + Number (soft muted peach matching top PNG text) */}
                    <div className="flex items-center justify-center gap-[2.5px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/cbe_balance_phone_icon.png"
                        alt=""
                        className="w-[12px] h-[12px] object-contain opacity-80 shrink-0 pointer-events-none select-none"
                        draggable={false}
                      />
                      <span className="text-[#eebd9c] text-[11.2px] sm:text-[12px] font-medium tracking-[0.03em] select-none whitespace-nowrap leading-none font-sans">
                        {`+251${(phoneNumber || '959754788').slice(0, 6)}***`}
                      </span>
                    </div>

                    {/* Row 2: Typewriter Animated Greeting / First Name with blinking cursor (Actionable, matches WELCOME BACK & AYMEN !) */}
                    <div className="flex items-center justify-center mt-1">
                      <span className="text-[#eebd9c] text-[10.2px] sm:text-[11px] font-medium tracking-[0.08em] select-none whitespace-nowrap leading-none uppercase font-sans">
                        {displayText || 'WELCOME BACK'}
                      </span>
                      <span className="inline-block text-[#eebd9c] text-[10.2px] sm:text-[11px] font-bold ml-0.5 animate-pulse select-none leading-none">
                        _
                      </span>
                    </div>
                  </div>

                  {/* Hotspot: Phone Number / Profile (Strictly Long-Press ONLY to edit profile details; normal click does nothing) */}
                  <button
                    type="button"
                    onPointerDown={startProfileLongPress}
                    onPointerUp={endProfileLongPress}
                    onPointerCancel={cancelProfileLongPress}
                    onPointerLeave={cancelProfileLongPress}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      position: 'absolute',
                      top: '46.0%',
                      left: '25.0%',
                      width: '50.0%',
                      height: '14.0%',
                    }}
                    aria-label="Long press to edit profile details"
                    className="cursor-pointer bg-transparent border-0 outline-none select-none z-20"
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
                        top: '76.8%',
                        left: '6.2%',
                        maxWidth: '45%',
                        height: '5.2%',
                        backgroundColor: '#842789',
                      }}
                      className="flex items-center pointer-events-none z-10 overflow-hidden"
                    >
                      <span className="text-white text-[11px] sm:text-[11.8px] font-semibold tracking-tight whitespace-nowrap leading-none">
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
                        top: '76.8%',
                        right: '7.2%',
                        maxWidth: '45%',
                        height: '5.2%',
                      }}
                      className="flex items-center justify-end bg-[#842789] pointer-events-none z-10 overflow-hidden"
                    >
                      <span className="text-white text-[12.2px] sm:text-[13px] font-semibold tracking-tight whitespace-nowrap leading-none">
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

                  {/* Hotspot: Top Header Language Switcher (EN / አማ) */}
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
                        onClick={openCbeAccountTransfer}
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

                      {/* Hotspot: Click "Send Money" card to open Send Money Menu Popup (Screenshot_20261105-141411.png) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSendMoneyMenuOpen((prev) => !prev);
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

                      {/* AUTHENTIC SEND MONEY MENU POPUP (To Individual / To Group) */}
                      <AnimatePresence>
                        {isSendMoneyMenuOpen && (
                          <>
                            {/* Invisible Backdrop to dismiss on outside tap */}
                            <div
                              onClick={() => setIsSendMoneyMenuOpen(false)}
                              className="fixed inset-0 z-30 bg-transparent"
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.94, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.94, y: -4 }}
                              transition={{ duration: 0.12 }}
                              style={{
                                position: 'absolute',
                                top: '55.0%',
                                left: '27.6%',
                                width: '46.1%',
                                aspectRatio: '332 / 197',
                                zIndex: 40,
                              }}
                              className="relative rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.22)] border border-black/[0.04] bg-white select-none cursor-pointer overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/screens/send_money_options_popup_rounded.png"
                                alt="Send Money Options"
                                className="w-full h-full object-fill block pointer-events-none"
                                draggable={false}
                              />
                              {/* Option 1: To Individual -> navigates to Step 15 */}
                              <button
                                type="button"
                                onClick={openPhoneTransfer}
                                style={{
                                  position: 'absolute',
                                  top: '0%',
                                  left: '0%',
                                  width: '100%',
                                  height: '50%',
                                }}
                                aria-label="To Individual"
                                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/[0.06] transition-colors z-20"
                              />
                              {/* Option 2: To Group */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSendMoneyMenuOpen(false);
                                  setReceiptToast('የቡድን ማስተላለፍ በቅርብ ቀን (Group Transfer coming soon)');
                                  setTimeout(() => setReceiptToast(''), 2500);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '0%',
                                  width: '100%',
                                  height: '50%',
                                }}
                                aria-label="To Group"
                                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/[0.06] transition-colors z-20"
                              />
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

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

                    {/* 2. PROMOTIONAL BANNER SECTION (Only Advertisement Card Slides Horizontally; Dots Below It Stay Stationary In Place) */}
                    <div className="w-full relative flex flex-col items-center py-1 bg-white select-none">
                      {/* Only the Advertisement Card (mastawekiaw) slides horizontally */}
                      <div
                        className="relative w-full overflow-hidden select-none bg-white cursor-grab active:cursor-grabbing touch-pan-y"
                        style={{ aspectRatio: '720 / 216' }}
                        onPointerDown={handleBannerPointerDown}
                        onPointerMove={handleBannerPointerMove}
                        onPointerUp={handleBannerPointerUp}
                        onPointerCancel={handleBannerPointerUp}
                      >
                        <div
                          className="flex w-full h-full"
                          style={{
                            transform: `translateX(calc(-${activeBannerIndex * 100}% + ${bannerDragDelta}px))`,
                            transition: isBannerDragging ? 'none' : 'transform 420ms cubic-bezier(0.25, 1, 0.5, 1)',
                            willChange: 'transform',
                          }}
                        >
                          {/* Banner Slide 1: Linked Bank Acct, Pull Money, Fuel Payment, Bill Payment, Send Money, Buy Goods */}
                          <div className="relative min-w-full w-full h-full flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/banners/cbe_banner_card_1.png"
                              alt="በሲቢኢ ብር ፕላስ የባንክ ሂሳብዎን ያንቀሳቅሱ!"
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCbeAccountTransfer();
                              }}
                              style={{ position: 'absolute', top: '52.0%', left: '18.0%', width: '13.0%', height: '41.0%' }}
                              aria-label="Linked Bank Account"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTempBalanceInput(balance.toString());
                                setTempRewardInput(reward.toString());
                                setBalanceModalTab('add');
                                setIsBalanceModalOpen(true);
                              }}
                              style={{ position: 'absolute', top: '56.0%', left: '32.0%', width: '10.5%', height: '36.0%' }}
                              aria-label="Pull Money"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToast('የነዳጅ ክፍያ አገልግሎት (Fuel Payment)');
                                setTimeout(() => setReceiptToast(''), 2500);
                              }}
                              style={{ position: 'absolute', top: '56.0%', left: '43.5%', width: '10.5%', height: '36.0%' }}
                              aria-label="Fuel Payment"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToast('የቢል ክፍያ አገልግሎት (Bill Payment)');
                                setTimeout(() => setReceiptToast(''), 2500);
                              }}
                              style={{ position: 'absolute', top: '56.0%', left: '55.0%', width: '10.5%', height: '36.0%' }}
                              aria-label="Bill Payment"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCbeAccountTransfer();
                              }}
                              style={{ position: 'absolute', top: '56.0%', left: '67.0%', width: '10.5%', height: '36.0%' }}
                              aria-label="Send Money"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentStep(14);
                              }}
                              style={{ position: 'absolute', top: '56.0%', left: '79.0%', width: '10.5%', height: '36.0%' }}
                              aria-label="Buy Goods"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                            />
                          </div>

                          {/* Banner Slide 2: Send Money & To CBE Acct */}
                          <div className="relative min-w-full w-full h-full flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/banners/cbe_banner_card_2.png"
                              alt="ከሰሊኢ ብር ወደ ሲቢኢ ብር እና ወደ ባንካችን ሂሳብ ገንዘብ በነጻ ያስተላልፉ"
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCbeAccountTransfer();
                              }}
                              style={{ position: 'absolute', top: '47.0%', left: '59.0%', width: '15.5%', height: '39.0%' }}
                              aria-label="Send Money"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-2xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCbeAccountTransfer();
                              }}
                              style={{ position: 'absolute', top: '47.0%', left: '75.0%', width: '15.5%', height: '39.0%' }}
                              aria-label="To CBE Acct"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-2xl"
                            />
                          </div>

                          {/* Banner Slide 3: Fuel Payment */}
                          <div className="relative min-w-full w-full h-full flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/banners/cbe_banner_card_3.png"
                              alt="የነዳጅ ክፍያዎችን በሲቢኢ ብር"
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToast('የነዳጅ ክፍያ በሲቢኢ ብር (Fuel Payment)');
                                setTimeout(() => setReceiptToast(''), 2500);
                              }}
                              style={{ position: 'absolute', top: '32.0%', left: '70.5%', width: '18.5%', height: '47.0%' }}
                              aria-label="Fuel Payment Button"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-2xl"
                            />
                          </div>

                          {/* Banner Slide 4: CBE Tickets */}
                          <div className="relative min-w-full w-full h-full flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/banners/cbe_banner_card_4.png"
                              alt="ትኬትዎን በሲቢኢ ብር ላይ ይሽጡ፣ ይግዙ!"
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToast('ትኬትዎን በሲቢኢ ብር ይሽጡ፣ ይግዙ (CBE Tickets)');
                                setTimeout(() => setReceiptToast(''), 2500);
                              }}
                              style={{ position: 'absolute', top: '33.0%', left: '70.0%', width: '18.5%', height: '47.0%' }}
                              aria-label="CBE Tickets Button"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-2xl"
                            />
                          </div>

                          {/* Banner Slide 5: EthioDirect */}
                          <div className="relative min-w-full w-full h-full flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/banners/cbe_banner_card_5.png"
                              alt="ከኢትዮ ዳይሬክት በቀጥታ ወደ ሲቢኢ ብር"
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToast('ከኢትዮ ዳይሬክት በቀጥታ ወደ ሲቢኢ ብር (EthioDirect)');
                                setTimeout(() => setReceiptToast(''), 2500);
                              }}
                              style={{ position: 'absolute', top: '53.0%', left: '71.0%', width: '18.5%', height: '42.0%' }}
                              aria-label="EthioDirect Button"
                              className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-2xl"
                            />
                          </div>
                        </div>
                      </div>

                      {/* THE ONE BELOW IT (kesu betach yalechw): IN THE EXACT SYSTEM IT WAS IN BEFORE (STATIONARY IN PLACE, NOT SLIDING HORIZONTALLY) */}
                      <div
                        className="relative w-full bg-white select-none -mt-0.5"
                        style={{ aspectRatio: '720 / 41' }}
                      >
                        {[1, 2, 3, 4, 5].map((num, idx) => (
                          <div
                            key={num}
                            className={`absolute inset-0 w-full h-full transition-opacity duration-300 pointer-events-none ${
                              activeBannerIndex === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/assets/banners/cbe_banner_dots_${num}.png`}
                              alt={`Dots ${num}`}
                              className="w-full h-full object-contain pointer-events-none select-none block"
                              draggable={false}
                            />
                          </div>
                        ))}

                        {/* Interactive Touch Hotspots on Stationary Dots */}
                        <div className="absolute inset-0 pointer-events-none z-20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIndex(0);
                            }}
                            style={{ position: 'absolute', top: '0%', left: '37.5%', width: '4.8%', height: '100%' }}
                            aria-label="Banner 1"
                            className="cursor-pointer bg-transparent border-0 outline-none pointer-events-auto"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIndex(1);
                            }}
                            style={{ position: 'absolute', top: '0%', left: '42.4%', width: '4.8%', height: '100%' }}
                            aria-label="Banner 2"
                            className="cursor-pointer bg-transparent border-0 outline-none pointer-events-auto"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIndex(2);
                            }}
                            style={{ position: 'absolute', top: '0%', left: '47.3%', width: '4.8%', height: '100%' }}
                            aria-label="Banner 3"
                            className="cursor-pointer bg-transparent border-0 outline-none pointer-events-auto"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIndex(3);
                            }}
                            style={{ position: 'absolute', top: '0%', left: '52.2%', width: '4.8%', height: '100%' }}
                            aria-label="Banner 4"
                            className="cursor-pointer bg-transparent border-0 outline-none pointer-events-auto"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIndex(4);
                            }}
                            style={{ position: 'absolute', top: '0%', left: '57.1%', width: '4.8%', height: '100%' }}
                            aria-label="Banner 5"
                            className="cursor-pointer bg-transparent border-0 outline-none pointer-events-auto"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. USER'S CROPPED LOWER 8 ICONS PNG (home_scroll_down___2__759e601d.png) */}
                    <div className="w-full flex justify-center pt-1 pb-4 bg-white">
                      <div className="relative w-[92.2%]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/assets/aistudio/home_scroll_down___2__759e601d.png"
                          alt="CBEBirr Transfer, Pay and Win"
                          className="w-full h-auto block object-contain pointer-events-none select-none"
                          draggable={false}
                        />
                        {/* Hotspot 1: Transfer To Other Banks (1st icon in 2x4 grid: top-left quadrant) */}
                        <button
                          type="button"
                          onClick={openOtherBanksTransfer}
                          style={{
                            position: 'absolute',
                            top: '0%',
                            left: '0%',
                            width: '25%',
                            height: '50%',
                          }}
                          aria-label="Transfer To Other Banks"
                          className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                        />
                        {/* Hotspot 2: Transfer To Other Wallet & Micro Finance (2nd icon in 2x4 grid) */}
                        <button
                          type="button"
                          onClick={openOtherWalletsTransfer}
                          style={{
                            position: 'absolute',
                            top: '0%',
                            left: '25%',
                            width: '25%',
                            height: '50%',
                          }}
                          aria-label="Transfer To Other Wallet & Micro Finance"
                          className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity pointer-events-auto rounded-xl"
                        />
                      </div>
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
                                      const currentTxnId = generate8CharTxnId(newRef);
                                      sendTransactionSms({
                                        fullName: userName || 'AYMEN NIGATU YIMAM',
                                        amount: addVal.toFixed(2),
                                        receiverAccount: userAccount || phoneNumber || '1000760389289',
                                        receiverName: userName || 'AYMEN NIGATU YIMAM',
                                        balance: newBal,
                                        txnId: currentTxnId,
                                        ftRef: newRef,
                                        date: now,
                                        isDeposit: true,
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

                {/* Hotspot: Top Right Language Switcher (EN) */}
                <button
                  type="button"
                  onClick={() => {}}
                  style={{
                    position: 'absolute',
                    top: '7.0%',
                    left: '91.0%',
                    width: '8.0%',
                    height: '24.0%',
                  }}
                  aria-label="Change Language"
                  title="Change Language / ቋንቋ ይምረጡ"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
                />

                {/* Hotspot: Long-Press Search Icon to Open Hidden Samsung Messages (Others Page Top Search) */}
                <button
                  type="button"
                  onPointerDown={handleSearchPointerDown}
                  onPointerUp={handleSearchPointerUp}
                  onPointerCancel={handleSearchPointerCancel}
                  onPointerLeave={handleSearchPointerCancel}
                  style={{
                    position: 'absolute',
                    top: '6.0%',
                    left: '81.5%',
                    width: '9.5%',
                    height: '26.0%',
                    touchAction: 'none',
                  }}
                  aria-label="Search - Long press to open Messages app"
                  title="Search (Long-press to open Messages)"
                  className="cursor-pointer bg-transparent border-0 outline-none active:bg-white/20 transition-colors z-30 rounded-full flex items-center justify-center relative select-none"
                >
                  {isHoldingSearch && (
                    <span className="w-7 h-7 rounded-full bg-white/30 border border-white/60 animate-ping absolute pointer-events-none" />
                  )}
                </button>
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

                  {/* Hotspot: Click "Change Language" row in the menu list */}
                  <button
                    type="button"
                    onClick={() => {}}
                    style={{
                      position: 'absolute',
                      top: '22.5%',
                      left: '5.0%',
                      width: '90.0%',
                      height: '8.2%',
                    }}
                    aria-label="Change Language"
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 rounded-2xl z-20"
                  />

                  {/* Hotspot: EXCLUSIVE LONG-PRESS on "Chat bot" row -> Opens Hidden Samsung Messages App */}
                  <button
                    type="button"
                    onPointerDown={handleChatbotPointerDown}
                    onPointerUp={handleChatbotPointerUp}
                    onPointerCancel={handleChatbotPointerCancel}
                    onPointerLeave={handleChatbotPointerCancel}
                    style={{
                      position: 'absolute',
                      top: '41.5%',
                      left: '4.0%',
                      width: '92.0%',
                      height: '11.5%',
                    }}
                    aria-label="CBE Chatbot"
                    title="CBE Chatbot (Long-press to open messaging)"
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-purple-900/5 rounded-2xl z-20"
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
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20"
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
                  setReceiverAccount('');
                  setCustomVerifiedReceiverName('');
                  setSendAmount('');
                  setSendReason('');
                  setTransferPin('');
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

              {/* Hotspot: Top Search Icon (Long-press ONLY to open Saved Receivers Management) */}
              <button
                type="button"
                onPointerDown={startSearchLongPress}
                onPointerUp={endSearchLongPress}
                onPointerCancel={cancelSearchLongPress}
                onPointerLeave={cancelSearchLongPress}
                onTouchStart={startSearchLongPress}
                onTouchEnd={endSearchLongPress}
                onMouseDown={startSearchLongPress}
                onMouseUp={endSearchLongPress}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Regular click does NOTHING per user request - only long-press opens saved receivers modal!
                }}
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

              {/* Hotspot: Top Header Language Switcher (EN) */}
              <button
                type="button"
                onClick={() => {}}
                style={{
                  position: 'absolute',
                  top: '1.2%',
                  left: '91.5%',
                  width: '7.5%',
                  height: '5.2%',
                }}
                aria-label="Change Language"
                title="Change Language / ቋንቋ ይምረጡ"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
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
                  if (transferError) setTransferError('');

                  // Auto-match saved receivers immediately
                  const matched = savedAccountReceivers.find(
                    (r) => r.accountNumber.replace(/\D/g, '') === raw
                  );
                  if (matched) {
                    setCustomVerifiedReceiverName(matched.accountName);
                    // Mark USSD as handled so it never triggers for saved accounts!
                    hasTriggeredUssdForAccountRef.current = true;
                  } else {
                    // Unsaved accounts strictly remain empty (bado) per user instruction
                    setCustomVerifiedReceiverName('');
                    hasTriggeredUssdForAccountRef.current = false;
                  }
                }}
                placeholder="Receivers Account Number"
                style={{
                  position: 'absolute',
                  top: '15.0%',
                  left: '21.5%',
                  width: '60.0%',
                  height: '3.0%',
                }}
                className={`z-20 text-[#262626] text-[13px] sm:text-[14px] font-normal outline-none px-1 bg-transparent placeholder-[#90869a] ${isTransferring ? 'pointer-events-none opacity-60' : ''}`}
              />

              {/* Hotspot: QR Code Icon on right of Receivers Account (Clicking does NOTHING per user request) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Strictly does nothing per user request - clicking QR icon must not open saved receivers
                }}
                style={{
                  position: 'absolute',
                  top: '14.5%',
                  left: '81.5%',
                  width: '9.5%',
                  height: '4.5%',
                }}
                aria-label="QR Code Icon"
                className="cursor-default bg-transparent border-0 outline-none z-20 rounded-xl"
              />

              {/* Receiver Name: Displayed cleanly below the account box (Saved name or CBE customer) */}
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

              {/* Calculator Icon Hotspot */}
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => openCalculator('cbe_account', sendAmount)}
                style={{
                  position: 'absolute',
                  top: '26.8%',
                  left: '83.0%',
                  width: '8.5%',
                  height: '4.0%',
                }}
                title="Calculator"
                aria-label="Calculator"
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
                    className="bg-[#8c288e] rounded-2xl shadow-[0_6px_28px_rgba(0,0,0,0.32)] border border-white/10 flex items-center justify-center z-40 pointer-events-auto p-2"
                  >
                    <div className="relative w-12 h-12 flex items-center justify-center pointer-events-none select-none">
                      {/* 1. Only the authentic cropped yellow ring spinner rotating in fluid animation style, keeping its place */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/aistudio/cbe_transfer_ring_spinner.png"
                        alt="Loading"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none block"
                        style={{
                          animation: 'cbeSmoothSpin 1.1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite',
                        }}
                      />

                      {/* 2. Original cropped CBE static logo anchored firmly at center */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/aistudio/cbe_transfer_logo_static.png"
                        alt="CBE"
                        className="w-7 h-7 object-contain pointer-events-none select-none relative z-10 block"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AUTHENTIC CBE FULL-SCREEN LOADING SYSTEM FOR USSD RECEIVER RESOLUTION */}
              {/* Covers the screen completely with a dimmed backdrop & centered authentic CBE loading card so NOTHING of USSD is visible */}
              <AnimatePresence>
                {isResolvingUssdReceiver && (
                  <motion.div
                    key="ussd-full-loading-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center pointer-events-auto select-none"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: 0.16 }}
                      className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.25)] border border-black/[0.05] flex items-center justify-center p-4"
                      style={{
                        width: '92px',
                        height: '92px',
                      }}
                    >
                      <div className="relative w-10 h-10 flex items-center justify-center pointer-events-none select-none">
                        {/* Authentic CBE dots turning on & off sequentially in turn (chaser animation, matching non-USSD loading speed) */}
                        <CBEAuthenticSpinner size={40} color="#8b278e" speed={0.95} />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>



            </motion.div>
          )}

          {/* STEP 7: TRANSFER PIN AUTHENTICATION SCREEN (Authentic CBE Design from Screenshot_20261107-231751_750ff58f.png) */}
          {currentStep === 7 && (
            <motion.div
              key="step-7-pin-transfer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full flex flex-col overflow-hidden select-none"
            >
              {(transferSource === 'other_banks' || transferSource === 'other_wallets') ? (
                /* AUTHENTIC OTHER BANK & OTHER WALLET TRANSFER PIN PAGE (Matches Screenshot_20261108-132819.png & authentic CBE design) */
                <div className="relative w-full h-full bg-[#D4CFD8] flex flex-col overflow-hidden">
                  {/* 1. FIXED TOP HEADER BAR */}
                  <div className="shrink-0 w-full h-[52px] sm:h-[54px] bg-[#7a1c7d] flex items-center justify-between px-3.5 z-30 shadow-xs">
                    {/* Back button */}
                    <button
                      type="button"
                      onClick={handleBackFromTransferPin}
                      className="w-9 h-9 rounded-xl border border-white/30 flex items-center justify-center text-white active:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Back"
                    >
                      <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
                    </button>

                    {/* Title */}
                    <h2 className="text-white text-[15px] sm:text-[16px] font-semibold tracking-wide truncate px-2">
                      {transferSource === 'other_wallets' ? 'Wallet Transfer' : 'Bank Transfer'}
                    </h2>

                    {/* Search & Language */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-white/90 hover:text-white p-1 cursor-pointer"
                        aria-label="Search"
                      >
                        <Search className="w-5 h-5 stroke-[2]" />
                      </button>
                      <span className="text-white text-xs font-bold tracking-wider uppercase ml-1">
                        EN
                      </span>
                    </div>
                  </div>

                  {/* 2. AUTHENTICATION SECTION (Fixed directly below Header, matching authentic Screenshot_20261108-132819.png) */}
                  <div className="shrink-0 w-full bg-[#D4CFD8] px-4 pt-2.5 pb-2 flex flex-col items-center z-20">
                    {/* Top Purple Chevron Down */}
                    <button
                      type="button"
                      onClick={handleBackFromTransferPin}
                      className="p-1 -mt-0.5 text-[#8b278e] hover:opacity-80 active:scale-95 transition-transform cursor-pointer"
                      aria-label="Back to transfer"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                      </svg>
                    </button>

                    {/* Title */}
                    <h3 className="text-[#1c1b1f] font-bold text-[15px] sm:text-[16px] tracking-tight mt-0.5">
                      Authentication
                    </h3>
                    <p className="text-[#49454f] text-[11.5px] sm:text-[12px] mt-0.5 font-normal">
                      Please enter valid PIN to continue the process
                    </p>

                    {/* PIN Input Box */}
                    <div className="w-full bg-white rounded-xl border border-gray-400 h-11 sm:h-12 mt-2 px-3.5 flex items-center justify-between shadow-xs">
                      {/* Warning triangle */}
                      <div className="text-[#f59e0b] shrink-0">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                        </svg>
                      </div>

                      {/* PIN display */}
                      <div className="flex-1 flex items-center justify-center pointer-events-none select-none">
                        {!transferPin ? (
                          <span className="text-[#9ca3af] font-normal text-[15px]">
                            PIN
                          </span>
                        ) : showTransferPin ? (
                          <span className="text-[#1c1b1f] font-bold text-[17px] tracking-[6px]">
                            {transferPin}
                          </span>
                        ) : (
                          <span className="text-[#1c1b1f] font-bold text-[22px] tracking-[6px] pt-1">
                            {'*'.repeat(transferPin.length)}
                          </span>
                        )}
                      </div>

                      {/* Eye toggle */}
                      <button
                        type="button"
                        onClick={() => setShowTransferPin((prev) => !prev)}
                        className="text-[#8b278e] p-1 hover:opacity-80 active:scale-95 transition-transform cursor-pointer shrink-0"
                        aria-label={showTransferPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showTransferPin ? (
                          <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Incorrect PIN feedback message */}
                    {transferPinError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 text-center text-[12px] font-bold text-white bg-red-600/95 py-1 px-3.5 rounded-full shadow-md"
                      >
                        {transferPinError}
                      </motion.div>
                    )}
                  </div>

                  {/* 3. SCROLLABLE CONFIRMATION CARDS (In Middle, Scrolls Smoothly on Web & APK) */}
                  <div
                    ref={step7ScrollRef}
                    onPointerDown={handleStep7PointerDown}
                    onPointerMove={handleStep7PointerMove}
                    onPointerUp={handleStep7PointerUp}
                    onPointerCancel={handleStep7PointerUp}
                    onPointerLeave={handleStep7PointerUp}
                    className="flex-1 min-h-[100px] w-full px-4 overflow-y-auto overflow-x-hidden relative space-y-2.5 pt-1 pb-2 touch-pan-y [scrollbar-width:thin] [scrollbar-color:#8b278e_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#8b278e] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehaviorY: 'contain',
                      touchAction: 'pan-y',
                    }}
                  >
                    {/* Card 1: Bank / Wallet Name */}
                    <div className="w-full bg-[#fcfbfe] rounded-2xl p-3.5 flex items-center justify-between shadow-xs border border-white/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold italic font-serif">i</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11.5px] text-[#4b5563] font-medium leading-none">
                            Bank
                          </span>
                          <span className="text-[13.5px] text-[#1c1b1f] font-semibold mt-1 leading-tight truncate">
                            {transferSource === 'other_wallets'
                              ? (selectedWallet?.name || 'MPESA')
                              : (selectedBank?.name || 'Awash International Bank')}
                          </span>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                    </div>

                    {/* Card 2: Customer Name (Completely blank if unsaved, never shows CBE customer) */}
                    <div className="w-full bg-[#fcfbfe] rounded-2xl p-3.5 flex items-center justify-between shadow-xs border border-white/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold italic font-serif">i</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11.5px] text-[#4b5563] font-medium leading-none">
                            Customer Name
                          </span>
                          <span className="text-[13.5px] text-[#1c1b1f] font-semibold mt-1 leading-tight truncate">
                            {transferSource === 'other_wallets'
                              ? (walletReceiverName || '')
                              : (bankReceiverName || '')}
                          </span>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                    </div>

                    {/* Card 3: Account No. */}
                    <div className="w-full bg-[#fcfbfe] rounded-2xl p-3.5 flex items-center justify-between shadow-xs border border-white/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold italic font-serif">i</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11.5px] text-[#4b5563] font-medium leading-none">
                            Account No.
                          </span>
                          <span className="text-[13.5px] text-[#1c1b1f] font-semibold mt-1 leading-tight truncate font-mono">
                            {transferSource === 'other_wallets'
                              ? (walletAccountNumber || '0715095670')
                              : (bankAccountNumber || '01320847291000')}
                          </span>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                    </div>

                    {/* Card 4: Amount */}
                    <div className="w-full bg-[#fcfbfe] rounded-2xl p-3.5 flex items-center justify-between shadow-xs border border-white/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold italic font-serif">i</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11.5px] text-[#4b5563] font-medium leading-none">
                            Amount
                          </span>
                          <span className="text-[13.5px] text-[#1c1b1f] font-semibold mt-1 leading-tight truncate">
                            {transferSource === 'other_wallets' ? (walletAmount || '1') : (bankAmount || '1')}
                          </span>
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                    </div>

                    {/* Card 5: Reason (if provided) */}
                    {(transferSource === 'other_wallets' ? walletReason : bankReason) ? (
                      <div className="w-full bg-[#fcfbfe] rounded-2xl p-3.5 flex items-center justify-between shadow-xs border border-white/60">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold italic font-serif">i</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11.5px] text-[#4b5563] font-medium leading-none">
                              Reason
                            </span>
                            <span className="text-[13.5px] text-[#1c1b1f] font-semibold mt-1 leading-tight truncate">
                              {transferSource === 'other_wallets' ? walletReason : bankReason}
                            </span>
                          </div>
                        </div>
                        <Check className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                      </div>
                    ) : null}

                    {/* Bottom spacer inside scroll container */}
                    <div className="h-2 w-full shrink-0" />
                  </div>

                  {/* 4. FIXED NUMERIC KEYPAD (Anchored at Bottom) */}
                  <div className="shrink-0 w-full bg-[#D4CFD8] px-3 pb-3 pt-1 border-t border-black/5 z-20">
                    <div className="w-full">
                      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                        {/* Keys 1-9 */}
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handleTransferKeypadClick(digit)}
                            className="h-[44px] sm:h-12 bg-white active:bg-gray-200 text-[#1c1b1f] font-bold text-[19px] sm:text-[20px] rounded-xl shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                          >
                            {digit}
                          </button>
                        ))}

                        {/* Backspace */}
                        <button
                          type="button"
                          onClick={handleTransferBackspace}
                          className="h-[44px] sm:h-12 bg-white active:bg-gray-200 text-[#1c1b1f] rounded-xl shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                          aria-label="Backspace"
                        >
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
                          </svg>
                        </button>

                        {/* 0 */}
                        <button
                          type="button"
                          onClick={() => handleTransferKeypadClick('0')}
                          className="h-[44px] sm:h-12 bg-white active:bg-gray-200 text-[#1c1b1f] font-bold text-[19px] sm:text-[20px] rounded-xl shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                        >
                          0
                        </button>

                        {/* Next */}
                        <button
                          type="button"
                          onClick={handleProceedToTransferSubmit}
                          disabled={transferPin.length < 4}
                          className={`h-[44px] sm:h-12 rounded-xl flex items-center justify-center font-semibold text-[15px] shadow-xs transition-all ${
                            transferPin.length === 4
                              ? 'bg-[#8b278e] text-white active:scale-95 cursor-pointer shadow-md'
                              : 'bg-[#C3B8C7] text-[#86768B] cursor-not-allowed opacity-90'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ORIGINAL CLEAN TRANSFER PIN SCREEN FOR CBE SEND MONEY & PHONE NUMBER UNTOUCHED */
                <div className="relative w-full h-full bg-[#dedede] flex flex-col overflow-hidden select-none">
                  {/* Underlying exact clean Transfer PIN Screen PNG */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/screens/screen_transfer_pin_clean.png"
                    alt="CBEBirr Transfer PIN Authentication"
                    className="w-full h-full object-fill pointer-events-none block select-none"
                    draggable={false}
                  />

                  {/* Hotspot: Top Bar Back Button (rounded outline) */}
                  <button
                    type="button"
                    onClick={handleBackFromTransferPin}
                    style={{
                      position: 'absolute',
                      top: '1.2%',
                      left: '2.8%',
                      width: '9.5%',
                      height: '5.5%',
                    }}
                    aria-label="Back to Transfer Page"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-xl"
                  />

                  {/* Hotspot: Top Right Language Switcher (EN / አማ) */}
                  <button
                    type="button"
                    onClick={() => {}}
                    style={{
                      position: 'absolute',
                      top: '1.2%',
                      right: '3.5%',
                      width: '9.0%',
                      height: '5.5%',
                    }}
                    aria-label="Change Language"
                    title="Change Language / ቋንቋ ይምረጡ"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
                  />

                  {/* Hotspot: Top Purple Chevron-Down (Back to originating transfer page) */}
                  <button
                    type="button"
                    onClick={handleBackFromTransferPin}
                    style={{
                      position: 'absolute',
                      top: '6.8%',
                      left: '44.0%',
                      width: '12.0%',
                      height: '4.2%',
                    }}
                    aria-label="Back to Transfer Page"
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
                  />

                  {/* Center Input Display (PIN placeholder or stars or numbers) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '25.0%',
                      left: '26.0%',
                      width: '48.0%',
                      height: '5.2%',
                    }}
                    className="z-20 flex items-center justify-center pointer-events-none select-none"
                  >
                    {!transferPin ? (
                      <span className="text-[#8e8c8f] font-normal text-[15px] sm:text-[16px] tracking-normal">
                        PIN
                      </span>
                    ) : showTransferPin ? (
                      <span className="text-[#1c1b1f] font-bold text-[17px] sm:text-[18px] tracking-[6px]">
                        {transferPin}
                      </span>
                    ) : (
                      <span className="text-[#1c1b1f] font-bold text-[22px] sm:text-[24px] tracking-[6px] pt-1">
                        {'*'.repeat(transferPin.length)}
                      </span>
                    )}
                  </div>

                  {/* Eye Icon Toggle Button (Show/Hide PIN) */}
                  <button
                    type="button"
                    onClick={() => setShowTransferPin((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      top: '25.0%',
                      left: '73.0%',
                      width: '9.0%',
                      height: '5.2%',
                    }}
                    aria-label={showTransferPin ? "Hide PIN" : "Show PIN"}
                    className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 flex items-center justify-center p-0"
                  />

                  {/* Incorrect PIN feedback message */}
                  {transferPinError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        position: 'absolute',
                        top: '31.5%',
                        left: '12%',
                        width: '76%',
                      }}
                      className="z-30 text-center text-[12px] font-bold text-white bg-red-600/90 py-1.5 px-3 rounded-full shadow-lg pointer-events-none"
                    >
                      {transferPinError}
                    </motion.div>
                  )}

                  {/* Card 1: Recipient Name & Account Number (Dynamic Injection into white card) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '49.1%',
                      left: '15.3%',
                      width: '68.0%',
                      height: '8.8%',
                    }}
                    className="z-10 flex flex-col justify-center pointer-events-none select-none"
                  >
                    {transferSource === 'phone_number' ? (
                      phoneReceiverName ? (
                        <>
                          <span className="text-[#1c1b1f] font-semibold text-[13px] leading-tight">
                            Name
                          </span>
                          <span className="text-[#1c1b1f] font-bold text-[14.5px] sm:text-[15.5px] leading-tight truncate mt-0.5">
                            {phoneReceiverName}
                          </span>
                        </>
                      ) : null
                    ) : (
                      <>
                        {displayReceiverName ? (
                          <span className="text-[#1c1b1f] font-bold text-[14.5px] sm:text-[15.5px] leading-tight truncate">
                            {displayReceiverName}
                          </span>
                        ) : null}
                        <span className="text-[#49454f] font-mono text-[11.5px] sm:text-[12.5px] leading-tight mt-1">
                          {receiverAccount || '1000440979843'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Card 2: Amount Label & Value (Dynamic Injection into white card) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '57.0%',
                      left: '15.3%',
                      width: '68.0%',
                      height: '8.2%',
                    }}
                    className="z-10 flex flex-col justify-center pointer-events-none select-none"
                  >
                    <span className="text-[#1c1b1f] font-semibold text-[13px] leading-tight">
                      Amount
                    </span>
                    <span className="text-[#1c1b1f] font-bold text-[14.5px] sm:text-[15px] leading-tight mt-0.5">
                      {transferSource === 'phone_number'
                        ? (phoneSendAmount || '5')
                        : (sendAmount || '5')}
                    </span>
                  </div>

                  {/* 4-ROW IN-APP NUMBER PAD */}
                  {/* Row 1: Keys 1, 2, 3 */}
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('1')}
                    style={{
                      position: 'absolute',
                      top: '70.6%',
                      left: '2.8%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="1"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('2')}
                    style={{
                      position: 'absolute',
                      top: '70.6%',
                      left: '35.3%',
                      width: '29.4%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="2"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('3')}
                    style={{
                      position: 'absolute',
                      top: '70.6%',
                      left: '67.9%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="3"
                  />

                  {/* Row 2: Keys 4, 5, 6 */}
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('4')}
                    style={{
                      position: 'absolute',
                      top: '78.2%',
                      left: '2.8%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="4"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('5')}
                    style={{
                      position: 'absolute',
                      top: '78.2%',
                      left: '35.3%',
                      width: '29.4%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="5"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('6')}
                    style={{
                      position: 'absolute',
                      top: '78.2%',
                      left: '67.9%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="6"
                  />

                  {/* Row 3: Keys 7, 8, 9 */}
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('7')}
                    style={{
                      position: 'absolute',
                      top: '85.8%',
                      left: '2.8%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="7"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('8')}
                    style={{
                      position: 'absolute',
                      top: '85.8%',
                      left: '35.3%',
                      width: '29.4%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="8"
                  />
                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('9')}
                    style={{
                      position: 'absolute',
                      top: '85.8%',
                      left: '67.9%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="9"
                  />

                  {/* Row 4: Key Backspace (⌫), Key 0, Key Next */}
                  <button
                    type="button"
                    onClick={handleTransferBackspace}
                    style={{
                      position: 'absolute',
                      top: '92.8%',
                      left: '2.8%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="Backspace"
                  />

                  <button
                    type="button"
                    onClick={() => handleTransferKeypadClick('0')}
                    style={{
                      position: 'absolute',
                      top: '92.8%',
                      left: '35.3%',
                      width: '29.4%',
                      height: '6.0%',
                    }}
                    className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/10 rounded-xl transition-colors z-20"
                    aria-label="0"
                  />

                  {transferPin.length === 4 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '92.8%',
                        left: '67.9%',
                        width: '29.3%',
                        height: '6.0%',
                      }}
                      className="bg-[#8b278e] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md pointer-events-none z-15"
                    >
                      Next
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProceedToTransferSubmit}
                    disabled={transferPin.length < 4}
                    style={{
                      position: 'absolute',
                      top: '92.8%',
                      left: '67.9%',
                      width: '29.3%',
                      height: '6.0%',
                    }}
                    className={`z-20 border-0 outline-none rounded-xl transition-all ${
                      transferPin.length === 4
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-not-allowed opacity-0'
                    }`}
                    aria-label="Next"
                  />
                </div>
              )}
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

              {/* Hotspot: Top Header Language Switcher (EN) */}
              <button
                type="button"
                onClick={() => {}}
                style={{
                  position: 'absolute',
                  top: '1.8%',
                  left: '86.5%',
                  width: '11.0%',
                  height: '5.2%',
                }}
                aria-label="Change Language"
                title="Change Language / ቋንቋ ይምረጡ"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
              />
              

              {/* Dynamic Transaction Summary Paragraph Overlay with seamless authentic background match */}
              <div
                style={{
                  position: 'absolute',
                  top: '23.8%',
                  left: '6.8%',
                  width: '86.4%',
                  height: '8.8%',
                  backgroundColor: '#eeeeee',
                }}
                className="text-[#1a1a1a] text-[12px] sm:text-[13px] leading-[1.38] p-1 pointer-events-none z-10 font-normal select-none overflow-hidden flex flex-col justify-center"
              >
                <p>
                  <span>ETB </span>
                  <span className="font-bold">
                    {transferSource === 'phone_number'
                      ? (phoneSendAmount ? parseFloat(phoneSendAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '10.00')
                      : transferSource === 'other_banks'
                      ? (bankAmount ? parseFloat(bankAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '10.00')
                      : transferSource === 'other_wallets'
                      ? (walletAmount ? parseFloat(walletAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '10.00')
                      : (sendAmount ? parseFloat(sendAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : (selectedTx?.amount ? parseFloat(String(selectedTx.amount)).toFixed(2) : '10.00'))}
                  </span>
                  <span> has been debited from </span>
                  <span className="font-bold">{userName || 'AYMEN NIGATU YIMAM'}</span>
                  <span> for </span>
                  <span className="font-bold">
                    {transferSource === 'phone_number'
                      ? (phoneReceiverName || '')
                      : transferSource === 'other_banks'
                      ? (bankReceiverName || '')
                      : transferSource === 'other_wallets'
                      ? (walletReceiverName || '')
                      : (displayReceiverName || '')}
                  </span>
                  <span> on </span>
                  <span className="font-bold">{transactionDate}</span>
                  <span> with transaction ID: </span>
                  <span className="font-bold">{transactionRef || selectedTx?.ref || 'FT262413JRB4'}</span>
                  <span> via CBEBirr mobile app&apos;s </span>
                  <span className="font-bold">
                    {transferSource === 'other_banks'
                      ? 'Transfer to Other Bank'
                      : transferSource === 'other_wallets'
                      ? (selectedWallet ? `Transfer to ${selectedWallet.name}` : 'Transfer to Other Wallet & Micro Finance')
                      : transferSource === 'phone_number'
                      ? 'Send Money'
                      : 'Transfer to CBE Bank Account'}
                  </span>
                  <span>.</span>
                </p>
              </div>

              {/* Hotspot on receipt preview card / QR area: Tapping opens Step 9 Official Receipt */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedTx && transactions.length > 0) {
                    setSelectedTx(transactions[0]);
                  }
                  setOfficialReceiptBackStep(8);
                  setCurrentStep(9);
                }}
                style={{
                  position: 'absolute',
                  top: '23.0%',
                  left: '8.0%',
                  width: '84.0%',
                  height: '45.0%',
                }}
                aria-label="View Official Receipt"
                className="cursor-pointer bg-transparent border-0 outline-none z-20 active:opacity-80 transition-opacity"
              />

              {/* Hotspot: Receipt button -> Opens Step 9 Official Receipt Page */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedTx && transactions.length > 0) {
                    setSelectedTx(transactions[0]);
                  }
                  setOfficialReceiptBackStep(8);
                  setCurrentStep(9);
                }}
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
                  setSelectedWallet(null);
                  setWalletAccountNumber('');
                  setWalletReceiverName('');
                  setWalletAmount('');
                  setWalletReason('');
                  setWalletTransferError('');
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
                  setSelectedWallet(null);
                  setWalletAccountNumber('');
                  setWalletReceiverName('');
                  setWalletAmount('');
                  setWalletReason('');
                  setWalletTransferError('');
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
                    onClick={() => setCurrentStep(officialReceiptBackStep || 8)}
                    className="p-1.5 -ml-1 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors cursor-pointer text-white flex items-center justify-center"
                    aria-label="Back"
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

                    {/* Exact real-time transaction vector text with complete white masking of underlying PNG details */}
                    {(() => {
                      const activeTx = selectedTx || (transactions.length > 0 ? transactions[0] : null);
                      const isPhoneTx = Boolean(
                        (activeTx?.account && (activeTx.account.startsWith('09') || activeTx.account.startsWith('07') || activeTx.creditAccountType?.includes('E-money'))) ||
                        transferSource === 'phone_number'
                      );
                      const activeRef = activeTx?.ref || activeTx?.orderId || transactionRef || 'FT262413JRB4';
                      const activeOrderId = activeTx?.orderId || activeTx?.ref || transactionRef || '9V8GPL5D';
                      const activeDate = activeTx?.date || transactionIsoDate || transactionDate || '2026-10-27 11:56:20';
                      const activeCustomerName = userName ? userName.toUpperCase() : 'AYMEN NIGATU YIMAM';
                      const activeDebitAcc = `${userAccount || phoneNumber || '0959754788'} - ${activeCustomerName}`;
                      const activeRecAcc = activeTx?.account || (isPhoneTx ? phoneReceiverNumber : receiverAccount) || '1000760389289';
                      const activeReceiverName = activeTx?.receiverName ?? (isPhoneTx ? phoneReceiverName : displayReceiverName) ?? '';
                      const activeCreditAccType = activeTx?.creditAccountType
                        ? activeTx.creditAccountType
                        : (activeTx?.bank
                          ? `${activeTx.bank} Account`
                          : (isPhoneTx ? 'Customer E-money Account' : 'CBE Bank Account'));

                      const rawAmt = parseFloat(
                        activeTx?.amount
                          ? String(activeTx.amount)
                          : (isPhoneTx ? (phoneSendAmount || '10.00') : (sendAmount || '10.00'))
                      ) || 10.00;

                      const isOther =
                        Boolean(activeTx?.bank) ||
                        Boolean(activeTx?.serviceCharge && parseFloat(String(activeTx.serviceCharge)) > 0) ||
                        transferSource === 'other_banks' ||
                        transferSource === 'other_wallets';

                      let feeData: { serviceCharge: string; vat: string; totalPaid: string; totalPaidNum: number } | null = null;
                      if (isOther) {
                        if (activeTx?.serviceCharge && parseFloat(String(activeTx.serviceCharge)) > 0) {
                          const sc = parseFloat(String(activeTx.serviceCharge));
                          const v = activeTx.vat ? parseFloat(String(activeTx.vat)) : +(sc * 0.15).toFixed(5);
                          const td = activeTx.totalPaidAmount ? parseFloat(String(activeTx.totalPaidAmount)) : +(rawAmt + sc + v).toFixed(2);
                          feeData = {
                            serviceCharge: sc.toString(),
                            vat: v.toString(),
                            totalPaid: td.toFixed(2),
                            totalPaidNum: td,
                          };
                        } else if (transactionServiceCharge > 0) {
                          feeData = {
                            serviceCharge: transactionServiceCharge.toString(),
                            vat: transactionVat.toString(),
                            totalPaid: (transactionTotalDeductions || (rawAmt + transactionServiceCharge + transactionVat)).toFixed(2),
                            totalPaidNum: transactionTotalDeductions || (rawAmt + transactionServiceCharge + transactionVat),
                          };
                        } else {
                          const calc = calculateTransferFees(rawAmt);
                          feeData = {
                            serviceCharge: calc.serviceCharge.toString(),
                            vat: calc.taxAmount.toString(),
                            totalPaid: calc.totalDeductions.toFixed(2),
                            totalPaidNum: calc.totalDeductions,
                          };
                        }
                      }

                      const displayAmt = rawAmt.toFixed(2);
                      const rawSc = feeData ? parseFloat(feeData.serviceCharge) : 0;
                      const formattedServiceCharge = isNaN(rawSc) || rawSc <= 0
                        ? '0.00'
                        : (rawSc >= 0.005 && rawSc < 0.01 ? '0.01' : rawSc.toFixed(2));
                      const rawVat = feeData ? parseFloat(feeData.vat) : 0;
                      const formattedVat = isNaN(rawVat) || rawVat <= 0 ? '0.00' : rawVat.toFixed(2);
                      const rawTotal = feeData ? parseFloat(feeData.totalPaid) : rawAmt;
                      const displayTotalPaid = isNaN(rawTotal) ? displayAmt : rawTotal.toFixed(2);
                      const displayWords = amountToWords(feeData ? feeData.totalPaidNum : rawAmt);

                      const activeReason = activeTx?.title
                        ? (activeTx.title === 'Bank Transfer' ? 'Transfer to Other Bank' : (activeTx.title === 'Wallet Transfer' ? 'Wallet Transfer' : 'Customer transfer to CBE account'))
                        : (isPhoneTx ? (phoneReason || 'Wallet Transfer') : (sendReason || 'Customer transfer to CBE account'));

                      return (
                        <g fontFamily="Arial, Helvetica, sans-serif" fill="#141414" fontSize="11" fontWeight="normal">
                          {/* Customer Name */}
                          <rect x="440" y="105" width="215" height="20" fill="#ffffff" />
                          <text x="442" y="118">
                            {activeCustomerName}
                          </text>

                          {/* 1. Debit Account Value */}
                          <rect x="435" y="354" width="225" height="17" fill="#ffffff" />
                          <text x="442" y="368">
                            {activeDebitAcc}
                          </text>

                          {/* 2. Credit Account Value */}
                          <rect x="435" y="371" width="225" height="16" fill="#ffffff" />
                          <text x="442" y="384">
                            {`${activeRecAcc} - ${activeCreditAccType}`}
                          </text>

                          {/* 3. Receiver Name Value */}
                          <rect x="435" y="388" width="225" height="16" fill="#ffffff" />
                          {activeReceiverName ? (
                            <text x="442" y="401">
                              {activeReceiverName}
                            </text>
                          ) : null}

                          {/* 4. Order ID Value */}
                          <rect x="435" y="413" width="225" height="16" fill="#ffffff" />
                          <text x="442" y="426">
                            {activeOrderId}
                          </text>

                          {/* 5. Receipt Number in Table */}
                          <rect x="14" y="563" width="250" height="18" fill="#ffffff" />
                          <text x="16" y="577">
                            {activeRef}
                          </text>

                          {/* 6. Transaction Date in Table */}
                          <rect x="275" y="563" width="200" height="18" fill="#ffffff" />
                          <text x="285" y="577">
                            {activeDate}
                          </text>

                          {/* 7. Amount in Table (Starts at x=551, expands to the right) */}
                          <rect x="538" y="563" width="110" height="19" fill="#ffffff" />
                          <text x="551" y="577">
                            {displayAmt}
                          </text>

                          {/* Solid white mask covering value column cleanly up to right edge (labels end at x=522) */}
                          <rect x="538" y="586" width="110" height="126" fill="#ffffff" />

                          {/* Row 1: Paid amount */}
                          <text x="551" y="602">
                            {displayAmt}
                          </text>

                          {/* Row 2: Service Charge */}
                          <text x="551" y="619">
                            {formattedServiceCharge}
                          </text>

                          {/* Row 3: Disaster Response */}
                          <text x="551" y="635">
                            0.00
                          </text>

                          {/* Row 4: VAT */}
                          <text x="551" y="668">
                            {formattedVat}
                          </text>

                          {/* Row 5: Tip */}
                          <text x="551" y="685">
                            0.00
                          </text>

                          {/* Row 6: Total Paid Amount */}
                          <text x="551" y="702" fontWeight="bold">
                            {displayTotalPaid}
                          </text>

                          {/* 11. Total Amount in word */}
                          <rect x="175" y="706" width="480" height="18" fill="#ffffff" />
                          <text x="182" y="719" fontSize="10.5">
                            {displayWords}
                          </text>

                          {/* 12. Payment Reason */}
                          <rect x="175" y="723" width="480" height="18" fill="#ffffff" />
                          <text x="182" y="736" fontSize="10.5">
                            {activeReason}
                          </text>

                          {/* 13. Dynamic QR Code overlay replacing old template QR */}
                          <rect x="517" y="768" width="108" height="108" fill="#ffffff" />
                          {officialReceiptQrDataUrl && (
                            <image
                              href={officialReceiptQrDataUrl}
                              x="519"
                              y="770"
                              width="104"
                              height="104"
                            />
                          )}
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                {/* Bottom padding for comfortable scrolling */}
                <div className="w-full h-4" />
              </div>

              {/* 3. BOTTOM ACTION BAR: Clean navigation without artificial download buttons */}
              <div className="shrink-0 w-full bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-center z-30 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setReceiverAccount('');
                    setSendAmount('');
                    setSendReason('');
                    setTransferPin('');
                    setTransferError('');
                    setSelectedWallet(null);
                    setWalletAccountNumber('');
                    setWalletReceiverName('');
                    setWalletAmount('');
                    setWalletReason('');
                    setWalletTransferError('');
                    setCurrentStep(4);
                  }}
                  className="w-full py-2.5 px-4 bg-[#7a1c7d] hover:bg-[#68176b] active:scale-[0.98] text-white rounded-xl text-xs sm:text-[13px] font-bold flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
                >
                  <span>ወደ መነሻ ገጽ ተመለስ (Back to Home)</span>
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
                    
                  </h2>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Search className="w-5 h-5 text-white/90 cursor-pointer" />
                  <button
                    type="button"
                    onClick={() => {}}
                    className="cursor-pointer text-white text-xs font-semibold tracking-wider hover:opacity-80 transition-opacity bg-white/10 px-1.5 py-0.5 rounded"
                    title="Change Language / ቋንቋ ይምረጡ"
                  >
                    
                  </button>
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
                  const targetTx = selectedTx || (transactions.length > 0 ? transactions[0] : null);
                  if (targetTx) {
                    setSelectedTx(targetTx);
                    const amt = typeof targetTx.amount === 'number' ? targetTx.amount.toFixed(2) : String(targetTx.amount);
                    setSendAmount(amt);
                    setTransactionRef(targetTx.ref || targetTx.orderId || 'FT262413JRB4');
                    setTransactionDate(targetTx.date);
                    setTransactionIsoDate(targetTx.date);
                    setReceiverAccount(targetTx.account || '1000760389289');
                    setCustomVerifiedReceiverName(targetTx.receiverName || '');

                    if (targetTx.account && (targetTx.account.startsWith('09') || targetTx.account.startsWith('07') || targetTx.creditAccountType?.includes('E-money'))) {
                      setTransferSource('phone_number');
                      setPhoneReceiverNumber(targetTx.account);
                      setPhoneReceiverName(targetTx.receiverName || '');
                      setPhoneSendAmount(amt);
                    } else if (targetTx.bank) {
                      setTransferSource('other_banks');
                    } else if (targetTx.title?.includes('Wallet')) {
                      setTransferSource('other_wallets');
                    } else {
                      setTransferSource('cbe_account');
                    }

                    if (targetTx.serviceCharge && parseFloat(String(targetTx.serviceCharge)) > 0) {
                      setTransactionServiceCharge(parseFloat(String(targetTx.serviceCharge)) || 0);
                      setTransactionVat(parseFloat(String(targetTx.vat)) || 0);
                      setTransactionTotalCharges(parseFloat(String(targetTx.totalCharges)) || 0);
                      setTransactionTotalDeductions(parseFloat(String(targetTx.totalPaidAmount)) || 0);
                    } else if (targetTx.bank || targetTx.title?.includes('Wallet')) {
                      const calc = calculateTransferFees(parseFloat(amt) || 10);
                      setTransactionServiceCharge(calc.serviceCharge);
                      setTransactionVat(calc.taxAmount);
                      setTransactionTotalCharges(calc.totalCharges);
                      setTransactionTotalDeductions(calc.totalDeductions);
                    } else {
                      setTransactionServiceCharge(0);
                      setTransactionVat(0);
                      setTransactionTotalCharges(0);
                      setTransactionTotalDeductions(0);
                    }
                  }

                  setOfficialReceiptBackStep(10);
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

                {/* Hotspot: Top Header Language Switcher (EN) */}
                <button
                  type="button"
                  onClick={() => {}}
                  style={{
                    position: 'absolute',
                    top: '12.0%',
                    left: '87.5%',
                    width: '10.5%',
                    height: '38.0%',
                  }}
                  aria-label="Change Language"
                  title="Change Language / ቋንቋ ይምረጡ"
                  className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-40 rounded-lg"
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
                onClick={() => {}}
                style={{
                  position: 'absolute',
                  top: '2.4%',
                  right: '4.0%',
                  width: '8.5%',
                  height: '4.2%',
                }}
                aria-label="Change Language"
                title="Change Language / ቋንቋ ይምረጡ"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
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
                onClick={() => {}}
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
                  onClick={() => {}}
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

          {/* STEP 15: CBEBIRR SEND MONEY BY PHONE NUMBER SCREEN (Screenshot_20261105-141425.png) */}
          {currentStep === 15 && (
            <motion.div
              key="step-15-send-money-phone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#eeeeee] flex flex-col overflow-hidden select-none"
            >
              {/* Underlying Base Image (Screenshot_20261105-141425.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/screen_send_money_phone.png"
                alt="Send Money By Phone Number"
                className="w-full h-full object-fill block pointer-events-none"
                draggable={false}
              />

              {/* Hotspot: Top Header Back Button (Navigates to Home Step 4) */}
              <button
                type="button"
                onClick={() => {
                  setPhoneTransferError('');
                  setPhoneReceiverNumber('');
                  setPhoneReceiverName('');
                  setPhoneSendAmount('');
                  setPhoneReason('');
                  setTransferPin('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '1.2%',
                  left: '2.5%',
                  width: '16.0%',
                  height: '5.2%',
                }}
                aria-label="Back to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full"
              />

              {/* Hotspot: Top Header Search / Saved Contacts (Long-press ONLY) */}
              <button
                type="button"
                onPointerDown={startSearchLongPress}
                onPointerUp={endSearchLongPress}
                onPointerCancel={cancelSearchLongPress}
                onPointerLeave={cancelSearchLongPress}
                onTouchStart={startSearchLongPress}
                onTouchEnd={endSearchLongPress}
                onMouseDown={startSearchLongPress}
                onMouseUp={endSearchLongPress}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Regular click does NOTHING per user request - only long-press opens saved receivers modal!
                }}
                style={{
                  position: 'absolute',
                  top: '1.5%',
                  left: '81.0%',
                  width: '10.0%',
                  height: '4.8%',
                }}
                aria-label="Manage Receivers (Long-press)"
                title="Long press to manage saved receivers"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full touch-none"
              />

              {/* Hotspot: Top Header Language Switcher (EN) */}
              <button
                type="button"
                onClick={() => {}}
                style={{
                  position: 'absolute',
                  top: '1.2%',
                  left: '91.0%',
                  width: '8.0%',
                  height: '5.2%',
                }}
                aria-label="Change Language"
                title="Change Language / ቋንቋ ይምረጡ"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-lg"
              />

              {/* Field 1: Receivers Phone Input Area (Strictly 10 digits, e.g. 0969096909) */}
              <div
                style={{
                  position: 'absolute',
                  top: '12.9%',
                  left: '21.4%',
                  width: '59.7%',
                  height: '5.4%',
                }}
                className="z-20 flex items-center bg-transparent"
              >
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  disabled={isPhoneTransferring}
                  value={phoneReceiverNumber}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhoneReceiverNumber(raw);
                    if (phoneTransferError) setPhoneTransferError('');
                    if (raw.length === 10) {
                      const matched = savedPhoneReceivers.find(
                        (r) => r.accountNumber.replace(/\D/g, '') === raw
                      );
                      if (matched) {
                        setPhoneReceiverName(matched.accountName);
                      } else {
                        // Unsaved phone number: strictly empty per user request
                        setPhoneReceiverName('');
                      }
                    } else {
                      setPhoneReceiverName('');
                    }
                  }}
                  placeholder="Receivers Phone"
                  className="w-full h-full bg-transparent text-[#262626] text-[15px] sm:text-[16px] font-normal outline-none px-1 placeholder:text-[#7c7784]"
                />
              </div>

              {/* Hotspot: QR Code Icon on right of Receivers Phone (Clicking does NOTHING per user request) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Strictly does nothing per user request - clicking QR icon must not open saved receivers
                }}
                style={{
                  position: 'absolute',
                  top: '12.8%',
                  left: '81.5%',
                  width: '9.5%',
                  height: '5.5%',
                }}
                aria-label="QR Code Icon"
                className="cursor-default bg-transparent border-0 outline-none z-20 rounded-xl"
              />

              {/* Receiver Name: Displayed cleanly below the phone input box (Saved receiver name only, completely empty if unsaved) */}
              {phoneReceiverNumber.length === 10 && phoneReceiverName ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '19.2%',
                    left: '5.0%',
                    width: '90.0%',
                    height: '2.4%',
                  }}
                  className="flex items-center justify-center text-center text-[#18181b] text-[14.5px] sm:text-[15px] font-semibold tracking-tight z-20 pointer-events-none select-none animate-in fade-in duration-150"
                >
                  <span>{phoneReceiverName}</span>
                </div>
              ) : null}

              {/* Field 2: Amount Input Area */}
              <div
                style={{
                  position: 'absolute',
                  top: '25.1%',
                  left: '21.0%',
                  width: '60.5%',
                  height: '5.4%',
                }}
                className="z-20 flex items-center bg-transparent"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={isPhoneTransferring}
                  value={phoneSendAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    setPhoneSendAmount(raw);
                    if (phoneTransferError) setPhoneTransferError('');
                  }}
                  placeholder="Amount"
                  className="w-full h-full bg-transparent text-[#262626] text-[15px] sm:text-[16px] font-normal outline-none px-1 placeholder:text-[#7c7784]"
                />
              </div>

              {/* Hotspot: Calculator quick amount button on right of Amount */}
              <button
                type="button"
                disabled={isPhoneTransferring}
                onClick={() => openCalculator('phone_number', phoneSendAmount)}
                style={{
                  position: 'absolute',
                  top: '25.0%',
                  left: '81.5%',
                  width: '9.5%',
                  height: '5.5%',
                }}
                aria-label="Calculator"
                title="Calculator"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Field 3: Reason Input Area */}
              <div
                style={{
                  position: 'absolute',
                  top: '35.2%',
                  left: '21.0%',
                  width: '69.5%',
                  height: '5.4%',
                }}
                className="z-20 flex items-center bg-transparent"
              >
                <input
                  type="text"
                  disabled={isPhoneTransferring}
                  value={phoneReason}
                  onChange={(e) => setPhoneReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full h-full bg-transparent text-[#262626] text-[15px] sm:text-[16px] font-normal outline-none px-1 placeholder:text-[#7c7784]"
                />
              </div>

              {/* Error Message Display */}
              {phoneTransferError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '41.2%',
                    left: '9.0%',
                    width: '82.0%',
                  }}
                  className="text-[#d32f2f] text-[12px] font-medium text-center z-20"
                >
                  {phoneTransferError}
                </div>
              )}

              {/* Hotspot: Solid Purple "Send Money" CTA Button */}
              <button
                type="button"
                disabled={isPhoneTransferring}
                onClick={() => {
                  const clean = phoneReceiverNumber.replace(/\D/g, '');
                  if (clean.length < 9) {
                    setPhoneTransferError('እባክዎ ትክክለኛ የስልክ ቁጥር ያስገቡ (09... ወይም 07...)');
                    return;
                  }
                  const amt = parseFloat(phoneSendAmount);
                  if (isNaN(amt) || amt <= 0) {
                    setPhoneTransferError('እባክዎ የሚተላለፍ የገንዘብ መጠን ያስገቡ');
                    return;
                  }
                  if (amt > balance) {
                    setPhoneTransferError('በቂ ያልሆነ ሂሳብ (Insufficient balance)');
                    return;
                  }
                  setPhoneTransferError('');
                  setTransferSource('phone_number');
                  setTransferPin('');
                  setCurrentStep(7);
                }}
                style={{
                  position: 'absolute',
                  top: '43.5%',
                  left: '9.2%',
                  width: '81.5%',
                  height: '5.2%',
                }}
                aria-label="Send Money"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-70 transition-opacity z-20 rounded-2xl"
              />

              {/* AUTHENTIC CBE LOADING BOX FOR PHONE NUMBER SEND MONEY */}
              <AnimatePresence>
                {isPhoneTransferring && (
                  <motion.div
                    key="phone-loading-popup"
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
                    className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] border border-black/[0.04] flex items-center justify-center z-50 pointer-events-auto"
                  >
                    <div className="relative w-9 h-9 flex items-center justify-center pointer-events-none select-none">
                      <CBEAuthenticSpinner size={36} color="#8b278e" speed={0.95} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toast Message */}
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

          {/* STEP 16: CBEBIRR TRANSFER TO OTHER BANKS SCREEN (screen_bank_transfer_base.png) */}
          {currentStep === 16 && (
            <motion.div
              key="step-16-bank-transfer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f2f2f2] flex flex-col overflow-hidden select-none"
            >
              {/* Entire Bank Transfer Base Screen PNG (screen_bank_transfer_base.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/banks/screen_bank_transfer_base.png"
                alt="CBEBirr Transfer To Other Banks"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Hotspot 1: Top Bar Purple Back Button -> Returns to Home Page (Step 4) */}
              <button
                type="button"
                onClick={() => {
                  setBankTransferError('');
                  setSelectedBank(null);
                  setBankAccountNumber('');
                  setBankReceiverName('');
                  setBankAmount('');
                  setBankReason('');
                  setTransferPin('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '0.8%',
                  left: '2.5%',
                  width: '15.0%',
                  height: '4.8%',
                }}
                aria-label="Back to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot: Top Header Search Icon (Long-press ONLY to open Saved Bank Receivers) */}
              <button
                type="button"
                onPointerDown={startSearchLongPress}
                onPointerUp={endSearchLongPress}
                onPointerCancel={cancelSearchLongPress}
                onPointerLeave={cancelSearchLongPress}
                onTouchStart={startSearchLongPress}
                onTouchEnd={endSearchLongPress}
                onMouseDown={startSearchLongPress}
                onMouseUp={endSearchLongPress}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Regular click does NOTHING per user request - only long-press opens saved receivers modal!
                }}
                style={{
                  position: 'absolute',
                  top: '0.8%',
                  left: '81.5%',
                  width: '10.5%',
                  height: '5.2%',
                }}
                aria-label="Manage Saved Bank Receivers (Long-press)"
                title="Long press to manage saved bank accounts"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full touch-none"
              />

              {/* Hotspot 2: * Banks Selector Box -> Opens Select Banks Bottom Sheet */}
              <button
                type="button"
                onClick={() => {
                  setBankTransferError('');
                  setIsSelectBankSheetOpen(true);
                }}
                style={{
                  position: 'absolute',
                  top: '11.8%',
                  left: '8.5%',
                  width: '83.0%',
                  height: '8.8%',
                }}
                aria-label="Select Bank"
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 transition-colors z-20 rounded-2xl flex items-center"
              >
                <div
                  style={{
                    marginLeft: '19.0%',
                    width: '66%',
                  }}
                  className="flex items-center text-left pointer-events-none select-none"
                >
                  <span
                    className={`text-[13.5px] sm:text-[14px] truncate ${
                      selectedBank
                        ? 'font-semibold text-[#1c1b1f]'
                        : 'font-normal text-[#8c8291]'
                    }`}
                  >
                    {selectedBank ? selectedBank.name : 'Banks'}
                  </span>
                </div>
              </button>

              {/* Contact icon on Bank Account field (Click does nothing - only top search long-press opens save modal) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  position: 'absolute',
                  top: '22.8%',
                  left: '8.5%',
                  width: '12.5%',
                  height: '6.2%',
                }}
                aria-label="Bank Account Contact Icon"
                className="cursor-default bg-transparent border-0 outline-none z-20"
              />

              {/* Functional Input: Bank Account Number */}
              <div
                style={{
                  position: 'absolute',
                  top: '23.0%',
                  left: '21.5%',
                  width: '69.0%',
                  height: '5.8%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={bankAccountNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9a-zA-Z]/g, '');
                    setBankAccountNumber(clean);
                    setBankTransferError('');
                    if (clean.length >= 5) {
                      const matched = savedBankReceivers.find(
                        (r) => r.accountNumber === clean && (!selectedBank || r.bankId === selectedBank.id)
                      ) || savedBankReceivers.find((r) => r.accountNumber === clean);

                      if (matched) {
                        setBankReceiverName(matched.accountName);
                        if (!selectedBank) {
                          const bObj = ALL_BANKS.find((b) => b.id === matched.bankId);
                          if (bObj) setSelectedBank(bObj);
                        }
                      } else {
                        // Unsaved account: strictly BADO (empty/blank) per user instruction
                        setBankReceiverName('');
                      }
                    } else {
                      setBankReceiverName('');
                    }
                  }}
                  placeholder="Bank Account"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-1"
                />
              </div>

              {/* Receiver Name: Displayed cleanly below Bank Account input ONLY when it is a SAVED account (bado if unsaved) */}
              {bankAccountNumber.trim().length >= 5 && bankReceiverName && (
                <div
                  style={{
                    position: 'absolute',
                    top: '29.6%',
                    left: '5.0%',
                    width: '90.0%',
                    height: '2.4%',
                  }}
                  className="flex items-center justify-center text-center text-[#18181b] text-[14px] sm:text-[14.5px] font-semibold tracking-tight z-20 pointer-events-none select-none animate-in fade-in duration-150"
                >
                  <span>{bankReceiverName}</span>
                </div>
              )}

              {/* Functional Input: Amount */}
              <div
                style={{
                  position: 'absolute',
                  top: '34.0%',
                  left: '21.5%',
                  width: '60.0%',
                  height: '5.8%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={bankAmount}
                  onChange={(e) => {
                    setBankAmount(e.target.value.replace(/[^0-9.]/g, ''));
                    setBankTransferError('');
                  }}
                  placeholder="Amount"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-1"
                />
              </div>

              {/* Calculator Icon Hotspot for Other Banks */}
              <button
                type="button"
                disabled={isBankTransferring}
                onClick={() => openCalculator('other_banks', bankAmount)}
                style={{
                  position: 'absolute',
                  top: '34.0%',
                  left: '81.5%',
                  width: '9.5%',
                  height: '5.8%',
                }}
                aria-label="Calculator"
                title="Calculator"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-xl"
              />

              {/* Functional Input: Reason */}
              <div
                style={{
                  position: 'absolute',
                  top: '44.8%',
                  left: '21.5%',
                  width: '69.0%',
                  height: '5.8%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  value={bankReason}
                  onChange={(e) => setBankReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-1"
                />
              </div>

              {/* Hotspot 4: Bank Transfer Submit Button */}
              <button
                type="button"
                onClick={handleProceedToBankTransferPin}
                style={{
                  position: 'absolute',
                  top: '51.5%',
                  left: '8.0%',
                  width: '84.0%',
                  height: '5.5%',
                }}
                aria-label="Proceed to Bank Transfer PIN"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-70 transition-opacity z-20 rounded-2xl"
              />

              {/* AUTHENTIC CBE LOADING BOX FOR BANK TRANSFER */}
              <AnimatePresence>
                {isBankTransferring && (
                  <motion.div
                    key="bank-loading-popup"
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
                    className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] border border-black/[0.04] flex items-center justify-center z-50 pointer-events-auto"
                  >
                    <div className="relative w-9 h-9 flex items-center justify-center pointer-events-none select-none">
                      <CBEAuthenticSpinner size={36} color="#8b278e" speed={0.95} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toast Error Message */}
              {bankTransferError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-red-600/95 py-2.5 px-4 rounded-xl shadow-xl backdrop-blur-xs"
                >
                  {bankTransferError}
                </motion.div>
              )}

              {/* AUTHENTIC CONFIRMATION BOTTOM SHEET FOR OTHER BANK TRANSFER (Screenshot_20261108-002341.png) */}
              <AnimatePresence>
                {isBankConfirmOpen && (
                  <motion.div
                    key="bank-confirm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[0.5px] flex flex-col justify-end select-none"
                    onClick={() => setIsBankConfirmOpen(false)}
                  >
                    <motion.div
                      key="bank-confirm-sheet"
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white rounded-t-[32px] pt-4 pb-7 px-6 sm:px-7 shadow-2xl relative flex flex-col"
                    >
                      {/* Top Right Close 'X' Button */}
                      <button
                        type="button"
                        onClick={() => setIsBankConfirmOpen(false)}
                        className="absolute top-4 right-5 text-gray-700 hover:text-black p-1 transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X className="w-6 h-6 stroke-[2]" />
                      </button>

                      {/* Title */}
                      <h3 className="text-center font-normal text-[#2b2b2b] text-[15px] pt-1">
                        Bank Transfer
                      </h3>

                      {/* Centered Large Amount */}
                      <div className="text-center mt-1 mb-5 flex items-baseline justify-center gap-1.5">
                        <span className="text-[26px] font-bold text-black tracking-tight">
                          {bankAmount || '1'}
                        </span>
                        <span className="text-xs font-semibold text-black tracking-wide">
                          ETB
                        </span>
                      </div>

                      {/* Dynamic Fee Breakdown Rows */}
                      {(() => {
                        const fees = calculateTransferFees(bankAmount || '1');
                        return (
                          <div className="w-full space-y-1.5 text-[12.5px] sm:text-[13px]">
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Service Charge</span>
                              <span className="text-[#1f2937] font-medium">{fees.serviceChargeFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Disaster Response Fund</span>
                              <span className="text-[#1f2937] font-medium">{fees.disasterFundFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Tax amount</span>
                              <span className="text-[#1f2937] font-medium">{fees.taxAmountFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Total charges</span>
                              <span className="text-[#1f2937] font-medium">{fees.totalChargesFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Total Deductions</span>
                              <span className="text-[#1f2937] font-medium">{fees.totalDeductionsFormatted}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Purple Confirm Button */}
                      <button
                        type="button"
                        onClick={handleConfirmBankTransfer}
                        className="w-full mt-6 py-3.5 bg-[#8b278e] hover:bg-[#7a227d] active:scale-[0.99] text-white font-medium text-[15px] rounded-[16px] shadow-sm transition-all duration-150 cursor-pointer"
                      >
                        Confirm
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* STEP 17: CBEBIRR TRANSFER TO OTHER WALLET & MICRO FINANCE SCREEN (screen_wallet_transfer_base.png) */}
          {currentStep === 17 && (
            <motion.div
              key="step-17-wallet-transfer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className="relative w-full h-full bg-[#f2f2f2] flex flex-col overflow-hidden select-none"
            >
              {/* Entire Wallet Transfer Base Screen PNG (screen_wallet_transfer_base.png) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/wallets/screen_wallet_transfer_base.png"
                alt="CBEBirr Transfer To Other Wallet & Micro Finance"
                className="w-full h-full object-fill pointer-events-none select-none block"
                draggable={false}
              />

              {/* Hotspot 1: Top Bar Purple Back Button -> Returns to Home Page (Step 4) */}
              <button
                type="button"
                onClick={() => {
                  setWalletTransferError('');
                  setSelectedWallet(null);
                  setWalletAccountNumber('');
                  setWalletReceiverName('');
                  setWalletAmount('');
                  setWalletReason('');
                  setTransferPin('');
                  setCurrentStep(4);
                }}
                style={{
                  position: 'absolute',
                  top: '0.8%',
                  left: '2.5%',
                  width: '15.0%',
                  height: '4.8%',
                }}
                aria-label="Back to Home"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-xl"
              />

              {/* Hotspot: Top Header Search Icon (Long-press ONLY to open Saved Wallet Receivers) */}
              <button
                type="button"
                onPointerDown={startSearchLongPress}
                onPointerUp={endSearchLongPress}
                onPointerCancel={cancelSearchLongPress}
                onPointerLeave={cancelSearchLongPress}
                onTouchStart={startSearchLongPress}
                onTouchEnd={endSearchLongPress}
                onMouseDown={startSearchLongPress}
                onMouseUp={endSearchLongPress}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Regular click does NOTHING per user request - only long-press opens saved receivers modal!
                }}
                style={{
                  position: 'absolute',
                  top: '0.8%',
                  left: '81.5%',
                  width: '10.5%',
                  height: '5.2%',
                }}
                aria-label="Manage Saved Wallet Receivers (Long-press)"
                title="Long press to manage saved wallet accounts"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-50 transition-opacity z-20 rounded-full touch-none"
              />

              {/* Hotspot 2: * Wallets Selector Box -> Opens Select Wallets Bottom Sheet */}
              <button
                type="button"
                onClick={() => {
                  setWalletTransferError('');
                  setIsSelectWalletSheetOpen(true);
                }}
                style={{
                  position: 'absolute',
                  top: '11.72%',
                  left: '7.95%',
                  width: '84.11%',
                  height: '7.81%',
                }}
                aria-label="Select Wallet or Micro Finance"
                className="cursor-pointer bg-transparent border-0 outline-none active:bg-black/5 transition-colors z-20 rounded-2xl flex items-center"
              >
                <div
                  style={{
                    marginLeft: '19.2%',
                    width: '66%',
                  }}
                  className="flex items-center text-left pointer-events-none select-none"
                >
                  <span
                    className={`text-[13.5px] sm:text-[14px] truncate ${
                      selectedWallet
                        ? 'font-semibold text-[#1c1b1f]'
                        : 'font-normal text-[#8c8291]'
                    }`}
                  >
                    {selectedWallet ? selectedWallet.name : 'Wallets'}
                  </span>
                </div>
              </button>

              {/* Contact icon on Wallet Account field */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  position: 'absolute',
                  top: '22.0%',
                  left: '8.0%',
                  width: '13.0%',
                  height: '6.2%',
                }}
                aria-label="Wallet Account Contact Icon"
                className="cursor-default bg-transparent border-0 outline-none z-20"
              />

              {/* Functional Input: Wallet Account Number */}
              <div
                style={{
                  position: 'absolute',
                  top: '22.66%',
                  left: '23.51%',
                  width: '65.56%',
                  height: '5.00%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={walletAccountNumber}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9a-zA-Z]/g, '');
                    setWalletAccountNumber(clean);
                    setWalletTransferError('');
                    if (clean.length >= 5) {
                      const matched = savedWalletReceivers.find(
                        (r) => r.accountNumber === clean && (!selectedWallet || r.walletId === selectedWallet.id)
                      ) || savedWalletReceivers.find((r) => r.accountNumber === clean);

                      if (matched) {
                        setWalletReceiverName(matched.accountName);
                        if (!selectedWallet) {
                          const wObj = ALL_WALLETS.find((w) => w.id === matched.walletId);
                          if (wObj) setSelectedWallet(wObj);
                        }
                      } else {
                        // Unsaved account: strictly BADO (empty/blank) per user instruction
                        setWalletReceiverName('');
                      }
                    } else {
                      setWalletReceiverName('');
                    }
                  }}
                  placeholder="Wallet Account"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-0"
                />
              </div>

              {/* Receiver Name: Displayed cleanly below Wallet Account input ONLY when it is a SAVED account (bado if unsaved) */}
              {walletAccountNumber.trim().length >= 5 && walletReceiverName && (
                <div
                  style={{
                    position: 'absolute',
                    top: '28.8%',
                    left: '5.0%',
                    width: '90.0%',
                    height: '2.8%',
                  }}
                  className="flex items-center justify-center text-center text-[#18181b] text-[14px] sm:text-[14.5px] font-semibold tracking-tight z-20 pointer-events-none select-none animate-in fade-in duration-150"
                >
                  <span>{walletReceiverName}</span>
                </div>
              )}

              {/* Functional Input: Amount */}
              <div
                style={{
                  position: 'absolute',
                  top: '33.59%',
                  left: '23.51%',
                  width: '57.12%',
                  height: '5.00%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={walletAmount}
                  onChange={(e) => {
                    setWalletAmount(e.target.value.replace(/[^0-9.]/g, ''));
                    setWalletTransferError('');
                  }}
                  placeholder="Amount"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-0"
                />
              </div>

              {/* Calculator Icon Hotspot for Other Wallets */}
              <button
                type="button"
                disabled={isWalletTransferring}
                onClick={() => openCalculator('other_wallets', walletAmount)}
                style={{
                  position: 'absolute',
                  top: '33.59%',
                  left: '80.63%',
                  width: '9.5%',
                  height: '5.00%',
                }}
                aria-label="Calculator"
                title="Calculator"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-60 transition-opacity z-20 rounded-xl"
              />

              {/* Functional Input: Reason */}
              <div
                style={{
                  position: 'absolute',
                  top: '42.97%',
                  left: '23.51%',
                  width: '65.56%',
                  height: '5.00%',
                }}
                className="z-20 flex items-center"
              >
                <input
                  type="text"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  placeholder="Reason"
                  className="w-full h-full bg-transparent border-none outline-none text-[#1c1b1f] placeholder:text-[#8c8291] text-[13.5px] sm:text-[14px] font-normal px-0"
                />
              </div>

              {/* Hotspot 4: Wallet Transfer Submit Button */}
              <button
                type="button"
                onClick={handleProceedToWalletTransferPin}
                style={{
                  position: 'absolute',
                  top: '50.31%',
                  left: '7.95%',
                  width: '84.11%',
                  height: '5.31%',
                }}
                aria-label="Proceed to Wallet Transfer PIN"
                className="cursor-pointer bg-transparent border-0 outline-none active:opacity-70 transition-opacity z-20 rounded-2xl"
              />

              {/* AUTHENTIC CBE LOADING BOX FOR WALLET TRANSFER */}
              <AnimatePresence>
                {isWalletTransferring && (
                  <motion.div
                    key="wallet-loading-popup"
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
                    className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)] border border-black/[0.04] flex items-center justify-center z-50 pointer-events-auto"
                  >
                    <div className="relative w-9 h-9 flex items-center justify-center pointer-events-none select-none">
                      <CBEAuthenticSpinner size={36} color="#8b278e" speed={0.95} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toast Error Message */}
              {walletTransferError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    bottom: '12%',
                    left: '10%',
                    width: '80%',
                  }}
                  className="z-50 text-center text-xs font-semibold text-white bg-red-600/95 py-2.5 px-4 rounded-xl shadow-xl backdrop-blur-xs"
                >
                  {walletTransferError}
                </motion.div>
              )}

              {/* AUTHENTIC CONFIRMATION BOTTOM SHEET FOR OTHER WALLET TRANSFER (Screenshot_20261108-132811.png) */}
              <AnimatePresence>
                {isWalletConfirmOpen && (
                  <motion.div
                    key="wallet-confirm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[0.5px] flex flex-col justify-end select-none"
                    onClick={() => setIsWalletConfirmOpen(false)}
                  >
                    <motion.div
                      key="wallet-confirm-sheet"
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white rounded-t-[32px] pt-4 pb-7 px-6 sm:px-7 shadow-2xl relative flex flex-col"
                    >
                      {/* Top Right Close 'X' Button */}
                      <button
                        type="button"
                        onClick={() => setIsWalletConfirmOpen(false)}
                        className="absolute top-4 right-5 text-gray-700 hover:text-black p-1 transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X className="w-6 h-6 stroke-[2]" />
                      </button>

                      {/* Title */}
                      <h3 className="text-center font-normal text-[#2b2b2b] text-[15px] pt-1">
                        Wallet Transfer
                      </h3>

                      {/* Centered Large Amount */}
                      <div className="text-center mt-1 mb-5 flex items-baseline justify-center gap-1.5">
                        <span className="text-[26px] font-bold text-black tracking-tight">
                          {walletAmount || '1'}
                        </span>
                        <span className="text-xs font-semibold text-black tracking-wide">
                          ETB
                        </span>
                      </div>

                      {/* Dynamic Fee Breakdown Rows */}
                      {(() => {
                        const fees = calculateTransferFees(walletAmount || '1');
                        return (
                          <div className="w-full space-y-1.5 text-[12.5px] sm:text-[13px]">
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Service Charge</span>
                              <span className="text-[#1f2937] font-medium">{fees.serviceChargeFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Disaster Response Fund</span>
                              <span className="text-[#1f2937] font-medium">{fees.disasterFundFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Tax amount</span>
                              <span className="text-[#1f2937] font-medium">{fees.taxAmountFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Total charges</span>
                              <span className="text-[#1f2937] font-medium">{fees.totalChargesFormatted}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#4b5563]">
                              <span>Total Deductions</span>
                              <span className="text-[#1f2937] font-medium">{fees.totalDeductionsFormatted}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Purple Confirm Button */}
                      <button
                        type="button"
                        onClick={handleConfirmWalletTransfer}
                        className="w-full mt-6 py-3.5 bg-[#8b278e] hover:bg-[#7a227d] active:scale-[0.99] text-white font-medium text-[15px] rounded-[16px] shadow-sm transition-all duration-150 cursor-pointer"
                      >
                        Confirm
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SELECT BANKS BOTTOM SHEET (Fixed sheet_header.png + real-time search + smoothly scrollable bank cards) */}
        <AnimatePresence>
          {isSelectBankSheetOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex flex-col justify-end select-none"
              onClick={() => setIsSelectBankSheetOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-[74%] bg-[#f2f2f2] rounded-t-[28px] overflow-hidden flex flex-col shadow-2xl relative"
              >
                {/* 1. FIXED HEADER: sheet_header.png (Handle, Select Banks title & Search Bar) */}
                <div
                  className="relative shrink-0 w-full select-none"
                  style={{ aspectRatio: '720 / 198' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/banks/sheet_header.png"
                    alt="Select Banks Header"
                    className="w-full h-full object-fill pointer-events-none select-none block"
                    draggable={false}
                  />

                  {/* Top drag handle / close area */}
                  <button
                    type="button"
                    onClick={() => setIsSelectBankSheetOpen(false)}
                    className="absolute top-0 left-0 right-0 h-[38%] bg-transparent cursor-pointer border-0 outline-none"
                    aria-label="Close"
                  />

                  {/* Interactive Search Input mapped directly over the 'Search Banks' input box */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '43.0%',
                      left: '23.5%',
                      width: '67.0%',
                      height: '49.0%',
                    }}
                    className="flex items-center"
                  >
                    {bankSearchTerm && (
                      <div className="absolute inset-0 bg-white rounded-r-full -z-10" />
                    )}
                    <input
                      type="text"
                      value={bankSearchTerm}
                      onChange={(e) => setBankSearchTerm(e.target.value)}
                      placeholder=""
                      className="w-full h-full bg-transparent border-none outline-none text-[#1a1a1a] text-[13px] sm:text-[14px] font-normal px-1"
                    />
                    {bankSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setBankSearchTerm('')}
                        className="text-gray-400 hover:text-gray-700 text-sm font-bold pr-2.5 cursor-pointer"
                        aria-label="Clear Search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. SCROLLABLE BANKS LIST: Smoothly scrolls underneath the fixed header as specified in user instructions */}
                <div className="flex-1 w-full overflow-y-auto overflow-x-hidden px-3.5 pt-2 pb-8 space-y-2.5 scroll-smooth">
                  {filteredBanks.map((bank) => (
                    <div
                      key={bank.id}
                      onClick={() => {
                        setSelectedBank(bank);
                        setIsSelectBankSheetOpen(false);
                        setBankSearchTerm('');
                        setBankTransferError('');
                      }}
                      className="w-full cursor-pointer active:scale-[0.985] transition-transform select-none rounded-[16px] overflow-hidden shadow-xs hover:shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bank.image}
                        alt={bank.name}
                        className="w-full h-auto block select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  ))}

                  {filteredBanks.length === 0 && (
                    <div className="w-full py-12 text-center text-gray-500 text-sm font-medium">
                      No banks found matching &quot;{bankSearchTerm}&quot;
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SAVED BANK RECEIVERS MODAL (Accessible via contact icon on Bank Account input) */}
        <AnimatePresence>
          {isSavedBankModalOpen && (
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
                className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88%]"
              >
                {/* Modal Header */}
                <div className="bg-[#7a1c7d] px-4 py-3 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-[#f2bf9d]" />
                    <h3 className="font-bold text-sm tracking-wide">
                      የተቀመጡ የባንክ ተቀባዮች (Saved Bank Accounts)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSavedBankModalOpen(false);
                      setIsAddSavedBankModalOpen(false);
                      setNewBankReceiverAcc('');
                      setNewBankReceiverName('');
                    }}
                    className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Content */}
                <div className="p-3.5 overflow-y-auto flex-1 space-y-3">
                  {isAddSavedBankModalOpen ? (
                    /* Add Bank Receiver Form */
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#7a1c7d] border-b pb-1">
                        አዲስ የባንክ ሂሳብ መዝግብ (Add Bank Account)
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ባንክ ይምረጡ (Select Bank)
                        </label>
                        <select
                          value={newBankReceiverBankId}
                          onChange={(e) => setNewBankReceiverBankId(e.target.value)}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800 bg-white"
                        >
                          {ALL_BANKS.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          የሂሳብ ቁጥር (Bank Account Number)
                        </label>
                        <input
                          type="text"
                          value={newBankReceiverAcc}
                          onChange={(e) => setNewBankReceiverAcc(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                          placeholder="e.g. 01320847291000"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          የተቀባይ ስም (Receiver Name)
                        </label>
                        <input
                          type="text"
                          value={newBankReceiverName}
                          onChange={(e) => setNewBankReceiverName(e.target.value)}
                          placeholder="e.g. ABEBE BIKILA"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newBankReceiverAcc.trim() || !newBankReceiverName.trim()) return;
                            const targetBank = ALL_BANKS.find((b) => b.id === newBankReceiverBankId) || ALL_BANKS[0];
                            const item: SavedBankReceiver = {
                              id: `bank-rec-${Date.now()}`,
                              bankId: targetBank.id,
                              bankName: targetBank.name,
                              accountNumber: newBankReceiverAcc.trim(),
                              accountName: newBankReceiverName.trim(),
                            };
                            setSavedBankReceivers((prev) => [item, ...prev]);
                            setIsAddSavedBankModalOpen(false);
                            setNewBankReceiverAcc('');
                            setNewBankReceiverName('');
                          }}
                          className="flex-1 bg-[#7a1c7d] hover:bg-[#68176b] text-white py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          አስቀምጥ (Save)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddSavedBankModalOpen(false);
                            setNewBankReceiverAcc('');
                            setNewBankReceiverName('');
                          }}
                          className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          ተመለስ (Cancel)
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* List of Saved Bank Accounts */
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600">
                          የተቀመጡ አካውንቶች ({savedBankReceivers.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddSavedBankModalOpen(true)}
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#7a1c7d] hover:underline cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>አዲስ መዝግብ</span>
                        </button>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                        {savedBankReceivers.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400">
                            ምንም የተቀመጠ የባንክ ሂሳብ የለም (No saved bank accounts)
                          </div>
                        ) : (
                          savedBankReceivers.map((r) => {
                            const bObj = ALL_BANKS.find((b) => b.id === r.bankId);
                            return (
                              <div
                                key={r.id}
                                className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-purple-50/40 hover:border-purple-300 transition-all cursor-pointer"
                                onClick={() => {
                                  if (bObj) setSelectedBank(bObj);
                                  setBankAccountNumber(r.accountNumber);
                                  setBankReceiverName(r.accountName);
                                  setIsSavedBankModalOpen(false);
                                }}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                                  <div className="w-8 h-8 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] flex items-center justify-center font-bold text-xs shrink-0">
                                    {r.accountName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-800 truncate">
                                      {r.accountName}
                                    </div>
                                    <div className="text-[11px] font-medium text-[#7a1c7d] truncate">
                                      {r.bankName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate font-mono">
                                      {r.accountNumber}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSavedBankReceivers((prev) => prev.filter((item) => item.id !== r.id));
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                                  aria-label="Delete saved account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SELECT WALLETS BOTTOM SHEET (Fixed sheet_header.png + real-time search + smoothly scrollable wallet cards) */}
        <AnimatePresence>
          {isSelectWalletSheetOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex flex-col justify-end select-none"
              onClick={() => setIsSelectWalletSheetOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-[74%] bg-[#f2f2f2] rounded-t-[28px] overflow-hidden flex flex-col shadow-2xl relative"
              >
                {/* 1. FIXED HEADER: sheet_header.png (Handle, Select Banks title & Search Bar) */}
                <div
                  className="relative shrink-0 w-full select-none"
                  style={{ aspectRatio: '604 / 142' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/wallets/sheet_header.png"
                    alt="Select Banks Header"
                    className="w-full h-full object-fill pointer-events-none select-none block"
                    draggable={false}
                  />

                  {/* Top drag handle / close area */}
                  <button
                    type="button"
                    onClick={() => setIsSelectWalletSheetOpen(false)}
                    className="absolute top-0 left-0 right-0 h-[38%] bg-transparent cursor-pointer border-0 outline-none"
                    aria-label="Close"
                  />

                  {/* Interactive Search Input mapped directly over the 'Search Banks' input box */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '39.0%',
                      left: '23.5%',
                      width: '67.0%',
                      height: '48.0%',
                    }}
                    className="flex items-center"
                  >
                    {walletSearchTerm && (
                      <div className="absolute inset-0 bg-white rounded-r-full -z-10" />
                    )}
                    <input
                      type="text"
                      value={walletSearchTerm}
                      onChange={(e) => setWalletSearchTerm(e.target.value)}
                      placeholder=""
                      className="w-full h-full bg-transparent border-none outline-none text-[#1a1a1a] text-[13px] sm:text-[14px] font-normal px-1"
                    />
                    {walletSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setWalletSearchTerm('')}
                        className="text-gray-400 hover:text-gray-700 text-sm font-bold pr-2.5 cursor-pointer"
                        aria-label="Clear Search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. SCROLLABLE WALLETS LIST: Smoothly scrolls underneath the fixed header starting right where the cards begin */}
                <div className="flex-1 w-full overflow-y-auto overflow-x-hidden px-3.5 pt-2 pb-8 space-y-2.5 scroll-smooth">
                  {filteredWallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      onClick={() => {
                        setSelectedWallet(wallet);
                        setIsSelectWalletSheetOpen(false);
                        setWalletSearchTerm('');
                        setWalletTransferError('');
                        if (walletAccountNumber.trim().length >= 5) {
                          const matched = savedWalletReceivers.find(
                            (r) => r.accountNumber === walletAccountNumber.trim() && r.walletId === wallet.id
                          );
                          if (matched) {
                            setWalletReceiverName(matched.accountName);
                          }
                        }
                      }}
                      className="w-full cursor-pointer active:scale-[0.985] transition-transform select-none rounded-[16px] overflow-hidden shadow-xs hover:shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={wallet.image}
                        alt={wallet.name}
                        className="w-full h-auto block select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  ))}

                  {filteredWallets.length === 0 && (
                    <div className="w-full py-12 text-center text-gray-500 text-sm font-medium">
                      No wallet or micro finance found matching &quot;{walletSearchTerm}&quot;
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SAVED WALLET RECEIVERS MODAL */}
        <AnimatePresence>
          {isSavedWalletModalOpen && (
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
                className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88%]"
              >
                {/* Modal Header */}
                <div className="bg-[#7a1c7d] px-4 py-3 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-[#f2bf9d]" />
                    <h3 className="font-bold text-sm tracking-wide">
                      የተቀመጡ ዋሌት ተቀባዮች (Saved Wallet Accounts)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSavedWalletModalOpen(false);
                      setIsAddSavedWalletModalOpen(false);
                      setNewWalletReceiverAcc('');
                      setNewWalletReceiverName('');
                    }}
                    className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Content */}
                <div className="p-3.5 overflow-y-auto flex-1 space-y-3">
                  {isAddSavedWalletModalOpen ? (
                    /* Add Wallet Receiver Form */
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#7a1c7d] border-b pb-1">
                        አዲስ የዋሌት ሂሳብ መዝግብ (Add Wallet Account)
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ዋሌት ይምረጡ (Select Wallet / Microfinance)
                        </label>
                        <select
                          value={newWalletReceiverWalletId}
                          onChange={(e) => setNewWalletReceiverWalletId(e.target.value)}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800 bg-white"
                        >
                          {ALL_WALLETS.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          የሂሳብ ቁጥር (Wallet Account Number)
                        </label>
                        <input
                          type="text"
                          value={newWalletReceiverAcc}
                          onChange={(e) => setNewWalletReceiverAcc(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                          placeholder="e.g. 0911223344"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          የተቀባይ ስም (Receiver Name)
                        </label>
                        <input
                          type="text"
                          value={newWalletReceiverName}
                          onChange={(e) => setNewWalletReceiverName(e.target.value)}
                          placeholder="e.g. ABEBE BIKILA"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newWalletReceiverAcc.trim() || !newWalletReceiverName.trim()) return;
                            const targetWallet = ALL_WALLETS.find((w) => w.id === newWalletReceiverWalletId) || ALL_WALLETS[0];
                            const item: SavedWalletReceiver = {
                              id: `wallet-rec-${Date.now()}`,
                              walletId: targetWallet.id,
                              walletName: targetWallet.name,
                              accountNumber: newWalletReceiverAcc.trim(),
                              accountName: newWalletReceiverName.trim(),
                            };
                            setSavedWalletReceivers((prev) => [item, ...prev]);
                            setIsAddSavedWalletModalOpen(false);
                            setNewWalletReceiverAcc('');
                            setNewWalletReceiverName('');
                          }}
                          className="flex-1 bg-[#7a1c7d] hover:bg-[#68176b] text-white py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          አስቀምጥ (Save)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddSavedWalletModalOpen(false);
                            setNewWalletReceiverAcc('');
                            setNewWalletReceiverName('');
                          }}
                          className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          ተመለስ (Cancel)
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* List of Saved Wallet Accounts */
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600">
                          የተቀመጡ ዋሌቶች ({savedWalletReceivers.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddSavedWalletModalOpen(true)}
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#7a1c7d] hover:underline cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>አዲስ መዝግብ</span>
                        </button>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                        {savedWalletReceivers.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400">
                            ምንም የተቀመጠ የዋሌት ሂሳብ የለም (No saved wallet accounts)
                          </div>
                        ) : (
                          savedWalletReceivers.map((r) => {
                            const wObj = ALL_WALLETS.find((w) => w.id === r.walletId);
                            return (
                              <div
                                key={r.id}
                                className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-purple-50/40 hover:border-purple-300 transition-all cursor-pointer"
                                onClick={() => {
                                  if (wObj) setSelectedWallet(wObj);
                                  setWalletAccountNumber(r.accountNumber);
                                  setWalletReceiverName(r.accountName);
                                  setIsSavedWalletModalOpen(false);
                                }}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                                  <div className="w-8 h-8 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] flex items-center justify-center font-bold text-xs shrink-0">
                                    {r.accountName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-800 truncate">
                                      {r.accountName}
                                    </div>
                                    <div className="text-[11px] font-medium text-[#7a1c7d] truncate">
                                      {r.walletName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate font-mono">
                                      {r.accountNumber}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSavedWalletReceivers((prev) => prev.filter((item) => item.id !== r.id));
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                                  aria-label="Delete saved account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SAVED RECEIVERS MANAGEMENT MODAL (Accessible on Step 6 CBE Account and Step 15 Phone Number via long-press on Search icon or Contact picker) */}
        <AnimatePresence>
          {isReceiversModalOpen && (
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
                className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88%]"
              >
                {/* Modal Header */}
                <div className="bg-[#7a1c7d] px-4 py-3 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-[#f2bf9d]" />
                    <h3 className="font-bold text-sm tracking-wide">
                      {currentStep === 15 || transferSource === 'phone_number'
                        ? 'የስልክ ቁጥር ተቀባዮች (Saved Contacts)'
                        : 'የተቀመጡ ተቀባዮች (Saved Receivers)'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReceiversModalOpen(false);
                      setIsAddingNewReceiver(false);
                      setEditingReceiverId(null);
                      setModalFormError('');
                    }}
                    className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-3.5 overflow-y-auto flex-1 space-y-3">
                  {isAddingNewReceiver || editingReceiverId ? (
                    /* Add or Edit Form */
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#7a1c7d] border-b pb-1">
                        {editingReceiverId ? 'ተቀባይ አስተካክል (Edit Receiver)' : 'አዲስ ተቀባይ መዝግብ (Add Receiver)'}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {currentStep === 15 || transferSource === 'phone_number'
                            ? 'የስልክ ቁጥር (Phone Number)'
                            : 'የሂሳብ ቁጥር (Account Number)'}
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={modalAccNum}
                          onChange={(e) => setModalAccNum(e.target.value.replace(/[^0-9+]/g, ''))}
                          placeholder={
                            currentStep === 15 || transferSource === 'phone_number'
                              ? '09... ወይም 07...'
                              : '1000...'
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          የተቀባይ ስም (Receiver Name)
                        </label>
                        <input
                          type="text"
                          value={modalAccName}
                          onChange={(e) => setModalAccName(e.target.value)}
                          placeholder="Ram"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#7a1c7d] text-slate-800"
                        />
                      </div>

                      {modalFormError && (
                        <div className="text-[11px] font-medium text-red-600 bg-red-50 p-2 rounded-lg">
                          {modalFormError}
                        </div>
                      )}

                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveReceiver}
                          className="flex-1 bg-[#7a1c7d] hover:bg-[#68176b] text-white py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          አስቀምጥ (Save)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewReceiver(false);
                            setEditingReceiverId(null);
                            setModalFormError('');
                          }}
                          className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          ተመለስ (Cancel)
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* List of Saved Receivers (Strictly separated per page: Step 15 = Phone Contacts, Step 6 = CBE Accounts) */
                    (() => {
                      const isPhoneContext = currentStep === 15 || transferSource === 'phone_number';
                      const currentList = isPhoneContext ? savedPhoneReceivers : savedAccountReceivers;
                      return (
                        <>
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-600">
                              {isPhoneContext
                                ? `የተቀመጡ ስልኮች (${currentList.length})`
                                : `የተቀመጡ የCBE ሂሳቦች (${currentList.length})`}
                            </span>
                            <button
                              type="button"
                              onClick={handleStartAddReceiver}
                              className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#7a1c7d] hover:underline cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isPhoneContext ? 'አዲስ ስልክ መዝግብ' : 'አዲስ ሂሳብ መዝግብ'}</span>
                            </button>
                          </div>

                          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                            {currentList.length === 0 ? (
                              <div className="text-center py-6 text-xs text-slate-400">
                                {isPhoneContext
                                  ? 'ምንም የተቀመጠ ስልክ ቁጥር የለም (No saved contacts)'
                                  : 'ምንም የተቀመጠ የሂሳብ ቁጥር የለም (No saved accounts)'}
                              </div>
                            ) : (
                              currentList.map((r) => (
                                <div
                                  key={r.id}
                                  className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-purple-50/40 hover:border-purple-300 transition-all cursor-pointer"
                                  onClick={() => handleSelectReceiver(r)}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                                    <div className="w-8 h-8 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] flex items-center justify-center font-bold text-xs shrink-0">
                                      {r.accountName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-slate-800 truncate">
                                        {r.accountName}
                                      </div>
                                      <div className="text-[11px] font-mono text-slate-500 truncate">
                                        {r.accountNumber}
                                      </div>
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center space-x-1 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditReceiver(r)}
                                      className="p-1.5 text-slate-400 hover:text-[#7a1c7d] hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                                      aria-label="Edit receiver"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReceiver(r.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      aria-label="Delete receiver"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              </motion.div>
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

        {/* AUTHENTIC CALCULATOR MODAL DIALOG (Matches calculator .png, Screenshot_20261108-002518.png, calculator page .png) */}
        <AnimatePresence>
          {isCalculatorOpen && (
            <motion.div
              key="calculator-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsCalculatorOpen(false)}
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[0.5px] flex items-center justify-center p-4 select-none"
            >
              <motion.div
                key="calculator-modal"
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[335px] bg-[#EDE7F2] rounded-[28px] p-4 sm:p-4.5 shadow-2xl border border-purple-200/50 flex flex-col"
              >
                {/* 1. HEADER ROW */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Purple square icon with white math signs matching images */}
                    <div className="w-7 h-7 rounded-lg bg-[#8B278E] flex items-center justify-center text-white shadow-xs">
                      <div className="grid grid-cols-2 gap-0.5 text-[9px] font-bold leading-none text-center">
                        <span>-</span>
                        <span>+</span>
                        <span>÷</span>
                        <span>=</span>
                      </div>
                    </div>
                    <span className="text-[#1c1b1f] text-[17px] font-semibold tracking-tight">
                      Calculator
                    </span>
                  </div>

                  {/* Close 'X' button */}
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(false)}
                    className="text-[#49454f] hover:text-black p-1 active:scale-95 transition-transform cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>

                {/* Divider Line */}
                <div className="h-[1px] bg-[#CAB6CF]/70 mt-3 mb-3.5 mx-0.5" />

                {/* 2. WHITE DISPLAY AREA (Live preview: expression on top, = result in bold green below) */}
                <div className="w-full bg-white rounded-[18px] p-3.5 mb-3.5 border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] flex flex-col justify-center min-h-[76px] text-right">
                  {calculatorLiveResult !== null ? (
                    <>
                      <span className="text-[#49454f] text-[15px] font-normal leading-tight tracking-normal">
                        {calculatorExpression}
                      </span>
                      <span className="text-[#15803d] text-[26px] font-bold leading-tight tracking-tight mt-0.5">
                        = {calculatorLiveResult}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#1c1b1f] text-[26px] sm:text-[28px] font-normal leading-tight tracking-tight">
                      {calculatorDisplay || '0'}
                    </span>
                  )}
                </div>

                {/* 3. KEYPAD GRID (4 columns, 5 rows) */}
                <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                  {/* Row 1 */}
                  <button
                    type="button"
                    onClick={handleCalcClear}
                    className="col-span-2 h-11 sm:h-12 bg-[#E23636] active:bg-[#c62828] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcBackspace}
                    className="col-span-1 h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                    aria-label="Backspace"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcOperator('÷')}
                    className="col-span-1 h-11 sm:h-12 bg-[#8B278E] active:bg-[#701e73] text-white font-bold text-[22px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    ÷
                  </button>

                  {/* Row 2 */}
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('7')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    7
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('8')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    8
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('9')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    9
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcOperator('×')}
                    className="h-11 sm:h-12 bg-[#8B278E] active:bg-[#701e73] text-white font-bold text-[20px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    ×
                  </button>

                  {/* Row 3 */}
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('4')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    4
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('5')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('6')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    6
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcOperator('-')}
                    className="h-11 sm:h-12 bg-[#8B278E] active:bg-[#701e73] text-white font-bold text-[22px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    -
                  </button>

                  {/* Row 4 */}
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('1')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('2')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('3')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    3
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcOperator('+')}
                    className="h-11 sm:h-12 bg-[#8B278E] active:bg-[#701e73] text-white font-bold text-[22px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    +
                  </button>

                  {/* Row 5 */}
                  <button
                    type="button"
                    onClick={handleCalcToggleSign}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    ±
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcDigit('0')}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[18px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcDecimal}
                    className="h-11 sm:h-12 bg-[#757575] active:bg-[#616161] text-white font-bold text-[22px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcEquals}
                    className="h-11 sm:h-12 bg-[#8B278E] active:bg-[#701e73] text-white font-bold text-[22px] rounded-[16px] shadow-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    =
                  </button>
                </div>

                {/* 4. BOTTOM ACTION BUTTONS */}
                <div className="grid grid-cols-2 gap-3 mt-3.5">
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(false)}
                    className="py-3 bg-[#757575] hover:bg-[#616161] active:scale-[0.98] text-white font-medium text-[15px] rounded-[16px] shadow-xs transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcInsert}
                    className="py-3 bg-[#8B278E] hover:bg-[#701e73] active:scale-[0.98] text-white font-medium text-[15px] rounded-[16px] shadow-xs transition-all cursor-pointer text-center"
                  >
                    Insert
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notice Toast for regular clicks */}
        <AnimatePresence>
          {cbeNotice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1f]/90 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-medium flex items-center gap-2 backdrop-blur-md"
            >
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{cbeNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Samsung Messages (One UI) Application (Opened exclusively via long-press on Chat bot in Others) */}
        <AnimatePresence>
          {showSamsungMessages && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute inset-0 z-50 bg-white"
            >
              <SamsungMessagesApp onClose={() => setShowSamsungMessages(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
