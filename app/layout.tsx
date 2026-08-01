import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
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
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
