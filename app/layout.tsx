import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CorePhone Pro — 1:1 Browser iOS Hardware Emulator',
  description:
    'Zero-lag browser-based iPhone 16 Pro & iOS 18 emulator featuring real URL browsing via Mobile Safari proxy, 1-for-1 iOS Settings, Dynamic Island, Taptic Engine audio-haptics, physical hardware quirks, and a Three.js Grade-5 Titanium 3D chassis.',
  openGraph: {
    title: 'CorePhone Pro — 1:1 Browser iOS Hardware Emulator',
    description:
      'Zero-lag browser-based iPhone 16 Pro & iOS 18 emulator featuring real URL browsing via Mobile Safari proxy, 1-for-1 iOS Settings, Dynamic Island, Taptic Engine audio-haptics, physical hardware quirks, and a Three.js Grade-5 Titanium 3D chassis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CorePhone Pro — 1:1 Browser iOS Hardware Emulator',
    description:
      'Zero-lag browser-based iPhone 16 Pro & iOS 18 emulator featuring real URL browsing via Mobile Safari proxy, 1-for-1 iOS Settings, Dynamic Island, Taptic Engine audio-haptics, physical hardware quirks, and a Three.js Grade-5 Titanium 3D chassis.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body
        suppressHydrationWarning
        className="bg-[#0B0D10] text-slate-100 antialiased selection:bg-blue-500/30 selection:text-white font-sans overflow-hidden"
      >
        {children}
      </body>
    </html>
  );
}
