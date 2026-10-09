"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/8bit/button";

const tabs = [
  { href: "/account/profile", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/vouchers", label: "Vouchers" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/security", label: "Security" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav className="account-tabs" aria-label="Account sections">
        <div className="account-tabs-inner">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Button
                key={tab.href}
                asChild
                variant={active ? "default" : "ghost"}
                className={active ? "active" : ""}
              >
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
