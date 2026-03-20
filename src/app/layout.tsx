import './globals.css';
import { Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google';

const serif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
  preload: false,
});

const sans = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

export const metadata = {
  title: 'AI 起名助手 - 为宝宝起个好名字',
  description: '基于 AI 多专家协作的宝宝起名工具，提供有文化内涵、寓意美好、无谐音问题的姓名方案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${serif.variable} ${sans.variable}`}>
      <body className="font-sans bg-bg text-ink min-h-screen">{children}</body>
    </html>
  );
}
