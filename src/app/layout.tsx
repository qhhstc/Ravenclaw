import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import AntdProvider from "@/components/common/AntdProvider";
import { getThemeBootstrapScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "跨境经营数据中心",
  description: "跨境公司内部经营管理后台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
        <AntdRegistry>
          <AntdProvider>{children}</AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
