"use client";

import Link from "next/link";
import { Bell, Heart, ShoppingCart, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useSession } from "./SessionProvider";
import { Button } from "./ui/8bit/button";
import { Badge } from "./ui/8bit/badge";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "./ui/8bit/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/8bit/dropdown-menu";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading: authLoading, setUser } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [counts, setCounts] = useState({ cart: 0, wishlist: 0, unread: 0 });

  const refreshCounts = useCallback(async () => {
    if (!user) {
      setCounts({ cart: 0, wishlist: 0, unread: 0 });
      return;
    }

    const [cart, wishlist, notifications] = await Promise.allSettled([
      apiFetch<{ total_quantity?: number }>("/cart/list.php"),
      apiFetch<{ count?: number }>("/wishlist/list.php"),
      apiFetch<{ unread_count?: number }>("/notifications/list.php?limit=1"),
    ]);

    setCounts({
      cart: cart.status === "fulfilled" ? (cart.value.total_quantity ?? 0) : 0,
      wishlist:
        wishlist.status === "fulfilled" ? (wishlist.value.count ?? 0) : 0,
      unread:
        notifications.status === "fulfilled"
          ? (notifications.value.unread_count ?? 0)
          : 0,
    });
  }, [user]);

  // Refresh the badges now, every 30 seconds, when the tab regains focus,
  // and whenever another page announces a cart / wishlist / notification change.
  useEffect(() => {
    const first = setTimeout(() => void refreshCounts(), 0);
    const timer = setInterval(() => void refreshCounts(), 30000);
    const onChange = () => void refreshCounts();

    window.addEventListener("focus", onChange);
    window.addEventListener("store:counts-changed", onChange);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("store:counts-changed", onChange);
    };
  }, [refreshCounts]);

  async function logout() {
    setLoggingOut(true);

    try {
      await apiFetch("/auth/logout.php", {
        method: "POST",
      });

      setUser(null);
      setMenuOpen(false);
    } catch {
      setLoggingOut(false);
      return;
    }

    setLoggingOut(false);
  }

  const displayName =
    user?.first_name || user?.username || user?.email || "Account";

  return (
    <>
      <Drawer
        direction="left"
        open={menuOpen}
        onOpenChange={setMenuOpen}
        shouldScaleBackground={false}
      >
      <header id="nav">
        <div className="header-inner">
          <DrawerTrigger asChild>
          <Button
            className="burger-btn"
            variant="ghost"
            size="icon"
            aria-label="Open Menu"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
          </DrawerTrigger>

          <Link href="/" className="header-logo-center">
            <img
              src="/logo1.png"
              alt="Arduino Store"
              className="logo"
              onError={(event) => {
                event.currentTarget.src = "/logo2.png";
              }}
            />
          </Link>

          <div className="header-right">
            {authLoading ? (
              <span
                className="icon-btn"
                aria-label="Checking account"
                title="Checking account"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                </svg>
              </span>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="icon-btn" title={`Account: ${displayName}`} aria-label={`Account: ${displayName}`}>
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><Link href="/account">My Account</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/account/orders">Orders</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><button type="button" disabled={loggingOut} onClick={logout}>{loggingOut ? "Logging out…" : "Log out"}</button></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="icon-btn"
                title="Login"
                aria-label="Login"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </Link>
            )}

            {user && (
              <Link
                href="/account/notifications"
                className="icon-btn"
                title="Notifications"
                aria-label="Notifications"
                style={{ position: "relative" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {counts.unread > 0 && (
                  <Badge className="icon-badge" variant="default">
                    {counts.unread > 99 ? "99+" : counts.unread}
                  </Badge>
                )}
              </Link>
            )}

            {user && (
              <Link
                href="/wishlist"
                className="icon-btn"
                title="Wishlist"
                aria-label="Wishlist"
                style={{ position: "relative" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {counts.wishlist > 0 && (
                  <Badge className="icon-badge">{counts.wishlist}</Badge>
                )}
              </Link>
            )}

            <Link
              href="/cart"
              className="icon-btn"
              title="Cart"
              style={{ position: "relative" }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {counts.cart > 0 && (
                <Badge className="icon-badge">
                  {counts.cart > 99 ? "99+" : counts.cart}
                </Badge>
              )}
            </Link>
          </div>
        </div>
      </header>

      <DrawerContent side="left" className="sidebar" aria-describedby={undefined}>
        <DrawerTitle className="sr-only">Store navigation</DrawerTitle>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <img src="/logo2.png" alt="Arduino Store" className="s-logo" />
            <span className="s-brand-name">Arduino Store</span>
          </div>

          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="s-close-btn"
              title="Close"
              aria-label="Close menu"
            >
              ×
            </Button>
          </DrawerClose>
        </div>

        <div className="sidebar-auth">
          {authLoading ? (
            <span className="s-auth-btn primary">Checking...</span>
          ) : user ? (
            <>
              <div className="s-auth-user">
                <span>Signed in as</span>
                <strong>{displayName}</strong>
              </div>

              <Link
                href="/account"
                className="s-auth-btn primary"
                onClick={() => setMenuOpen(false)}
              >
                My Account
              </Link>

              <Button
                variant="outline"
                type="button"
                className="s-auth-btn"
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging Out..." : "Log Out"}
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="s-auth-btn primary"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="s-auth-btn"
                onClick={() => setMenuOpen(false)}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          <Link
            href="/"
            className="s-item active"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <span className="s-label">Home</span>
          </Link>

          <Link
            href="/products"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </span>
            <span className="s-label">Products</span>
          </Link>

          <div className="s-divider" />

          <Link
            href="/account"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon"><UserRound size={18} aria-hidden="true" /></span>
            <span className="s-label">Account</span>
          </Link>

          <Link
            href="/cart"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon"><ShoppingCart size={18} aria-hidden="true" /></span>
            <span className="s-label">Cart</span>
            {counts.cart > 0 && <span className="s-count">{counts.cart}</span>}
          </Link>

          <Link
            href="/wishlist"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon"><Heart size={18} aria-hidden="true" /></span>
            <span className="s-label">Wishlist</span>
            {counts.wishlist > 0 && (
              <span className="s-count">{counts.wishlist}</span>
            )}
          </Link>

          {user && (
            <Link
              href="/account/notifications"
              className="s-item"
              onClick={() => setMenuOpen(false)}
            >
              <span className="s-icon"><Bell size={18} aria-hidden="true" /></span>
              <span className="s-label">Notifications</span>
              {counts.unread > 0 && (
                <span className="s-count">{counts.unread}</span>
              )}
            </Link>
          )}

          <div className="s-divider" />

          <Link
            href="/contact"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">Contact Us</span>
          </Link>

          <Link
            href="/about"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">About</span>
          </Link>

          <Link
            href="/faq"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">FAQ</span>
          </Link>

          <Link
            href="/terms"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">Terms</span>
          </Link>

          <Link
            href="/rules"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">Rules</span>
          </Link>

          <Link
            href="/shipping"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">Shipping</span>
          </Link>

          <Link
            href="/returns"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-label">Returns</span>
          </Link>
        </nav>
      </DrawerContent>
      </Drawer>
    </>
  );
}
