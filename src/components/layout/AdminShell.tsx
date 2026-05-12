"use client";

import {
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space, Tooltip, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { appRoutes, getRouteTitle, getSelectedRoute, getSystemIcon } from "@/lib/routes";

const { Header, Content, Sider } = Layout;
const siderWidth = 208;
const collapsedSiderWidth = 72;

type AdminShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: string;
};

export default function AdminShell({ children, userName, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = useMemo(() => getSelectedRoute(pathname), [pathname]);
  const pageTitle = useMemo(() => getRouteTitle(pathname), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Layout className="min-h-screen">
      <Sider
        width={siderWidth}
        collapsedWidth={collapsedSiderWidth}
        collapsible
        collapsed={collapsed}
        trigger={null}
        className="fixed left-0 top-0 z-20 h-screen overflow-auto border-r border-[#e8edf5] !bg-white"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[#edf0f5] px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#1677ff] text-white">
            {getSystemIcon()}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-5 text-[#172033]">Ravenclaw</div>
              <div className="text-xs leading-4 text-[#8a94a6]">跨境经营数据中心</div>
            </div>
          ) : null}
        </div>

        <Menu
          className="border-0 px-2 py-3"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => router.push(String(key))}
          items={appRoutes
            .map((route) => ({
              key: route.path,
              icon: route.icon,
              label: route.menuLabel,
            }))
            .filter((item) => userRole !== "sales" || item.key !== "/reports/profit")
            .filter((item) => userRole === "admin" || item.key !== "/settings/system")}
        />
      </Sider>

      <Layout className="min-h-screen">
        <Header className="sticky top-0 z-10 flex h-16 items-center justify-between overflow-hidden border-b border-[#e8edf5] !bg-white px-6">
          <Space size={14}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <Typography.Title level={4} className="!m-0 !text-[#172033]">
              {pageTitle}
            </Typography.Title>
          </Space>

          <Space size={12} className="h-16">
            <Tooltip title="搜索">
              <Button type="text" shape="circle" icon={<SearchOutlined />} />
            </Tooltip>
            <Tooltip title="通知">
              <Button type="text" shape="circle" icon={<BellOutlined />} />
            </Tooltip>
            <Space className="h-9 rounded-md bg-[#fafcff] px-2">
              <Avatar size={28} style={{ backgroundColor: "#1677ff" }}>
                A
              </Avatar>
              <span className="max-w-[96px] truncate text-sm font-medium leading-none text-[#172033]">
                {userName || "Admin"}
              </span>
            </Space>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              退出登录
            </Button>
          </Space>
        </Header>

        <Content className="min-h-[calc(100vh-64px)] bg-[#f5f7fb] p-6">{children}</Content>
      </Layout>
    </Layout>
  );
}
