import './globals.css';
import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ascend.app'),
  title: 'Ascend — AI Growth Coaching',
  description:
    'A personalized AI growth-coaching agent that recommends learning quests and learns from every interaction.',
  openGraph: {
    title: 'Ascend — AI Growth Coaching',
    description:
      'A personalized AI growth-coaching agent that recommends learning quests and learns from every interaction.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
