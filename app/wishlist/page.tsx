"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

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
};

type WishlistItem = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product: Product;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [removingId, setRemovingId] = useState("");

  const formatPrice = (cents: number) => {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const loadWishlist = async () => {
    try {
      const data = await apiFetch<{ items: WishlistItem[] }>(
        "/wishlist/list.php",
      );

      setItems(data.items || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your wishlist.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWishlist();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const removeItem = async (wishlistId: string) => {
    setRemovingId(wishlistId);
    setMessage("");

    try {
      await apiFetch("/wishlist/remove.php", {
        method: "POST",
        body: JSON.stringify({
          wishlist_id: wishlistId,
        }),
      });

      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== wishlistId),
      );

      setMessage("Product removed from your wishlist.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove the product.",
      );
    } finally {
      setRemovingId("");
    }
  };

  if (loading) {
    return (
      <main className="wishlist-page">
        <div className="wishlist-container">
          <h1>Wishlist</h1>
          <p>Loading your wishlist...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wishlist-page">
      <div className="wishlist-container">
        <div className="wishlist-header">
          <div>
            <h1>My Wishlist</h1>
            <p>
              {items.length === 0
                ? "You have no saved products."
                : `${items.length} saved ${
                    items.length === 1 ? "product" : "products"
                  }`}
            </p>
          </div>

          <Link href="/products">Continue Shopping</Link>
        </div>

        {message && <div className="wishlist-message">{message}</div>}

        {items.length === 0 ? (
          <div className="wishlist-empty">
            <h2>Your wishlist is empty</h2>
            <p>Save products here so you can easily find them later.</p>
            <Link href="/products">Browse Products</Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {items.map((item) => (
              <article className="wishlist-card" key={item.id}>
                <Link
                  href={`/product/${item.product.slug}`}
                  className="wishlist-image-link"
                >
                  <img
                    src={item.product.img_url || "/product.png"}
                    alt={item.product.name}
                    onError={(event) => {
                      event.currentTarget.src = "/product.png";
                    }}
                  />
                </Link>

                <div className="wishlist-card-content">
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="wishlist-product-name"
                  >
                    {item.product.name}
                  </Link>

                  <div className="wishlist-price">
                    {formatPrice(item.product.price_cents)}
                  </div>

                  <div className="wishlist-stock">
                    {item.product.stock > 0
                      ? `${item.product.stock} available`
                      : "Out of stock"}
                  </div>

                  <div className="wishlist-actions">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="wishlist-view-button"
                    >
                      View Product
                    </Link>

                    <button
                      type="button"
                      className="wishlist-remove-button"
                      onClick={() => removeItem(item.id)}
                      disabled={removingId === item.id}
                    >
                      {removingId === item.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
