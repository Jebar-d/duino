"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type User = {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  contact_number: string | null;
  address: string | null;
  terms_accepted: boolean;
  rules_accepted: boolean;
  created_at: string;
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ user: User }>("/auth/user/me.php");
        setUser(data.user || null);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

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
      <header id="nav">
        <div className="header-inner">
          <button
            className="burger-btn"
            aria-label="Open Menu"
            onClick={() => setMenuOpen(true)}
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
          </button>

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
              <Link
                href="/account"
                className="icon-btn"
                title={`Account: ${displayName}`}
                aria-label={`Account: ${displayName}`}
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
              </Link>
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
            </Link>
          </div>
        </div>
      </header>

      <div
        className={`sidebar-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <img src="/logo2.png" alt="Arduino Store" className="s-logo" />
            <span className="s-brand-name">Arduino Store</span>
          </div>

          <button
            className="s-close-btn"
            onClick={() => setMenuOpen(false)}
            title="Close"
            aria-label="Close menu"
          >
            ×
          </button>
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

              <button
                type="button"
                className="s-auth-btn"
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging Out..." : "Log Out"}
              </button>
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
            <span className="s-icon">👤</span>
            <span className="s-label">Account</span>
          </Link>

          <Link
            href="/cart"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon">🛒</span>
            <span className="s-label">Cart</span>
          </Link>

          <Link
            href="/wishlist"
            className="s-item"
            onClick={() => setMenuOpen(false)}
          >
            <span className="s-icon">♡</span>
            <span className="s-label">Wishlist</span>
          </Link>

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
        </nav>
      </aside>
    </>
  );
}
