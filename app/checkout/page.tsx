"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useSession } from "../../components/SessionProvider";
import { Button } from "../../components/ui/8bit/button";
import { Input } from "../../components/ui/8bit/input";
import { Textarea } from "../../components/ui/8bit/textarea";
import { Label } from "../../components/ui/8bit/label";
import { Checkbox } from "../../components/ui/8bit/checkbox";
import { RadioGroup, RadioGroupItem } from "../../components/ui/8bit/radio-group";
import { Alert, AlertDescription } from "../../components/ui/8bit/alert";
import { Card } from "../../components/ui/8bit/card";

type SavedAddress = {
  first_name?: string; middle_name?: string; last_name?: string; suffix?: string;
  address_line?: string; city?: string; province?: string; postal_code?: string; contact_number?: string;
};

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
    discount_cents?: number;
    promo_code?: string | null;
    shipping_method: string;
    payment_method: string;
  };
};

type PaymentMethodsResponse = { online_enabled: boolean };
type CheckoutResponse = { checkout_url?: string; already_paid?: boolean };

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

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
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("different");
  const [saveAddress, setSaveAddress] = useState(false);
  const shippingTouched = useRef(false);
  const prefetchedAddress = useRef(false);
  const [onlineEnabled, setOnlineEnabled] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
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

  useEffect(() => {
    if (sessionLoading || prefetchedAddress.current) return;
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        apiFetch<{ addresses: SavedAddress[] }>("/auth/user/addresses.php"),
      ]).then(([addressResult]) => {
        if (!active) return;
        const addresses = addressResult.status === "fulfilled" ? addressResult.value.addresses || [] : [];
        const fromProfile = user?.extra_addresses || [];
        const mergedAddresses = addresses.length ? addresses : fromProfile;
        setSavedAddresses(mergedAddresses);
        if (shippingTouched.current || prefetchedAddress.current) return;
        const first = mergedAddresses[0];
        if (first) {
          setFirstName(first.first_name || user?.first_name || "");
          setLastName(first.last_name || user?.last_name || "");
          setContactNumber(first.contact_number || user?.contact_number || "");
          setAddressLine(first.address_line || "");
          setCity(first.city || "");
          setProvince(first.province || "");
          setPostalCode(first.postal_code || "");
          setSelectedAddress("0");
          setSaveAddress(false);
        } else {
          setFirstName(user?.first_name || "");
          setLastName(user?.last_name || "");
          setContactNumber(user?.contact_number || "");
          setAddressLine(user?.address || "");
          setSaveAddress(Boolean(user?.address));
        }
        prefetchedAddress.current = true;
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [sessionLoading, user]);

  function updateShippingField(field: "firstName" | "lastName" | "contactNumber" | "addressLine" | "city" | "province" | "postalCode", value: string) {
    shippingTouched.current = true;
    setSelectedAddress("different");
    const next = { firstName, lastName, contactNumber, addressLine, city, province, postalCode, [field]: value };
    if (field === "firstName") setFirstName(value);
    if (field === "lastName") setLastName(value);
    if (field === "contactNumber") setContactNumber(value);
    if (field === "addressLine") setAddressLine(value);
    if (field === "city") setCity(value);
    if (field === "province") setProvince(value);
    if (field === "postalCode") setPostalCode(value);
    setSaveAddress(!savedAddresses.some((address) => address.address_line === next.addressLine && address.city === next.city && address.province === next.province && address.postal_code === next.postalCode));
  }

  function selectShippingAddress(value: string) {
    setSelectedAddress(value);
    shippingTouched.current = true;
    if (value === "different") {
      setSaveAddress(!savedAddresses.some((address) => address.address_line === addressLine && address.city === city && address.province === province && address.postal_code === postalCode));
      return;
    }
    const address = savedAddresses[Number(value)];
    if (!address) return;
    setFirstName(address.first_name || "");
    setLastName(address.last_name || "");
    setContactNumber(address.contact_number || "");
    setAddressLine(address.address_line || "");
    setCity(address.city || "");
    setProvince(address.province || "");
    setPostalCode(address.postal_code || "");
    setSaveAddress(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch<PaymentMethodsResponse>("/payment/methods.php")
        .then((data) => {
          setOnlineEnabled(data.online_enabled);
          if (!data.online_enabled) setPaymentMethod("cod");
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
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

      if (saveAddress) {
        try {
          await apiFetch("/auth/user/addresses.php", {
            method: "POST",
            body: JSON.stringify({
              action: "add",
              address: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                contact_number: contactNumber.trim(),
                address_line: addressLine.trim(),
                city: city.trim(),
                province: province.trim(),
                postal_code: postalCode.trim(),
              },
            }),
          });
        } catch {
          // Address saving is optional and must not block the order.
        }
      }

      sessionStorage.setItem("last_order", JSON.stringify(data.order));
      const orderUrl = `/order-complete?order=${encodeURIComponent(data.order.id)}`;
      if (paymentMethod === "cod") {
        router.push(orderUrl);
      } else {
        setIsRedirecting(true);
        try {
          const checkout = await apiFetch<CheckoutResponse>("/payment/create-checkout.php", {
            method: "POST",
            body: JSON.stringify({ order_id: data.order.id }),
          });
          if (checkout.checkout_url) {
            window.location.href = checkout.checkout_url;
            return;
          }
        } catch {
          // The order page can retry checkout if the initial request fails.
        }
        router.push(orderUrl);
      }
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

        {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}

        <form onSubmit={handleSubmit} className="checkout-layout">
          <div className="checkout-form-section">
            <Card className="checkout-card">
              <h2>Shipping Information</h2>

              <RadioGroup className="checkout-address-picker" aria-label="Deliver to" value={selectedAddress} onValueChange={selectShippingAddress}>
                <strong>Deliver to</strong>
                {savedAddresses.map((address, index) => (
                  <Label key={`${address.address_line}-${index}`}>
                    <RadioGroupItem value={String(index)} aria-label={`Use address ${index + 1}`} />
                    <strong>{[address.first_name, address.last_name].filter(Boolean).join(" ") || "Saved address"}</strong>
                    <p>{address.address_line}</p>
                    <p>{[address.city, address.province, address.postal_code].filter(Boolean).join(", ")}</p>
                    <p>{address.contact_number}</p>
                  </Label>
                ))}
                <Label><RadioGroupItem value="different" aria-label="Enter a different address" />Enter a different address</Label>
              </RadioGroup>

              <div className="checkout-field-row">
                <div className="checkout-field">
                  <Label htmlFor="firstName">First Name</Label>

                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(event) => updateShippingField("firstName", event.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field">
                  <Label htmlFor="lastName">Last Name</Label>

                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(event) => updateShippingField("lastName", event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="checkout-field">
                <Label htmlFor="contactNumber">Contact Number</Label>

                <Input
                  id="contactNumber"
                  type="text"
                  value={contactNumber}
                  onChange={(event) => updateShippingField("contactNumber", event.target.value)}
                  required
                />
              </div>

              <div className="checkout-field">
                  <Label htmlFor="addressLine">Street / house no. / barangay</Label>

                <Input
                  id="addressLine"
                  type="text"
                  value={addressLine}
                  onChange={(event) => updateShippingField("addressLine", event.target.value)}
                  required
                />
              </div>

              <div className="checkout-field-row">
                <div className="checkout-field"><Label htmlFor="city">City / municipality</Label><Input id="city" value={city} onChange={(event) => updateShippingField("city", event.target.value)} required /></div>
                <div className="checkout-field"><Label htmlFor="province">Province</Label><Input id="province" value={province} onChange={(event) => updateShippingField("province", event.target.value)} required /></div>
              </div>
              <div className="checkout-field"><Label htmlFor="postalCode">Postal code</Label><Input id="postalCode" inputMode="numeric" value={postalCode} onChange={(event) => updateShippingField("postalCode", event.target.value)} required /></div>
              <Label className="checkout-save-address"><Checkbox checked={saveAddress} onCheckedChange={(checked) => setSaveAddress(checked === true)} />Save this address to my account</Label>

              <div className="checkout-field-row">
                <div className="checkout-field">
                  <Label htmlFor="city">City</Label>

                  <Input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    required
                  />
                </div>

                <div className="checkout-field">
                  <Label htmlFor="province">Province</Label>

                  <Input
                    id="province"
                    type="text"
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="checkout-field">
                <Label htmlFor="postalCode">Postal Code</Label>

                <Input
                  id="postalCode"
                  type="text"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  required
                />
              </div>
            </Card>

            <Card className="checkout-card">
              <h2>Shipping Method</h2>

              <RadioGroup value={shippingMethod} onValueChange={setShippingMethod} aria-label="Shipping method">
                <Label className="checkout-option"><RadioGroupItem value="standard" /><span>Standard Shipping</span></Label>
              </RadioGroup>
            </Card>

            <Card className="checkout-card">
              <h2>Payment Method</h2>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} aria-label="Payment method">
                <Label className="checkout-option"><RadioGroupItem value="cod" /><span>Cash on Delivery</span></Label>
                <Label className="checkout-option"><RadioGroupItem value="gcash" disabled={!onlineEnabled} /><span>GCash</span></Label>
                <Label className="checkout-option"><RadioGroupItem value="maya" disabled={!onlineEnabled} /><span>Maya</span></Label>
                <Label className="checkout-option"><RadioGroupItem value="card" disabled={!onlineEnabled} /><span>Card</span></Label>
              </RadioGroup>
              {!onlineEnabled && <p>Online payment is not set up yet. Only Cash on Delivery is available.</p>}
            </Card>

            <Card className="checkout-card">
              <h2>Order Notes</h2>

              <div className="checkout-field">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for your order"
                  rows={4}
                />
              </div>
            </Card>
          </div>

          <Card className="checkout-summary">
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
                <Label htmlFor="promoCode">Enter promo code</Label>

                <Input
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
                <Button
                  type="button"
                  className="checkout-submit"
                  onClick={handleApplyPromo}
                  disabled={isApplyingPromo}
                >
                  {isApplyingPromo ? "Applying..." : "Apply Promo"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="checkout-submit"
                  onClick={handleRemovePromo}
                >
                  Remove Promo
                </Button>
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

            <Button
              type="submit"
              className="checkout-submit"
              disabled={isSubmitting}
            >
              {isRedirecting
                ? "Redirecting to payment..."
                : isSubmitting
                ? "Creating Order..."
                : paymentMethod === "cod"
                  ? "Place Order"
                  : "Continue to Payment"}
            </Button>
          </Card>
        </form>
      </section>
    </main>
  );
}
