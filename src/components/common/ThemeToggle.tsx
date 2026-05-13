"use client";

import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { toggleThemeMode, useThemeMode } from "@/hooks/useThemeMode";

export default function ThemeToggle() {
  const mode = useThemeMode();

  return (
    <Button
      type="text"
      className="rounded-md text-[var(--menu-text)] hover:!bg-[var(--hover-fill)] hover:!text-[var(--foreground)]"
      icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
      onClick={toggleThemeMode}
      title={mode === "dark" ? "切换浅色模式" : "切换深色模式"}
    >
      {mode === "dark" ? "浅色" : "深色"}
    </Button>
  );
}
