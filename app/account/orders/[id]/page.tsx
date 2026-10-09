"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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

type EditableOrderItem = {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  qty: number;
  product_name: string;
  product_img: string | null;
  price_cents: number;
};

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [itemsDraft, setItemsDraft] = useState<EditableOrderItem[]>([]);
  const [itemPendingRemoval, setItemPendingRemoval] =
    useState<EditableOrderItem | null>(null);

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
      address: address.address_line || address.address || "",
      location: [address.city, address.province, address.postal_code]
        .filter(Boolean)
        .join(", "),
    };
  };

  const canEditOrder =
    order?.status.toLowerCase() === "pending" &&
    order.tracking_status.toLowerCase() !== "shipped";

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
      setAddressError(
        message,
      );
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
      setItemsError(
        message,
      );
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
                    <img src={item.product_img || "/product.png"} alt="" />
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
                      src={item.product_img || "/product.png"}
                      alt={item.product_name || "Product"}
                      onError={(event) => { event.currentTarget.src = "/product.png"; }}
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
