import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { appRoutes } from "@/lib/routes";

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
    <div className="min-h-screen bg-[#f5f7fb]">
      <aside className="fixed left-0 top-0 z-20 h-screen w-[208px] overflow-auto border-r border-[#e8edf5] bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-[#edf0f5] px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#1677ff] text-sm font-bold text-white">R</div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-5 text-[#172033]">Ravenclaw</div>
            <div className="text-xs leading-4 text-[#8a94a6]">跨境经营数据中心</div>
          </div>
        </div>
        <nav className="px-2 py-3">
          {routes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              prefetch
              className="mb-1 flex h-10 items-center overflow-hidden rounded-md px-3 text-sm text-[#344054] no-underline transition hover:bg-[#f5f7fb]"
              title={route.menuLabel}
            >
              <span className="mr-3 inline-flex w-4 shrink-0 items-center justify-center text-xs">{iconMap[route.iconKey] ?? "•"}</span>
              <span className="min-w-0 truncate">{route.menuLabel}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-h-screen pl-[208px]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between overflow-hidden border-b border-[#e8edf5] bg-white px-6">
          <h1 className="m-0 text-xl font-semibold text-[#172033]">跨境经营数据中心</h1>
          <div className="flex h-16 items-center gap-3">
            <div className="flex h-9 items-center rounded-md bg-[#fafcff] px-2">
              <div className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-[#1677ff] text-sm text-white">A</div>
              <span className="max-w-[120px] truncate text-sm font-medium leading-none text-[#172033]">{user.name || "Admin"}</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="h-9 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm text-[#344054]">
                退出登录
              </button>
            </form>
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)] bg-[#f5f7fb] p-6">{children}</main>
      </div>
    </div>
  );
}
