"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Header from "./Header";
import SiteFooter from "./SiteFooter";

// Shows the store header (with its sidebar menu) and footer on every page,
// except the admin panel, which has its own layout.
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <SiteFooter />
    </>
  );
}
