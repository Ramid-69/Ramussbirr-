import { Suspense } from 'react';
import OfficialReceiptView from '@/components/OfficialReceiptView';

export const dynamic = 'force-dynamic';

export default function OfficialReceiptPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#6b1d6b] flex items-center justify-center text-white">Loading receipt...</div>}>
      <OfficialReceiptView />
    </Suspense>
  );
}

