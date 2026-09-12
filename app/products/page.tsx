"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type Product = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  description?: string | null;
  img_url?: string | null;
  model_url?: string | null;
  category_id?: string | null;
};

type Category = {
  id: string;
  name: string;
  slug?: string;
  parent_id?: string | null;
  icon?: string | null;
};

type ProductsResponse = {
  success: boolean;
  products: Product[];
  count: number;
};

type CategoriesResponse = {
  success: boolean;
  categories: Category[];
  count: number;
};

export default function ProductsPage() {
  const [search, setSearch] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const params = new URLSearchParams(window.location.search);

    return params.get("search") || "";
  });

  const [category, setCategory] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setIsLoading(true);
        setError("");

        const [productsResponse, categoriesResponse] = await Promise.all([
          apiFetch<ProductsResponse>("/products/list.php"),
          apiFetch<CategoriesResponse>("/categories/list.php"),
        ]);

        if (cancelled) {
          return;
        }

        setProducts(productsResponse.products || []);

        setCategories(categoriesResponse.categories || []);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load products.",
        );

        setProducts([]);

        setCategories([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query);

      const matchesCategory = !category || product.category_id === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  return (
    <>
      <main className="container">
        <section className="page-header">
          <h1>All Products</h1>

          <p>
            Browse our collection of Arduino boards, modules, sensors,
            components, and accessories.
          </p>
        </section>

        <section className="products-controls">
          <div className="search-box">
            <input
              id="product-search"
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>

          <div className="category-box">
            <select
              id="category-filter"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
              }}
            >
              <option value="">All Categories</option>

              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section id="product-grid" className="product-grid">
          {isLoading ? (
            <div className="empty-state">
              <h2>Loading products...</h2>

              <p>Please wait.</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <h2>Unable to load products</h2>

              <p>{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <h2>No products found</h2>

              <p>
                There are currently no products matching your search or
                category.
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="product-card"
              >
                <div className="product-image-wrapper">
                  <img
                    src={product.img_url || "/product.png"}
                    alt={product.name}
                    className="product-image"
                    onError={(event) => {
                      const image = event.currentTarget;

                      if (image.src.endsWith("/product.png")) {
                        return;
                      }

                      image.src = "/product.png";
                    }}
                  />

                  {product.model_url && (
                    <span className="product-3d-badge">3D</span>
                  )}
                </div>

                <div className="product-info">
                  <h3>{product.name}</h3>

                  <p className="product-price">
                    ₱{(product.price_cents / 100).toFixed(2)}
                  </p>

                  {product.stock > 0 ? (
                    <p className="product-stock in-stock">
                      ✓ In Stock ({product.stock})
                    </p>
                  ) : (
                    <p className="product-stock out-of-stock">✗ Out of Stock</p>
                  )}
                </div>
              </Link>
            ))
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} Arduino Store. All rights reserved.</p>
      </footer>
    </>
  );
}
