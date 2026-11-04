import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CBEBirr Plus',
  description: 'Commercial Bank of Ethiopia - CBEBirr Mobile Banking',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CBEBirr Plus',
  },
  openGraph: {
    title: 'CBEBirr Plus',
    description: 'Commercial Bank of Ethiopia - CBEBirr Mobile Banking',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CBEBirr Plus',
    description: 'Commercial Bank of Ethiopia - CBEBirr Mobile Banking',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#7a1c7d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="h-full w-full overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
