'use client';

import React from 'react';
import Link from 'next/link';
import { Download, MessageSquare, ShieldCheck, ArrowRight, Smartphone, Bell, CheckCircle2 } from 'lucide-react';

export default function DownloadPage() {
  return (
    <div className="min-h-screen w-full bg-[#f4f5f8] text-[#1c1b1f] flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 flex flex-col">
        {/* Header with Dual App Branding */}
        <div className="bg-gradient-to-br from-[#7a1c7d] via-[#8b278e] to-[#1c65e3] px-6 py-7 text-white text-center flex flex-col items-center relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/cbe_qr_center_badge_crisp.png"
                alt="CBEBirr"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#1e65e3] p-2 shadow-md flex items-center justify-center text-white">
              <MessageSquare className="w-8 h-8 fill-white text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Android Native Apps</h1>
          <p className="text-purple-100 text-xs sm:text-sm mt-1 max-w-xs mx-auto">
            የCBEBirr Plus ባንኪንግ እና የSamsung Messages Default SMS አንድሮይድ አፖች
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Messages APK Card (Top Priority) */}
          <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">
                  <MessageSquare className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Samsung Messages APK</span>
                    <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                      Default SMS App
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    Real-time Banking SMS &bull; Native Sound &bull; Vibration
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-1 rounded-lg">
                31 KB .apk
              </span>
            </div>

            <ul className="text-xs text-slate-700 space-y-1.5 pl-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>በስልክዎ ላይ <strong>Default SMS App</strong> ሆኖ በቀጥታ ይመረጣል</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>የባንክ ዝውውር ሲደረግ በስልክዎ ኦሪጅናል ኖቲፊኬሽን ድምፅና ንዝረት ይደርሳል</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>ትክክለኛ የCBEBirr Transaction SMS እና ኦፊሴላዊ PDF ደረሰኝ</span>
              </li>
            </ul>

            <a
              href="/download/messages"
              download="SamsungMessages.apk"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download Samsung Messages APK (.apk)</span>
            </a>
          </div>

          {/* CBEBirr Plus APK Card */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#7a1c7d] text-white flex items-center justify-center shadow">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">CBEBirr Plus Banking APK</h2>
                  <p className="text-[11px] text-slate-600">
                    Mobile Banking &bull; USSD Auto Lookup &bull; PDF Receipts
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-100 px-2 py-1 rounded-lg">
                16 KB .apk
              </span>
            </div>

            <a
              href="/download/cbebirr"
              download="CBEBirrPlus.apk"
              className="w-full py-3 px-4 bg-[#7a1c7d] hover:bg-[#68146a] active:scale-[0.98] text-white font-bold rounded-xl shadow-md shadow-purple-900/20 flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download CBEBirr Plus Banking APK (.apk)</span>
            </a>
          </div>

          {/* Installation & Permission Controller Guide matching Screenshot */}
          <div className="bg-[#f9fafb] rounded-2xl p-4 border border-slate-200 space-y-3 text-xs text-slate-700">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7a1c7d]" />
              <span>የአጫጫን እና የDefault SMS ፍቃድ አሰጣጥ (Setup Guide):</span>
            </h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  ከላይ <strong>&quot;Download Samsung Messages APK&quot;</strong> የሚለውን ተጭነው ያውርዱ።
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  ፋይሉ ሲወርድ ይክፈቱትና ስልክዎ <strong>&quot;Install unknown apps&quot;</strong> ሲጠይቅ ፈቅደው <strong>Install</strong> ይጫኑ።
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  አፑ ሲከፈት በስክሪኑ ላይ ልክ በስክሪንሾትህ እንዳለው <strong>&quot;Set Messages as your default SMS app?&quot;</strong> የሚል የሲስተም ፍቃድ ይመጣል። <strong>&quot;Set as default&quot;</strong> የሚለውን ይምረጡ።
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  ✓
                </span>
                <div>
                  ከዚያ በባንኪንግ አፑ ገንዘብ ሲልኩ ወዲያውኑ በስልክዎ የኖቲፊኬሽን ድምፅ እና ንዝረት ትክክለኛ የCBEBirr ዝውውር ዝርዝር ይደርሳል!
                </div>
              </div>
            </div>
          </div>

          {/* Quick Access to Web Versions */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <Link
              href="/messages"
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs text-center transition-all"
            >
              <Bell className="w-3.5 h-3.5 text-blue-600" />
              <span>በብሮውዘር Messages ክፈት</span>
            </Link>

            <Link
              href="/"
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs text-center transition-all"
            >
              <span>ወደ CBE Banking ተመለስ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
