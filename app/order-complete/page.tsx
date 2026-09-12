"use client";

import Link from "next/link";
import { useState } from "react";

type OrderData = {
  id: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_method: string;
  payment_method: string;
};

function getStoredOrder(): OrderData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedOrder = sessionStorage.getItem("last_order");

  if (!storedOrder) {
    return null;
  }

  try {
    const parsedOrder = JSON.parse(storedOrder);

    if (parsedOrder?.id) {
      return parsedOrder;
    }

    return null;
  } catch {
    sessionStorage.removeItem("last_order");
    return null;
  }
}

export default function OrderCompletePage() {
  const [order] = useState<OrderData | null>(() => getStoredOrder());

  const formatPrice = (cents: number) => {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (!order) {
    return (
      <main className="order-complete-page">
        <div className="order-complete-container">
          <div className="order-complete-card">
            <h1>Order Complete</h1>
            <p>We could not find the order information for this page.</p>

            <div className="order-complete-actions">
              <Link href="/products">Continue Shopping</Link>
              <Link href="/account">Go to Account</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="order-complete-page">
      <div className="order-complete-container">
        <div className="order-complete-card">
          <div className="order-success-icon">✓</div>

          <h1>Order placed successfully!</h1>

          <p className="order-success-message">
            Thank you for your order. Your order has been received and is now
            being processed.
          </p>

          <div className="order-number">
            <span>Order Number</span>
            <strong>{order.id}</strong>
          </div>

          <div className="order-details">
            <div className="order-detail-row">
              <span>Subtotal</span>
              <strong>{formatPrice(order.subtotal_cents)}</strong>
            </div>

            <div className="order-detail-row">
              <span>Shipping</span>
              <strong>
                {order.shipping_cents === 0
                  ? "Free"
                  : formatPrice(order.shipping_cents)}
              </strong>
            </div>

            <div className="order-detail-row order-total-row">
              <span>Total</span>
              <strong>{formatPrice(order.total_cents)}</strong>
            </div>
          </div>

          <div className="order-information">
            <div>
              <span>Payment Method</span>
              <strong>
                {order.payment_method === "cod"
                  ? "Cash on Delivery"
                  : order.payment_method}
              </strong>
            </div>

            <div>
              <span>Shipping Method</span>
              <strong>
                {order.shipping_method === "standard"
                  ? "Standard Shipping"
                  : order.shipping_method}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>Pending</strong>
            </div>
          </div>

          <div className="order-complete-actions">
            <Link href="/products">Continue Shopping</Link>
            <Link href="/account">View Account</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
