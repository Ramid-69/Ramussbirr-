import fs from 'fs';

export interface StoredReceipt {
  ref: string;
  amt: string;
  date: string;
  rec: string;
  name: string;
  user: string;
  acc: string;
  reason: string;
  bank?: string;
  status?: string;
  orderId?: string;
  serviceCharge?: string;
  vat?: string;
  totalCharges?: string;
  totalPaidAmount?: string;
}

/**
 * Exact URL & parameters decoded verbatim from the untouched original PNG QR codes
 * (public/assets/cbe_authentic_receipt_qr_exact.png, public/screens/receipt_page.png,
 * and public/screens/official_receipt_hq.png).
 */
export const ORIGINAL_QR_URL =
  'https://cbepay1.cbe.com.et/aureceipt?TID=DJM51SKYIQ3&PH=251959754788';
export const ORIGINAL_QR_TID = 'DJM51SKYIQ3';
export const ORIGINAL_QR_PH = '251959754788';

const LATEST_KEY = '__LATEST__';
const STORAGE_FILE = '/tmp/cbe_receipts.json';

// In-memory cache pre-seeded with user's authentic screenshots
const memoryStore = new Map<string, StoredReceipt>();
let lastLoadedMtime = 0;

// Default fallback for any unknown reference
export const DEFAULT_RECEIPT: StoredReceipt = {
  ref: 'FT1384476084',
  amt: '10.00',
  date: '2026-10-29 15:50',
  rec: '1000278947339',
  name: 'Ram',
  user: 'AYMEN NIGATU YIMAM',
  acc: '959754788',
  reason: 'Wallet Transfer',
  status: 'Completed',
  orderId: 'FT1384476084',
};

// Seed with default transactions from user's screenshots
const INITIAL_SEEDS: StoredReceipt[] = [
  {
    ref: 'FT262413JRB4',
    amt: '740.00',
    date: '2026-10-27 11:56:20',
    rec: '1000760389289',
    name: 'Miss Simera Gofer Abdisa',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Customer transfer to CBE account',
    status: 'Completed',
    orderId: '9V8GPL5D',
  },
  {
    ref: '9V8GPL5D',
    amt: '740.00',
    date: '2026-10-27 11:56:20',
    rec: '1000760389289',
    name: 'Miss Simera Gofer Abdisa',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Customer transfer to CBE account',
    status: 'Completed',
    orderId: '9V8GPL5D',
  },
  {
    ref: 'FT1384476084',
    amt: '10.00',
    date: '2026-10-29 15:50',
    rec: '1000278947339',
    name: 'Ram',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Wallet Transfer',
    status: 'Completed',
    orderId: 'FT1384476084',
  },
  {
    ref: 'FT7321557800',
    amt: '8.00',
    date: '2026-10-29 15:53',
    rec: '1000278947339',
    name: 'Ram',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Wallet Transfer',
    status: 'Completed',
    orderId: 'FT7321557800',
  },
  {
    ref: 'FT8653931662',
    amt: '5.00',
    date: '2026-10-29 15:03',
    rec: '0715095670',
    name: 'Fozia Mossa Mohammed',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Wallet Transfer',
    status: 'Completed',
    orderId: 'FT8653931662',
  },
  {
    ref: 'DJM51SKYIQ3',
    amt: '10.00',
    date: '2026-10-29 15:50',
    rec: '1000278947339',
    name: 'Ram',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'Wallet Transfer',
    status: 'Completed',
    orderId: 'DJM51SKYIQ3',
  },
  {
    ref: 'DJT61TBG8Y2',
    amt: '300.00',
    date: '2026-10-29 12:40',
    rec: '1000****9843',
    name: 'SANI AHMED MOHAMMED',
    user: 'AYMEN NIGATU YIMAM',
    acc: '959754788',
    reason: 'TransferfromMMToBank by Customer to Org',
    status: 'Completed',
    orderId: 'FT263027RY7L',
  },
];

for (const seed of INITIAL_SEEDS) {
  memoryStore.set(seed.ref, seed);
}

function syncFromDisk(): void {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return;
    const stat = fs.statSync(STORAGE_FILE);
    if (stat.mtimeMs <= lastLoadedMtime) return;
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      memoryStore.set(k, v as StoredReceipt);
    }
    lastLoadedMtime = stat.mtimeMs;
  } catch {
    // ignore
  }
}

syncFromDisk();

/**
 * Extracts a TID / ref from either a raw ID or the full scanned QR URL.
 */
export function extractReceiptRef(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.includes('://') || trimmed.includes('?')) {
    try {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://cbepay1.cbe.com.et${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
      return (
        urlObj.searchParams.get('TID') ||
        urlObj.searchParams.get('tid') ||
        urlObj.searchParams.get('ref') ||
        ''
      ).trim();
    } catch {
      // fall through
    }
  }
  return trimmed;
}

export function saveReceipt(data: StoredReceipt): void {
  if (!data || !data.ref) return;
  syncFromDisk();

  const cleanRef = data.ref.trim();
  const normalized: StoredReceipt = { ...data, ref: cleanRef };

  memoryStore.set(cleanRef, normalized);
  memoryStore.set(cleanRef.toUpperCase(), normalized);
  memoryStore.set(cleanRef.toLowerCase(), normalized);

  // Track latest live transaction so scanning the untouched original PNG QR code
  // (https://cbepay1.cbe.com.et/aureceipt?TID=DJM51SKYIQ3&PH=251959754788)
  // resolves to the live transaction receipt immediately.
  memoryStore.set(LATEST_KEY, normalized);

  if (normalized.orderId) {
    const oId = normalized.orderId.trim();
    memoryStore.set(oId, normalized);
    memoryStore.set(oId.toUpperCase(), normalized);
  }

  // Also index by 8-character TID
  if (cleanRef.length >= 8) {
    const last8 = cleanRef.slice(-8).toUpperCase();
    memoryStore.set(last8, normalized);
  }
  if (cleanRef.toUpperCase().startsWith('FT') && cleanRef.length >= 10) {
    memoryStore.set(cleanRef.slice(2, 10).toUpperCase(), normalized);
  }

  try {
    const obj: Record<string, StoredReceipt> = {};
    for (const [k, v] of memoryStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    lastLoadedMtime = fs.statSync(STORAGE_FILE).mtimeMs;
  } catch {
    // ignore
  }
}

export function getReceipt(ref: string): StoredReceipt {
  syncFromDisk();

  const clean = extractReceiptRef(ref);

  // When scanned from the untouched original PNG QR code (TID=DJM51SKYIQ3),
  // or requesting the latest transaction, return the latest live transaction if saved.
  if (!clean || clean.toUpperCase() === ORIGINAL_QR_TID || clean === LATEST_KEY || clean.toLowerCase() === 'latest') {
    const latest = memoryStore.get(LATEST_KEY);
    if (latest) return latest;
    return memoryStore.get(ORIGINAL_QR_TID) || DEFAULT_RECEIPT;
  }

  if (memoryStore.has(clean)) return memoryStore.get(clean)!;
  if (memoryStore.has(clean.toUpperCase())) return memoryStore.get(clean.toUpperCase())!;

  // Try case-insensitive or partial match (skipping internal __LATEST__ key)
  const upper = clean.toUpperCase();
  for (const [k, v] of memoryStore.entries()) {
    if (k === LATEST_KEY) continue;
    const kUpper = k.toUpperCase();
    if (kUpper === upper || (upper.length >= 8 && kUpper.includes(upper)) || (kUpper.length >= 8 && upper.includes(kUpper))) {
      return v;
    }
  }

  return { ...DEFAULT_RECEIPT, ref: clean };
}
