import fs from 'fs';
import path from 'path';

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
}

const STORAGE_FILE = '/tmp/cbe_receipts.json';

// In-memory cache pre-seeded with user's authentic screenshots
const memoryStore = new Map<string, StoredReceipt>();

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

// Load persisted transactions on startup
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      memoryStore.set(k, v as StoredReceipt);
    }
  }
} catch {
  // ignore
}

export function saveReceipt(data: StoredReceipt): void {
  if (!data || !data.ref) return;
  memoryStore.set(data.ref, data);
  try {
    const obj: Record<string, StoredReceipt> = {};
    for (const [k, v] of memoryStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

export function getReceipt(ref: string): StoredReceipt {
  if (memoryStore.has(ref)) {
    return memoryStore.get(ref)!;
  }
  // Try case-insensitive lookup
  for (const [k, v] of memoryStore.entries()) {
    if (k.toLowerCase() === ref.toLowerCase()) {
      return v;
    }
  }
  return { ...DEFAULT_RECEIPT, ref };
}
