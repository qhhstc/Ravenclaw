"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { appRoutes, getRouteTitle, getSelectedRoute } from "@/lib/routes";
import ThemeToggle from "@/components/common/ThemeToggle";
import PageHelpButton from "@/components/layout/PageHelpButton";

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
    <div className="admin-shell min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className="fixed left-0 top-0 z-50 h-screen overflow-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]"
        style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      >
        <div className="flex h-14 items-center gap-3 border-b border-[var(--sidebar-border)] px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--primary)] text-sm font-bold text-white">R</div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="truncate whitespace-nowrap text-[15px] font-semibold leading-5 text-[var(--foreground)]">Ravenclaw</div>
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
                  className={[
                    "sidebar-menu-item mb-1 flex h-10 items-center overflow-hidden rounded-lg border-l-[3px] px-3 text-sm no-underline transition",
                    selected ? "sidebar-menu-item-selected font-semibold" : "border-transparent font-normal",
                  ].join(" ")}
                  href={route.path}
                  prefetch
                  title={route.menuLabel}
                  onClick={() => {
                    if (route.path !== pathname) startTransition(() => setPendingPath(route.path));
                  }}
                >
                  <span className="sidebar-menu-icon mr-3 inline-flex w-4 shrink-0 items-center justify-center text-xs">{iconMap[route.iconKey] ?? "•"}</span>
                  {!collapsed ? <span className="min-w-0 truncate">{route.menuLabel}</span> : null}
                </Link>
              );
            })}
        </nav>
      </aside>

      <div className="min-h-screen" style={{ paddingLeft: sidebarWidth }}>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between overflow-hidden border-b border-[var(--sidebar-border)] bg-[var(--header-bg)] px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-md border-0 bg-transparent px-3 text-lg text-[var(--menu-text)] transition hover:bg-[var(--hover-fill)] hover:text-[var(--foreground)]"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "展开菜单" : "收起菜单"}
            >
              {collapsed ? "☰" : "×"}
            </button>
            <h1 className="m-0 truncate text-xl font-semibold leading-8 text-[var(--foreground)]">{pageTitle}</h1>
            <PageHelpButton />
          </div>

          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 items-center rounded-md bg-[var(--soft-bg)] px-2">
              <div className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-sm text-white">A</div>
              <span className="max-w-[96px] truncate text-sm font-medium leading-none text-[var(--foreground)]">
                {userName || "Admin"}
              </span>
            </div>
            <ThemeToggle />
            <button type="button" className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--menu-text)] transition hover:bg-[var(--hover-fill)] hover:text-[var(--foreground)]" onClick={logout}>
              退出登录
            </button>
          </div>
        </header>

        <main data-admin-main className="relative min-h-[calc(100vh-64px)] bg-[var(--background)] p-6">
          {activePendingPath || isPending ? <div className="absolute left-0 top-0 z-20 h-1 w-full overflow-hidden bg-[var(--chart-blue-soft)]"><div className="h-full w-1/3 animate-pulse bg-[var(--primary)]" /></div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
