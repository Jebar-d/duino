"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type CartProduct = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  img_url: string | null;
};

type CartItem = {
  id: string;
  product_id: string;
  qty: number;
  product: CartProduct;
  subtotal_cents: number;
};

type CartResponse = {
  success: boolean;
  items: CartItem[];
  count: number;
  total_quantity: number;
  total_cents: number;
};

type PromoResponse = {
  success: boolean;
  message?: string;
  promo: {
    id: string;
    code: string;
    discount_percent: number;
    is_free_shipping: boolean;
    min_order_cents: number;
    description: string | null;
    valid_from: string;
    valid_until: string;
  };
  original_total_cents: number;
  discount_cents: number;
  discounted_total_cents: number;
  is_free_shipping: boolean;
};

type OrderResponse = {
  success: boolean;
  message?: string;
  order: {
    id: string;
    subtotal_cents: number;
    shipping_cents: number;
    total_cents: number;
    shipping_method: string;
    payment_method: string;
  };
};

export default function CheckoutPage() {
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [notes, setNotes] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<PromoResponse["promo"] | null>(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");

  async function loadCart() {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await apiFetch<CartResponse>("/cart/list.php");

      setItems(data.items || []);
      setSubtotalCents(data.total_cents || 0);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load checkout.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCart();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  function formatPrice(cents: number) {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const baseShippingCents = subtotalCents >= 150000 ? 0 : 9900;

  const shippingCents = promo?.is_free_shipping ? 0 : baseShippingCents;

  const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);

  const totalCents = discountedSubtotalCents + shippingCents;

  async function handleApplyPromo() {
    const code = promoCode.trim();

    if (!code) {
      setPromoMessage("Please enter a promo code.");
      return;
    }

    try {
      setIsApplyingPromo(true);
      setPromoMessage("");

      const data = await apiFetch<PromoResponse>("/promos/apply.php", {
        method: "POST",
        body: JSON.stringify({
          code,
          total_cents: subtotalCents,
        }),
      });

      setPromo(data.promo);
      setDiscountCents(data.discount_cents);
      setPromoCode(data.promo.code);
      setPromoMessage(data.message || "Promo code applied successfully.");
    } catch (error) {
      setPromo(null);
      setDiscountCents(0);
      setPromoMessage(
        error instanceof Error ? error.message : "Unable to apply promo code.",
      );
    } finally {
      setIsApplyingPromo(false);
    }
  }

  function handleRemovePromo() {
    setPromo(null);
    setDiscountCents(0);
    setPromoCode("");
    setPromoMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !contactNumber.trim() ||
      !addressLine.trim() ||
      !city.trim() ||
      !province.trim() ||
      !postalCode.trim()
    ) {
      setMessage("Please complete all required shipping fields.");
      return;
    }

    if (items.length === 0) {
      setMessage("Your cart is empty.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      const data = await apiFetch<OrderResponse>("/orders/create.php", {
        method: "POST",
        body: JSON.stringify({
          shipping_address: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            contact_number: contactNumber.trim(),
            address_line: addressLine.trim(),
            city: city.trim(),
            province: province.trim(),
            postal_code: postalCode.trim(),
          },
          shipping_method: shippingMethod,
          payment_method: paymentMethod,
          notes: notes.trim(),
          promo_code: promo?.code || null,
        }),
      });

      sessionStorage.setItem("last_order", JSON.stringify(data.order));

      router.push(`/order-complete?order=${encodeURIComponent(data.order.id)}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="checkout-page">
        <section className="checkout-container">
          <h1>Checkout</h1>
          <p>Loading checkout...</p>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="checkout-page">
        <section className="checkout-container">
          <h1>Checkout</h1>
          <p>Your cart is empty.</p>
          <Link href="/products">Browse Products</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <section className="checkout-container">
        <div className="checkout-header">
          <div>
            <h1>Checkout</h1>
            <p>Complete your shipping and payment details.</p>
          </div>

          <Link href="/cart">Back to Cart</Link>
        </div>

        {message && <div className="checkout-message">{message}</div>}

        <form onSubmit={handleSubmit} className="checkout-layout">
          <div className="checkout-form-section">
            <section className="checkout-card">
              <h2>Shipping Information</h2>

              <div className="checkout-field-row">
                <div className="checkout-field">
                  <label htmlFor="firstName">First Name</label>

                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="lastName">Last Name</label>

                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="contactNumber">Contact Number</label>

                <input
                  id="contactNumber"
                  type="text"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  required
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="addressLine">Address</label>

                <input
                  id="addressLine"
                  type="text"
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                  required
                />
              </div>

              <div className="checkout-field-row">
                <div className="checkout-field">
                  <label htmlFor="city">City</label>

                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="province">Province</label>

                  <input
                    id="province"
                    type="text"
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="checkout-field">
                <label htmlFor="postalCode">Postal Code</label>

                <input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  required
                />
              </div>
            </section>

            <section className="checkout-card">
              <h2>Shipping Method</h2>

              <label className="checkout-option">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="standard"
                  checked={shippingMethod === "standard"}
                  onChange={(event) => setShippingMethod(event.target.value)}
                />

                <span>Standard Shipping</span>
              </label>
            </section>

            <section className="checkout-card">
              <h2>Payment Method</h2>

              <label className="checkout-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                />

                <span>Cash on Delivery</span>
              </label>

              <label className="checkout-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="xendit"
                  checked={paymentMethod === "xendit"}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                />

                <span>Online Payment</span>
              </label>
            </section>

            <section className="checkout-card">
              <h2>Order Notes</h2>

              <div className="checkout-field">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for your order"
                  rows={4}
                />
              </div>
            </section>
          </div>

          <aside className="checkout-summary">
            <h2>Order Summary</h2>

            <div className="checkout-items">
              {items.map((item) => (
                <div key={item.id} className="checkout-item">
                  <div>
                    <strong>{item.product.name}</strong>

                    <span>Qty: {item.qty}</span>
                  </div>

                  <strong>
                    {formatPrice(item.product.price_cents * item.qty)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="checkout-card">
              <h2>Promo Code</h2>

              <div className="checkout-field">
                <label htmlFor="promoCode">Enter promo code</label>

                <input
                  id="promoCode"
                  type="text"
                  value={promoCode}
                  onChange={(event) =>
                    setPromoCode(event.target.value.toUpperCase())
                  }
                  placeholder="Enter promo code"
                  disabled={isApplyingPromo}
                />
              </div>

              {!promo ? (
                <button
                  type="button"
                  className="checkout-submit"
                  onClick={handleApplyPromo}
                  disabled={isApplyingPromo}
                >
                  {isApplyingPromo ? "Applying..." : "Apply Promo"}
                </button>
              ) : (
                <button
                  type="button"
                  className="checkout-submit"
                  onClick={handleRemovePromo}
                >
                  Remove Promo
                </button>
              )}

              {promoMessage && <p>{promoMessage}</p>}

              {promo?.description && <p>{promo.description}</p>}
            </div>

            <div className="checkout-summary-row">
              <span>Subtotal</span>

              <strong>{formatPrice(subtotalCents)}</strong>
            </div>

            {discountCents > 0 && (
              <div className="checkout-summary-row">
                <span>
                  Discount
                  {promo?.discount_percent
                    ? ` (${promo.discount_percent}%)`
                    : ""}
                </span>

                <strong>-{formatPrice(discountCents)}</strong>
              </div>
            )}

            <div className="checkout-summary-row">
              <span>Shipping</span>

              <strong>
                {shippingCents === 0 ? "FREE" : formatPrice(shippingCents)}
              </strong>
            </div>

            <div className="checkout-summary-total">
              <span>Total</span>

              <strong>{formatPrice(totalCents)}</strong>
            </div>

            <button
              type="submit"
              className="checkout-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Creating Order..."
                : paymentMethod === "cod"
                  ? "Place Order"
                  : "Continue to Payment"}
            </button>
          </aside>
        </form>
      </section>
    </main>
  );
}
