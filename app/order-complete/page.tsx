"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { Badge } from "../../components/ui/8bit/badge";
import { Button } from "../../components/ui/8bit/button";
import { Alert, AlertDescription } from "../../components/ui/8bit/alert";

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
  discount_cents?: number;
  promo_code?: string | null;
  items?: { id: string; product_name?: string | null; product_img?: string | null; qty: number; subtotal_cents?: number; price_cents?: number }[];
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
  const [copied, setCopied] = useState(false);

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

  const title = online ? cancelled ? "Order cancelled" : paid ? "Payment received" : "Awaiting payment" : "Order placed";
  const message = cancelled
    ? "This payment expired and the order was cancelled."
    : paid
      ? "Thanks, your payment has been confirmed."
      : online
        ? "Your order is saved. Complete payment to continue."
        : "Thanks for your order. We’ll prepare it for delivery.";
  const statusLabel = cancelled ? "Expired" : paid ? "Paid" : online ? "Unpaid" : "COD received";
  const receiptOrder = storedOrder;
  const discount = receiptOrder?.discount_cents || order.discount_cents || 0;
  const orderItems = order.items || [];
  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the order number.");
    }
  };

  return (
    <main className="order-complete-page">
      <div className="order-complete-container">
        <div className="order-complete-card">
          {paid && <div className="receipt-confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
          <div className="order-success-icon" aria-hidden="true">{cancelled ? "×" : paid || !online ? "✓" : "…"}</div>
          <h1>{title}</h1>
          <p className="order-success-message">{message}</p>

          <div className="order-number">
            <div><span>Order Number</span><strong>{order.id}</strong></div>
            <Button type="button" variant="outline" font="retro" onClick={copyOrderNumber}>{copied ? "Copied" : "Copy"}</Button>
          </div>

          <section className="receipt-block" aria-label="Order receipt">
            {receiptOrder && <>
              <div className="receipt-row"><span>Subtotal</span><strong>{formatPrice(receiptOrder.subtotal_cents)}</strong></div>
              <div className="receipt-row"><span>Shipping</span><strong>{receiptOrder.shipping_cents === 0 ? "Free" : formatPrice(receiptOrder.shipping_cents)}</strong></div>
              <hr className="receipt-separator" />
            </>}
            {discount > 0 && <div className="receipt-row"><span>Discount{receiptOrder?.promo_code || order.promo_code ? ` (${receiptOrder?.promo_code || order.promo_code})` : ""}</span><strong>−{formatPrice(discount)}</strong></div>}
            <div className="receipt-row total"><span>Total</span><strong>{formatPrice(order.total_cents)}</strong></div>
            <hr className="receipt-separator" />
            <div className="order-information">
              <div><span>Payment method</span><strong>{order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method.toUpperCase()}</strong></div>
              <div><span>Shipping method</span><strong>{order.shipping_method === "standard" ? "Standard Shipping" : order.shipping_method}</strong></div>
              <div><span>Payment status</span><Badge variant="outline">{statusLabel}</Badge></div>
            </div>
          </section>

          {orderItems.length > 0 && <div className="receipt-items" aria-label="Order items">
            {orderItems.map((item) => <div className="receipt-item" key={item.id}>
              <img src={item.product_img || "/product.png"} alt={item.product_name || ""} />
              <span>{item.product_name || "Product"} × {item.qty}</span>
              <strong>{formatPrice(item.subtotal_cents ?? (item.price_cents || 0) * item.qty)}</strong>
            </div>)}
          </div>}

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {online && !cancelled && !paid && <div className="order-complete-actions">
            <Button type="button" onClick={startCheckout} disabled={isRedirecting}>{isRedirecting ? "Redirecting to payment..." : "Pay now"}</Button>
            <Button type="button" variant="outline" onClick={checkStatus}>Check payment status</Button>
          </div>}
          <div className="order-complete-actions">
            <Link href="/products">Continue shopping</Link>
            <Link href={`/account/orders/${encodeURIComponent(order.id)}`}>View order</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OrderCompletePage() {
  return <Suspense fallback={<main className="order-complete-page"><div className="order-complete-container"><div className="order-complete-card"><h1>Loading order...</h1></div></div></main>}><OrderCompleteContent /></Suspense>;
}

