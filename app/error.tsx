'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  const name = String(e.name || '');
  const msg = String(e.message || '');
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(msg)
  );
}

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkErr = useMemo(() => isChunkLoadError(error), [error]);

  useEffect(() => {
    if (isChunkErr && typeof window !== 'undefined') {
      try {
        const now = Date.now();
        const rawTs = Number(sessionStorage.getItem('__cbe_chunk_err_ts') || '0');
        const rawCount = Number(sessionStorage.getItem('__cbe_chunk_err_count') || '0');
        const withinWindow = now - rawTs < 15000;
        const count = withinWindow ? rawCount : 0;

        if (count < 2) {
          sessionStorage.setItem('__cbe_chunk_err_ts', String(now));
          sessionStorage.setItem('__cbe_chunk_err_count', String(count + 1));

          const cleanupAndReload = async () => {
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
            } catch {}
            window.location.reload();
          };
          void cleanupAndReload();
          return;
        }
      } catch {}
    }

    console.error('App Error:', error);
  }, [error, isChunkErr]);

  if (isChunkErr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-800 bg-white p-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#7a1c7d] border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 mb-3">Refreshing application...</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#7a1c7d] text-white rounded-lg text-xs font-semibold hover:bg-[#68146a] transition-colors cursor-pointer"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-800 bg-slate-50 p-4">
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-slate-600 mb-4 max-w-md text-center">
        An unexpected error occurred. You can attempt to refresh or return to the main CBEBirr app.
      </p>
      <div className="flex items-center space-x-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-[#7a1c7d] text-white rounded-lg font-semibold hover:bg-[#68146a] transition-colors cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
