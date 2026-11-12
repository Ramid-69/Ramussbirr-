import { NextResponse } from 'next/server';
import { MASTER_API_KEY, BANK_API_KEYS } from '@/lib/sms-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supportedBanks = [
    { name: 'Commercial Bank of Ethiopia', code: 'CBE', key: 'cbe-api-key', sampleSender: 'CBEBirr' },
    { name: 'CBEBirr Mobile Money', code: 'CBEBIRR', key: 'cbebirr-api-key', sampleSender: 'CBEBirr' },
    { name: 'telebirr (Ethio telecom)', code: 'TELEBIRR', key: 'telebirr-api-key', sampleSender: '127' },
    { name: 'Safaricom M-PESA', code: 'MPESA', key: 'mpesa-api-key', sampleSender: 'Safaricom' },
    { name: 'Bank of Abyssinia', code: 'BOA', key: 'boa-api-key', sampleSender: 'BOA' },
    { name: 'Awash Bank', code: 'AWASH', key: 'awash-api-key', sampleSender: 'AwashBirr' },
    { name: 'Dashen Bank', code: 'DASHEN', key: 'dashen-api-key', sampleSender: 'Amole' },
    { name: 'Sinqe Bank', code: 'SINQE', key: 'sinqe-api-key', sampleSender: 'SinqeBank' },
    { name: 'Cooperative Bank of Oromia', code: 'COOP', key: 'coop-api-key', sampleSender: 'CoopBank' },
    { name: 'Oromia Bank', code: 'OROMIA', key: 'oromia-api-key', sampleSender: 'OromiaBank' },
  ];

  return NextResponse.json({
    success: true,
    masterApiKey: MASTER_API_KEY,
    keys: BANK_API_KEYS,
    banks: supportedBanks,
    endpoints: {
      webhook: '/api/sms/webhook',
      send: '/api/sms/send',
      transaction: '/api/sms/transaction',
      cbebirr: '/api/sms/cbebirr',
      messages: '/api/sms/messages',
      markSynced: '/api/sms/mark-synced',
    },
  });
}
