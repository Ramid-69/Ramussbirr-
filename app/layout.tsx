import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CBEBirr Demo',
  description: 'CBEBirr demo mobile application clone featuring Splash, Login, PIN, and Home screens.',
  manifest: '/manifest.json',
  icons: {
    icon: '/assets/cbe_birr_logo.png',
    apple: '/assets/cbe_birr_logo.png',
  },
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
  interactiveWidget: 'overlays-content',
};

const IS_PROD_BUILD = process.env.NODE_ENV === 'production';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const swScript = IS_PROD_BUILD
    ? `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
              reg.update().catch(function() {});
            }).catch(function(err) {
              console.log('SW registration failed:', err);
            });
          });
        }
      `
    : `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            var hadController = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              return Promise.all(regs.map(function(r) { return r.unregister(); }));
            }).then(function() {
              if ('caches' in window) {
                return caches.keys().then(function(keys) {
                  return Promise.all(keys.map(function(k) { return caches.delete(k); }));
                });
              }
            }).then(function() {
              if (hadController && !sessionStorage.getItem('__cbe_sw_dev_reloaded')) {
                sessionStorage.setItem('__cbe_sw_dev_reloaded', '1');
                window.location.reload();
              }
            }).catch(function() {});
          });
        }
      `;

  return (
    <html lang="en" className="h-full w-full" suppressHydrationWarning>
      <body className="h-full w-full overflow-hidden" suppressHydrationWarning>
        {children}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: swScript,
          }}
        />
      </body>
    </html>
  );
}
