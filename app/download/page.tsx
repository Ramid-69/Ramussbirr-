'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Download, Smartphone, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function subscribeToStandalone(callback: () => void) {
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {
    mq.removeEventListener('change', callback);
    window.removeEventListener('appinstalled', callback);
  };
}

function getStandaloneSnapshot() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function getServerSnapshot() {
  return false;
}

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);
  const isInstalled = useSyncExternalStore(subscribeToStandalone, getStandaloneSnapshot, getServerSnapshot);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallSuccess(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallSuccess(true);
      }
      setDeferredPrompt(null);
    } else {
      // Guide user to manual chrome install
      alert('በChrome ብሮውዘር የላይኛውን 3 ነጥቦች (⋮) ተጭነው "Install app" ወይም "Add to Home screen" (ወደ መነሻ ገጽ አክል) የሚለውን ይምረጡ።');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f6f6f8] text-[#1c1b1f] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">
        {/* Header with CBE Brand */}
        <div className="bg-[#7a1c7d] px-6 py-8 text-white text-center flex flex-col items-center relative">
          <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/cbe_qr_center_badge_crisp.png"
              alt="CBEBirr"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">CBEBirr Plus</h1>
          <p className="text-purple-200 text-xs sm:text-sm mt-1">
            የኢትዮጵያ ንግድ ባንክ ሞባይል ባንኪንግ መተግበሪያ
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {installSuccess || isInstalled ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 text-green-800">
              <CheckCircle className="w-6 h-6 shrink-0 text-green-600" />
              <div className="text-xs sm:text-sm font-medium">
                መተግበሪያው በተሳካ ሁኔታ በስልክዎ ላይ ተጭኗል! በቀጥታ መክፈት ይችላሉ።
              </div>
            </div>
          ) : null}

          {/* Primary Action Button: 1-Click Install */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-4 px-6 bg-[#8b278e] hover:bg-[#77217a] active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2.5 transition-all text-base cursor-pointer"
            >
              <Smartphone className="w-5 h-5" />
              <span>መተግበሪያውን ስልክዎ ላይ ጫኑ (Install App)</span>
            </button>

            <Link
              href="/"
              className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all text-sm text-center"
            >
              <span>ቀጥታ በብሮውዘር ክፈት (Open in Browser)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Visual Step-by-Step Installation Guide */}
          <div className="bg-[#f9fafb] rounded-2xl p-4 border border-gray-100 space-y-3">
            <h3 className="font-bold text-sm text-[#7a1c7d] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7a1c7d]" />
              <span>በቀላሉ ስልክዎ ላይ ለመጫን (How to Install):</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <div>
                  በChrome ብሮውዘር የላይኛውን <strong>3 ነጥቦች (⋮)</strong> ይጫኑ (Tap menu icon)።
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  ከሚመጡት አማራጮች ውስጥ <strong>&quot;Install app&quot;</strong> ወይም <strong>&quot;Add to Home screen&quot; (ወደ መነሻ ገጽ አክል)</strong> የሚለውን ይምረጡ።
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7a1c7d]/10 text-[#7a1c7d] font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  <strong>&quot;Install&quot;</strong> የሚለውን ያጽድቁ። አፑ ልክ እንደ ኦሪጅናል CBEBirr በስልክዎ ስክሪን ላይ ይቀመጣል!
                </div>
              </div>
            </div>
          </div>

          {/* Note about APK Parsing error */}
          <div className="text-[11.5px] text-slate-500 leading-relaxed bg-amber-50/70 border border-amber-200/60 rounded-xl p-3">
            <span className="font-bold text-amber-900 block mb-0.5">
              ⚠️ &quot;Problem parsing the package&quot; ለምን አሳየ?
            </span>
            የአንድሮይድ ስልኮች ከብሮውዘር በቀጥታ የሚወርዱ ጥሬ APK ፋይሎችን ሊያግዱ ወይም ላይከፍቱ ይችላሉ። ስለዚህ ከላይ በተገለጸው መሰረት <strong>&quot;Add to Home screen&quot;</strong> በማድረግ ያለ ምንም ስህተትና ፈጣን በሆነ መንገድ በስልክዎ መጫን ይችላሉ!
          </div>

          {/* Direct Native Android APK Downloads */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider text-center">
              Direct Native Android APKs (.apk)
            </h4>

            <a
              href="/SamsungMessages.apk"
              download="SamsungMessages.apk"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-md flex items-center justify-between text-xs transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  💬
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-xs">Samsung Messages APK</div>
                  <div className="text-[10px] text-blue-100">Default SMS App with CBE auto-receipts</div>
                </div>
              </div>
              <Download className="w-4 h-4 shrink-0 text-white" />
            </a>

            <a
              href="/cbebirr-plus.apk"
              download="cbebirr-plus.apk"
              className="w-full py-3 px-4 bg-[#7a1c7d] hover:bg-[#68146a] active:scale-[0.98] text-white font-semibold rounded-2xl shadow-md flex items-center justify-between text-xs transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  🏦
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-xs">CBEBirr Plus APK</div>
                  <div className="text-[10px] text-purple-200">Mobile banking app for Android</div>
                </div>
              </div>
              <Download className="w-4 h-4 shrink-0 text-white" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
