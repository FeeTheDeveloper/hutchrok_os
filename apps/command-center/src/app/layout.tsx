import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hutchrok Command Center',
  description: 'A governed visual control surface for Hutchrok OS.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Hutchrok' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071116',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
