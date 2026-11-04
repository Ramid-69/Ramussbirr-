import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CBEBirr Demo',
  description: 'CBEBirr demo mobile application clone featuring Splash, Login, PIN, and Home screens.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CBEBirr Demo',
  },
  openGraph: {
    title: 'CBEBirr Demo',
    description: 'CBEBirr demo mobile application clone featuring Splash, Login, PIN, and Home screens.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CBEBirr Demo',
    description: 'CBEBirr demo mobile application clone featuring Splash, Login, PIN, and Home screens.',
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
