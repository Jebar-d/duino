import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type { RefundOrder, RefundRequest, ShippingAddress } from "./types";
import { money } from "./utils";
import { StatusBadge } from "./StatusBadge";

export function RefundsView({
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
  const [refundConfirmation, setRefundConfirmation] = useState<{
    refund: RefundRequest;
    status: "approved" | "rejected";
  } | null>(null);

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
    try {
      setUpdatingId(refund.id);
      await apiFetch("/admin/refund-status.php", {
        method: "POST",
        body: JSON.stringify({ id: refund.id, status }),
      });
      showToast(`Refund request ${status} successfully.`, "success");
      setRefundConfirmation(null);
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
                          <button type="button" className="adm-btn adm-btn-p adm-btn-s" disabled={updatingId === refund.id} onClick={() => setRefundConfirmation({ refund, status: "approved" })}>Approve</button>
                          <button type="button" className="adm-btn adm-btn-d adm-btn-s" disabled={updatingId === refund.id} onClick={() => setRefundConfirmation({ refund, status: "rejected" })}>Reject</button>
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

      {refundConfirmation && (
        <div className="adm-modal adm-refund-confirm-backdrop" role="presentation">
          <section
            className={`adm-modal-box adm-refund-confirm ${refundConfirmation.status}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-confirm-title"
            aria-describedby="refund-confirm-description"
          >
            <div className="adm-refund-confirm-mark" aria-hidden="true">
              {refundConfirmation.status === "approved" ? "✓" : "!"}
            </div>
            <div className="adm-refund-confirm-eyebrow">Refund review</div>
            <h2 id="refund-confirm-title">
              {refundConfirmation.status === "approved"
                ? "Approve this refund?"
                : "Reject this refund?"}
            </h2>
            <p id="refund-confirm-description" className="adm-refund-confirm-copy">
              {refundConfirmation.status === "approved"
                ? "The request will be marked approved and the customer will see the updated status."
                : "The request will be marked rejected and the customer will see the updated status."}
            </p>
            <dl className="adm-refund-confirm-details">
              <div>
                <dt>Request</dt>
                <dd>#{refundConfirmation.refund.id.substring(0, 8).toUpperCase()}</dd>
              </div>
              <div>
                <dt>Order</dt>
                <dd>#{refundConfirmation.refund.order_id.substring(0, 8).toUpperCase()}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{refundConfirmation.refund.customer_email || refundConfirmation.refund.user_id}</dd>
              </div>
              <div className="adm-refund-confirm-reason">
                <dt>Reason</dt>
                <dd>{refundConfirmation.refund.reason || "No reason provided."}</dd>
              </div>
            </dl>
            <div className="adm-refund-confirm-actions">
              <button
                type="button"
                className="adm-btn adm-btn-o"
                disabled={updatingId === refundConfirmation.refund.id}
                onClick={() => setRefundConfirmation(null)}
              >
                Keep pending
              </button>
              <button
                type="button"
                className={`adm-btn ${refundConfirmation.status === "approved" ? "adm-btn-p" : "adm-btn-d"}`}
                disabled={updatingId === refundConfirmation.refund.id}
                onClick={() => void updateRefund(refundConfirmation.refund, refundConfirmation.status)}
              >
                {updatingId === refundConfirmation.refund.id
                  ? "Saving..."
                  : refundConfirmation.status === "approved"
                    ? "Approve refund"
                    : "Reject refund"}
              </button>
            </div>
          </section>
        </div>
      )}

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
                    {selectedAddress.length ? selectedAddress.map((line, index) => <div className="adm-order-address" key={`${index}-${line}`}>{line}</div>) : <div className="adm-muted adm-small">No shipping address was saved.</div>}
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
