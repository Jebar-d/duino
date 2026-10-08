"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "../../lib/api";

type User = {
  id: string;
  email?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_admin?: boolean;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  used_count: number;
  is_free_shipping: boolean;
  min_order_cents: number;
  description: string | null;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  description?: string | null;
  img_url?: string | null;
  category_id?: string | null;
  sku?: string | null;
  category_name?: string | null;
};

type Order = {
  id: string;
  total_cents: number;
  status: string;
  created_at: string;
  payment_method?: string | null;
  user_id?: string | null;
  customer_email?: string | null;
};

type DashboardData = {
  product_count: number;
  order_count: number;
  user_count: number;
  promo_count: number;
  revenue_cents: number;
  recent_orders: Order[];
};

type AnalyticsData = {
  total_revenue_cents: number;
  month_revenue_cents: number;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  monthly_revenue: {
    label: string;
    revenue_cents: number;
    order_count: number;
  }[];
  payment_methods: {
    method: string;
    count: number;
  }[];
  order_statuses: {
    status: string;
    count: number;
  }[];
  top_products: {
    name: string;
    img_url?: string | null;
    qty: number;
    revenue_cents: number;
  }[];
};

type RawAnalytics = Partial<Omit<AnalyticsData, "monthly_revenue" | "top_products">> & {
  monthly_revenue?: {
    month?: string;
    label?: string;
    revenue_cents?: number;
    order_count?: number;
  }[];
  top_products?: {
    name?: string;
    product_name?: string;
    img_url?: string | null;
    qty?: number;
    units_sold?: number;
    revenue_cents?: number;
  }[];
};

function monthLabel(value: string) {
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
function normalizeAnalytics(raw: RawAnalytics): AnalyticsData {
  return {
    total_revenue_cents: raw.total_revenue_cents ?? 0,
    month_revenue_cents: raw.month_revenue_cents ?? 0,
    total_orders: raw.total_orders ?? 0,
    paid_orders: raw.paid_orders ?? 0,
    pending_orders: raw.pending_orders ?? 0,
    cancelled_orders: raw.cancelled_orders ?? 0,
    monthly_revenue: (raw.monthly_revenue ?? []).map((item, index) => ({
      label: item.label ?? (item.month ? monthLabel(item.month) : `Month ${index + 1}`),
      revenue_cents: item.revenue_cents ?? 0,
      order_count: item.order_count ?? 0,
    })),
    payment_methods: raw.payment_methods ?? [],
    order_statuses: raw.order_statuses ?? [],
    top_products: (raw.top_products ?? []).map((item) => ({
      name: item.name ?? item.product_name ?? "Unknown product",
      img_url: item.img_url ?? null,
      qty: item.qty ?? item.units_sold ?? 0,
      revenue_cents: item.revenue_cents ?? 0,
    })),
  };
}

type Tab =
  | "dashboard"
  | "analytics"
  | "products"
  | "categories"
  | "promos"
  | "orders"
  | "users"
  | "refunds"
  | "admins";

const tabs: {
  id: Tab;
  label: string;
  icon: string;
  section?: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞", section: "Overview" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "products", label: "Products", icon: "📦", section: "Catalog" },
  { id: "categories", label: "Categories", icon: "🏷️" },
  { id: "promos", label: "Promos", icon: "🎟️" },
  { id: "orders", label: "Orders", icon: "🚚", section: "Manage" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "refunds", label: "Refunds", icon: "↩️" },
  { id: "admins", label: "Admin Users", icon: "🔑" },
];

function money(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function moneyWhole(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  })}`;
}

function escapeText(value: unknown) {
  return String(value ?? "");
}

function statusClass(status: string) {
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

function StatusBadge({ status }: { status: string }) {
  return <span className={statusClass(status)}>{status}</span>;
}

function CategoriesView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function loadCategories() {
    try {
      setLoadingCategories(true);

      const data = await apiFetch<{
        success: boolean;
        categories: Category[];
      }>("/categories/list.php");

      setCategories(data.categories ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load categories.",
        "error",
      );
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    async function load() {
      await loadCategories();
    }

    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSlug("");
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setSlug(category.slug);
  }

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(value: string) {
    setName(value);

    if (!editingId) {
      setSlug(makeSlug(value));
    }
  }

  async function saveCategory() {
    if (!name.trim()) {
      showToast("Category name is required.", "error");
      return;
    }

    if (!slug.trim()) {
      showToast("Category slug is required.", "error");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await apiFetch("/categories/update.php", {
          method: "POST",
          body: JSON.stringify({
            id: editingId,
            name: name.trim(),
            slug: slug.trim(),
          }),
        });

        showToast("Category updated successfully.", "success");
      } else {
        await apiFetch("/categories/create.php", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
          }),
        });

        showToast("Category created successfully.", "success");
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save category.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(categoryId: string, categoryName: string) {
    const confirmed = window.confirm(`Delete category "${categoryName}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await apiFetch("/categories/delete.php", {
        method: "POST",
        body: JSON.stringify({
          id: categoryId,
        }),
      });

      showToast("Category deleted successfully.", "success");

      if (editingId === categoryId) {
        resetForm();
      }

      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete category.",
        "error",
      );
    }
  }

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage product categories for your store.</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>{editingId ? "Edit Category" : "Add Category"}</h2>
              <p>
                {editingId
                  ? "Update the selected category."
                  : "Create a new product category."}
              </p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="e.g. Arduino Boards"
              />
            </label>

            <label>
              <span>Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="e.g. arduino-boards"
              />
            </label>

            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-primary-button"
                onClick={saveCategory}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Category"
                    : "Add Category"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Categories</h2>
              <p>{categories.length} categories</p>
            </div>
          </div>

          {loadingCategories ? (
            <div className="admin-empty-state">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="admin-empty-state">No categories found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <strong>{category.name}</strong>
                      </td>

                      <td>
                        <code>{category.slug}</code>
                      </td>

                      <td>
                        <div className="admin-table-actions">
                          <button
                            type="button"
                            className="admin-small-button"
                            onClick={() => startEdit(category)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="admin-small-button admin-danger-button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void deleteCategory(category.id, category.name);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PromosView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [description, setDescription] = useState("");

  async function loadPromos() {
    try {
      setLoadingPromos(true);
      const data = await apiFetch<{ success: boolean; promos: Promo[] }>(
        "/promos/list.php",
      );
      setPromos(data.promos ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load promos.",
        "error",
      );
    } finally {
      setLoadingPromos(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPromos();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setDiscountPercent("0");
    setValidFrom("");
    setValidUntil("");
    setMaxUses("");
    setFreeShipping(false);
    setMinOrderAmount("0");
    setDescription("");
  }

  function toDateTimeInput(value: string) {
    return value ? value.replace(" ", "T").slice(0, 16) : "";
  }

  function startEdit(promo: Promo) {
    setEditingId(promo.id);
    setCode(promo.code);
    setDiscountPercent(String(promo.discount_percent));
    setValidFrom(toDateTimeInput(promo.valid_from));
    setValidUntil(toDateTimeInput(promo.valid_until));
    setMaxUses(promo.max_uses === null ? "" : String(promo.max_uses));
    setFreeShipping(promo.is_free_shipping);
    setMinOrderAmount((promo.min_order_cents / 100).toFixed(2));
    setDescription(promo.description ?? "");
  }

  function validateForm() {
    const normalizedCode = code.trim().toUpperCase();
    const discount = Number(discountPercent);
    const minimum = Number(minOrderAmount);
    const uses = maxUses.trim() === "" ? null : Number(maxUses);

    if (!normalizedCode) {
      showToast("Promo code is required.", "error");
      return null;
    }

    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      showToast("Promo code may only contain letters, numbers, underscores, and hyphens.", "error");
      return null;
    }

    if (!Number.isInteger(discount) || discount < 0 || discount > 100) {
      showToast("Discount must be a whole number from 0 to 100.", "error");
      return null;
    }

    if (!validFrom || !validUntil) {
      showToast("Valid from and valid until dates are required.", "error");
      return null;
    }

    if (new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
      showToast("Valid until must be after valid from.", "error");
      return null;
    }

    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) {
      showToast("Maximum uses must be a whole number of at least 1.", "error");
      return null;
    }

    if (!Number.isFinite(minimum) || minimum < 0) {
      showToast("Minimum order amount cannot be negative.", "error");
      return null;
    }

    return {
      code: normalizedCode,
      discount_percent: discount,
      valid_from: validFrom,
      valid_until: validUntil,
      max_uses: uses,
      is_free_shipping: freeShipping,
      min_order_cents: Math.round(minimum * 100),
      description: description.trim(),
    };
  }

  async function savePromo() {
    const payload = validateForm();

    if (!payload) {
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await apiFetch("/promos/update.php", {
          method: "POST",
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        showToast("Promo updated successfully.", "success");
      } else {
        await apiFetch("/promos/create.php", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Promo created successfully.", "success");
      }

      resetForm();
      await loadPromos();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save promo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePromo(promo: Promo) {
    if (!window.confirm(`Delete promo "${promo.code}"?`)) {
      return;
    }

    try {
      setDeletingId(promo.id);
      await apiFetch("/promos/delete.php", {
        method: "POST",
        body: JSON.stringify({ id: promo.id }),
      });
      showToast("Promo deleted successfully.", "success");

      if (editingId === promo.id) {
        resetForm();
      }

      await loadPromos();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete promo.",
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div>
          <h1>Promos</h1>
          <p>Create and manage discount codes for your store.</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>{editingId ? "Edit Promo" : "Add Promo"}</h2>
              <p>{editingId ? "Update the selected promotion." : "Create a new promotion."}</p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              <span>Promo Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. SAVE10" />
            </label>

            <label>
              <span>Discount Percentage</span>
              <input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
            </label>

            <label>
              <span>Valid From</span>
              <input type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
            </label>

            <label>
              <span>Valid Until</span>
              <input type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </label>

            <label>
              <span>Maximum Uses</span>
              <input type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder="Unlimited" />
            </label>

            <label>
              <span>Minimum Order Amount (₱)</span>
              <input type="number" min="0" step="0.01" value={minOrderAmount} onChange={(event) => setMinOrderAmount(event.target.value)} />
            </label>

            <label className="admin-checkbox-label">
              <input type="checkbox" checked={freeShipping} onChange={(event) => setFreeShipping(event.target.checked)} />
              <span>Free shipping</span>
            </label>

            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional promo details" rows={3} />
            </label>

            <div className="admin-form-actions">
              <button type="button" className="admin-primary-button" onClick={savePromo} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Promo" : "Add Promo"}
              </button>

              {editingId && (
                <button type="button" className="admin-secondary-button" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Promos</h2>
              <p>{promos.length} active promos</p>
            </div>
          </div>

          {loadingPromos ? (
            <div className="admin-empty-state">Loading promos...</div>
          ) : promos.length === 0 ? (
            <div className="admin-empty-state">No active promos found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Validity</th>
                    <th>Uses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => (
                    <tr key={promo.id}>
                      <td><strong>{promo.code}</strong>{promo.description && <div className="admin-promo-description">{promo.description}</div>}</td>
                      <td>{promo.discount_percent}%{promo.is_free_shipping ? " + Free Shipping" : ""}<div className="admin-promo-description">Min. ₱{(promo.min_order_cents / 100).toFixed(2)}</div></td>
                      <td>{new Date(promo.valid_from).toLocaleDateString("en-PH")} – {new Date(promo.valid_until).toLocaleDateString("en-PH")}</td>
                      <td>{promo.used_count} / {promo.max_uses ?? "∞"}</td>
                      <td>
                        <div className="admin-table-actions">
                          <button type="button" className="admin-small-button" onClick={() => startEdit(promo)} disabled={deletingId === promo.id}>Edit</button>
                          <button type="button" className="admin-small-button admin-danger-button" onClick={() => void deletePromo(promo)} disabled={deletingId === promo.id}>
                            {deletingId === promo.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type OrderItemDetail = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty: number;
  price_cents: number;
  product_name: string | null;
  product_img: string | null;
  subtotal_cents: number;
};

type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

type AdminOrder = {
  id: string;
  user_id?: string;
  total_cents: number;
  promo_code: string | null;
  status: string;
  shipping_address: ShippingAddress | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  tracking_status: string;
  expected_delivery: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  email_confirmed: boolean;
  items: OrderItemDetail[];
  item_count: number;
};

type AdminOrderSummary = Omit<AdminOrder, "user_id" | "shipping_address"> & {
  shipping_address: string | null;
};

function OrdersView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  async function loadOrders() {
    try {
      setLoadingOrders(true);
      const data = await apiFetch<{
        success: boolean;
        orders: AdminOrderSummary[];
      }>("/orders/list.php");
      setOrders(data.orders ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load orders.",
        "error",
      );
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function formatDate(value: string) {
    return new Date(value.replace(" ", "T")).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatValue(value: string) {
    return value
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatPaymentMethod(value: string) {
    return value === "cod" ? "Cash on Delivery" : formatValue(value);
  }

  function addressLines(address: ShippingAddress | string | null) {
    if (!address) {
      return [];
    }

    let value: ShippingAddress;

    if (typeof address === "string") {
      try {
        const parsed = JSON.parse(address);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return [];
        }

        value = parsed as ShippingAddress;
      } catch {
        return [];
      }
    } else {
      value = address;
    }

    return [
      [value.first_name, value.last_name].filter(Boolean).join(" "),
      value.contact_number ?? "",
      value.address ?? "",
      [value.city, value.province, value.postal_code]
        .filter(Boolean)
        .join(", "),
    ].filter(Boolean);
  }

  async function viewOrder(orderId: string) {
    try {
      setSelectedOrder(null);
      setDetailsError("");
      setDetailsLoading(true);
      const data = await apiFetch<{ success: boolean; order: AdminOrder }>(
        `/orders/get.php?id=${encodeURIComponent(orderId)}`,
      );
      setSelectedOrder(data.order);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load order details.";
      setDetailsError(message);
      showToast(message, "error");
    } finally {
      setDetailsLoading(false);
    }
  }

  const selectedAddress = addressLines(selectedOrder?.shipping_address ?? null);

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Orders</div>
          <div className="adm-ph-sub">View order details and customer delivery information.</div>
        </div>
      </div>

      <div className="adm-tw">
        <table className="adm-t">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer Email</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Shipping Address</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingOrders ? (
              <tr><td colSpan={8}><div className="adm-empty">Loading orders...</div></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8}><div className="adm-empty">No orders found.</div></td></tr>
            ) : (
              orders.map((order) => {
                const address = addressLines(order.shipping_address);

                return (
                  <tr key={order.id}>
                    <td className="adm-mono">#{order.id.substring(0, 8).toUpperCase()}</td>
                    <td className="adm-muted">Unavailable</td>
                    <td className="adm-muted adm-small">{formatDate(order.created_at)}</td>
                    <td>{money(order.total_cents)}</td>
                    <td>{formatPaymentMethod(order.payment_method)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="adm-small">{address.length ? address.join(", ") : "—"}</td>
                    <td><button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => void viewOrder(order.id)}>View</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(detailsLoading || selectedOrder || detailsError) && (
        <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Order details">
          <div className="adm-modal-box adm-order-modal">
            <div className="adm-mh">
              <div className="adm-mt">Order Details</div>
              <button type="button" className="adm-mx" onClick={() => { setSelectedOrder(null); setDetailsError(""); }} aria-label="Close order details">×</button>
            </div>

            {detailsLoading ? (
              <div className="adm-empty">Loading order details...</div>
            ) : detailsError ? (
              <div className="adm-empty">{detailsError}</div>
            ) : selectedOrder && (
              <>
                <div className="adm-order-detail-grid">
                  <section className="an-section">
                    <h4>Order Information</h4>
                    <div className="adm-order-info"><span>Order ID</span><strong className="adm-mono">{selectedOrder.id}</strong></div>
                    <div className="adm-order-info"><span>Order Date</span><strong>{formatDate(selectedOrder.created_at)}</strong></div>
                    <div className="adm-order-info"><span>Status</span><StatusBadge status={selectedOrder.status} /></div>
                    <div className="adm-order-info"><span>Order Total</span><strong>{money(selectedOrder.total_cents)}</strong></div>
                  </section>

                  <section className="an-section">
                    <h4>Customer Information</h4>
                    <div className="adm-order-info"><span>Email</span><strong>Unavailable</strong></div>
                    {selectedAddress.length ? selectedAddress.map((line) => <div className="adm-order-info" key={line}><span>{line === selectedAddress[0] ? "Recipient" : ""}</span><strong>{line}</strong></div>) : <div className="adm-muted adm-small">No customer details were saved.</div>}
                  </section>

                  <section className="an-section">
                    <h4>Payment & Shipping</h4>
                    <div className="adm-order-info"><span>Payment Method</span><strong>{formatPaymentMethod(selectedOrder.payment_method)}</strong></div>
                    <div className="adm-order-info"><span>Shipping Method</span><strong>{formatValue(selectedOrder.shipping_method)}</strong></div>
                    <div className="adm-order-info"><span>Tracking Status</span><strong>{formatValue(selectedOrder.tracking_status)}</strong></div>
                    {selectedOrder.promo_code && <div className="adm-order-info"><span>Promo Code</span><strong>{selectedOrder.promo_code}</strong></div>}
                  </section>
                </div>

                <section className="an-section">
                  <h4>Shipping Address</h4>
                  {selectedAddress.length ? selectedAddress.map((line) => <div className="adm-order-address" key={line}>{line}</div>) : <div className="adm-muted adm-small">No shipping address was saved for this order.</div>}
                </section>

                <section className="an-section">
                  <h4>Order Items</h4>
                  <div className="adm-tw">
                    <table className="adm-t">
                      <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                      <tbody>
                        {selectedOrder.items.map((item) => <tr key={item.id}><td>{item.product_name || "Product"}</td><td>{item.qty}</td><td>{money(item.price_cents)}</td><td>{money(item.subtotal_cents)}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

type AdminUser = {
  id: string;
  email: string;
  role: string;
  email_verified: boolean | number;
  created_at: string;
};

function UsersView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch<{ success: boolean; users: AdminUser[] }>("/admin/users.php")
        .then((data) => {
          setUsers(data.users ?? []);
        })
        .catch((loadError) => {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load users.";
          setError(message);
          showToast(message, "error");
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function formatDate(value: string) {
    return new Date(value.replace(" ", "T")).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Users</div>
          <div className="adm-ph-sub">View registered customer and administrator accounts.</div>
        </div>
      </div>

      <div className="adm-tw">
        <table className="adm-t">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Email Verification</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr><td colSpan={4}><div className="adm-empty">Loading users...</div></td></tr>
            ) : error ? (
              <tr><td colSpan={4}><div className="adm-empty">{error}</div></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4}><div className="adm-empty">No users found.</div></td></tr>
            ) : (
              users.map((account) => (
                <tr key={account.id}>
                  <td>{account.email}</td>
                  <td><StatusBadge status={account.role} /></td>
                  <td><StatusBadge status={account.email_verified ? "Verified" : "Not Verified"} /></td>
                  <td className="adm-muted adm-small">{formatDate(account.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

type RefundRequest = {
  id: string;
  order_id: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  customer_email: string | null;
};

type RefundOrder = {
  id: string;
  user_id: string | null;
  total_cents: number;
  status: string;
  shipping_address: string | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  items: OrderItemDetail[];
};

function RefundsView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loadingRefunds, setLoadingRefunds] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<RefundOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  async function loadRefunds() {
    try {
      setLoadingRefunds(true);
      setError("");
      const data = await apiFetch<{ success: boolean; refunds: RefundRequest[] }>(
        "/admin/refunds.php",
      );
      setRefunds(data.refunds ?? []);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load refund requests.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoadingRefunds(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRefunds();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    return new Date(value.replace(" ", "T")).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatValue(value: string) {
    return value
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function shippingLines(value: string | null) {
    if (!value) {
      return [];
    }

    try {
      const address = JSON.parse(value) as ShippingAddress;

      return [
        [address.first_name, address.last_name].filter(Boolean).join(" "),
        address.contact_number ?? "",
        address.address ?? "",
        [address.city, address.province, address.postal_code]
          .filter(Boolean)
          .join(", "),
      ].filter(Boolean);
    } catch {
      return [];
    }
  }

  async function updateRefund(refund: RefundRequest, status: "approved" | "rejected") {
    if (!window.confirm(`${status === "approved" ? "Approve" : "Reject"} refund request ${refund.id}?`)) {
      return;
    }

    try {
      setUpdatingId(refund.id);
      await apiFetch("/admin/refund-status.php", {
        method: "POST",
        body: JSON.stringify({ id: refund.id, status }),
      });
      showToast(`Refund request ${status} successfully.`, "success");
      await loadRefunds();
    } catch (updateError) {
      showToast(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update refund request.",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function viewOrder(orderId: string) {
    try {
      setSelectedOrder(null);
      setOrderError("");
      setOrderLoading(true);
      const data = await apiFetch<{ success: boolean; order: RefundOrder }>(
        `/admin/refund-order.php?id=${encodeURIComponent(orderId)}`,
      );
      setSelectedOrder(data.order);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load order.";
      setOrderError(message);
      showToast(message, "error");
    } finally {
      setOrderLoading(false);
    }
  }

  const selectedAddress = shippingLines(selectedOrder?.shipping_address ?? null);

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Refunds</div>
          <div className="adm-ph-sub">Review and resolve customer refund requests.</div>
        </div>
      </div>

      <div className="adm-tw">
        <table className="adm-t">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Created</th>
              <th>Resolved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingRefunds ? (
              <tr><td colSpan={8}><div className="adm-empty">Loading refund requests...</div></td></tr>
            ) : error ? (
              <tr><td colSpan={8}><div className="adm-empty">{error}</div></td></tr>
            ) : refunds.length === 0 ? (
              <tr><td colSpan={8}><div className="adm-empty">No refund requests found.</div></td></tr>
            ) : (
              refunds.map((refund) => (
                <tr key={refund.id}>
                  <td className="adm-mono">#{refund.id.substring(0, 8).toUpperCase()}</td>
                  <td className="adm-mono">#{refund.order_id.substring(0, 8).toUpperCase()}</td>
                  <td>{refund.customer_email || refund.user_id}</td>
                  <td className="adm-small">{refund.reason || "—"}</td>
                  <td><StatusBadge status={refund.status} /></td>
                  <td className="adm-muted adm-small">{formatDate(refund.created_at)}</td>
                  <td className="adm-muted adm-small">{formatDate(refund.resolved_at)}</td>
                  <td>
                    <div className="adm-actions">
                      <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => void viewOrder(refund.order_id)}>Order</button>
                      {refund.status === "pending" && (
                        <>
                          <button type="button" className="adm-btn adm-btn-p adm-btn-s" disabled={updatingId === refund.id} onClick={() => void updateRefund(refund, "approved")}>Approve</button>
                          <button type="button" className="adm-btn adm-btn-d adm-btn-s" disabled={updatingId === refund.id} onClick={() => void updateRefund(refund, "rejected")}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(orderLoading || selectedOrder || orderError) && (
        <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Related order">
          <div className="adm-modal-box adm-order-modal">
            <div className="adm-mh">
              <div className="adm-mt">Related Order</div>
              <button type="button" className="adm-mx" onClick={() => { setSelectedOrder(null); setOrderError(""); }} aria-label="Close related order">×</button>
            </div>
            {orderLoading ? <div className="adm-empty">Loading order...</div> : orderError ? <div className="adm-empty">{orderError}</div> : selectedOrder && (
              <>
                <div className="adm-order-detail-grid">
                  <section className="an-section">
                    <h4>Order Information</h4>
                    <div className="adm-order-info"><span>Order ID</span><strong className="adm-mono">{selectedOrder.id}</strong></div>
                    <div className="adm-order-info"><span>Date</span><strong>{formatDate(selectedOrder.created_at)}</strong></div>
                    <div className="adm-order-info"><span>Status</span><StatusBadge status={selectedOrder.status} /></div>
                    <div className="adm-order-info"><span>Total</span><strong>{money(selectedOrder.total_cents)}</strong></div>
                  </section>
                  <section className="an-section">
                    <h4>Payment & Shipping</h4>
                    <div className="adm-order-info"><span>Payment</span><strong>{selectedOrder.payment_method === "cod" ? "Cash on Delivery" : formatValue(selectedOrder.payment_method)}</strong></div>
                    <div className="adm-order-info"><span>Shipping</span><strong>{formatValue(selectedOrder.shipping_method)}</strong></div>
                  </section>
                  <section className="an-section">
                    <h4>Shipping Address</h4>
                    {selectedAddress.length ? selectedAddress.map((line) => <div className="adm-order-address" key={line}>{line}</div>) : <div className="adm-muted adm-small">No shipping address was saved.</div>}
                  </section>
                </div>
                <section className="an-section">
                  <h4>Order Items</h4>
                  <div className="adm-tw">
                    <table className="adm-t">
                      <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
                      <tbody>{selectedOrder.items.map((item) => <tr key={item.id}><td>{item.product_name || "Product"}</td><td>{item.qty}</td><td>{money(item.price_cents)}</td><td>{money(item.subtotal_cents)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  const [loading, setLoading] = useState(false);

  // Must keep the same identity between renders: child views list it in
  // their useEffect dependencies, so a new function every render made the
  // admin pages reload forever (flicker + spinner).
  const showToast = useCallback((message: string, type = "info") => {
    setToastMessage(message);
    setToastType(type);

    window.setTimeout(() => {
      setToastMessage("");
    }, 3000);
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
        <style>{adminStyles}</style>
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
        <style>{adminStyles}</style>
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admin Access</h2>
          <p>
            Please{" "}
            <a href="/login" style={{ color: "var(--adm-primary)" }}>
              log in
            </a>{" "}
            to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="adm-gate">
        <style>{adminStyles}</style>
        <div className="adm-gate-box">
          <img src="/logo2.png" alt="ARduino Store" />
          <h2>Admin Access</h2>

          <p>
            Welcome back, {(user.email || "admin").split("@")[0]}. Enter your
            admin code:
          </p>

          <div className="fg" style={{ textAlign: "left" }}>
            <label>Admin Code</label>
            <input
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

          <button
            className="adm-btn adm-btn-p adm-btn-full"
            onClick={verifyCode}
          >
            Continue →
          </button>

          {codeError && <p className="adm-code-error">{codeError}</p>}

          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={signOut}
              className="adm-btn adm-btn-d adm-btn-full"
            >
              Sign Out
            </button>
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
      <style>{adminStyles}</style>

      <div className="adm-layout">
        <aside className="adm-sidebar">
          <div className="adm-logo">
            <img src="/logo2.png" alt="ARduino Store" />
            <span className="adm-logo-text">Admin Panel</span>
          </div>

          <nav className="adm-nav">
            {tabs.map((item) => (
              <div key={item.id}>
                {item.section && (
                  <div className="adm-nav-section">{item.section}</div>
                )}

                <button
                  className={`adm-nav-link ${tab === item.id ? "active" : ""}`}
                  onClick={() => changeTab(item.id)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </nav>

          <div className="adm-sidebar-footer">
            <div style={{ marginBottom: "0.3rem", fontSize: "0.72rem" }}>
              Signed in as
            </div>

            <div
              style={{
                color: "var(--adm-text)",
                fontWeight: 600,
                fontSize: "0.8rem",
                wordBreak: "break-all",
              }}
            >
              {user.email || user.username || "Admin"}
            </div>

            <button onClick={signOut} className="adm-sidebar-signout">
              <span>↪</span>
              Sign Out
            </button>
          </div>
        </aside>

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
              <UsersView showToast={showToast} />
            )}

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
        <div className="adm-loading-overlay">
          <div className="adm-spin" />
        </div>
      )}

      {toastMessage && (
        <div className={`adm-toast ${toastType} show`}>{toastMessage}</div>
      )}
    </div>
  );
}

function DashboardView({
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
          icon="📦"
          iconClass="ic-teal"
          value={stats.product_count}
          label="Products"
        />

        <StatCard
          icon="🛒"
          iconClass="ic-green"
          value={stats.order_count}
          label="Orders"
        />

        <StatCard
          icon="👥"
          iconClass="ic-orange"
          value={stats.user_count}
          label="Users"
        />

        <StatCard
          icon="%"
          iconClass="ic-teal"
          value={stats.promo_count}
          label="Promos"
        />

        <StatCard
          icon="₱"
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
          icon="📦"
          title="Products"
          description="Add, edit, remove items from your catalog."
          onClick={() => onTab("products")}
        />

        <QuickCard
          icon="🎟️"
          title="Promos"
          description="Create discount codes and send notifications."
          onClick={() => onTab("promos")}
        />

        <QuickCard
          icon="🚚"
          title="Orders"
          description="View and update order statuses."
          onClick={() => onTab("orders")}
        />

        <QuickCard
          icon="👥"
          title="Users"
          description="Manage user profiles and send messages."
          onClick={() => onTab("users")}
        />
      </div>
    </>
  );
}

function AnalyticsView({
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
        <h4>📈 Monthly Revenue — Last 6 Months</h4>

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
          <h4>💳 Payment Methods</h4>

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
          <h4>📦 Order Status Breakdown</h4>

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
        <h4>🏆 Top Products by Units Sold</h4>

        {analytics.top_products.length ? (
          analytics.top_products.map((product, index) => (
            <div className="top-prod-row" key={`${product.name}-${index}`}>
              <div className="top-rank">#{index + 1}</div>

              <img
                src={product.img_url || "/product.png"}
                alt={product.name}
                onError={(event) => {
                  event.currentTarget.src = "/product.png";
                }}
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

function ProductsView({
  showToast,
  setLoading,
}: {
  showToast: (message: string, type?: string) => void;
  setLoading: (value: boolean) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function refreshProducts() {
    const data = await apiFetch<{
      success: boolean;
      products: Product[];
    }>("/products/list.php");

    setProducts(data.products || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          apiFetch<{
            success: boolean;
            products: Product[];
          }>("/products/list.php"),
          apiFetch<{
            success: boolean;
            categories: Category[];
          }>("/categories/list.php"),
        ]);

        if (!cancelled) {
          setProducts(productsData.products || []);
          setCategories(categoriesData.categories || []);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q) ||
        (product.sku || "").toLowerCase().includes(q);

      const matchesCategory =
        !categoryFilter || product.category_id === categoryFilter;

      return matchesQuery && matchesCategory;
    });
  }, [products, query, categoryFilter]);

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }

  function openAdd() {
    setEditing(null);
    setName("");
    setSlug("");
    setPrice("");
    setStock("");
    setCategoryId("");
    setSku("");
    setDescription("");
    setImageFile(null);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setName(product.name);
    setSlug(product.slug);
    setPrice((product.price_cents / 100).toFixed(2));
    setStock(String(product.stock));
    setCategoryId(product.category_id || "");
    setSku(product.sku || "");
    setDescription(product.description || "");
    setImageFile(null);
    setModalOpen(true);
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/products/upload.php`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Image upload failed.");
    }

    return data.url as string;
  }

  async function saveProduct() {
    const id = editing?.id;
    const cleanName = name.trim();
    const cleanSlug = slug.trim();
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (
      !cleanName ||
      !cleanSlug ||
      !Number.isFinite(numericPrice) ||
      !Number.isInteger(numericStock)
    ) {
      showToast("Fill all required fields.", "error");
      return;
    }

    setSaving(true);

    try {
      let imgUrl = editing?.img_url || null;

      if (imageFile) {
        imgUrl = await uploadImage(imageFile);
      }

      const payload = {
        name: cleanName,
        slug: cleanSlug,
        price_cents: Math.round(numericPrice * 100),
        stock: numericStock,
        category_id: categoryId || null,
        sku: sku.trim() || null,
        description: description.trim() || null,
        img_url: imgUrl,
      };

      if (id) {
        await apiFetch("/products/update.php", {
          method: "PUT",
          body: JSON.stringify({
            id,
            ...payload,
          }),
        });

        showToast("Product updated!", "success");
      } else {
        await apiFetch("/products/create.php", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        showToast("Product added!", "success");
      }

      setModalOpen(false);
      await refreshProducts();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to save product.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(productId: string) {
    const confirmed = window.confirm(
      "Delete this product? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/products/delete.php", {
        method: "DELETE",
        body: JSON.stringify({
          id: productId,
        }),
      });

      showToast("Product deleted.", "info");
      await refreshProducts();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to delete product.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Products</div>
          <div className="adm-ph-sub">{products.length} items in catalog</div>
        </div>

        <button className="adm-btn adm-btn-p" onClick={openAdd}>
          + Add Product
        </button>
      </div>

      <div className="adm-toolbar">
        <div className="adm-search">
          <span className="adm-search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search products…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <select
          className="adm-sel"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All Categories</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="adm-tw">
        {!filteredProducts.length ? (
          <div className="adm-empty">No products found</div>
        ) : (
          <table className="adm-t">
            <thead>
              <tr>
                <th>Img</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <img
                      src={product.img_url || "/product.png"}
                      alt={product.name}
                      onError={(event) => {
                        event.currentTarget.src = "/product.png";
                      }}
                    />
                  </td>

                  <td>
                    <div style={{ fontWeight: 600 }}>{product.name}</div>

                    <div className="adm-small adm-muted">{product.slug}</div>
                  </td>

                  <td>{money(product.price_cents)}</td>

                  <td>
                    {product.stock <= 5 ? (
                      <span className="b b-r">{product.stock}</span>
                    ) : (
                      <span className="b b-g">{product.stock}</span>
                    )}
                  </td>

                  <td>
                    <span className="b b-t">
                      {product.category_name || "—"}
                    </span>
                  </td>

                  <td className="adm-small adm-muted">{product.sku || "—"}</td>

                  <td>
                    <div className="adm-actions">
                      <button
                        className="adm-btn adm-btn-o adm-btn-s"
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </button>

                      <button
                        className="adm-btn adm-btn-d adm-btn-s"
                        onClick={() => deleteProduct(product.id)}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="adm-modal">
          <div className="adm-modal-box">
            <div className="adm-mh">
              <div className="adm-mt">
                {editing ? "Edit Product" : "Add Product"}
              </div>

              <button className="adm-mx" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Name *</label>

                <input
                  value={name}
                  placeholder="Arduino UNO R3"
                  onChange={(event) => {
                    const value = event.target.value;
                    setName(value);

                    if (!editing) {
                      setSlug(createSlug(value));
                    }
                  }}
                />
              </div>

              <div className="fg">
                <label>Slug *</label>

                <input
                  value={slug}
                  placeholder="arduino-uno-r3"
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Price (PHP) *</label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  placeholder="1500.00"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>

              <div className="fg">
                <label>Stock *</label>

                <input
                  type="number"
                  min="0"
                  value={stock}
                  placeholder="25"
                  onChange={(event) => setStock(event.target.value)}
                />
              </div>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Category</label>

                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select…</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>SKU</label>

                <input
                  value={sku}
                  placeholder="ARD-001"
                  onChange={(event) => setSku(event.target.value)}
                />
              </div>
            </div>

            <div className="fg">
              <label>Description</label>

              <textarea
                value={description}
                placeholder="Product description…"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="fg">
              <label>
                Image{" "}
                <small
                  style={{
                    textTransform: "none",
                    fontWeight: 400,
                    color: "var(--adm-text2)",
                  }}
                >
                  (JPG/PNG/WEBP)
                </small>
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] || null)
                }
              />
            </div>

            <div className="adm-mf">
              <button
                className="adm-btn adm-btn-o"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="adm-btn adm-btn-p"
                onClick={saveProduct}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: string;
  iconClass: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="adm-stat">
      <div className={`adm-stat-icon ${iconClass}`}>{icon}</div>

      <div>
        <div className="adm-stat-val">{value}</div>
        <div className="adm-stat-lbl">{label}</div>
      </div>
    </div>
  );
}

function AnalyticsStat({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub: string;
}) {
  return (
    <div className="an-stat">
      <div className="an-stat-val">{value}</div>
      <div className="an-stat-lbl">{label}</div>
      <div className="an-stat-sub">{sub}</div>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="adm-qc" onClick={onClick}>
      <div className="adm-qc-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="adm-qc-arr">Open →</div>
    </button>
  );
}

function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">{title}</div>
          <div className="adm-ph-sub">{description}</div>
        </div>
      </div>

      <div className="adm-tw">
        <div className="adm-empty">
          This section will be connected to the PHP API next.
        </div>
      </div>
    </div>
  );
}

function paymentLabel(method: string) {
  const labels: Record<string, string> = {
    gcash: "GCash",
    maya: "Maya",
    card: "Card",
    cod: "COD",
  };

  return labels[method] || method;
}

const adminStyles = `
:root {
  --adm-bg: #050505;
  --adm-surface: #0d0d0d;
  --adm-card: #141414;
  --adm-border: #303030;
  --adm-primary: #ffffff;
  --adm-accent: #aaaaaa;
  --adm-danger: #cccccc;
  --adm-warning: #aaaaaa;
  --adm-success: #dddddd;
  --adm-text: #ffffff;
  --adm-text2: #888888;
  --adm-sidebar: 240px;
}

.adm-page,
.adm-page *,
.adm-page *::before,
.adm-page *::after {
  box-sizing: border-box;
}

.adm-page {
  min-height: 100vh;
  background: var(--adm-bg);
  color: var(--adm-text);
  font-family: "Segoe UI", system-ui, sans-serif;
}

.adm-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.adm-sidebar {
  width: var(--adm-sidebar);
  background: var(--adm-surface);
  border-right: 1px solid var(--adm-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1000;
  height: 100vh;
  overflow-y: auto;
}

.adm-logo {
  padding: 1.25rem;
  border-bottom: 1px solid var(--adm-border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.adm-logo img {
  height: 1.75rem;
  width: auto;
}

.adm-logo-text {
  font-size: 0.7rem;
  color: var(--adm-primary);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.adm-nav {
  flex: 1;
  padding: 0.75rem 0;
  overflow-y: auto;
}

.adm-nav-section {
  padding: 0.75rem 1.25rem 0.25rem;
  font-size: 0.62rem;
  color: var(--adm-text2);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
}

.adm-nav-link {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 1.25rem;
  color: var(--adm-text2);
  background: transparent;
  border: 0;
  border-left: 2px solid transparent;
  text-align: left;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.adm-nav-link:hover {
  color: var(--adm-text);
  background: #171717;
}

.adm-nav-link.active {
  color: var(--adm-primary);
  border-left-color: var(--adm-primary);
  background: #1b1b1b;
  font-weight: 600;
}

.adm-sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--adm-border);
  font-size: 0.75rem;
  color: var(--adm-text2);
}

.adm-sidebar-signout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.75rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: #ffffff;
  border-radius: 6px;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  width: 100%;
}

.adm-main {
  margin-left: var(--adm-sidebar);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.adm-topbar {
  background: var(--adm-surface);
  border-bottom: 1px solid var(--adm-border);
  padding: 0 2rem;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 99;
}

.adm-breadcrumb {
  font-size: 0.82rem;
  color: var(--adm-text2);
}

.adm-breadcrumb span {
  color: var(--adm-text);
  font-weight: 600;
}

.adm-user-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--adm-text2);
}

.adm-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg,var(--adm-primary),var(--adm-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #000;
}

.adm-content {
  padding: 1.75rem 2rem;
  flex: 1;
}

.adm-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(180px,1fr));
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.adm-stat {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.adm-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 800;
}

.ic-teal {
  background: #303030;
  color: var(--adm-primary);
}

.ic-green {
  background: rgba(255,255,255,0.05);
  color: var(--adm-success);
}

.ic-orange {
  background: rgba(255,255,255,0.05);
  color: var(--adm-warning);
}

.adm-stat-val {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
}

.adm-stat-lbl {
  font-size: 0.75rem;
  color: var(--adm-text2);
  margin-top: 0.2rem;
}

.adm-ph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.adm-ph-title {
  font-size: 1.35rem;
  font-weight: 700;
}

.adm-ph-sub {
  font-size: 0.82rem;
  color: var(--adm-text2);
  margin-top: 0.15rem;
}

.adm-section-title {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.adm-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.adm-search {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.adm-search input {
  width: 100%;
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 8px;
  padding: 0.55rem 0.9rem 0.55rem 2.25rem;
  color: var(--adm-text);
  font-size: 0.85rem;
  outline: none;
}

.adm-search input:focus {
  border-color: var(--adm-primary);
}

.adm-search-icon {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--adm-text2);
  pointer-events: none;
}

.adm-sel {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 8px;
  padding: 0.55rem 0.9rem;
  color: var(--adm-text);
  font-size: 0.85rem;
  outline: none;
}

.adm-tw {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--adm-border);
}

.adm-t {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.adm-t thead {
  background: rgba(255,255,255,0.02);
}

.adm-t th {
  padding: 0.8rem 1rem;
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--adm-text2);
  font-weight: 700;
  border-bottom: 1px solid var(--adm-border);
}

.adm-t td {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #171717;
  vertical-align: middle;
}

.adm-t tr:last-child td {
  border-bottom: none;
}

.adm-t tr:hover td {
  background: rgba(255,255,255,0.015);
}

.adm-t img {
  width: 38px;
  height: 38px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--adm-border);
}

.b {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
}

.b-g {
  background: rgba(255,255,255,0.05);
  color: #dddddd;
}

.b-r {
  background: rgba(255,255,255,0.05);
  color: #cccccc;
}

.b-o {
  background: rgba(255,255,255,0.05);
  color: #aaaaaa;
}

.b-t {
  background: #303030;
  color: #ffffff;
}

.b-gray {
  background: rgba(255,255,255,0.05);
  color: #888888;
}

.adm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  border: none;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.adm-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.adm-btn-p {
  background: var(--adm-primary);
  color: #000;
}

.adm-btn-p:hover:not(:disabled) {
  background: var(--adm-accent);
}

.adm-btn-o {
  background: transparent;
  border: 1px solid var(--adm-border);
  color: var(--adm-text2);
}

.adm-btn-o:hover:not(:disabled) {
  border-color: var(--adm-primary);
  color: var(--adm-primary);
}

.adm-btn-d {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #cccccc;
}

.adm-btn-d:hover:not(:disabled) {
  background: rgba(255,255,255,0.06);
}

.adm-btn-s {
  padding: 0.35rem 0.75rem;
  font-size: 0.76rem;
}

.adm-btn-full {
  width: 100%;
}

.adm-actions {
  display: flex;
  gap: 0.4rem;
}

.adm-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.adm-modal-box {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 14px;
  padding: 1.75rem;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
}

.adm-order-modal {
  max-width: 860px;
}

.adm-order-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.adm-order-detail-grid .an-section {
  margin-bottom: 1rem;
}

.adm-order-info {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 0;
  font-size: 0.8rem;
}

.adm-order-info span {
  color: var(--adm-text2);
}

.adm-order-info strong {
  text-align: right;
  overflow-wrap: anywhere;
}

.adm-order-address {
  font-size: 0.84rem;
  line-height: 1.6;
}

.adm-mh {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.adm-mt {
  font-size: 1.05rem;
  font-weight: 700;
}

.adm-mx {
  background: none;
  border: none;
  color: var(--adm-text2);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.2rem;
}

.adm-mx:hover {
  color: var(--adm-text);
}

.adm-mf {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
}

.fg {
  margin-bottom: 0.9rem;
}

.fg label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--adm-text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

.fg input,
.fg select,
.fg textarea {
  width: 100%;
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-radius: 7px;
  padding: 0.65rem 0.85rem;
  color: var(--adm-text);
  font-size: 0.875rem;
  outline: none;
}

.fg input:focus,
.fg select:focus,
.fg textarea:focus {
  border-color: var(--adm-primary);
}

.fg textarea {
  resize: vertical;
  min-height: 75px;
}

.fg select option {
  background: var(--adm-surface);
}

.fg input[type=file] {
  color: var(--adm-text2);
  padding: 0.45rem 0.85rem;
}

.fr {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.adm-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--adm-bg);
  color: var(--adm-text);
  font-family: "Segoe UI", system-ui, sans-serif;
}

.adm-gate-box {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 14px;
  padding: 2.25rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.adm-gate-box img {
  height: 2.5rem;
  margin-bottom: 1.25rem;
}

.adm-gate-box h2 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.adm-gate-box p {
  font-size: 0.83rem;
  color: var(--adm-text2);
  margin-bottom: 1.25rem;
}

.adm-code-error {
  color: var(--adm-danger) !important;
  font-size: 0.8rem !important;
  margin-top: 0.5rem !important;
  margin-bottom: 0 !important;
}

.adm-empty {
  text-align: center;
  padding: 3.5rem 2rem;
  color: var(--adm-text2);
  font-size: 0.875rem;
}

.adm-spin {
  width: 28px;
  height: 28px;
  border: 2px solid var(--adm-border);
  border-top-color: var(--adm-primary);
  border-radius: 50%;
  animation: adm-spin 0.6s linear infinite;
  margin: 2rem auto;
}

@keyframes adm-spin {
  to {
    transform: rotate(360deg);
  }
}

.adm-loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.18);
  z-index: 5000;
  pointer-events: none;
}

.adm-loading-overlay .adm-spin {
  position: fixed;
  top: 50%;
  left: 50%;
  margin: -14px 0 0 -14px;
}

.adm-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 6000;
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 9px;
  padding: 0.8rem 1.1rem;
  font-size: 0.83rem;
  font-weight: 500;
  min-width: 200px;
}

.adm-toast.success {
  border-left: 3px solid var(--adm-success);
}

.adm-toast.error {
  border-left: 3px solid var(--adm-danger);
}

.adm-toast.info {
  border-left: 3px solid var(--adm-primary);
}

.adm-qgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(200px,1fr));
  gap: 1rem;
}

.adm-qc {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 10px;
  padding: 1.25rem;
  text-decoration: none;
  color: var(--adm-text);
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-align: left;
  cursor: pointer;
}

.adm-qc:hover {
  border-color: var(--adm-primary);
  transform: translateY(-2px);
}

.adm-qc-icon {
  font-size: 1.6rem;
}

.adm-qc h3 {
  font-size: 0.95rem;
  font-weight: 600;
}

.adm-qc p {
  font-size: 0.78rem;
  color: var(--adm-text2);
  line-height: 1.5;
}

.adm-qc-arr {
  margin-top: auto;
  color: var(--adm-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.adm-muted {
  color: var(--adm-text2);
}

.adm-small {
  font-size: 0.76rem;
}

.adm-mono {
  font-family: monospace;
  font-size: 0.76rem;
}

.an-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(160px,1fr));
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.an-stat {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
}

.an-stat-val {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  color: var(--adm-text);
}

.an-stat-lbl {
  font-size: 0.73rem;
  color: var(--adm-text2);
  margin-top: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.an-stat-sub {
  font-size: 0.78rem;
  color: var(--adm-primary);
  margin-top: 0.2rem;
  font-weight: 600;
}

.an-section {
  background: var(--adm-card);
  border: 1px solid var(--adm-border);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.an-section h4 {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--adm-text);
  margin-bottom: 1rem;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}

.bar-label {
  font-size: 0.76rem;
  color: var(--adm-text2);
  width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 28px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg,var(--adm-primary),#AAAAAA);
  transition: width 0.6s ease;
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
}

.bar-val {
  font-size: 0.72rem;
  font-weight: 700;
  color: #000;
  white-space: nowrap;
}

.bar-orders {
  font-size: 0.72rem;
  color: var(--adm-text2);
  min-width: 55px;
  text-align: right;
}

.top-prod-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--adm-border);
}

.top-prod-row:last-child {
  border-bottom: none;
}

.top-prod-row img {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--adm-border);
}

.top-rank {
  color: var(--adm-text2);
  font-size: 0.8rem;
  font-weight: 700;
  min-width: 20px;
}

.top-product-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--adm-text);
}

.top-product-qty {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--adm-primary);
}

.an-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

@media(max-width:700px) {
  .adm-order-detail-grid {
    grid-template-columns: 1fr;
  }

  .an-two {
    grid-template-columns: 1fr;
  }

  .adm-sidebar {
    width: 200px;
  }

  .adm-main {
    margin-left: 200px;
  }

  .adm-content {
    padding: 1rem;
  }

  .adm-topbar {
    padding: 0 1rem;
  }

  .fr {
    grid-template-columns: 1fr;
  }
}
`;
