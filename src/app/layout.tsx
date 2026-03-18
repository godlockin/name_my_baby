import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AI 起名助手 - 为宝宝起个好名字</title>
        <meta name="description" content="基于 AI 多专家协作的宝宝起名工具，提供有文化内涵、寓意美好、无谐音问题的姓名方案" />
      </head>
      <body>{children}</body>
    </html>
  );
}
