'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const LOCAL_COMMIT_SHA = process.env.NEXT_PUBLIC_APP_COMMIT_SHA || '';
const LOCAL_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID || '';
const IS_PROD = process.env.NODE_ENV === 'production';

function getLocalHashedPageChunk(): string {
  if (typeof document === 'undefined') return '';
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const el of scripts) {
    const src = el.getAttribute('src') || '';
    const m = src.match(/\/_next\/static\/chunks\/app\/(page-[0-9a-f]+\.js)(?:\?|$)/i);
    if (m && m[1]) {
      return m[1];
    }
  }
  return '';
}

async function purgeCachesAndReload(targetSig: string) {
  try {
    sessionStorage.setItem('__cbe_ota_reloaded_sig', targetSig);
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          try {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            if (reg.active) {
              reg.active.postMessage({ type: 'CLEAR_ALL_CACHES' });
            }
            await reg.update().catch(() => {});
          } catch {}
        })
      );
    }
  } catch {}

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

export default function OtaAutoUpdater() {
  const [updateSig, setUpdateSig] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissedSig, setDismissedSig] = useState<string | null>(null);
  const mountTimeRef = useRef<number>(0);
  const lastCheckRef = useRef<number>(0);

  const checkForUpdate = useCallback(async () => {
    if (!IS_PROD || typeof window === 'undefined') return;
    if (window.location.protocol === 'file:' || window.location.hostname.includes('appassets.androidplatform.net')) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const now = Date.now();
    if (now - lastCheckRef.current < 15000) return;
    lastCheckRef.current = now;

    try {
      const res = await fetch(`/api/app-version?t=${now}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        buildSignature?: string;
        commitSha?: string;
        deploymentId?: string;
        pageChunk?: string;
      };

      const localPageChunk = getLocalHashedPageChunk();
      const serverCommit = data.commitSha || '';
      const serverDeploy = data.deploymentId || '';
      const serverPageChunk = data.pageChunk || '';

      const commitMismatch = Boolean(serverCommit && LOCAL_COMMIT_SHA && serverCommit !== LOCAL_COMMIT_SHA);
      const deployMismatch = Boolean(serverDeploy && LOCAL_DEPLOYMENT_ID && serverDeploy !== LOCAL_DEPLOYMENT_ID);
      const chunkMismatch = Boolean(serverPageChunk && localPageChunk && serverPageChunk !== localPageChunk);

      if (!commitMismatch && !deployMismatch && !chunkMismatch) {
        return;
      }

      const targetSig = data.buildSignature || serverCommit || serverDeploy || serverPageChunk;
      if (!targetSig) return;

      try {
        if (sessionStorage.getItem('__cbe_ota_reloaded_sig') === targetSig) {
          return;
        }
      } catch {}

      const elapsedSinceMount = Date.now() - (mountTimeRef.current || now);
      // Within first 6s of cold app launch, seamlessly auto-update without requiring any click
      if (elapsedSinceMount <= 6000 && window.location.pathname === '/') {
        setIsUpdating(true);
        await purgeCachesAndReload(targetSig);
        return;
      }

      // Mid-session (resumed from background): offer non-intrusive Update button so active work isn't interrupted
      setUpdateSig(targetSig);
    } catch {
      // Offline or transient network error — keep working offline cleanly
    }
  }, []);

  useEffect(() => {
    if (!IS_PROD || typeof window === 'undefined') return;
    mountTimeRef.current = Date.now();

    const initialTimer = window.setTimeout(() => {
      void checkForUpdate();
    }, 300);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    const onOnline = () => {
      void checkForUpdate();
    };

    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [checkForUpdate]);

  if (!updateSig || dismissedSig === updateSig) {
    return null;
  }

  return (
    <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-[360px] bg-[#1c1b1f]/95 text-white rounded-2xl shadow-2xl border border-white/15 px-3.5 py-2.5 flex items-center justify-between gap-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-[#7a1c7d] flex items-center justify-center shrink-0">
          <RefreshCw className={`w-4 h-4 text-white ${isUpdating ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold leading-tight truncate">
            New App Update Ready
          </p>
          <p className="text-[10.5px] text-white/75 leading-tight truncate mt-0.5">
            Tap Update to load latest changes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsUpdating(true);
            void purgeCachesAndReload(updateSig);
          }}
          disabled={isUpdating}
          className="px-3 py-1.5 rounded-xl bg-[#8b278e] hover:bg-[#a030a3] active:scale-95 text-white text-[11.5px] font-bold transition-all cursor-pointer disabled:opacity-70"
        >
          {isUpdating ? 'Updating...' : 'Update'}
        </button>
        <button
          type="button"
          onClick={() => setDismissedSig(updateSig)}
          className="p-1 text-white/60 hover:text-white cursor-pointer"
          aria-label="Dismiss update"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
