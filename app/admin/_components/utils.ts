import type { AnalyticsData, RawAnalytics } from "./types";

export function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return value;
  }

  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

// Accepts both the old and the new backend field names so the charts never
// get an undefined key/label.
export function normalizeAnalytics(raw: RawAnalytics | null | undefined): AnalyticsData {
  const monthlyRevenue = Array.isArray(raw?.monthly_revenue)
    ? raw.monthly_revenue
    : [];
  const paymentMethods = Array.isArray(raw?.payment_methods)
    ? raw.payment_methods
    : [];
  const orderStatuses = Array.isArray(raw?.order_statuses)
    ? raw.order_statuses
    : [];
  const topProducts = Array.isArray(raw?.top_products) ? raw.top_products : [];

  return {
    total_revenue_cents: raw?.total_revenue_cents ?? 0,
    month_revenue_cents: raw?.month_revenue_cents ?? 0,
    total_orders: raw?.total_orders ?? 0,
    paid_orders: raw?.paid_orders ?? 0,
    pending_orders: raw?.pending_orders ?? 0,
    cancelled_orders: raw?.cancelled_orders ?? 0,
    monthly_revenue: monthlyRevenue.map((item, index) => ({
      label: item.label ?? (item.month ? monthLabel(item.month) : `Month ${index + 1}`),
      revenue_cents: item.revenue_cents ?? 0,
      order_count: item.order_count ?? 0,
    })),
    payment_methods: paymentMethods,
    order_statuses: orderStatuses,
    top_products: topProducts.map((item) => ({
      name: item.name ?? item.product_name ?? "Unknown product",
      img_url: item.img_url ?? null,
      qty: item.qty ?? item.units_sold ?? 0,
      revenue_cents: item.revenue_cents ?? 0,
    })),
  };
}

export function money(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function moneyWhole(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  })}`;
}

export function escapeText(value: unknown) {
  return String(value ?? "");
}

export function statusClass(status: string) {
  const value = status.toLowerCase();

  if (value === "paid" || value === "delivered") {
    return "b b-g";
  }

  if (value === "cancelled" || value === "rejected") {
    return "b b-r";
  }

  if (value === "pending" || value === "processing") {
    return "b b-o";
  }

  if (value === "shipped") {
    return "b b-t";
  }

  return "b b-gray";
}

export function paymentLabel(method: string) {
  const labels: Record<string, string> = {
    gcash: "GCash",
    maya: "Maya",
    card: "Card",
    cod: "COD",
  };

  return labels[method] || method;
}
