"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../../../../lib/product-assets";

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
  address_line?: string;
  city?: string;
  province?: string;
  postal_code?: string;
};

type ShippingAddressForm = {
  first_name: string;
  last_name: string;
  contact_number: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
};
type SavedAddress = Partial<ShippingAddressForm> & { middle_name?: string; suffix?: string };

type Order = {
  id: string;
  total_cents: number;
  promo_code: string | null;
  status: string;
  shipping_address: ShippingAddress | null;
  created_at: string;
  shipping_method: string;
  payment_method: string;
  payment_status: string;
  tracking_status: string;
  expected_delivery: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  email_confirmed: boolean;
  items: OrderItem[];
  item_count: number;
  history?: { id?: string; status: string; note: string | null; created_at: string }[];
  refund_request?: { id: string; status: string; reason: string | null; admin_note: string | null; created_at?: string; resolved_at?: string | null } | null;
  can_cancel?: boolean;
  can_request_refund?: boolean;
};

type EditableOrderItem = {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  qty: number;
  product_name: string;
  product_img: string | null;
  price_cents: number;
};

function buildTrackingTimeline(order: Order) {
  const history = order.history ?? [];
  const terminalStatus = ["cancelled", "refunded"].includes(order.status.toLowerCase())
    ? order.status.toLowerCase()
    : "";
  const timeline: { label: string; created_at?: string }[] = [
    { label: "Placed", created_at: order.created_at },
  ];

  if (terminalStatus) {
    const terminalEvent = [...history].reverse().find(
      (entry) => entry.status.toLowerCase() === terminalStatus,
    );
    timeline.push({
      label: terminalStatus === "cancelled" ? "Cancelled" : "Refunded",
      created_at:
        terminalEvent?.created_at ||
        (terminalStatus === "cancelled" ? order.cancelled_at || undefined : order.refund_request?.resolved_at || undefined),
    });
    return timeline;
  }

  const currentStage = order.tracking_status.toLowerCase();
  const stages = [
    { key: "packed", label: "Packed" },
    { key: "shipped", label: "Shipped" },
    { key: "out_for_delivery", label: "Out for delivery" },
    { key: "delivered", label: "Delivered" },
  ];
  const currentStageIndex = stages.findIndex((stage) => stage.key === currentStage);

  for (const [index, stage] of stages.entries()) {
    const event = [...history].reverse().find((entry) => {
      const note = entry.note?.toLowerCase() ?? "";
      return (
        entry.status.toLowerCase() === stage.key ||
        note.includes(`tracking status: ${stage.key}`)
      );
    });
    if (event || (currentStageIndex >= index && currentStageIndex !== -1)) {
      timeline.push({ label: stage.label, created_at: event?.created_at });
    }
  }

  return timeline;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionType, setActionType] = useState<"cancel" | "refund" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [productSlugs, setProductSlugs] = useState<Record<string, string>>({});
  const [productSlugError, setProductSlugError] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressForm, setAddressForm] = useState<ShippingAddressForm>({
    first_name: "",
    last_name: "",
    contact_number: "",
    address_line: "",
    city: "",
    province: "",
    postal_code: "",
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("different");
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [itemsDraft, setItemsDraft] = useState<EditableOrderItem[]>([]);
  const [itemPendingRemoval, setItemPendingRemoval] =
    useState<EditableOrderItem | null>(null);

  const refreshOrder = useCallback(async () => {
    const data = await apiFetch<{ success: boolean; order: Order }>(
      `/orders/get.php?id=${encodeURIComponent(orderId)}`,
    );
    setOrder(data.order);
    setError("");
    return data.order;
  }, [orderId]);
  const shouldLoadProductSlugs = Boolean(
    order &&
      (["delivered", "completed"].includes(order.status.toLowerCase()) ||
        order.tracking_status.toLowerCase() === "delivered"),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshOrder()
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the order."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshOrder]);

  useEffect(() => {
    if (!shouldLoadProductSlugs) return;
    let cancelled = false;
    apiFetch<{ success: boolean; products: { id: string; slug: string }[] }>("/products/list.php")
      .then((data) => {
        if (!cancelled) {
          setProductSlugs(Object.fromEntries((data.products || []).map((product) => [product.id, product.slug])));
          setProductSlugError("");
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setProductSlugError(loadError instanceof Error ? loadError.message : "Unable to load product review links.");
        }
      });
    return () => { cancelled = true; };
  }, [order?.id, shouldLoadProductSlugs]);

  async function submitOrderAction() {
    if (!order || !actionType) return;
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
        body: JSON.stringify({ order_id: order.id, reason }),
      });
      await refreshOrder();
      setActionType(null);
      setActionReason("");
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : "Unable to update this order.");
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
      address: address.address_line || address.address || "",
      location: [address.city, address.province, address.postal_code]
        .filter(Boolean)
        .join(", "),
    };
  };

  const canEditOrder =
    order?.status.toLowerCase() === "pending" &&
    order.tracking_status.toLowerCase() !== "shipped";
  const onlinePayment = ["gcash", "maya", "card"].includes(order?.payment_method.toLowerCase() || "");
  const paymentLabel = order?.payment_method.toLowerCase() === "gcash"
    ? "GCash"
    : order?.payment_method.toLowerCase() === "maya"
      ? "Maya"
      : "Card";
  const paymentStatusLabel = order?.payment_status.toLowerCase() === "paid"
    ? "Paid"
    : order?.payment_status.toLowerCase() === "expired"
      ? "Expired"
      : "Unpaid";
  const canCompletePayment = onlinePayment && paymentStatusLabel === "Unpaid" && order?.status.toLowerCase() !== "cancelled" && !order?.cancelled_at;

  const startAddressEdit = () => {
    const address = order?.shipping_address;
    setAddressForm({
      first_name: address?.first_name || "",
      last_name: address?.last_name || "",
      contact_number: address?.contact_number || "",
      address_line: address?.address_line || address?.address || "",
      city: address?.city || "",
      province: address?.province || "",
      postal_code: address?.postal_code || "",
    });
    setAddressError("");
    setIsEditingAddress(true);
    setSelectedAddress("different");
    apiFetch<{ addresses: SavedAddress[] }>("/auth/user/addresses.php")
      .then((data) => setSavedAddresses(data.addresses || []))
      .catch(() => setSavedAddresses([]));
  };

  const saveShippingAddress = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!order || !canEditOrder) return;

    setIsSavingAddress(true);
    setAddressError("");
    try {
      const data = await apiFetch<{ order: Order }>(
        "/orders/update-customer.php",
        {
          method: "POST",
          body: JSON.stringify({
            order_id: order.id,
            shipping_address: addressForm,
          }),
        },
      );
      setOrder(data.order);
      setIsEditingAddress(false);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update the shipping address.";
      if (message.toLowerCase().includes("no longer be edited")) {
        setIsEditingAddress(false);
        apiFetch<{ order: Order }>(
          `/orders/get.php?id=${encodeURIComponent(order.id)}`,
        ).then((data) => setOrder(data.order)).catch(() => undefined);
      }
      setAddressError(message.toLowerCase() === "failed to fetch" ? "Couldn't save your changes. Check your connection and try again." : message);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const startItemsEdit = () => {
    if (!order) return;
    setItemsDraft(
      order.items.map((item, index) => ({
        key: `${item.id}-${index}`,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        product_name: item.product_name || "Product",
        product_img: item.product_img,
        price_cents: item.price_cents,
      })),
    );
    setItemsError("");
    setIsEditingItems(true);
  };

  const decreaseItemQuantity = (itemKey: string) => {
    const item = itemsDraft.find((draft) => draft.key === itemKey);
    if (!item) return;
    setItemsError("");

    if (item.qty > 1) {
      setItemsDraft(
        itemsDraft.map((draft) =>
          draft.key === itemKey ? { ...draft, qty: draft.qty - 1 } : draft,
        ),
      );
      return;
    }

    setItemPendingRemoval(item);
  };

  const confirmItemRemoval = () => {
    if (!itemPendingRemoval) return;
    if (itemsDraft.length > 1) {
      setItemsDraft(
        itemsDraft.filter((draft) => draft.key !== itemPendingRemoval.key),
      );
    } else {
      setItemsError("An order must contain at least one product. Cancel the order instead.");
    }
    setItemPendingRemoval(null);
  };

  const saveOrderItems = async () => {
    if (!order || !canEditOrder) return;
    if (!itemsDraft.length) {
      setItemsError("An order must contain at least one product.");
      return;
    }

    setIsSavingItems(true);
    setItemsError("");
    try {
      const data = await apiFetch<{ order: Order }>(
        "/orders/update-customer.php",
        {
          method: "POST",
          body: JSON.stringify({
            order_id: order.id,
            items: itemsDraft.map(({ product_id, variant_id, qty }) => ({
              product_id,
              variant_id,
              qty,
            })),
          }),
        },
      );
      setOrder(data.order);
      const refreshed = await apiFetch<{ order: Order }>(`/orders/get.php?id=${encodeURIComponent(order.id)}`);
      setOrder(refreshed.order);
      setIsEditingItems(false);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update order items.";
      if (message.toLowerCase().includes("no longer be edited")) {
        setIsEditingItems(false);
        apiFetch<{ order: Order }>(
          `/orders/get.php?id=${encodeURIComponent(order.id)}`,
        ).then((data) => setOrder(data.order)).catch(() => undefined);
      }
      setItemsError(message.toLowerCase() === "failed to fetch" ? "Couldn't save your changes. Check your connection and try again." : message);
    } finally {
      setIsSavingItems(false);
    }
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
  const trackingTimeline = buildTrackingTimeline(order);
  const delivered =
    ["delivered", "completed"].includes(order.status.toLowerCase()) ||
    order.tracking_status.toLowerCase() === "delivered";
  const canRequestRefund =
    order.can_request_refund &&
    (order.status.toLowerCase() === "delivered" ||
      order.tracking_status.toLowerCase() === "delivered");

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
              {canEditOrder && !isEditingItems && (
                <button className="account-order-edit-button" type="button" onClick={startItemsEdit}>
                  Edit Items
                </button>
              )}
            </div>

            <div className="account-order-details-items">
              {isEditingItems ? itemsDraft.map((item) => (
                <div className="account-order-details-item" key={item.key}>
                  <div className="account-order-details-item-image">
                    <img
                      src={getProductImageUrl(item.product_img)}
                      alt=""
                      onError={handleProductImageError}
                    />
                  </div>
                  <div className="account-order-details-item-info">
                    <strong>{item.product_name}</strong>
                    <span>{formatPrice(item.price_cents)} each</span>
                  </div>
                  <div className="account-order-item-edit-controls">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.product_name} quantity`}
                      onClick={() => decreaseItemQuantity(item.key)}
                    >-</button>
                    <strong aria-live="polite">{item.qty}</strong>
                    <button
                      type="button"
                      aria-label={`Increase ${item.product_name} quantity`}
                      disabled={item.qty >= 99}
                      onClick={() => setItemsDraft(itemsDraft.map((draft) =>
                        draft.key === item.key ? { ...draft, qty: draft.qty + 1 } : draft,
                      ))}
                    >+</button>
                  </div>
                </div>
              )) : order.items.map((item) => (
                <div className="account-order-details-item" key={item.id}>
                  <div className="account-order-details-item-image">
                    <img
                      src={getProductImageUrl(item.product_img)}
                      alt={item.product_name || "Product"}
                      onError={handleProductImageError}
                    />
                  </div>
                  <div className="account-order-details-item-info">
                    <strong>{item.product_name || "Product"}</strong>
                    <div className="account-order-details-item-meta">
                      <span>Qty {item.qty}</span>
                      <span>{formatPrice(item.price_cents)} each</span>
                    </div>
                  </div>
                  <div className="account-order-details-item-subtotal">
                    <span>Subtotal</span>
                    <strong>{formatPrice(item.subtotal_cents)}</strong>
                  </div>
                </div>
              ))}
            </div>
            {isEditingItems && (
              <div className="account-order-items-editor">
                {itemsError && <p className="account-order-address-error">{itemsError}</p>}
                <div className="account-order-address-form-actions">
                  <button type="button" disabled={isSavingItems} onClick={saveOrderItems}>
                    {isSavingItems ? "Saving..." : "Save Items"}
                  </button>
                  <button type="button" disabled={isSavingItems} onClick={() => setIsEditingItems(false)}>Cancel</button>
                </div>
              </div>
            )}
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
                    : `${paymentLabel} · ${paymentStatusLabel}`}
                </strong>
              </div>
              {canCompletePayment && (
                <div>
                  <span>Payment</span>
                  <Link href={`/order-complete?order=${encodeURIComponent(order.id)}`}>Complete payment</Link>
                </div>
              )}

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
              {order.refund_request && (
                <div>
                  <span>Refund status</span>
                  <span className={`account-order-refund-status ${order.refund_request.status.toLowerCase()}`}>
                    {formatStatus(order.refund_request.status)}
                  </span>
                  {order.refund_request.admin_note && (
                    <p>Admin note: {order.refund_request.admin_note}</p>
                  )}
                </div>
              )}

              <div className="account-order-summary-total">
                <span>Total</span>
                <strong>{formatPrice(order.total_cents)}</strong>
              </div>
            </div>
          </section>

          <section className="account-order-details-card account-order-tracking-timeline">
            <div className="account-order-details-card-header"><h2>Tracking timeline</h2></div>
            <ol>
              {trackingTimeline.map((event, index) => (
                <li key={`${event.label}-${event.created_at || index}`}>
                  <strong>{event.label}</strong>
                  <time>{event.created_at ? formatDateTime(event.created_at) : "Time unavailable"}</time>
                </li>
              ))}
            </ol>
          </section>

          {delivered && (
            <section className="account-order-details-card">
              <div className="account-order-details-card-header"><h2>Rate your items</h2></div>
              <ul className="account-order-rate-items">
                {order.items.map((item) => {
                  const slug = item.product_id ? productSlugs[item.product_id] : "";
                  return (
                    <li key={item.id}>
                      {slug ? (
                        <Link href={`/product/${encodeURIComponent(slug)}#reviews`}>
                          {item.product_name || "Product"} — Write a review
                        </Link>
                      ) : (
                        <span>{item.product_name || "Product"} — Review link unavailable</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {productSlugError && <p className="account-order-address-error">{productSlugError}</p>}
            </section>
          )}

          <section className="account-order-details-card">
            <div className="account-order-details-card-header">
              <h2>Shipping Address</h2>
              {canEditOrder && !isEditingAddress && (
                <button
                  className="account-order-edit-button"
                  type="button"
                  onClick={startAddressEdit}
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingAddress ? (
              <form
                className="account-order-address-form"
                onSubmit={saveShippingAddress}
              >
                <div className="checkout-address-picker" role="radiogroup" aria-label="Deliver to">
                  <strong>Deliver to</strong>
                  {savedAddresses.map((address, index) => (
                    <label key={`${address.address_line}-${index}`}>
                      <input type="radio" name="orderSavedAddress" checked={selectedAddress === String(index)} onChange={() => { setSelectedAddress(String(index)); setAddressForm((current) => ({ ...current, first_name: address.first_name || current.first_name, last_name: address.last_name || current.last_name, contact_number: address.contact_number || current.contact_number, address_line: address.address_line || "", city: address.city || "", province: address.province || "", postal_code: address.postal_code || "" })); }} />
                      <strong>{[address.first_name, address.last_name].filter(Boolean).join(" ") || "Saved address"}</strong>
                      <p>{address.address_line}</p>
                      <p>{[address.city, address.province, address.postal_code].filter(Boolean).join(", ")}</p>
                      <p>{address.contact_number}</p>
                    </label>
                  ))}
                  <label><input type="radio" name="orderSavedAddress" checked={selectedAddress === "different"} onChange={() => setSelectedAddress("different")} />Enter a different address</label>
                </div>
                <label>
                  First name
                  <input
                    required
                    value={addressForm.first_name}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, first_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={addressForm.last_name}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, last_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Contact number
                  <input
                    required
                    value={addressForm.contact_number}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, contact_number: event.target.value })
                    }
                  />
                </label>
                <label className="account-order-address-form-full">
                  Street address
                  <input
                    required
                    value={addressForm.address_line}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, address_line: event.target.value })
                    }
                  />
                </label>
                <label>
                  City
                  <input
                    required
                    value={addressForm.city}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, city: event.target.value })
                    }
                  />
                </label>
                <label>
                  Province
                  <input
                    required
                    value={addressForm.province}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, province: event.target.value })
                    }
                  />
                </label>
                <label>
                  Postal code
                  <input
                    required
                    value={addressForm.postal_code}
                    onChange={(event) =>
                      setAddressForm({ ...addressForm, postal_code: event.target.value })
                    }
                  />
                </label>
                {addressError && (
                  <p className="account-order-address-error">{addressError}</p>
                )}
                <div className="account-order-address-form-actions">
                  <button type="submit" disabled={isSavingAddress}>
                    {isSavingAddress ? "Saving..." : "Save Address"}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingAddress}
                    onClick={() => setIsEditingAddress(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : shippingAddress ? (
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
                    : `${paymentLabel} · ${paymentStatusLabel}`}
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
          {order.can_cancel && (
            <button type="button" onClick={() => {
              setActionType("cancel");
              setActionReason("");
              setActionError("");
            }}>Cancel order</button>
          )}
          {canRequestRefund && (
            <button type="button" onClick={() => {
              setActionType("refund");
              setActionReason("");
              setActionError("");
            }}>Request refund</button>
          )}
          <Link href="/account/orders">Back to My Orders</Link>
          <Link href="/products">Continue Shopping</Link>
        </div>
      </div>

      {actionType && (
        <div className="account-item-remove-backdrop">
          <section className="account-item-remove-dialog" role="dialog" aria-modal="true" aria-labelledby="order-action-title">
            <span className="account-item-remove-eyebrow">Order action</span>
            <h2 id="order-action-title">{actionType === "cancel" ? "Cancel this order?" : "Request a refund?"}</h2>
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
              <button type="button" disabled={actionSaving} onClick={() => setActionType(null)}>Keep order</button>
              <button type="button" disabled={actionSaving} onClick={() => void submitOrderAction()}>
                {actionSaving ? "Submitting…" : actionType === "cancel" ? "Confirm cancellation" : "Submit request"}
              </button>
            </div>
          </section>
        </div>
      )}

      {itemPendingRemoval && (
        <div className="account-item-remove-backdrop">
          <section
            className="account-item-remove-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-item-remove-title"
            aria-describedby="account-item-remove-description"
          >
            <span className="account-item-remove-eyebrow">Update order</span>
            <h2 id="account-item-remove-title">
              {itemsDraft.length === 1 ? "Keep at least one item" : "Remove this item?"}
            </h2>
            <p id="account-item-remove-description">
              {itemsDraft.length === 1
                ? "An order needs at least one product, so the final item can’t be removed."
                : `Remove ${itemPendingRemoval.product_name} from this order? Your total will update when you save.`}
            </p>
            <div className="account-item-remove-actions">
              {itemsDraft.length === 1 ? (
                <button
                  type="button"
                  className="account-item-remove-cancel"
                  autoFocus
                  onClick={() => setItemPendingRemoval(null)}
                >
                  Got it
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="account-item-remove-cancel"
                    autoFocus
                    onClick={() => setItemPendingRemoval(null)}
                  >
                    Keep item
                  </button>
                  <button
                    type="button"
                    className="account-item-remove-confirm"
                    onClick={confirmItemRemoval}
                  >
                    Remove item
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
