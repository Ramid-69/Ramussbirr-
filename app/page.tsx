'use client';

import dynamic from 'next/dynamic';

const CBEBirrFullscreenApp = dynamic(
  () => import('@/components/CBEBirrFullscreenApp'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#7a1c7d] flex flex-col items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-14 h-14 rounded-full border-4 border-yellow-300 border-t-transparent animate-spin" />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-wider">CBEBirr Plus</h1>
            <p className="text-xs text-purple-200 mt-1">በመጫን ላይ (Loading)...</p>
          </div>
        </div>
      </div>
    ),
  }
);

export default function Page() {
  return <CBEBirrFullscreenApp />;
}
