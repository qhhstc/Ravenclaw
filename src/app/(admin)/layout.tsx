import { requireUser } from "@/lib/auth";
import { appRoutes } from "@/lib/routes";
import ThemeToggle from "@/components/common/ThemeToggle";
import HeaderTitle from "@/components/layout/HeaderTitle";
import PageHelpButton from "@/components/layout/PageHelpButton";
import RouteScrollRestoration from "@/components/layout/RouteScrollRestoration";
import SidebarNav from "@/components/layout/SidebarNav";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const routes = appRoutes
    .filter((route) => user.role !== "sales" || route.path !== "/reports/profit")
    .filter((route) => user.role === "admin" || route.path !== "/settings/system");

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed left-0 top-0 z-50 h-screen w-[208px] overflow-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
        <div className="flex h-14 items-center gap-3 border-b border-[var(--sidebar-border)] px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--primary)] text-sm font-bold text-white">R</div>
          <div className="min-w-0">
            <div className="truncate whitespace-nowrap text-[15px] font-semibold leading-5 text-[var(--foreground)]">Ravenclaw</div>
          </div>
        </div>
        <SidebarNav routes={routes} />
      </aside>

      <div className="min-h-screen pl-[208px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between overflow-hidden border-b border-[var(--sidebar-border)] bg-[var(--header-bg)] px-6">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderTitle />
            <PageHelpButton />
          </div>
          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 items-center rounded-md bg-[var(--soft-bg)] px-2">
              <div className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-sm text-white">A</div>
              <span className="max-w-[120px] truncate text-sm font-medium leading-none text-[var(--foreground)]">{user.name || "Admin"}</span>
            </div>
            <ThemeToggle />
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--menu-text)] transition hover:bg-[var(--hover-fill)] hover:text-[var(--foreground)]">
                退出登录
              </button>
            </form>
          </div>
        </header>
        <main data-admin-main className="min-h-[calc(100vh-64px)] bg-[var(--background)] p-6">
          <RouteScrollRestoration />
          {children}
        </main>
      </div>
    </div>
  );
}
