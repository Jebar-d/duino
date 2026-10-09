"use client";

import "./admin.css";

import { useCallback, useEffect, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { apiFetch } from "../../lib/api";
import { Button } from "@/components/ui/8bit/button";
import { Input } from "@/components/ui/8bit/input";
import { Label } from "@/components/ui/8bit/label";
import { Skeleton } from "@/components/ui/8bit/skeleton";
import type { Tab, User } from "./_components/types";
import { tabs } from "./_components/navigation";
import { AdminSidebar } from "./_components/AdminSidebar";
import { AnalyticsView } from "./_components/AnalyticsView";
import { CategoriesView } from "./_components/CategoriesView";
import { DashboardView } from "./_components/DashboardView";
import { MessagesView } from "./_components/MessagesView";
import { OrdersView } from "./_components/OrdersView";
import { PlaceholderView } from "./_components/PlaceholderView";
import { ProductsView } from "./_components/ProductsView";
import { PromosView } from "./_components/PromosView";
import { RefundsView } from "./_components/RefundsView";
import { UsersView } from "./_components/UsersView";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);

  // Must keep the same identity between renders: child views list it in
  // their useEffect dependencies, so a new function every render made the
  // admin pages reload forever (flicker + spinner).
  const showToast = useCallback((message: string, type = "info") => {
    if (type === "success") {
      sonnerToast.success(message);
    } else if (type === "error" || type === "danger") {
      sonnerToast.error(message);
    } else {
      sonnerToast(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const data = await apiFetch<{ success: boolean; user: User | null }>(
          "/auth/user/me.php",
        );

        if (!mounted) {
          return;
        }

        setUser(data.user ?? null);
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  async function verifyCode() {
    if (!adminCode.trim()) {
      setCodeError("Enter the admin code.");
      return;
    }

    setCodeError("");

    try {
      const data = await apiFetch<{
        success: boolean;
        user: User;
      }>("/admin/verify.php", {
        method: "POST",
        body: JSON.stringify({
          code: adminCode,
        }),
      });

      setUser(data.user);
      setAuthorized(true);
      setAdminCode("");
    } catch (error) {
      setCodeError(
        error instanceof Error ? error.message : "Incorrect admin code.",
      );
    }
  }

  async function signOut() {
    try {
      await apiFetch("/auth/logout.php", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } finally {
      window.location.replace("/login");
    }
  }

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
  }

  if (authLoading) {
    return (
      <div className="adm-gate">
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admin Access</h2>
          <p>Verifying session…</p>
          <div className="adm-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="adm-gate">
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admin Access</h2>
          <p>
            Please{" "}
            <a href="/login" className="text-foreground underline underline-offset-4">
              log in
            </a>{" "}
            to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="adm-gate">
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admins only</h2>
          <p>
            This account does not have admin access.{" "}
            <a href="/products" className="text-foreground underline underline-offset-4">
              Back to the store
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="adm-gate">
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admin Access</h2>

          <p>
            Welcome back, {(user.email || "admin").split("@")[0]}. Enter your
            admin code:
          </p>

          <div className="fg text-left">
            <Label htmlFor="admin-code">Admin Code</Label>
            <Input
              id="admin-code"
              type="password"
              value={adminCode}
              placeholder="Enter secret code"
              onChange={(event) => setAdminCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  verifyCode();
                }
              }}
            />
          </div>

          <Button
            className="adm-btn adm-btn-p adm-btn-full"
            size="lg"
            onClick={verifyCode}
          >
            Continue →
          </Button>

          {codeError && <p className="adm-code-error">{codeError}</p>}

          <div className="mt-4">
            <Button
              onClick={signOut}
              variant="destructive"
              className="adm-btn adm-btn-d adm-btn-full"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const initials = (user.email || user.username || "A").charAt(0).toUpperCase();

  const currentLabel =
    tabs.find((item) => item.id === tab)?.label || "Dashboard";

  return (
    <div className="adm-page">
      <div className="adm-layout">
        <AdminSidebar
          user={user}
          tab={tab}
          onTabChange={changeTab}
          onSignOut={signOut}
        />

        <div className="adm-main">
          <div className="adm-topbar">
            <div className="adm-breadcrumb">
              Admin / <span>{currentLabel}</span>
            </div>

            <div className="adm-user-badge">
              <div className="adm-avatar">{initials}</div>
              <span>
                {user.first_name ||
                  user.username ||
                  (user.email || "Admin").split("@")[0]}
              </span>
            </div>
          </div>

          <main className="adm-content">
            {tab === "dashboard" && (
              <DashboardView
                user={user}
                onTab={changeTab}
                showToast={showToast}
                setLoading={setLoading}
              />
            )}

            {tab === "analytics" && (
              <AnalyticsView showToast={showToast} setLoading={setLoading} />
            )}

            {tab === "products" && (
              <ProductsView showToast={showToast} setLoading={setLoading} />
            )}

            {tab === "categories" && <CategoriesView showToast={showToast} />}

            {tab === "promos" && (
              <PromosView showToast={showToast} />
            )}

            {tab === "orders" && (
              <OrdersView showToast={showToast} />
            )}

            {tab === "users" && (
              <UsersView showToast={showToast} currentUserId={user.id} />
            )}

            {tab === "messages" && <MessagesView showToast={showToast} />}

            {tab === "refunds" && (
              <RefundsView showToast={showToast} />
            )}

            {tab === "admins" && (
              <PlaceholderView
                title="Admin Users"
                description="Manage administrator accounts."
              />
            )}
          </main>
        </div>
      </div>

      {loading && (
        <div className="adm-loading-overlay" role="status" aria-label="Loading">
          <Skeleton className="h-4 w-48" />
        </div>
      )}
    </div>
  );
}

