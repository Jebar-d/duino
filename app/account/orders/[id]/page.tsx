"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

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

type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  contact_number?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

type Order = {
  id: string;
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
  items: OrderItem[];
  item_count: number;
};

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch<{ success: boolean; order: Order }>(
        `/orders/get.php?id=${encodeURIComponent(orderId)}`,
      )
        .then((data) => {
          setOrder(data.order);
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Unable to load the order.",
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [orderId]);

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

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getShippingAddress = () => {
    if (!order?.shipping_address) {
      return null;
    }

    const address = order.shipping_address;

    return {
      name: [address.first_name, address.last_name].filter(Boolean).join(" "),
      contact: address.contact_number || "",
      address: address.address || "",
      location: [address.city, address.province, address.postal_code]
        .filter(Boolean)
        .join(", "),
    };
  };

  if (loading) {
    return (
      <main className="account-order-details-page">
        <div className="account-order-details-container">
          <p>Loading order...</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="account-order-details-page">
        <div className="account-order-details-container">
          <div className="account-order-details-error">
            <h1>Order Not Found</h1>
            <p>{error || "We could not find this order."}</p>
            <Link href="/account/orders">Back to My Orders</Link>
          </div>
        </div>
      </main>
    );
  }

  const shippingAddress = getShippingAddress();

  return (
    <main className="account-order-details-page">
      <div className="account-order-details-container">
        <div className="account-order-details-top">
          <Link href="/account/orders">← Back to My Orders</Link>

          <div className="account-order-details-heading">
            <div>
              <span>Order Number</span>
              <h1>{order.id}</h1>
              <p>Placed on {formatDateTime(order.created_at)}</p>
            </div>

            <div className="account-order-status">
              <span>Status</span>
              <strong>{formatStatus(order.status)}</strong>
            </div>
          </div>
        </div>

        <div className="account-order-details-grid">
          <section className="account-order-details-card">
            <div className="account-order-details-card-header">
              <h2>Items</h2>
              <span>{order.item_count} item(s)</span>
            </div>

            <div className="account-order-details-items">
              {order.items.map((item) => (
                <div className="account-order-details-item" key={item.id}>
                  <div className="account-order-details-item-image">
                    <img
                      src={item.product_img || "/product.png"}
                      alt={item.product_name || "Product"}
                      onError={(event) => {
                        event.currentTarget.src = "/product.png";
                      }}
                    />
                  </div>

                  <div className="account-order-details-item-info">
                    <strong>{item.product_name || "Product"}</strong>

                    <span>Quantity: {item.qty}</span>

                    <span>{formatPrice(item.price_cents)} each</span>
                  </div>

                  <strong>{formatPrice(item.subtotal_cents)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="account-order-details-card">
            <div className="account-order-details-card-header">
              <h2>Order Summary</h2>
            </div>

            <div className="account-order-summary">
              <div>
                <span>Items</span>
                <strong>{order.item_count}</strong>
              </div>

              {order.promo_code && (
                <div>
                  <span>Promo Code</span>
                  <strong>{order.promo_code}</strong>
                </div>
              )}

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
                <strong>{formatStatus(order.tracking_status)}</strong>
              </div>

              {order.expected_delivery && (
                <div>
                  <span>Expected Delivery</span>
                  <strong>{formatDate(order.expected_delivery)}</strong>
                </div>
              )}

              <div className="account-order-summary-total">
                <span>Total</span>
                <strong>{formatPrice(order.total_cents)}</strong>
              </div>
            </div>
          </section>

          <section className="account-order-details-card">
            <div className="account-order-details-card-header">
              <h2>Shipping Address</h2>
            </div>

            {shippingAddress ? (
              <div className="account-order-address">
                {shippingAddress.name && (
                  <strong>{shippingAddress.name}</strong>
                )}

                {shippingAddress.contact && (
                  <span>{shippingAddress.contact}</span>
                )}

                {shippingAddress.address && (
                  <span>{shippingAddress.address}</span>
                )}

                {shippingAddress.location && (
                  <span>{shippingAddress.location}</span>
                )}
              </div>
            ) : (
              <p>No shipping address was saved for this order.</p>
            )}
          </section>

          <section className="account-order-details-card">
            <div className="account-order-details-card-header">
              <h2>Order Information</h2>
            </div>

            <div className="account-order-information">
              <div>
                <span>Order Status</span>
                <strong>{formatStatus(order.status)}</strong>
              </div>

              <div>
                <span>Tracking Status</span>
                <strong>{formatStatus(order.tracking_status)}</strong>
              </div>

              <div>
                <span>Payment Method</span>
                <strong>
                  {order.payment_method === "cod"
                    ? "Cash on Delivery"
                    : formatStatus(order.payment_method)}
                </strong>
              </div>

              <div>
                <span>Shipping Method</span>
                <strong>{formatStatus(order.shipping_method)}</strong>
              </div>

              <div>
                <span>Email Confirmation</span>
                <strong>
                  {order.email_confirmed ? "Confirmed" : "Not Confirmed"}
                </strong>
              </div>

              {order.cancelled_at && (
                <div>
                  <span>Cancelled</span>
                  <strong>{formatDateTime(order.cancelled_at)}</strong>
                </div>
              )}

              {order.cancel_reason && (
                <div>
                  <span>Cancellation Reason</span>
                  <strong>{order.cancel_reason}</strong>
                </div>
              )}
            </div>
          </section>

          {order.notes && (
            <section className="account-order-details-card">
              <div className="account-order-details-card-header">
                <h2>Order Notes</h2>
              </div>

              <p>{order.notes}</p>
            </section>
          )}
        </div>

        <div className="account-order-details-actions">
          <Link href="/account/orders">Back to My Orders</Link>
          <Link href="/products">Continue Shopping</Link>
        </div>
      </div>
    </main>
  );
}
