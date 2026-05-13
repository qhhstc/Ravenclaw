"use client";

import { App, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeMode();

  const antdTheme = useMemo(
    () => ({
      algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        borderRadius: 10,
        borderRadiusLG: 12,
        colorPrimary: mode === "dark" ? "#3b82f6" : "#1677ff",
        colorSuccess: mode === "dark" ? "#22c55e" : "#16a34a",
        colorWarning: "#f59e0b",
        colorError: "#ef4444",
        colorInfo: mode === "dark" ? "#3b82f6" : "#1677ff",
        colorTextBase: mode === "dark" ? "#ececec" : "#172033",
        colorText: mode === "dark" ? "#ececec" : "#172033",
        colorTextSecondary: mode === "dark" ? "#b4b4b4" : "#667085",
        colorTextTertiary: mode === "dark" ? "#8f8f8f" : "#98a2b3",
        colorTextQuaternary: mode === "dark" ? "#6b6b6b" : "#c1c7d0",
        colorBgBase: mode === "dark" ? "#212121" : "#f5f7fb",
        colorBgLayout: mode === "dark" ? "#212121" : "#f5f7fb",
        colorBgContainer: mode === "dark" ? "#2f2f2f" : "#ffffff",
        colorBgElevated: mode === "dark" ? "#2f2f2f" : "#ffffff",
        colorBgSpotlight: mode === "dark" ? "#343434" : "#ffffff",
        colorBorder: mode === "dark" ? "#3a3a3a" : "#edf0f5",
        colorBorderSecondary: mode === "dark" ? "rgba(255,255,255,0.08)" : "#edf0f5",
      },
      components: {
        Layout: {
          headerBg: mode === "dark" ? "#212121" : "#ffffff",
          bodyBg: mode === "dark" ? "#212121" : "#f5f7fb",
          siderBg: mode === "dark" ? "#171717" : "#ffffff",
        },
        Menu: {
          darkItemBg: "#171717",
          darkSubMenuItemBg: "#171717",
          darkItemColor: "#b4b4b4",
          darkItemHoverBg: "#2a2a2a",
          darkItemSelectedBg: "#2f2f2f",
          darkItemSelectedColor: "#ffffff",
          darkItemHoverColor: "#ececec",
          itemBorderRadius: 10,
        },
        Card: {
          borderRadiusLG: 12,
          colorBgContainer: mode === "dark" ? "#2f2f2f" : "#ffffff",
        },
        Table: {
          headerBg: mode === "dark" ? "#2a2a2a" : "#f7f9fc",
          headerColor: mode === "dark" ? "#ececec" : "#344054",
          rowHoverBg: mode === "dark" ? "#343434" : "#f5f7fb",
          borderColor: mode === "dark" ? "#3a3a3a" : "#edf0f5",
        },
        Modal: {
          contentBg: mode === "dark" ? "#2f2f2f" : "#ffffff",
          headerBg: mode === "dark" ? "#2f2f2f" : "#ffffff",
          titleColor: mode === "dark" ? "#ececec" : "#172033",
        },
        Select: {
          optionSelectedBg: mode === "dark" ? "#343434" : "#e6f4ff",
          optionActiveBg: mode === "dark" ? "#343434" : "#f5f7fb",
        },
        Input: {
          activeBorderColor: mode === "dark" ? "#4f8cff" : "#1677ff",
          hoverBorderColor: mode === "dark" ? "#4f8cff" : "#1677ff",
        },
        Button: {
          defaultBg: mode === "dark" ? "#2f2f2f" : "#ffffff",
          defaultColor: mode === "dark" ? "#ececec" : "#344054",
          defaultBorderColor: mode === "dark" ? "#3a3a3a" : "#d0d5dd",
          textTextColor: mode === "dark" ? "#b4b4b4" : "#344054",
        },
        Tabs: {
          itemColor: mode === "dark" ? "#b4b4b4" : "#667085",
          itemSelectedColor: mode === "dark" ? "#ececec" : "#1677ff",
          itemHoverColor: mode === "dark" ? "#ececec" : "#1677ff",
          inkBarColor: mode === "dark" ? "#3b82f6" : "#1677ff",
        },
        Tag: {
          defaultBg: mode === "dark" ? "#262626" : "#f5f7fb",
          defaultColor: mode === "dark" ? "#b4b4b4" : "#667085",
        },
        Tooltip: {
          colorBgSpotlight: mode === "dark" ? "#2f2f2f" : "#ffffff",
        },
      },
    }),
    [mode],
  );

  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
