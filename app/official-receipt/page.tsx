'use client';

import dynamic from 'next/dynamic';

const OfficialReceiptView = dynamic(
  () => import('@/components/OfficialReceiptView'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-[#7a1c7d] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-700">ደረሰኝ በመጫን ላይ (Loading Official Receipt)...</p>
        </div>
      </div>
    ),
  }
);

export default function OfficialReceiptPage() {
  return <OfficialReceiptView />;
}
