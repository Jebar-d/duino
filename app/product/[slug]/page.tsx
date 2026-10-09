"use client";

import Link from "next/link";
import { Heart, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../../../lib/product-assets";

const ProductModelViewer = dynamic(
  () => import("../../../components/ProductModelViewer"),
  {
    ssr: false,
    loading: () => <div className="product-model-loading">Loading 3D model...</div>,
  },
);

type Variant = {
  id: string;
  variant_name: string;
  option_value: string;
  price_adjustment: number;
  stock: number;
  img_url: string | null;
};

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

type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ReviewsResponse = {
  success: boolean;
  reviews: Review[];
  review_count: number;
  average_rating: number;
};

type WishlistItem = {
  id: string;
  product_id: string;
};

type WishlistResponse = {
  success: boolean;
  items: WishlistItem[];
};

type AuthResponse = {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
};

function getModelUrl(product: Product) {
  const modelUrl = product.model_url?.trim() ?? "";

  if (modelUrl && /\.glb(?:[?#].*)?$/i.test(modelUrl)) {
    return modelUrl;
  }

  if (!modelUrl) {
    if (product.slug === "arduino-uno") {
      return "/arduino_uno_board.glb";
    }

    if (product.slug === "mb-102-breadboard") {
      return "/arduino_breadboard_-_low_poly.glb";
    }
  }

  return null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [cartMessage, setCartMessage] = useState("");
  const [cartLoading, setCartLoading] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<"image" | "model">("image");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");

  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await apiFetch<{
          success: boolean;
          product: Product;
        }>(`/products/get.php?slug=${encodeURIComponent(slug)}`);

        if (!cancelled) {
          setProduct(response.product);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setProduct(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const productId = product?.id ?? "";

    if (!productId) {
      return;
    }

    let cancelled = false;

    async function loadAuthAndWishlist() {
      try {
        const auth = await apiFetch<AuthResponse>("/auth/user/me.php");

        if (cancelled) {
          return;
        }

        if (!auth.user) {
          setIsLoggedIn(false);
          setIsWishlisted(false);
          return;
        }

        setIsLoggedIn(true);

        const wishlist = await apiFetch<WishlistResponse>("/wishlist/list.php");

        if (cancelled) {
          return;
        }

        const found = wishlist.items.some(
          (item) => item.product_id === productId,
        );

        setIsWishlisted(found);
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false);
          setIsWishlisted(false);
        }
      }
    }

    loadAuthAndWishlist();

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  useEffect(() => {
    const productId = product?.id ?? "";

    if (!productId) {
      return;
    }

    let cancelled = false;

    async function loadReviews() {
      setReviewsLoading(true);

      try {
        const response = await apiFetch<ReviewsResponse>(
          `/reviews/list.php?product_id=${encodeURIComponent(productId)}`,
        );

        if (cancelled) {
          return;
        }

        setReviews(response.reviews || []);
        setReviewCount(response.review_count || 0);
        setAverageRating(response.average_rating || 0);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setReviews([]);
          setReviewCount(0);
          setAverageRating(0);
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const formatPrice = (cents: number) => {
    return `₱${(cents / 100).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getReviewName = (review: Review) => {
    const fullName = [review.first_name, review.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) {
      return fullName;
    }

    if (review.username) {
      return review.username;
    }

    return "Customer";
  };

  const formatReviewDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStars = (rating: number) => {
    return (
      <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index}>{index < rating ? "★" : "☆"}</span>
        ))}
      </span>
    );
  };

  const increaseQuantity = () => {
    if (!product) {
      return;
    }

    setQuantity((current) => Math.min(current + 1, activeStock));
  };

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(current - 1, 1));
  };

  useEffect(() => {
    const productId = product?.id ?? "";

    if (!productId) {
      return;
    }

    let cancelled = false;

    apiFetch<{ variants: Variant[] }>(
      `/variants/list.php?product_id=${encodeURIComponent(productId)}`,
    )
      .then((data) => {
        if (!cancelled) {
          setVariants(data.variants ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVariants([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const activePriceCents =
    (product?.price_cents ?? 0) + (selectedVariant?.price_adjustment ?? 0);
  const activeStock = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0);

  const addToCart = async () => {
    if (!product) {
      return;
    }

    if (variants.length > 0 && !selectedVariant) {
      setCartMessage("Please choose an option first.");
      return;
    }

    setCartLoading(true);
    setCartMessage("");

    try {
      await apiFetch("/cart/add.php", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          qty: quantity,
          ...(selectedVariant ? { variant_id: selectedVariant.id } : {}),
        }),
      });

      setCartMessage("Added to cart.");
      window.dispatchEvent(new Event("store:counts-changed"));
    } catch (error) {
      setCartMessage(
        error instanceof Error ? error.message : "Unable to add to cart.",
      );
    } finally {
      setCartLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!product) {
      return;
    }

    if (!isLoggedIn) {
      setCartMessage("Please log in to use your wishlist.");
      return;
    }

    setWishlistLoading(true);

    try {
      if (isWishlisted) {
        await apiFetch("/wishlist/remove.php", {
          method: "POST",
          body: JSON.stringify({
            product_id: product.id,
          }),
        });

        setIsWishlisted(false);
      } else {
        await apiFetch("/wishlist/add.php", {
          method: "POST",
          body: JSON.stringify({
            product_id: product.id,
          }),
        });

        setIsWishlisted(true);
      }
    } catch (error) {
      setCartMessage(
        error instanceof Error ? error.message : "Unable to update wishlist.",
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  const submitReview = async () => {
    if (!product) {
      return;
    }

    if (!isLoggedIn) {
      setReviewError("Please log in to submit a review.");
      setReviewMessage("");
      return;
    }

    if (!reviewComment.trim()) {
      setReviewError("Please enter a review.");
      setReviewMessage("");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    setReviewMessage("");

    try {
      await apiFetch("/reviews/create.php", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          rating: selectedRating,
          comment: reviewComment.trim(),
        }),
      });

      const response = await apiFetch<ReviewsResponse>(
        `/reviews/list.php?product_id=${encodeURIComponent(product.id)}`,
      );

      setReviews(response.reviews || []);
      setReviewCount(response.review_count || 0);
      setAverageRating(response.average_rating || 0);
      setReviewComment("");
      setSelectedRating(5);
      setReviewMessage("Your review has been submitted successfully.");
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to submit review.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-container">
          <p>Loading product...</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-container">
          <h1>Product Not Found</h1>
          <p>The product you are looking for could not be found.</p>
          <Link href="/products">Back to Products</Link>
        </div>
      </main>
    );
  }

  const modelUrl = getModelUrl(product);

  return (
    <main className="product-detail-page">
      <div className="product-detail-container">
        <div
          className={`product-detail-main${selectedMedia === "model" && modelUrl ? " is-3d" : ""}`}
        >
          <div className="product-detail-image">
            {modelUrl && (
              <div className="product-media-tabs" role="tablist" aria-label="Product media">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedMedia === "image"}
                  className={selectedMedia === "image" ? "active" : ""}
                  onClick={() => setSelectedMedia("image")}
                >
                  Image
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedMedia === "model"}
                  className={selectedMedia === "model" ? "active" : ""}
                  onClick={() => setSelectedMedia("model")}
                >
                  View in 3D
                </button>
              </div>
            )}

            {selectedMedia === "model" && modelUrl ? (
              <ProductModelViewer
                key={modelUrl}
                modelUrl={modelUrl}
                productName={product.name}
                poster={getProductImageUrl(product.img_url)}
              />
            ) : (
              <img
                src={getProductImageUrl(product.img_url)}
                alt={product.name}
                onError={handleProductImageError}
              />
            )}

            {!modelUrl && (
              <p className="product-model-unavailable">
                A 3D model is not available for this product.
              </p>
            )}
          </div>

          <div className="product-detail-info">
            <h1>{product.name}</h1>

            <div className="product-detail-rating">
              {reviewCount > 0 ? (
                <>
                  {renderStars(Math.round(averageRating))}
                  <span>
                    {averageRating.toFixed(1)} ({reviewCount}{" "}
                    {reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
            </div>

            <div className="product-detail-price">
              {formatPrice(activePriceCents)}
            </div>

            {variants.length > 0 && (
              <div className="product-variants">
                <span className="product-variants-label">
                  {variants[0].variant_name}
                </span>
                <div className="product-variants-options">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={variant.stock <= 0}
                      className={variant.id === selectedVariantId ? "active" : ""}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setQuantity(1);
                      }}
                    >
                      {variant.option_value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="product-detail-stock">
              {activeStock > 0 ? `${activeStock} available` : "Out of stock"}
            </div>

            {product.description && (
              <div className="product-detail-description">
                <p>{product.description}</p>
              </div>
            )}

            {activeStock > 0 && (
              <div className="product-detail-purchase">
                <div className="product-quantity">
                  <button
                    type="button"
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={17} strokeWidth={2.5} aria-hidden="true" />
                  </button>

                  <span>{quantity}</span>

                  <button
                    type="button"
                    onClick={increaseQuantity}
                    disabled={quantity >= activeStock}
                    aria-label="Increase quantity"
                  >
                    <Plus size={17} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={addToCart}
                  disabled={cartLoading}
                  className="product-add-cart"
                >
                  {cartLoading ? "Adding..." : "Add to Cart"}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              className="product-wishlist-button"
            >
              {wishlistLoading
                ? "Saving..."
                : isWishlisted
                  ? <><Heart size={16} fill="currentColor" aria-hidden="true" /> Saved</>
                  : <><Heart size={16} aria-hidden="true" /> Save</>}
            </button>

            {cartMessage && (
              <p className="product-cart-message">{cartMessage}</p>
            )}
          </div>
        </div>

        <section className="product-reviews-section" id="reviews">
          <div className="product-reviews-header">
            <div>
              <h2>Customer Reviews</h2>

              {reviewCount > 0 ? (
                <div className="reviews-summary">
                  <div className="reviews-average">
                    <strong>{averageRating.toFixed(1)}</strong>
                    {renderStars(Math.round(averageRating))}
                  </div>

                  <span>
                    {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                  </span>
                </div>
              ) : (
                <p>No reviews yet. Be the first to review this product.</p>
              )}
            </div>
          </div>

          <div className="review-form">
            <h3>Write a Review</h3>

            {!isLoggedIn ? (
              <div className="review-login-message">
                <p>Please log in to submit a review.</p>
                <Link href="/login">Log In</Link>
              </div>
            ) : (
              <>
                <div className="review-rating-selector">
                  <span>Your Rating</span>

                  <div>
                    {Array.from({ length: 5 }, (_, index) => {
                      const rating = index + 1;

                      return (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setSelectedRating(rating)}
                          aria-label={`${rating} star rating`}
                          className={rating <= selectedRating ? "selected" : ""}
                        >
                          {rating <= selectedRating ? "★" : "☆"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="review-comment-field">
                  <label htmlFor="review-comment">Your Review</label>

                  <textarea
                    id="review-comment"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="Share your experience with this product"
                    rows={5}
                    maxLength={1000}
                  />

                  <span>{reviewComment.length}/1000</span>
                </div>

                <button
                  type="button"
                  onClick={submitReview}
                  disabled={reviewSubmitting}
                  className="review-submit-button"
                >
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </button>

                {reviewMessage && (
                  <p className="review-success-message">{reviewMessage}</p>
                )}

                {reviewError && (
                  <p className="review-error-message">{reviewError}</p>
                )}
              </>
            )}
          </div>

          <div className="reviews-list">
            {reviewsLoading ? (
              <p>Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="no-reviews">No reviews have been submitted yet.</p>
            ) : (
              reviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-card-header">
                    <div>
                      <strong>{getReviewName(review)}</strong>
                      {renderStars(review.rating)}
                    </div>

                    <time dateTime={review.created_at}>
                      {formatReviewDate(review.created_at)}
                    </time>
                  </div>

                  <p>{review.comment}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
