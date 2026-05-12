"use client";

import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: "#1677ff",
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
