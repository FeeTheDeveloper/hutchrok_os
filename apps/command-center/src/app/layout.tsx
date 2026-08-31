import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Hutchrok Command Center',
  description: 'Hutchrok Business Action OS — Mobile Command Center',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hutchrok',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#000', color: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
