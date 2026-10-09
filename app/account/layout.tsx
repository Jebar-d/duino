"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={pathname.startsWith(tab.href) ? "active" : ""}
              aria-current={pathname.startsWith(tab.href) ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
