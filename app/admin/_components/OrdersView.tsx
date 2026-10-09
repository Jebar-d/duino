import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type {
  AdminOrder,
  AdminOrderSummary,
  ShippingAddress,
} from "./types";
import { escapeText, money, moneyWhole, paymentLabel } from "./utils";
import { StatusBadge } from "./StatusBadge";

export function OrdersView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [formStatus, setFormStatus] = useState("");
  const [formTracking, setFormTracking] = useState("");
  const [formDelivery, setFormDelivery] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const data = await apiFetch<{
        success: boolean;
        orders: AdminOrderSummary[];
        pagination: { pages: number };
      }>(
        `/admin/orders.php?page=${page}&status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(search.trim())}`,
      );
      setOrders(data.orders ?? []);
      setPages(data.pagination?.pages ?? 1);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load orders.",
        "error",
      );
    } finally {
      setLoadingOrders(false);
    }
  }, [page, search, showToast, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 250);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

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
      value.address_line ?? value.address ?? "",
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
      setSelectedOrder({
        ...data.order,
        customer_email: orders.find((order) => order.id === orderId)?.customer_email ?? null,
      });
      setFormStatus(data.order.status);
      setFormTracking(data.order.tracking_status || "processing");
      setFormDelivery(data.order.expected_delivery?.slice(0, 10) || "");
      setFormNote("");
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
  const orderLocked =
    ["cancelled", "refunded"].includes(selectedOrder?.status.toLowerCase() ?? "");

  async function saveOrderUpdate() {
    if (!selectedOrder) return;
    try {
      setSaving(true);
      const result = await apiFetch<{ success: boolean; message: string }>(
        "/admin/order-update.php",
        {
          method: "POST",
          body: JSON.stringify({
            order_id: selectedOrder.id,
            status: formStatus,
            tracking_status: formTracking,
            expected_delivery: formDelivery,
            note: formNote.trim() || null,
          }),
        },
      );
      showToast(result.message || "Order updated.", "success");
      const [detail] = await Promise.all([
        apiFetch<{ success: boolean; order: AdminOrder }>(
          `/orders/get.php?id=${encodeURIComponent(selectedOrder.id)}`,
        ),
        loadOrders(),
      ]);
      setSelectedOrder({
        ...detail.order,
        customer_email: selectedOrder.customer_email ?? null,
      });
      setFormStatus(detail.order.status);
      setFormTracking(detail.order.tracking_status || "processing");
      setFormDelivery(detail.order.expected_delivery?.slice(0, 10) || "");
      setFormNote("");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to update order.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Orders</div>
          <div className="adm-ph-sub">View order details and customer delivery information.</div>
        </div>
      </div>

      <div className="fr">
        <div className="fg">
          <label>Search order or customer email</label>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <div className="fg">
          <label>Status</label>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {["pending", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"].map((status) => (
              <option key={status} value={status}>{formatValue(status)}</option>
            ))}
          </select>
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
              <th>Items</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingOrders ? (
              <tr><td colSpan={8}><div className="adm-empty">Loading orders...</div></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8}><div className="adm-empty">No orders found.</div></td></tr>
            ) : (
              orders.map((order) => (
                  <tr key={order.id}>
                    <td className="adm-mono">#{order.id.substring(0, 8).toUpperCase()}</td>
                    <td className="adm-muted">{order.customer_email || "—"}</td>
                    <td className="adm-muted adm-small">{formatDate(order.created_at)}</td>
                    <td>{money(order.total_cents)}</td>
                    <td>{formatPaymentMethod(order.payment_method)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="adm-small">{order.item_count}</td>
                    <td><button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => void viewOrder(order.id)}>View</button></td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="adm-mf">
          <button type="button" className="adm-btn adm-btn-o adm-btn-s" disabled={page <= 1 || loadingOrders} onClick={() => setPage((current) => current - 1)}>Previous</button>
          <span className="adm-small adm-muted">Page {page} of {pages}</span>
          <button type="button" className="adm-btn adm-btn-o adm-btn-s" disabled={page >= pages || loadingOrders} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      )}

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
                    <div className="adm-order-info"><span>Payment Status</span><StatusBadge status={selectedOrder.payment_status} /></div>
                    <div className="adm-order-info"><span>Order Total</span><strong>{money(selectedOrder.total_cents)}</strong></div>
                  </section>

                  <section className="an-section">
                    <h4>Customer Information</h4>
                    <div className="adm-order-info"><span>Email</span><strong>{selectedOrder.customer_email || "Unavailable"}</strong></div>
                    {selectedAddress.length ? selectedAddress.map((line, index) => <div className="adm-order-info" key={`${index}-${line}`}><span>{line === selectedAddress[0] ? "Recipient" : ""}</span><strong>{line}</strong></div>) : <div className="adm-muted adm-small">No customer details were saved.</div>}
                  </section>

                  <section className="an-section">
                    <h4>Payment & Shipping</h4>
                    <div className="adm-order-info"><span>Payment Method</span><strong>{formatPaymentMethod(selectedOrder.payment_method)}</strong></div>
                    <div className="adm-order-info"><span>Shipping Method</span><strong>{formatValue(selectedOrder.shipping_method)}</strong></div>
                    <div className="adm-order-info"><span>Tracking Status</span><strong>{formatValue(selectedOrder.tracking_status)}</strong></div>
                    {selectedOrder.promo_code && <div className="adm-order-info"><span>Promo Code</span><strong>{selectedOrder.promo_code}</strong></div>}
                  </section>

                  <section className="an-section adm-order-update-section">
                    <h4>Update Order</h4>
                    <div className="adm-order-form-grid">
                      <div className="fg">
                        <label>Status</label>
                        <select disabled={orderLocked || saving} value={formStatus} onChange={(event) => setFormStatus(event.target.value)}>
                          {["pending", "paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"].map((status) => (
                            <option key={status} value={status}>{formatValue(status)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="fg">
                        <label>Tracking status</label>
                        <select disabled={orderLocked || saving} value={formTracking} onChange={(event) => setFormTracking(event.target.value)}>
                          {["processing", "packed", "shipped", "out_for_delivery", "delivered"].map((status) => (
                            <option key={status} value={status}>{formatValue(status)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="adm-order-form-grid">
                      <div className="fg">
                        <label>Expected delivery</label>
                        <input type="date" disabled={orderLocked || saving} value={formDelivery} onChange={(event) => setFormDelivery(event.target.value)} />
                      </div>
                      <div className="fg">
                        <label>Note</label>
                        <textarea disabled={orderLocked || saving} value={formNote} maxLength={2000} onChange={(event) => setFormNote(event.target.value)} />
                      </div>
                    </div>
                    {!orderLocked && (
                      <button type="button" className="adm-btn adm-btn-p" disabled={saving} onClick={() => void saveOrderUpdate()}>
                        {saving ? "Saving…" : "Save update"}
                      </button>
                    )}
                    {orderLocked && <p className="adm-muted adm-small">Updates are disabled for cancelled or refunded orders.</p>}
                  </section>

                  <section className="an-section adm-order-history-section">
                    <h4>History</h4>
                    {selectedOrder.history?.length ? (
                      <ol className="adm-order-history">
                        {selectedOrder.history.map((entry, index) => (
                          <li key={entry.id || `${entry.created_at}-${index}`}>
                            <strong>{formatValue(entry.status)}</strong>
                            <time>{formatDate(entry.created_at)}</time>
                            {entry.note && <p>{entry.note}</p>}
                          </li>
                        ))}
                      </ol>
                    ) : <p className="adm-muted">No status history recorded.</p>}
                  </section>
                </div>

                <section className="an-section">
                  <h4>Shipping Address</h4>
                  {selectedAddress.length ? selectedAddress.map((line, index) => <div className="adm-order-address" key={`${index}-${line}`}>{line}</div>) : <div className="adm-muted adm-small">No shipping address was saved for this order.</div>}
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
