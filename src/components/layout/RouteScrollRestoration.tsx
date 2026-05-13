"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function RouteScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector("[data-admin-main]")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [pathname, searchParams]);

  return null;
}
