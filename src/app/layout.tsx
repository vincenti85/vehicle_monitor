import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FleetGuard 30 · Opelika AL — Corporate Fleet & No-Dashcam Telemetry',
  description:
    '4400 Northpark Dr, Opelika, AL 36801 — Zero-subscription smartphone-based corporate fleet (30 vehicles) dispatch, unauthorized driving & 6-axis IMU accident reconstruction system.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0D10',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-[#0B0D10] text-[#F4F6F8] selection:bg-[#3E6AE1] selection:text-white">
        {children}
      </body>
    </html>
  );
}
