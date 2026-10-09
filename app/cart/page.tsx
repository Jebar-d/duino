"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../../lib/product-assets";
import { Button } from "../../components/ui/8bit/button";
import { Card } from "../../components/ui/8bit/card";
import { Alert, AlertDescription } from "../../components/ui/8bit/alert";
import { Skeleton } from "../../components/ui/8bit/skeleton";
import { toast } from "../../components/ui/8bit/toast";

type Product = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  description: string | null;
  img_url: string | null;
  model_url: string | null;
  category_id: string | null;
  sku: string | null;
};

type CartItem = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  qty: number;
  product: Product;
  subtotal_cents: number;
};

type CartResponse = {
  success: boolean;
  items: CartItem[];
  count: number;
  total_quantity: number;
  total_cents: number;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [message, setMessage] = useState("");

  async function loadCart() {
    try {
      setIsLoading(true);
      setMessage("");

      const data = await apiFetch<CartResponse>("/cart/list.php");

      setItems(data.items || []);
      setTotalCents(data.total_cents || 0);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load your cart.",
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

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      return;
    }

    const item = items.find((cartItem) => cartItem.id === itemId);

    if (!item) {
      return;
    }

    if (quantity > item.product.stock) {
      setMessage(`Only ${item.product.stock} item(s) are available.`);
      return;
    }

    try {
      setUpdatingId(itemId);
      setMessage("");

      await apiFetch("/cart/update.php", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          qty: quantity,
        }),
      });

      await loadCart();
      toast("Cart quantity updated.");
      window.dispatchEvent(new Event("store:counts-changed"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update cart.",
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function removeItem(itemId: string) {
    const item = items.find((cartItem) => cartItem.id === itemId);
    if (!item) return;
    try {
      setRemovingId(itemId);
      setMessage("");

      await apiFetch("/cart/remove.php", {
        method: "POST",
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
        }),
      });

      await loadCart();
      toast(`${item.product.name} removed from cart.`);
      window.dispatchEvent(new Event("store:counts-changed"));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to remove item.",
      );
    } finally {
      setRemovingId("");
    }
  }

  function formatPrice(cents: number) {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const shippingCents = totalCents >= 150000 ? 0 : 9900;
  const grandTotalCents = totalCents + shippingCents;

  if (isLoading) {
    return (
      <main className="cart-page">
        <section className="cart-container">
          <h1>Shopping Cart</h1>
          <Skeleton className="h-10 w-full" aria-label="Loading your cart" />
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <section className="cart-container">
        <div className="cart-header">
          <div>
            <h1>Shopping Cart</h1>
            <p>
              {items.length === 0
                ? "Your cart is empty."
                : `${items.length} item${items.length === 1 ? "" : "s"} in your cart.`}
            </p>
          </div>

          <Link href="/products" className="cart-continue">
            Continue Shopping
          </Link>
        </div>

        {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}

        {items.length === 0 ? (
          <div className="cart-empty">
            <h2>Your cart is empty</h2>
            <p>Add some Arduino products to get started.</p>
            <Link href="/products" className="cart-shop-button">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {items.map((item) => {
                const product = item.product;
                const lineTotal = product.price_cents * item.qty;

                return (
                  <Card key={item.id} className="cart-item">
                    <Link
                      href={`/product/${product.slug}`}
                      className="cart-item-image"
                    >
                      <img
                        src={getProductImageUrl(product.img_url)}
                        alt={product.name}
                        onError={handleProductImageError}
                      />
                    </Link>

                    <div className="cart-item-info">
                      <Link
                        href={`/product/${product.slug}`}
                        className="cart-item-name"
                      >
                        {product.name}
                      </Link>

                      {product.sku && (
                        <p className="cart-item-sku">SKU: {product.sku}</p>
                      )}

                      <p className="cart-item-stock">
                        {product.stock > 0
                          ? `${product.stock} available`
                          : "Out of stock"}
                      </p>

                      <div className="cart-item-actions">
                        <div className="cart-quantity">
                          <Button
                            variant="outline"
                            size="icon"
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.qty - 1)
                            }
                            disabled={
                              updatingId === item.id || item.qty <= 1
                            }
                          >
                            −
                          </Button>

                          <span>
                            {updatingId === item.id ? "…" : item.qty}
                          </span>

                          <Button
                            variant="outline"
                            size="icon"
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.qty + 1)
                            }
                            disabled={
                              updatingId === item.id ||
                              item.qty >= product.stock
                            }
                          >
                            +
                          </Button>
                        </div>

                        <Button
                          variant="destructive"
                          type="button"
                          className="cart-remove"
                          onClick={() => removeItem(item.id)}
                          disabled={removingId === item.id}
                        >
                          {removingId === item.id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </div>

                    <div className="cart-item-price">
                      <strong>{formatPrice(lineTotal)}</strong>
                      <span>{formatPrice(product.price_cents)} each</span>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="cart-summary">
              <h2>Order Summary</h2>

              <div className="cart-summary-row">
                <span>Subtotal</span>
                <strong>{formatPrice(totalCents)}</strong>
              </div>

              <div className="cart-summary-row">
                <span>Shipping</span>
                <strong>
                  {shippingCents === 0 ? "FREE" : formatPrice(shippingCents)}
                </strong>
              </div>

              {shippingCents > 0 && (
                <p className="cart-shipping-note">
                  Free shipping on orders of ₱1,500 or more.
                </p>
              )}

              <div className="cart-summary-total">
                <span>Total</span>
                <strong>{formatPrice(grandTotalCents)}</strong>
              </div>

              <Link href="/checkout" className="cart-checkout-button">
                Proceed to Checkout
              </Link>
            </Card>
          </div>
        )}
      </section>
    </main>
  );
}
