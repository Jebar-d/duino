//homepage whaahhaha

"use client";

import Link from "next/link";
import { Clock3, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { Button } from "./ui/8bit/button";
import { Input } from "./ui/8bit/input";
import { toast as pixelToast } from "./ui/8bit/toast";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../lib/product-assets";
import { getPromoStatus } from "../lib/promo-status";

type Product = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  description?: string | null;
  img_url?: string | null;
  model_url?: string | null;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | string;
  is_low_stock?: boolean;
  low_stock_threshold?: number;
};

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from?: string | null;
  valid_until?: string | null;
  expiration_at?: string | null;
  status?: string | null;
  is_expired?: boolean;
  min_order_cents: number;
  description?: string | null;
  is_free_shipping: boolean;
};

export default function HomePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosLoaded, setPromosLoaded] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [promoSeconds, setPromoSeconds] = useState(0);
  const [heroSearch, setHeroSearch] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await apiFetch("/auth/user/me.php");
        setIsLoggedIn(true);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setAuthLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  function showToast(
    title: string,
    message?: string,
    _type: "success" | "error" | "info" = "info",
  ) {
    void _type;
    pixelToast(`${title}${message ? `: ${message}` : ""}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const loader = document.getElementById("page-loader");

      if (loader) {
        loader.classList.add("loaded");
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{
          products?: Product[];
        }>("/products/list.php?limit=8");

        if (Array.isArray(data.products)) {
          setProducts(data.products);
        }
      } catch {
        setProducts([]);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPromos() {
      try {
        const data = await apiFetch<{
          promos?: Promo[];
        }>("/promos/list.php");

        if (!cancelled && Array.isArray(data.promos)) {
          setPromos(data.promos);
        }
      } catch {
        if (!cancelled) {
          setPromos([]);
        }
      } finally {
        if (!cancelled) {
          setPromosLoaded(true);
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadPromos();
      }
    };
    void loadPromos();
    const interval = window.setInterval(() => void loadPromos(), 60_000);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isLoggedIn) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{
          items?: Array<{
            product_id: string;
          }>;
        }>("/wishlist/list.php");

        const productIds = new Set(
          (data.items || []).map((item) => item.product_id),
        );

        setWishlist(productIds);
      } catch {
        setWishlist(new Set());
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !promosLoaded) {
      return;
    }

    const popupKey = `promo_popup_${new Date().toDateString()}`;

    if (sessionStorage.getItem(popupKey)) {
      return;
    }

    const timer = setTimeout(() => {
      const activePromos = promos.filter(
        (promo) => getPromoStatus(promo) === "active",
      );

      if (activePromos.length === 0) {
        return;
      }

      const promo = activePromos[Math.floor(Math.random() * activePromos.length)];
      const expiration = new Date(
        (promo.expiration_at || promo.valid_until || "").replace(" ", "T"),
      ).getTime();

      setPromoCode(promo.code);
      setPromoMessage(promo.description || "Use this promo code at checkout:");
      setPromoSeconds(Math.max(0, Math.floor((expiration - Date.now()) / 1000)));
      setPromoOpen(true);

      sessionStorage.setItem(popupKey, "1");
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoggedIn, promosLoaded, promos]);

  useEffect(() => {
    if (!promoOpen) {
      return;
    }

    if (promoSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setPromoSeconds((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [promoOpen, promoSeconds]);

  function doHeroSearch() {
    const query = heroSearch.trim();

    if (!query) {
      return;
    }

    router.push(`/products?search=${encodeURIComponent(query)}`);
  }

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query)
      );
    });
  }, [products, productSearch]);

  async function toggleWishlist(productId: string) {
    if (authLoading) {
      return;
    }

    if (!isLoggedIn) {
      showToast("Sign in required", "Please log in to save items.", "info");
      return;
    }

    const currentlyWishlisted = wishlist.has(productId);

    try {
      if (currentlyWishlisted) {
        await apiFetch("/wishlist/remove.php", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
          }),
        });

        setWishlist((currentWishlist) => {
          const nextWishlist = new Set(currentWishlist);
          nextWishlist.delete(productId);
          return nextWishlist;
        });

        showToast("Removed", "Item removed from wishlist.", "info");
      } else {
        await apiFetch("/wishlist/add.php", {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
          }),
        });

        setWishlist((currentWishlist) => {
          const nextWishlist = new Set(currentWishlist);
          nextWishlist.add(productId);
          return nextWishlist;
        });

        showToast("Wishlisted!", "Item saved to your wishlist.", "success");
      }
    } catch (error) {
      showToast(
        "Wishlist error",
        error instanceof Error
          ? error.message
          : "Unable to update your wishlist.",
        "error",
      );
    }
  }

  function subscribeNewsletter() {
    const email = newsletterEmail.trim();

    if (!email.includes("@")) {
      showToast("Invalid email", "Please enter a valid email.", "error");
      return;
    }

    showToast("Subscribed!", "Thanks! We'll keep you in the loop.", "success");

    setNewsletterEmail("");
  }

  async function copyPromoCode() {
    try {
      await navigator.clipboard.writeText(promoCode);

      showToast("Copied!", `Code ${promoCode} copied to clipboard.`, "success");
    } catch {
      showToast("Copy failed", "Please copy the code manually.", "error");
    }
  }

  async function claimVoucher(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {}

    showToast(
      "Voucher Copied!",
      `Code "${code}" copied. Use it at checkout.`,
      "success",
    );
  }

  function formatPrice(priceCents: number) {
    return `₱${(priceCents / 100).toFixed(2)}`;
  }

  function formatCountdown(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  function heartIcon(active: boolean) {
    if (active) {
      return (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }

  return (
    <>
      <div id="page-loader">
        <img src="/logo2.png" alt="Arduino Store" className="loader-logo-img" />

        <div className="loader-bar-wrap">
          <div className="loader-bar" />
        </div>
      </div>

      <div className={`promo-popup-overlay ${promoOpen ? "" : "hidden"}`}>
        <div className="promo-popup">
          <Button
            className="promo-popup-close"
            onClick={() => setPromoOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </Button>

          <div className="promo-popup-badge">Limited Time Offer</div>

          <h2>Welcome Back!</h2>

          <p>{promoMessage}</p>

          <div className="promo-timer">
            {promoSeconds > 0
              ? <><Clock3 size={15} aria-hidden="true" /> Expires in {formatCountdown(promoSeconds)}</>
              : "Offer expired"}
          </div>

          <div className="promo-code-box">
            <span className="code">{promoCode}</span>

            <Button onClick={copyPromoCode}>Copy</Button>
          </div>

          <Link
            href="/products"
            className="promo-popup-cta"
            onClick={() => setPromoOpen(false)}
          >
            Shop Now &amp; Save
          </Link>

          <Button
            className="promo-popup-skip"
            onClick={() => setPromoOpen(false)}
          >
            Maybe later
          </Button>
        </div>
      </div>

      <section className="hero-banner">
        <div className="hero-scanlines" />

        <div className="hero-inner">
          <div className="hero-text-col">
            <div className="hero-tag">
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="4" fill="#FFFFFF" />
              </svg>
              Electronics &amp; Maker Components
            </div>

            <h1 className="hero-heading">
              <span className="hero-line-plain">Build</span>

              <span className="hero-line-accent">Something</span>

              <span className="hero-line-plain">Extraordinary</span>
            </h1>

            <p className="hero-sub">
              Premium Arduino boards, sensors, and components for makers,
              students, and engineers.
            </p>

            <div className="hero-buttons">
              <Link href="/products" className="btn-hero-primary">
                Browse Products
              </Link>

              <Button
                className="btn-hero-secondary"
                onClick={() => {
                  document.querySelector(".featured-grid")?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
              >
                Featured Items ↓
              </Button>
            </div>

            <div className="hero-search">
              <Input
                type="text"
                value={heroSearch}
                placeholder="Search products, boards, sensors…"
                onChange={(event) => setHeroSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    doHeroSearch();
                  }
                }}
              />

              <Button onClick={doHeroSearch} aria-label="Search">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8" />

                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="hero-visual-col">
            <div className="hero-board-scene">
              <div className="hb-glow" />

              <svg
                className="hb-svg"
                viewBox="0 0 340 240"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="20"
                  y="20"
                  width="280"
                  height="180"
                  rx="10"
                  fill="#0D0D0D"
                  stroke="#1A1A1A"
                  strokeWidth="2"
                />

                <rect
                  x="20"
                  y="20"
                  width="280"
                  height="180"
                  rx="10"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />

                <g stroke="rgba(255,255,255,0.1)" strokeWidth="1">
                  {[50, 62, 74, 86, 98, 110, 122, 134].map((x) => (
                    <rect
                      key={x}
                      x={x}
                      y="12"
                      width="8"
                      height="12"
                      rx="1"
                      fill="#111"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="0.8"
                    />
                  ))}
                </g>

                <g>
                  {[50, 62, 74, 86, 98, 110].map((x) => (
                    <rect
                      key={x}
                      x={x}
                      y="216"
                      width="8"
                      height="12"
                      rx="1"
                      fill="#111"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="0.8"
                    />
                  ))}
                </g>

                <rect
                  x="8"
                  y="88"
                  width="16"
                  height="28"
                  rx="3"
                  fill="#1a1a1a"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />

                <rect
                  x="10"
                  y="92"
                  width="12"
                  height="20"
                  rx="1"
                  fill="#0a0a0a"
                />

                <circle
                  cx="30"
                  cy="200"
                  r="10"
                  fill="#111"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />

                <circle cx="30" cy="200" r="5" fill="#0a0a0a" />

                <circle cx="30" cy="200" r="2" fill="#333" />

                <rect
                  x="130"
                  y="80"
                  width="70"
                  height="70"
                  rx="4"
                  fill="#0a0a0a"
                  stroke="rgba(119,207,207,0.35)"
                  strokeWidth="1.5"
                />

                {[90, 100, 110, 120, 130, 140].map((y) => (
                  <g key={y}>
                    <line
                      x1="120"
                      y1={y}
                      x2="130"
                      y2={y}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="1.5"
                    />

                    <line
                      x1="200"
                      y1={y}
                      x2="210"
                      y2={y}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}

                <text
                  x="165"
                  y="118"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.12)"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  ATmega
                </text>

                <text
                  x="165"
                  y="130"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.12)"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  328P
                </text>

                <rect
                  x="230"
                  y="95"
                  width="22"
                  height="12"
                  rx="3"
                  fill="#1a1a1a"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />

                <line
                  x1="234"
                  y1="95"
                  x2="234"
                  y2="107"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.5"
                />

                <line
                  x1="248"
                  y1="95"
                  x2="248"
                  y2="107"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.5"
                />

                <rect
                  x="240"
                  y="140"
                  width="20"
                  height="28"
                  rx="2"
                  fill="#1a1a1a"
                  stroke="rgba(119,207,207,0.25)"
                  strokeWidth="1"
                />

                <path
                  className="hb-trace hb-trace-1"
                  d="M60 22 V50 H120 V80"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                />

                <path
                  className="hb-trace hb-trace-2"
                  d="M80 22 V60 H200 V80"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animationDelay: "0.5s",
                  }}
                />

                <path
                  className="hb-trace hb-trace-3"
                  d="M100 22 V55 H240 V90"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animationDelay: "1s",
                  }}
                />

                <path
                  className="hb-trace hb-trace-4"
                  d="M60 218 V185 H120 V150"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animationDelay: "1.5s",
                  }}
                />

                <path
                  className="hb-trace hb-trace-5"
                  d="M80 218 V190 H210 V150"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animationDelay: "0.8s",
                  }}
                />

                <path
                  className="hb-trace hb-trace-6"
                  d="M36 102 H60 V60 H130 V80"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animationDelay: "0.3s",
                  }}
                />

                <circle
                  cx="270"
                  cy="55"
                  r="7"
                  fill="#0D0D0D"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />

                <circle
                  className="hb-led-pwr"
                  cx="270"
                  cy="55"
                  r="4.5"
                  fill="#1A1A1A"
                />

                <circle
                  cx="255"
                  cy="55"
                  r="7"
                  fill="#0D0D0D"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />

                <circle
                  className="hb-led-tx"
                  cx="255"
                  cy="55"
                  r="4.5"
                  fill="#1A1A1A"
                />

                <circle
                  cx="240"
                  cy="55"
                  r="7"
                  fill="#1A1A1A"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />

                <circle
                  className="hb-led-rx"
                  cx="240"
                  cy="55"
                  r="4.5"
                  fill="#1A1A1A"
                />

                <rect
                  x="270"
                  y="150"
                  width="22"
                  height="22"
                  rx="3"
                  fill="#111"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />

                <circle
                  className="hb-btn"
                  cx="281"
                  cy="161"
                  r="7"
                  fill="#1a1a1a"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1.5"
                />

                <circle cx="281" cy="161" r="3" fill="#0d0d0d" />
              </svg>

              <div className="hb-packet hb-packet-1" />
              <div className="hb-packet hb-packet-2" />
              <div className="hb-packet hb-packet-3" />
            </div>
          </div>
        </div>
      </section>

      <main className="container">
        <h2 className="section-title">Shop by Category</h2>

        <div className="categories-grid">
          {[
            {
              name: "Boards",
              icon: (
                <svg viewBox="0 0 24 24" fill="none">
                  <rect
                    x="2"
                    y="5"
                    width="20"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="7" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="17" cy="12" r="1.5" fill="currentColor" />
                  <line
                    x1="2"
                    y1="9"
                    x2="22"
                    y2="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              ),
            },
            {
              name: "Sensors",
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              ),
            },
            {
              name: "Actuators",
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              ),
            },
            {
              name: "Modules",
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ),
            },
            {
              name: "Kits",
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              ),
            },
          ].map((category) => (
            <Link
              href="/products"
              className="category-card"
              key={category.name}
            >
              <div className="category-icon">{category.icon}</div>

              <h3>{category.name}</h3>
            </Link>
          ))}
        </div>

        <h2 className="section-title">Featured Products</h2>

        <div className="search-bar-wrap">
          <Input
            type="text"
            value={productSearch}
            placeholder="Search featured products…"
            onChange={(event) => setProductSearch(event.target.value)}
          />

          <span className="search-icon">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />

              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>

        <div className="featured-grid">
          {filteredProducts.length === 0 ? (
            <p style={{ color: "var(--text2)" }}>No products available yet.</p>
          ) : (
            filteredProducts.map((product, index) => {
              const inWishlist = wishlist.has(product.id);
              const isOutOfStock =
                product.availability === "out_of_stock" ||
                Number(product.stock) <= 0;

              return (
                <Link
                  href={`/product/${product.slug}`}
                  className="featured-card"
                  key={product.id}
                  style={{
                    animationDelay: `${index * 0.08}s`,
                    opacity: isOutOfStock ? 0.75 : 1,
                  }}
                >
                  <div className="featured-image">
                    <img
                      src={getProductImageUrl(product.img_url)}
                      alt={product.name}
                      loading="lazy"
                      onError={handleProductImageError}
                    />

                    <div className="featured-badge">
                      {product.model_url ? "3D" : "NEW"}
                    </div>

                    {isOutOfStock && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.55)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "inherit",
                        }}
                      >
                        <span
                          style={{
                            background: "var(--foreground)",
                            color: "var(--background)",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            padding: "0.35rem 0.85rem",
                            borderRadius: "99px",
                            letterSpacing: "0.08em",
                          }}
                        >
                          SOLD OUT
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="featured-content">
                    <h3>{product.name}</h3>

                    <p>
                      {(
                        product.description || "Premium Arduino component"
                      ).substring(0, 80)}
                      …
                    </p>

                    {isOutOfStock ? (
                      <span
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#FFFFFF",
                          fontSize: "0.7rem",
                          padding: "2px 6px",
                          borderRadius: "10px",
                        }}
                      >
                        Out of Stock
                      </span>
                    ) : product.availability === "low_stock" || product.is_low_stock ? (
                      <span
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#FFFFFF",
                          fontSize: "0.7rem",
                          padding: "2px 6px",
                          borderRadius: "10px",
                        }}
                      >
                        Low Stock ({product.stock})
                      </span>
                    ) : null}

                    <div className="featured-price">
                      {formatPrice(product.price_cents)}
                    </div>

                    <div className="featured-footer">
                      <span>
                        {isOutOfStock ? "View Product" : "View Details"}
                      </span>

                      <Button
                        className={`wishlist-btn ${inWishlist ? "active" : ""}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleWishlist(product.id);
                        }}
                        title={
                          inWishlist
                            ? "Remove from wishlist"
                            : "Add to wishlist"
                        }
                      >
                        {heartIcon(inWishlist)}
                      </Button>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <h2 className="section-title">Active Promos &amp; Vouchers</h2>

        <div
          id="promo-vouchers-section"
          style={{
            marginBottom: "2.5rem",
          }}
        >
          <div
            id="promo-vouchers-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
              gap: "1rem",
            }}
          >
            {promos.length === 0 ? (
              <p
                style={{
                  color: "var(--text2)",
                  fontSize: "0.88rem",
                }}
              >
                No active promos right now. Check back soon!
              </p>
            ) : (
              promos.map((promo) => {
                const status = getPromoStatus(promo);
                const expired = status === "expired";

                return (
                <div
                  className="voucher-card"
                  key={promo.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px dashed var(--border)",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        className="voucher-code"
                        style={{
                          fontFamily: "monospace",
                          fontSize: "1rem",
                          fontWeight: 800,
                          color: "var(--primary)",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {promo.code}
                      </div>

                      <div
                        className="voucher-desc"
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text2)",
                          marginTop: "0.2rem",
                        }}
                      >
                        {promo.description ||
                          (promo.is_free_shipping
                            ? "Free Shipping"
                            : `${promo.discount_percent}% off`)}
                      </div>

                      {promo.min_order_cents > 0 && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text2)",
                          }}
                        >
                          Min. order: {formatPrice(promo.min_order_cents)}
                        </div>
                      )}
                    </div>
                      <span className={expired ? "b b-r" : status === "active" ? "b b-g" : "b b-o"}>
                        {status === "expired" ? "Expired" : status === "active" ? "Active" : status}
                      </span>
                      <Button
                        onClick={() => claimVoucher(promo.code)}
                        disabled={!["active"].includes(status)}
                      className="voucher-claim"
                      style={{
                        padding: "0.45rem 1rem",
                        background: "var(--primary)",
                        color: "#000",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {expired
                        ? "Expired"
                        : promo.is_free_shipping
                        ? "Free Ship"
                        : `${promo.discount_percent}% Off`}
                    </Button>
                  </div>

                  {(promo.expiration_at || promo.valid_until) && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text2)",
                      }}
                    >
                      Expires:{" "}
                      {new Date((promo.expiration_at || promo.valid_until || "").replace(" ", "T")).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>

        <div className="newsletter-section">
          <h2>Stay in the Loop</h2>

          <p>
            Get the latest products, project ideas, and exclusive deals straight
            to your inbox.
          </p>

          <div className="newsletter-form">
            <Input
              type="email"
              value={newsletterEmail}
              placeholder="your@email.com"
              onChange={(event) => setNewsletterEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  subscribeNewsletter();
                }
              }}
            />

            <Button onClick={subscribeNewsletter}>Subscribe</Button>
          </div>
        </div>
      </main>
    </>
  );
}
