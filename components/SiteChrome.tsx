"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import { useSession } from "./SessionProvider";

// Shows the store header (with its sidebar menu) and footer on every page,
// except the admin panel, which has its own layout.
// Admin accounts only get the admin panel: every store page sends them to /admin.
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAdmin } = useSession();
  const onAdminRoute = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (!loading && isAdmin && !onAdminRoute) {
      router.replace("/admin");
    }
  }, [loading, isAdmin, onAdminRoute, router]);

  if (onAdminRoute) {
    return <>{children}</>;
  }

  // Hold the page back until we know the account type, so an admin never
  // sees a store page flash on screen before being redirected.
  if (loading || isAdmin) {
    return (
      <div className="session-splash" role="status">
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <>
      <Header />
      {children}
      <SiteFooter />
    </>
  );
}
