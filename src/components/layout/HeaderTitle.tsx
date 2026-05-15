"use client";

import { usePathname } from "next/navigation";
import { getRouteTitle } from "@/lib/routes";

export default function HeaderTitle() {
  const pathname = usePathname();
  return <h1 className="m-0 truncate text-xl font-semibold leading-8 text-[var(--foreground)]">{getRouteTitle(pathname)}</h1>;
}
