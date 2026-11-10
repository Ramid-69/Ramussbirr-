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

// Authentic initial seeds directly matching user screenshots
const INITIAL_SMS_SEEDS: SmsMessage[] = [
  // --- CBEBirr thread ---
  {
    id: 'sms-cbe-1',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'DJM21SJFE7S ግዢ ፈፅመዋል፡፡አሁን ያሉት ቀሪ ሂሳብ 15.00Br. ነው፡፡እናመሰግናለን!',
    timestamp: '3:31 PM',
    date: '2026-10-22 15:31:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    txnId: 'DJM21SJFE7S',
    balance: '15.00',
  },
  {
    id: 'sms-cbe-2',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'Dear AYMEN, you have successfully transferred 1.00 Br to 0715095670 - Fayyee Lammeessa Didhaa (Transfer) on 22-10-2026 21:36:00. Txn ID DJM51SKY. Your balance is 13.99 Br. Thank You! CBEBirr transaction Receipt. Com https://cbepay1.cbe.com.et/aureceipt?TID=DJM51SKY&PH=+251959754788',
    timestamp: '9:36 PM',
    date: '2026-10-22 21:36:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    amount: '1.00',
    recipient: 'Fayyee Lammeessa Didhaa',
    recipientAccount: '0715095670',
    txnId: 'DJM51SKY',
    balance: '13.99',
    receiptUrl: 'https://cbepay1.cbe.com.et/aureceipt?TID=DJM51SKY&PH=+251959754788',
  },
  {
    id: 'sms-cbe-3',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'ውድ ደንበኛ የ 10.00Br. አየር ሰአት ከ 959754788 – AYMEN NIGATU YIMAM በቀን 22/10/26 22:15 ተሞልቶሎታል። እናመሰግናለን!',
    timestamp: '10:15 PM',
    date: '2026-10-22 22:15:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    amount: '10.00',
  },
  {
    id: 'sms-cbe-4',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'ውድ ደንበኛ የ 10.00Br. አየር ሰዓት በቀን 22/10/26 22:15 በደረሰኝ ቁጥር DJM81SL25JM ግዢ ፈፅመዋል፡፡አሁን ያሉት ቀሪ ሂሳብ 3.99Br. ነው፡፡እናመሰግናለን!',
    timestamp: '10:15 PM',
    date: '2026-10-22 22:15:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    amount: '10.00',
    txnId: 'DJM81SL25JM',
    balance: '3.99',
  },
  {
    id: 'sms-cbe-5',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'ውድ AYMEN, 300.00Br. ከ 0965848508 – abdu siraj siraj በቀን 29/10/26 12:20 በደረሰኝ ቁጥር DJT01TBDK7Y ተልኮሎታል። አሁን ያሉት ቀሪ ሂሳብ 303.99Br. ነው፡፡ እናመሰግናለን!',
    timestamp: '12:20 PM',
    date: '2026-10-29 12:20:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    amount: '300.00',
    txnId: 'DJT01TBDK7Y',
    balance: '303.99',
  },
  {
    id: 'sms-cbe-6',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'Dear AYMEN, you have successfully transferred 300.00 Br to 1000440979843 - SANI AHMED MOHAMMED (Transfer) on 29-10-2026 12:40:02. Txn ID DJT61TBG. Your balance is 3.99 Br. Thank You! CBEBirr transaction Receipt. Com https://cbepay1.cbe.com.et/aureceipt?TID=DJT61TBG&PH=+251959754788',
    timestamp: '12:40 PM',
    date: '2026-10-29 12:40:02',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
    amount: '300.00',
    recipient: 'SANI AHMED MOHAMMED',
    recipientAccount: '1000440979843',
    fullName: 'AYMEN NIGATU YIMAM',
    txnId: 'DJT61TBG',
    reference: 'FT263027RY7L',
    balance: '3.99',
    receiptUrl: 'https://cbepay1.cbe.com.et/aureceipt?TID=DJT61TBG&PH=+251959754788',
  },
  {
    id: 'sms-cbe-7',
    conversationId: 'CBEBirr',
    sender: 'CBEBirr',
    senderName: 'CBEBirr',
    text: 'ይቅርታ ያስገቡት ሚስጥር ቁጥር የተሳሳተ ነው:: እባክዎ እንደገና ይሞክሩ:: እናመሰግናለን!',
    timestamp: 'Nov 1',
    date: '2026-11-01 14:10:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'CBEBirr',
  },

  // --- Safaricom thread ---
  {
    id: 'sms-saf-1',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ወይም የአየር ሰአት ብድር ለማግኘት ወደ *711# ይደውሉ::',
    timestamp: '8:14 PM',
    date: '2026-11-06 20:14:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-2',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ውድ ደንበኛችን፥ ቀሪ የአየር ሰዓት ሒሳብዎ 5.00 ብር ነው:: የሚያበቃበት ቀን:04/04/2027 19:28:: በሽ ኮምፖ: 90.51 ሜ.ባ፤ የሚያበቃበት ቀን:06/11/2026 19:28:: እናመሰግናለን',
    timestamp: '8:25 PM',
    date: '2026-11-06 20:25:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-3',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ውድ ደንበኛችን፥ ቀሪ የአየር ሰዓት ሒሳብዎ 0.00 ብር ነው:: የሚያበቃበት ቀን:04/04/2027 19:28:: በሽ ኮምፖ: 239.37 ሜ.ባ፤ የሚያበቃበት ቀን:06/11/2026 20:14:: እናመሰግናለን',
    timestamp: '8:50 PM',
    date: '2026-11-06 20:50:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-4',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ውድ ደንበኛችን፥ ያልዎት ዕለታዊ የኢንተርኔት ጥቅል 100 MB ሜ.ባ ነው:: የሚያበቃበት ጊዜ: 06-11-2026 20:14:00',
    timestamp: '9:24 PM',
    date: '2026-11-06 21:24:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-5',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ውድ ደንበኛችን፥ የ ዕለታዊ የኢንተርኔት ጥቅል ጥቅል አልቋል:: አዲስ ጥቅል ለመግዛት እባክዎ ወደ *777# ይደውሉ:: እናመሰግናለን::',
    timestamp: '9:51 PM',
    date: '2026-11-06 21:51:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-6',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'በትሳኬ ሁኔታ 15.00 ብር ሞልተዋል:: ያለዎት ሂሳብ : 15.00 ብር ነው:: የሚያበቃበት ጊዜ: 04-04-2027 21:52:38 የባለ 200ጊ.ባ እና 500ጊ.ባ ሜጋ ኢንተርኔት ጥቅሎችን ለማግኘት ወደ *777*2*1# ይደውሉ ወይም መተግበሪያውን ይጠቀሙ:-https://bit.ly/M-PESA-SAFARICOM-ETHIOPIA',
    timestamp: '9:52 PM',
    date: '2026-11-06 21:52:38',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'Safaricom M-PESA',
    amount: '15.00',
    balance: '15.00',
  },
  {
    id: 'sms-saf-7',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'የ15ብር 600 ሜጋ ለ24 ሰዓት ጥቅል በተሳካ ሁኔታ ገዝተዋል:: የሚያበቃበት ጊዜ: 06-11-2026 21:53::',
    timestamp: '9:53 PM',
    date: '2026-11-06 21:53:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-saf-8',
    conversationId: 'Safaricom',
    sender: 'Safaricom',
    senderName: 'Safaricom',
    text: 'ውድ ደንበኛችን፥ የአየር ሰዓትዎን ጨርሰዋል፡፡ ካርድ ለመሙላት ወደ *705*የካርድ ቁጥር# ይደውሉ ወይም የአየር ሰአት ብድር ለማግኘት ወደ *711# ይደውሉ::',
    timestamp: '9:53 PM',
    date: '2026-11-06 21:53:10',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },

  // --- 127 (telebirr) thread ---
  {
    id: 'sms-tel-1',
    conversationId: '127',
    sender: '127',
    senderName: '127',
    text: 'በቴሌ-ብር ስለተገለገሉ እናመሰግናለን ኢትዮ ቴሌኮም',
    timestamp: '2:56 PM',
    date: '2026-11-04 14:56:00',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'telebirr',
  },
  {
    id: 'sms-tel-2',
    conversationId: '127',
    sender: '127',
    senderName: '127',
    text: 'ውድ Aymen በ 04/11/2026 15:13:40. ለ 251959754788 Daily Birr 5 for 120 MB ጥቅል ለመግዛት 5.00 ብር ከፍለዋል፡፡ የግንኙነት ቁጥርዎ DK49ORBLRT ነው፡፡ ያለዎት ቀሪ ሂሳብ 210.00 ብር ነው፡፡ የክፍያ መረጃዎን ለማውረድ እባክዎ ይህን ሊንክ ይጫኑ: https://transactioninfo.ethiotelecom.et/receipt/DK49ORBLRT በቴሌ-ብር ስለተገለገሉ እናመሰግናለን ኢትዮ ቴሌኮም',
    timestamp: '3:13 PM',
    date: '2026-11-04 15:13:40',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'telebirr',
    amount: '5.00',
    balance: '210.00',
    txnId: 'DK49ORBLRT',
    receiptUrl: 'https://transactioninfo.ethiotelecom.et/receipt/DK49ORBLRT',
  },
  {
    id: 'sms-tel-3',
    conversationId: '127',
    sender: '127',
    senderName: '127',
    text: 'ውድ Aymen በ 04/11/2026 22:26:42. ለ 251959754788 Daily Birr 5 for 120 MB ጥቅል ለመግዛት 5.00 ብር ከፍለዋል፡፡ የግንኙነት ቁጥርዎ DK44PEH7J2 ነው፡፡ ያለዎት ቀሪ ሂሳብ 205.00 ብር ነው፡፡ የክፍያ መረጃዎን ለማውረድ እባክዎ ይህን ሊንክ ይጫኑ: https://transactioninfo.ethiotelecom.et/receipt/DK44PEH7J2 በቴሌ-ብር ስለተገለገሉ እናመሰግናለን ኢትዮ ቴሌኮም',
    timestamp: '10:27 PM',
    date: '2026-11-04 22:26:42',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'telebirr',
    amount: '5.00',
    balance: '205.00',
    txnId: 'DK44PEH7J2',
    receiptUrl: 'https://transactioninfo.ethiotelecom.et/receipt/DK44PEH7J2',
  },
  {
    id: 'sms-tel-4',
    conversationId: '127',
    sender: '127',
    senderName: '127',
    text: 'ውድ Aymen በ 05/11/2026 10:49:08. ለ 251959754788 Daily Birr 5 for 120 MB ጥቅል ለመግዛት 5.00 ብር ከፍለዋል፡፡ የግንኙነት ቁጥርዎ DK54Q3CYIQ ነው፡፡ ያለዎት ቀሪ ሂሳብ 200.00 ብር ነው፡፡ የክፍያ መረጃዎን ለማውረድ እባክዎ ይህን ሊንክ ይጫኑ: https://transactioninfo.ethiotelecom.et/receipt/DK54Q3CYIQ በቴሌ-ብር ስለተገለገሉ እናመሰግናለን ኢትዮ ቴሌኮም',
    timestamp: '10:49 AM',
    date: '2026-11-05 10:49:08',
    isOutgoing: false,
    status: 'read',
    isBank: true,
    bankName: 'telebirr',
    amount: '5.00',
    balance: '200.00',
    txnId: 'DK54Q3CYIQ',
    receiptUrl: 'https://transactioninfo.ethiotelecom.et/receipt/DK54Q3CYIQ',
  },

  // --- Other screenshot contacts ---
  {
    id: 'sms-my-1',
    conversationId: 'My 😘',
    sender: 'My 😘',
    senderName: 'My 😘',
    text: 'yene bal slkh eko alsera alegn',
    timestamp: '8:39 PM',
    date: '2026-11-05 20:39:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-quiz-1',
    conversationId: '34000',
    sender: '34000',
    senderName: '34000',
    text: 'A. ድሬዳዋ B. ባሀር ዳር C. አዲስ አበባ',
    timestamp: '12:54 PM',
    date: '2026-11-05 12:54:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-994-1',
    conversationId: '994',
    sender: '994',
    senderName: '994',
    text: 'ውድ ደንበኛችን Daily Internet Package 120 MB from telebirr to be expired after 24 Hours ከ 0 ተልኮልዎታል፡፡ጥቅል የሚያበቃ...',
    timestamp: '10:49 AM',
    date: '2026-11-05 10:49:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-dot-1',
    conversationId: '•',
    sender: '•',
    senderName: '•',
    text: 'Mn kez',
    timestamp: 'Nov 4',
    date: '2026-11-04 18:20:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-251994-1',
    conversationId: '251994',
    sender: '251994',
    senderName: '251994',
    text: 'ውድ ደንበኛችን፤ ከDaily Internet Package 120 MB from telebirr to be expired after 24 Hours ውስጥ ያለዎትን የኢንተርኔ...',
    timestamp: 'Nov 4',
    date: '2026-11-04 11:30:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-131-1',
    conversationId: '131',
    sender: '131',
    senderName: '131',
    text: 'Dear customer, Your airtime top-up has given you 1 Silver coin(s) and 1 Weekly Draw Ticket! Check your priz...',
    timestamp: 'Nov 3',
    date: '2026-11-03 09:15:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-jibril-1',
    conversationId: 'ጅብሪል',
    sender: 'ጅብሪል',
    senderName: 'ጅብሪል',
    text: '1051216690116',
    timestamp: 'Oct 30',
    date: '2026-10-30 14:02:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-beep-1',
    conversationId: 'BeepCall710',
    sender: 'BeepCall710',
    senderName: 'BeepCall710',
    text: 'Dear Customer, your beep call request is successfully delivered to 0965848508.',
    timestamp: 'Oct 30',
    date: '2026-10-30 11:18:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-aa-1',
    conversationId: 'A A',
    sender: 'A A',
    senderName: 'A A',
    text: 'ልኬልሃለሁ',
    timestamp: 'Oct 29',
    date: '2026-10-29 17:45:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-code-1',
    conversationId: '+251708279538',
    sender: '+251708279538',
    senderName: '+251708279538',
    text: 'Requested 251713939469 code is 4090, thanks! [Tech part :<kEp>{IEC]',
    timestamp: 'Oct 28',
    date: '2026-10-28 16:30:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-eoc-1',
    conversationId: 'EoC',
    sender: 'EoC',
    senderName: 'EoC',
    text: 'ቆይታ: 00:01:10 ክፍያ: 0.00 ብር ቀሪ ጥቅል: 17.89 ደቂቃ',
    timestamp: 'Oct 27',
    date: '2026-10-27 10:12:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
  {
    id: 'sms-callsign-1',
    conversationId: 'CallSign',
    sender: 'CallSign',
    senderName: 'CallSign',
    text: '1*2# ይጫኑ:: ኢትዮ ቴሌኮም',
    timestamp: 'Oct 27',
    date: '2026-10-27 09:05:00',
    isOutgoing: false,
    status: 'read',
    isBank: false,
  },
];

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

    // Deduplication guard: if a message with this exact txnId, id, or text already exists, return existing
    if (msgInput.txnId || msgInput.id || msgInput.text) {
      const existing = this.messages.find(
        (m) =>
          (msgInput.id && m.id === msgInput.id) ||
          (msgInput.txnId && m.txnId && m.txnId.trim().toUpperCase() === msgInput.txnId.trim().toUpperCase()) ||
          (msgInput.text && m.text.trim() === msgInput.text.trim())
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
