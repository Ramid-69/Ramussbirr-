'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

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
