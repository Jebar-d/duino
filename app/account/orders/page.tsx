"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../../../lib/product-assets";

type OrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty: number;
  price_cents: number;
  product_name: string | null;
  product_img: string | null;
  subtotal_cents: number;
};

type Order = {
  id: string;
  total_cents: number;
  promo_code: string | null;
  status: string;
  shipping_address: string | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  tracking_status: string;
  expected_delivery: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  email_confirmed: boolean | number;
  items: OrderItem[];
  item_count: number;
  can_cancel?: boolean;
  can_request_refund?: boolean;
  refund_request?: { id: string; status: string; reason: string | null; admin_note: string | null } | null;
};

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<"cancel" | "refund">("cancel");
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const refreshOrders = useCallback(async () => {
    const data = await apiFetch<{ success: boolean; orders: Order[] }>("/orders/list.php");
    setOrders(data.orders || []);
    setError("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshOrders()
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to load orders."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshOrders]);

  async function submitOrderAction() {
    if (!actionOrder) return;
    const reason = actionReason.trim();
    if (!reason || (actionType === "refund" && (reason.length < 10 || reason.length > 500))) {
      setActionError(actionType === "refund" ? "Reason must be 10–500 characters." : "A cancellation reason is required.");
      return;
    }
    try {
      setActionSaving(true);
      setActionError("");
      await apiFetch(actionType === "cancel" ? "/orders/cancel.php" : "/refunds/request.php", {
        method: "POST",
        body: JSON.stringify({ order_id: actionOrder.id, reason }),
      });
      await refreshOrders();
      setActionOrder(null);
      setActionReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update this order.");
    } finally {
      setActionSaving(false);
    }
  }

  const formatPrice = (cents: number) => {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getShippingAddressLines = (rawAddress: string | null) => {
    if (!rawAddress) return [];

    let address: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawAddress);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return [rawAddress];
      }
      address = parsed as Record<string, unknown>;
    } catch {
      return [rawAddress];
    }

    const getText = (key: string) =>
      typeof address[key] === "string" ? (address[key] as string).trim() : "";
    const name = [getText("first_name"), getText("last_name")]
      .filter(Boolean)
      .join(" ");
    const street = getText("address_line") || getText("address");
    const location = [
      getText("city"),
      getText("province"),
      getText("postal_code"),
    ]
      .filter(Boolean)
      .join(", ");

    return [name, getText("contact_number"), street, location].filter(Boolean);
  };

  if (loading) {
    return (
      <main className="account-orders-page">
        <div className="account-orders-container">
          <h1>My Orders</h1>
          <p>Loading your orders...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="account-orders-page">
        <div className="account-orders-container">
          <h1>My Orders</h1>

          <div className="account-orders-error">
            <p>{error}</p>
            <Link href="/login">Log In</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="account-orders-page">
      <div className="account-orders-container">
        <div className="account-orders-header">
          <div>
            <h1>My Orders</h1>
            <p>View your previous orders and their current status.</p>
          </div>

          <Link href="/products">Continue Shopping</Link>
        </div>

        {orders.length === 0 ? (
          <div className="account-orders-empty">
            <h2>No orders yet</h2>
            <p>Your completed orders will appear here.</p>
            <Link href="/products">Start Shopping</Link>
          </div>
        ) : (
          <div className="account-orders-list">
            {orders.map((order) => (
              <article className="account-order-card" key={order.id}>
                <div className="account-order-header">
                  <div>
                    <span>Order Number</span>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="account-order-number-link"
                    >
                      {order.id}
                    </Link>
                  </div>

                  <div>
                    <span>Date</span>
                    <strong>{formatDate(order.created_at)}</strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>{formatStatus(order.status)}</strong>
                  </div>
                </div>

                <Link
                  href={`/account/orders/${order.id}`}
                  className="account-order-items-link"
                >
                  <div className="account-order-items">
                    {order.items.map((item) => (
                      <div className="account-order-item" key={item.id}>
                        <div className="account-order-item-image">
                          <img
                            src={getProductImageUrl(item.product_img)}
                            alt={item.product_name || "Product"}
                            onError={handleProductImageError}
                          />
                        </div>

                        <div className="account-order-item-info">
                          <strong>{item.product_name || "Product"}</strong>

                          <div className="account-order-item-meta">
                            <span>Qty {item.qty}</span>
                            <span>{formatPrice(item.price_cents)} each</span>
                          </div>
                        </div>

                        <div className="account-order-item-subtotal">
                          <span>Subtotal</span>
                          <strong>{formatPrice(item.subtotal_cents)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>

                <div className="account-order-footer">
                  <div>
                    <span>Payment</span>
                    <strong>
                      {order.payment_method === "cod"
                        ? "Cash on Delivery"
                        : formatStatus(order.payment_method)}
                    </strong>
                  </div>

                  <div>
                    <span>Shipping</span>
                    <strong>{formatStatus(order.shipping_method)}</strong>
                  </div>

                  <div>
                    <span>Tracking</span>
                    <strong className="account-order-tracking-status">{formatStatus(order.tracking_status)}</strong>
                  </div>
                  {order.refund_request && (
                    <div>
                      <span>Refund</span>
                      <span className={`account-order-refund-status ${order.refund_request.status.toLowerCase()}`}>
                        {formatStatus(order.refund_request.status)}
                      </span>
                      {order.refund_request.admin_note && <p>{order.refund_request.admin_note}</p>}
                    </div>
                  )}

                  {order.shipping_address && (
                    <div className="account-order-address">
                      <span>Shipping address</span>
                      <address>
                        {getShippingAddressLines(order.shipping_address).map(
                          (line, index) => (
                            <span key={`${index}-${line}`}>{line}</span>
                          ),
                        )}
                      </address>
                    </div>
                  )}

                  <div>
                    <span>Total</span>
                    <strong>{formatPrice(order.total_cents)}</strong>
                  </div>

                  <Link
                    href={`/account/orders/${order.id}`}
                    className="account-order-view-link"
                  >
                    View Order
                  </Link>
                </div>
                {(order.can_cancel ||
                  (order.can_request_refund &&
                    (order.status.toLowerCase() === "delivered" ||
                      order.tracking_status.toLowerCase() === "delivered"))) && (
                  <div className="account-order-details-actions">
                    {order.can_cancel && (
                      <button type="button" onClick={() => {
                        setActionOrder(order);
                        setActionType("cancel");
                        setActionReason("");
                        setActionError("");
                      }}>Cancel order</button>
                    )}
                    {order.can_request_refund &&
                      (order.status.toLowerCase() === "delivered" ||
                        order.tracking_status.toLowerCase() === "delivered") && (
                      <button type="button" onClick={() => {
                        setActionOrder(order);
                        setActionType("refund");
                        setActionReason("");
                        setActionError("");
                      }}>Request refund</button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      {actionOrder && (
        <div className="account-item-remove-backdrop">
          <section className="account-item-remove-dialog" role="dialog" aria-modal="true" aria-labelledby="orders-action-title">
            <span className="account-item-remove-eyebrow">Order action</span>
            <h2 id="orders-action-title">{actionType === "cancel" ? "Cancel this order?" : "Request a refund?"}</h2>
            <label>
              Reason
              <textarea
                required
                minLength={actionType === "refund" ? 10 : 1}
                maxLength={500}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
              />
            </label>
            {actionError && <p className="account-order-address-error">{actionError}</p>}
            <div className="account-item-remove-actions">
              <button type="button" disabled={actionSaving} onClick={() => setActionOrder(null)}>Keep order</button>
              <button type="button" disabled={actionSaving} onClick={() => void submitOrderAction()}>
                {actionSaving ? "Submitting…" : actionType === "cancel" ? "Confirm cancellation" : "Submit request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
