import { useEffect, useState } from "react";
import { Banknote, Box, Package, Percent, TicketPercent, Truck, Users } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import type { DashboardData, Order, Tab, User } from "./types";
import { money, moneyWhole } from "./utils";
import { StatusBadge } from "./StatusBadge";
import { QuickCard } from "./QuickCard";
import { StatCard } from "./StatCard";

export function DashboardView({
  user,
  onTab,
  showToast,
  setLoading,
}: {
  user: User;
  onTab: (tab: Tab) => void;
  showToast: (message: string, type?: string) => void;
  setLoading: (value: boolean) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      try {
        const result = await apiFetch<{
          success: boolean;
          dashboard: DashboardData;
        }>("/admin/dashboard.php");

        if (mounted) {
          setData(result.dashboard);
        }
      } catch (error) {
        if (mounted) {
          showToast(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard.",
            "error",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [setLoading, showToast]);

  const stats = data || {
    product_count: 0,
    order_count: 0,
    user_count: 0,
    promo_count: 0,
    revenue_cents: 0,
    recent_orders: [],
  };

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Dashboard</div>
          <div className="adm-ph-sub">
            Welcome back, {(user.email || "admin").split("@")[0]}!
          </div>
        </div>
      </div>

      <div className="adm-stats-grid">
        <StatCard
          icon={Package}
          iconClass="ic-teal"
          value={stats.product_count}
          label="Products"
        />

        <StatCard
          icon={Box}
          iconClass="ic-green"
          value={stats.order_count}
          label="Orders"
        />

        <StatCard
          icon={Users}
          iconClass="ic-orange"
          value={stats.user_count}
          label="Users"
        />

        <StatCard
          icon={Percent}
          iconClass="ic-teal"
          value={stats.promo_count}
          label="Promos"
        />

        <StatCard
          icon={Banknote}
          iconClass="ic-green"
          value={moneyWhole(stats.revenue_cents)}
          label="Revenue (Paid)"
        />
      </div>

      <div className="adm-section-title">Recent Orders</div>

      <div className="adm-tw" style={{ marginBottom: "1.75rem" }}>
        <table className="adm-t">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {stats.recent_orders.length ? (
              stats.recent_orders.map((order) => (
                <tr key={order.id}>
                  <td className="adm-mono">
                    #{order.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="adm-muted">{order.customer_email || "—"}</td>
                  <td>{money(order.total_cents)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="adm-muted adm-small">
                    {new Date(order.created_at).toLocaleDateString("en-PH")}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="adm-empty">No orders yet</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="adm-section-title">Quick Access</div>

      <div className="adm-qgrid">
        <QuickCard
          icon={Package}
          title="Inventory"
          description="Manage products, categories, and stock quantities."
          onClick={() => onTab("inventory")}
        />

        <QuickCard
          icon={TicketPercent}
          title="Promos"
          description="Create discount codes and send notifications."
          onClick={() => onTab("promos")}
        />

        <QuickCard
          icon={Truck}
          title="Orders"
          description="View and update order statuses."
          onClick={() => onTab("orders")}
        />

        <QuickCard
          icon={Users}
          title="Users"
          description="Manage user profiles and send messages."
          onClick={() => onTab("users")}
        />
      </div>
    </>
  );
}
