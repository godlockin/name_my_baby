import './globals.css';

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
    <html lang="zh-CN">
      <body className="font-sans bg-bg text-ink min-h-screen" style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", "Noto Serif SC", sans-serif',
      }}>{children}</body>
    </html>
  );
}
