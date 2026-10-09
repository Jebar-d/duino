"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { Input } from "../../components/ui/8bit/input";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/8bit/alert";
import { Skeleton } from "../../components/ui/8bit/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/8bit/select";
import { Card } from "../../components/ui/8bit/card";
import {
  getProductImageUrl,
  handleProductImageError,
} from "../../lib/product-assets";

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
  sku?: string | null;
  low_stock_threshold?: number;
  availability?: "in_stock" | "low_stock" | "out_of_stock" | string;
  is_low_stock?: boolean;
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
            <Input
              id="product-search"
              type="search"
              aria-label="Search products"
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>

          <div className="category-box">
            <Select value={category || "all"} onValueChange={(value) => setCategory(value === "all" ? "" : value)}>
              <SelectTrigger id="category-filter" aria-label="Filter products by category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section id="product-grid" className="product-grid">
          {isLoading ? (
              <div className="empty-state" aria-label="Loading products"><Skeleton className="h-8 w-48" /><Skeleton className="mt-3 h-4 w-32" /></div>
          ) : error ? (
            <Alert variant="destructive"><AlertTitle>Unable to load products</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
          ) : filteredProducts.length === 0 ? (
            <Alert><AlertTitle>No products found</AlertTitle><AlertDescription>
                There are currently no products matching your search or
                category.
            </AlertDescription></Alert>
          ) : (
            filteredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="product-card"
              >
                <Card>
                <div className="product-image-wrapper">
                  <img
                    src={getProductImageUrl(product.img_url)}
                    alt={product.name}
                    className="product-image"
                    onError={handleProductImageError}
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

                  {product.stock > 0 && product.availability !== "out_of_stock" ? (
                    <p className="product-stock in-stock">
                      {product.availability === "low_stock" || product.is_low_stock
                        ? `Low Stock (${product.stock})`
                        : `✓ In Stock (${product.stock})`}
                    </p>
                  ) : (
                    <p className="product-stock out-of-stock">✗ Out of Stock</p>
                  )}
                </div>
                </Card>
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
