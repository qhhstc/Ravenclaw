"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { appRoutes, getRouteTitle, getSelectedRoute } from "@/lib/routes";

const siderWidth = 208;
const collapsedSiderWidth = 72;

const iconMap: Record<string, string> = {
  "bar-chart": "▦",
  dollar: "¥",
  global: "R",
  idcard: "#",
  "line-chart": "⌁",
  product: "□",
  "ordered-list": "≡",
  setting: "⚙",
  shop: "⌂",
  team: "◎",
  "usergroup-add": "+",
};

type AdminShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: string;
};

export default function AdminShell({ children, userName, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activePendingPath = pendingPath && pendingPath !== pathname ? pendingPath : null;
  const selectedKey = useMemo(() => activePendingPath ?? getSelectedRoute(pathname), [activePendingPath, pathname]);
  const pageTitle = useMemo(() => getRouteTitle(activePendingPath ?? pathname), [activePendingPath, pathname]);
  const sidebarWidth = collapsed ? collapsedSiderWidth : siderWidth;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="admin-shell min-h-screen bg-[#f5f7fb]">
      <aside
        className="fixed left-0 top-0 z-20 h-screen overflow-auto border-r border-[#e8edf5] bg-white"
        style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      >
        <div className="flex h-16 items-center gap-3 border-b border-[#edf0f5] px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#1677ff] text-sm font-bold text-white">R</div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-5 text-[#172033]">Ravenclaw</div>
              <div className="text-xs leading-4 text-[#8a94a6]">跨境经营数据中心</div>
            </div>
          ) : null}
        </div>

        <nav className="px-2 py-3">
          {appRoutes
            .filter((route) => userRole !== "sales" || route.path !== "/reports/profit")
            .filter((route) => userRole === "admin" || route.path !== "/settings/system")
            .map((route) => {
              const selected = selectedKey === route.path;
              return (
                <Link
                  key={route.path}
                  className={`mb-1 flex h-10 items-center overflow-hidden rounded-md px-3 text-sm no-underline transition ${selected ? "bg-[#e6f4ff] font-medium text-[#1677ff]" : "text-[#344054] hover:bg-[#f5f7fb]"}`}
                  href={route.path}
                  prefetch
                  title={route.menuLabel}
                  onClick={() => {
                    if (route.path !== pathname) startTransition(() => setPendingPath(route.path));
                  }}
                >
                  <span className="mr-3 inline-flex w-4 shrink-0 items-center justify-center text-xs">{iconMap[route.iconKey] ?? "•"}</span>
                  {!collapsed ? <span className="min-w-0 truncate">{route.menuLabel}</span> : null}
                </Link>
              );
            })}
        </nav>
      </aside>

      <div className="min-h-screen" style={{ paddingLeft: sidebarWidth }}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between overflow-hidden border-b border-[#e8edf5] bg-white px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-9 rounded-md border-0 bg-transparent px-3 text-lg text-[#344054] hover:bg-[#f5f7fb]"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "展开菜单" : "收起菜单"}
            >
              {collapsed ? "☰" : "×"}
            </button>
            <h1 className="m-0 text-xl font-semibold text-[#172033]">{pageTitle}</h1>
          </div>

          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 items-center rounded-md bg-[#fafcff] px-2">
              <div className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-[#1677ff] text-sm text-white">A</div>
              <span className="max-w-[96px] truncate text-sm font-medium leading-none text-[#172033]">
                {userName || "Admin"}
              </span>
            </div>
            <button type="button" className="h-9 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#344054]" onClick={logout}>
              退出登录
            </button>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-64px)] bg-[#f5f7fb] p-6">
          {activePendingPath || isPending ? <div className="absolute left-0 top-0 z-20 h-1 w-full overflow-hidden bg-[#e6f4ff]"><div className="h-full w-1/3 animate-pulse bg-[#1677ff]" /></div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
