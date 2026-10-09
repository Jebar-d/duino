"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

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
};

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch<{ success: boolean; orders: Order[] }>("/orders/list.php")
        .then((data) => {
          setOrders(data.orders || []);
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Unable to load orders.",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
                            src={item.product_img || "/product.png"}
                            alt={item.product_name || "Product"}
                            onError={(event) => {
                              event.currentTarget.src = "/product.png";
                            }}
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
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
