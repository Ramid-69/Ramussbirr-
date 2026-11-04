import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-800 bg-slate-50 p-4">
      <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-slate-600 mb-4">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#7a1c7d] text-white rounded-lg font-semibold hover:bg-[#68146a] transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}

