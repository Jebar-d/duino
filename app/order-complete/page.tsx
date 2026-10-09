"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";

type OrderData = {
  id: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_method: string;
  payment_method: string;
  payment_status?: string;
  status?: string;
  cancelled_at?: string | null;
};
type PaymentStatusResponse = {
  order_status: string;
  payment_method: string;
  payment_status: "unpaid" | "paid" | "expired";
  invoice_status: string;
};
type CheckoutResponse = { checkout_url?: string; already_paid?: boolean };

function OrderCompleteContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const loadPaymentStatus = useCallback(async (id: string) => {
    let status = await apiFetch<PaymentStatusResponse>(`/payment/status.php?order_id=${encodeURIComponent(id)}`);
    for (let attempt = 0; attempt < 3 && status.payment_status === "unpaid"; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      status = await apiFetch<PaymentStatusResponse>(`/payment/status.php?order_id=${encodeURIComponent(id)}`);
    }
    setPaymentStatus(status);
  }, []);

  useEffect(() => {
    if (!orderId) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    const timer = window.setTimeout(() => {
      apiFetch<{ order: OrderData }>(`/orders/get.php?id=${encodeURIComponent(orderId)}`)
        .then(async (data) => {
          if (!active) return;
          setOrder(data.order);
          const method = data.order.payment_method.toLowerCase();
          const online = ["gcash", "maya", "card"].includes(method);
          const cancelled = Boolean(data.order.cancelled_at) || data.order.status?.toLowerCase() === "cancelled";
          if (online && !cancelled) {
            try {
              const status = await apiFetch<PaymentStatusResponse>(`/payment/status.php?order_id=${encodeURIComponent(orderId)}`);
              if (active) setPaymentStatus(status);
              if (status.payment_status === "unpaid" && active) {
                for (let attempt = 0; attempt < 3; attempt += 1) {
                  await new Promise((resolve) => window.setTimeout(resolve, 3000));
                  const refreshed = await apiFetch<PaymentStatusResponse>(`/payment/status.php?order_id=${encodeURIComponent(orderId)}`);
                  if (active) setPaymentStatus(refreshed);
                  if (refreshed.payment_status !== "unpaid") break;
                }
              }
            } catch (statusError) {
              if (active) setError(statusError instanceof Error ? statusError.message : "Unable to check payment status.");
            }
          }
        })
        .catch((loadError) => {
          if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load the order.");
        })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [orderId, loadPaymentStatus]);

  const formatPrice = (cents: number) => `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const online = Boolean(order && ["gcash", "maya", "card"].includes(order.payment_method.toLowerCase()));
  const cancelled = Boolean(order?.cancelled_at) || order?.status?.toLowerCase() === "cancelled" || paymentStatus?.order_status?.toLowerCase() === "cancelled" || paymentStatus?.payment_status === "expired";
  const paid = paymentStatus?.payment_status === "paid" || order?.payment_status === "paid";
  const storedOrder = (() => {
    if (!orderId || typeof window === "undefined") return null;
    try {
      const stored = JSON.parse(sessionStorage.getItem("last_order") || "null");
      return stored?.id === orderId ? stored as OrderData : null;
    } catch { return null; }
  })();
  const startCheckout = async () => {
    if (!order) return;
    try {
      setIsRedirecting(true);
      const checkout = await apiFetch<CheckoutResponse>("/payment/create-checkout.php", { method: "POST", body: JSON.stringify({ order_id: order.id }) });
      if (checkout.checkout_url) window.location.href = checkout.checkout_url;
      else if (checkout.already_paid) await loadPaymentStatus(order.id);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start payment.");
    } finally { setIsRedirecting(false); }
  };
  const checkStatus = async () => {
    if (!order) return;
    setError("");
    try { await loadPaymentStatus(order.id); }
    catch (statusError) { setError(statusError instanceof Error ? statusError.message : "Unable to check payment status."); }
  };

  if (loading) return <main className="order-complete-page"><div className="order-complete-container"><div className="order-complete-card"><h1>Loading order...</h1></div></div></main>;
  if (!order) return <main className="order-complete-page"><div className="order-complete-container"><div className="order-complete-card"><h1>Order Complete</h1><p>{error || "We could not find the order information for this page."}</p><div className="order-complete-actions"><Link href="/products">Continue Shopping</Link><Link href="/account">Go to Account</Link></div></div></div></main>;

  const title = online ? cancelled ? "Payment expired, order cancelled" : paid ? "Payment received" : "Waiting for payment" : "Order placed successfully!";
  return <main className="order-complete-page"><div className="order-complete-container"><div className="order-complete-card">
    <div className="order-success-icon">{paid || !online ? "✓" : "…"}</div>
    <h1>{title}</h1>
    {!online ? <p className="order-success-message">Thank you for your order. Your order has been received and is now being processed.</p> : !cancelled && !paid ? <p className="order-success-message">Complete your payment to continue processing this order.</p> : null}
    <div className="order-number"><span>Order Number</span><strong>{order.id}</strong></div>
    <div className="order-details">
      {storedOrder && <><div className="order-detail-row"><span>Subtotal</span><strong>{formatPrice(storedOrder.subtotal_cents)}</strong></div><div className="order-detail-row"><span>Shipping</span><strong>{storedOrder.shipping_cents === 0 ? "Free" : formatPrice(storedOrder.shipping_cents)}</strong></div></>}
      <div className="order-detail-row order-total-row"><span>Total</span><strong>{formatPrice(order.total_cents)}</strong></div>
    </div>
    <div className="order-information"><div><span>Payment Method</span><strong>{order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method.toUpperCase()}</strong></div><div><span>Shipping Method</span><strong>{order.shipping_method === "standard" ? "Standard Shipping" : order.shipping_method}</strong></div><div><span>Status</span><strong>{online ? cancelled ? "Expired" : paid ? "Paid" : "Unpaid" : "Pending"}</strong></div></div>
    {error && <p className="order-success-message">{error}</p>}
    <div className="order-complete-actions">{online && !cancelled && !paid ? <><button type="button" onClick={startCheckout} disabled={isRedirecting}>{isRedirecting ? "Redirecting to payment..." : "Pay now"}</button><button type="button" onClick={checkStatus}>Check payment status</button></> : <Link href="/products">Continue Shopping</Link>}{!cancelled && <Link href="/account">View Account</Link>}</div>
  </div></div></main>;
}

export default function OrderCompletePage() {
  return <Suspense fallback={<main className="order-complete-page"><div className="order-complete-container"><div className="order-complete-card"><h1>Loading order...</h1></div></div></main>}><OrderCompleteContent /></Suspense>;
}
