import { useEffect, useState } from "react";
import { Activity, Box, ChartNoAxesColumnIncreasing, Package } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { getProductImageUrl, handleProductImageError } from "../../../lib/product-assets";
import type { AnalyticsData } from "./types";
import { escapeText, money, moneyWhole, normalizeAnalytics, paymentLabel } from "./utils";
import { AnalyticsStat } from "./AnalyticsStat";

export function AnalyticsView({
  showToast,
  setLoading,
}: {
  showToast: (message: string, type?: string) => void;
  setLoading: (value: boolean) => void;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      try {
        const result = await apiFetch<{
          success: boolean;
          analytics: AnalyticsData;
        }>("/admin/analytics.php");

        if (mounted) {
          setData(normalizeAnalytics(result.analytics));
        }
      } catch (error) {
        if (mounted) {
          showToast(
            error instanceof Error
              ? error.message
              : "Unable to load analytics.",
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

  const analytics = data || {
    total_revenue_cents: 0,
    month_revenue_cents: 0,
    total_orders: 0,
    paid_orders: 0,
    pending_orders: 0,
    cancelled_orders: 0,
    monthly_revenue: [],
    payment_methods: [],
    order_statuses: [],
    top_products: [],
  };

  const maxRevenue = Math.max(
    ...analytics.monthly_revenue.map((item) => item.revenue_cents),
    1,
  );

  const paymentTotal =
    analytics.payment_methods.reduce((total, item) => total + item.count, 0) ||
    1;

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Analytics</div>
          <div className="adm-ph-sub">Revenue and sales overview</div>
        </div>
      </div>

      <div className="an-grid">
        <AnalyticsStat
          value={moneyWhole(analytics.total_revenue_cents)}
          label="Total Revenue"
          sub="All-time paid"
        />

        <AnalyticsStat
          value={moneyWhole(analytics.month_revenue_cents)}
          label="This Month"
          sub={`${analytics.monthly_revenue.reduce(
            (total, item) => total + item.order_count,
            0,
          )} orders`}
        />

        <AnalyticsStat
          value={analytics.total_orders}
          label="Total Orders"
          sub={`${analytics.paid_orders} paid`}
        />

        <AnalyticsStat
          value={analytics.pending_orders}
          label="Pending / Processing"
          sub={`${analytics.cancelled_orders} cancelled`}
        />

        <AnalyticsStat
          value={
            analytics.paid_orders > 0
              ? moneyWhole(
                  Math.round(
                    analytics.total_revenue_cents / analytics.paid_orders,
                  ),
                )
              : "—"
          }
          label="Avg. Order Value"
          sub="Paid orders only"
        />
      </div>

      <div className="an-section">
        <h4><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /> Monthly Revenue — Last 6 Months</h4>

        {analytics.monthly_revenue.length ? (
          analytics.monthly_revenue.map((month) => (
            <div className="bar-row" key={month.label}>
              <div className="bar-label">{month.label}</div>

              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max(
                      month.revenue_cents > 0
                        ? (month.revenue_cents / maxRevenue) * 100
                        : 0,
                      month.revenue_cents > 0 ? 3 : 0,
                    )}%`,
                  }}
                >
                  {month.revenue_cents > 0 && (
                    <span className="bar-val">
                      {moneyWhole(month.revenue_cents)}
                    </span>
                  )}
                </div>
              </div>

              <div className="bar-orders">{month.order_count} orders</div>
            </div>
          ))
        ) : (
          <p className="adm-muted">No sales data yet.</p>
        )}
      </div>

      <div className="an-two">
        <div className="an-section">
          <h4><Activity size={16} aria-hidden="true" /> Payment Methods</h4>

          {analytics.payment_methods.length ? (
            analytics.payment_methods.map((payment) => {
              const percentage = (payment.count / paymentTotal) * 100;

              return (
                <div
                  className="bar-row"
                  style={{ marginBottom: "0.5rem" }}
                  key={payment.method}
                >
                  <div className="bar-label" style={{ width: "70px" }}>
                    {paymentLabel(payment.method)}
                  </div>

                  <div className="bar-track" style={{ height: "22px" }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${percentage}%`,
                      }}
                    >
                      <span className="bar-val">
                        {payment.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="adm-muted">No paid orders yet.</p>
          )}
        </div>

        <div className="an-section">
          <h4><Package size={16} aria-hidden="true" /> Order Status Breakdown</h4>

          {analytics.order_statuses.length ? (
            analytics.order_statuses.map((item) => {
              const percentage =
                analytics.total_orders > 0
                  ? (item.count / analytics.total_orders) * 100
                  : 0;

              return (
                <div
                  className="bar-row"
                  style={{ marginBottom: "0.5rem" }}
                  key={item.status}
                >
                  <div
                    className="bar-label"
                    style={{
                      width: "75px",
                      textTransform: "capitalize",
                    }}
                  >
                    {item.status}
                  </div>

                  <div className="bar-track" style={{ height: "22px" }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${percentage}%`,
                      }}
                    >
                      <span className="bar-val">{item.count}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="adm-muted">No order data yet.</p>
          )}
        </div>
      </div>

      <div className="an-section">
        <h4><Box size={16} aria-hidden="true" /> Top Products by Units Sold</h4>

        {analytics.top_products.length ? (
          analytics.top_products.map((product, index) => (
            <div className="top-prod-row" key={`${product.name}-${index}`}>
              <div className="top-rank">#{index + 1}</div>

              <img
                src={getProductImageUrl(product.img_url)}
                alt={product.name}
                onError={handleProductImageError}
              />

              <div style={{ flex: 1 }}>
                <div className="top-product-name">
                  {escapeText(product.name)}
                </div>

                <div className="adm-small adm-muted">
                  {money(product.revenue_cents)} revenue
                </div>
              </div>

              <div className="top-product-qty">{product.qty} sold</div>
            </div>
          ))
        ) : (
          <p className="adm-muted">No sales data yet.</p>
        )}
      </div>
    </>
  );
}
