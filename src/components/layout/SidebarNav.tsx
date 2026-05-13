"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getSelectedRoute, type AppRoute } from "@/lib/routes";

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

type SidebarNavProps = {
  routes: AppRoute[];
};

type PendingSelection = {
  path: string;
  fromPath: string;
};

export default function SidebarNav({ routes }: SidebarNavProps) {
  const pathname = usePathname();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const selectedKey = pendingSelection?.fromPath === pathname ? pendingSelection.path : getSelectedRoute(pathname);

  return (
    <nav className="px-2 py-3">
      {routes.map((route) => {
        const selected = selectedKey === route.path;
        return (
          <Link
            key={route.path}
            href={route.path}
            prefetch
            aria-current={selected ? "page" : undefined}
            className={[
              "sidebar-menu-item mb-1 flex h-10 items-center overflow-hidden rounded-lg border-l-[3px] px-3 text-sm no-underline transition",
              selected ? "sidebar-menu-item-selected font-semibold" : "border-transparent font-normal",
            ].join(" ")}
            title={route.menuLabel}
            onClick={() => {
              if (route.path !== pathname) setPendingSelection({ path: route.path, fromPath: pathname });
            }}
          >
            <span className="sidebar-menu-icon mr-3 inline-flex w-4 shrink-0 items-center justify-center text-xs">{iconMap[route.iconKey] ?? "•"}</span>
            <span className="min-w-0 truncate">{route.menuLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
