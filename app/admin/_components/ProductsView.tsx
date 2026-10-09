import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch, API_BASE } from "../../../lib/api";
import { getProductImageUrl, handleProductImageError } from "../../../lib/product-assets";
import type { Category, Product, ProductVariant } from "./types";
import { money } from "./utils";

const ProductModelViewer = dynamic(() => import("../../../components/ProductModelViewer"), { ssr: false, loading: () => <div className="product-model-loading">Loading 3D model...</div> });

export function ProductsView({
  showToast,
  setLoading,
}: {
  showToast: (message: string, type?: string) => void;
  setLoading: (value: boolean) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [initialVariants, setInitialVariants] = useState<ProductVariant[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantLoadError, setVariantLoadError] = useState("");
  const variantRequestIdRef = useRef(0);
  const [modelUrl, setModelUrl] = useState("");
  const [modelFileName, setModelFileName] = useState("");
  const [uploadingModel, setUploadingModel] = useState(false);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  async function refreshProducts() {
    const data = await apiFetch<{
      success: boolean;
      products: Product[];
    }>("/products/list.php");

    setProducts(data.products || []);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchProducts() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          apiFetch<{
            success: boolean;
            products: Product[];
          }>("/products/list.php"),
          apiFetch<{
            success: boolean;
            categories: Category[];
          }>("/categories/list.php"),
        ]);

        if (!cancelled) {
          setProducts(productsData.products || []);
          setCategories(categoriesData.categories || []);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, []);
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q) ||
        (product.sku || "").toLowerCase().includes(q);

      const matchesCategory =
        !categoryFilter || product.category_id === categoryFilter;

      return matchesQuery && matchesCategory;
    });
  }, [products, query, categoryFilter]);

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }

  function openAdd() {
    variantRequestIdRef.current += 1;
    setEditing(null);
    setName("");
    setSlug("");
    setPrice("");
    setStock("");
    setCategoryId("");
    setSku("");
    setDescription("");
    setImageFile(null);
    setInitialVariants([]);
    setVariantDrafts([]);
    setVariantsLoading(false);
    setVariantLoadError("");
    setModelUrl("");
    setModelFileName("");
    if (modelFileInputRef.current) {
      modelFileInputRef.current.value = "";
    }
    setModalOpen(true);
  }

  async function openEdit(product: Product) {
    const requestId = variantRequestIdRef.current + 1;
    variantRequestIdRef.current = requestId;
    setEditing(product);
    setName(product.name);
    setSlug(product.slug);
    setPrice((product.price_cents / 100).toFixed(2));
    setStock(String(product.stock));
    setCategoryId(product.category_id || "");
    setSku(product.sku || "");
    setDescription(product.description || "");
    setImageFile(null);
    setInitialVariants([]);
    setVariantDrafts([]);
    setVariantsLoading(true);
    setVariantLoadError("");
    setModelUrl(product.model_url || "");
    setModelFileName(
      product.model_url?.split(/[?#]/, 1)[0].split("/").pop() || "",
    );
    if (modelFileInputRef.current) {
      modelFileInputRef.current.value = "";
    }
    setModalOpen(true);
    try {
      const data = await apiFetch<{ success: boolean; variants: ProductVariant[] }>(
        `/variants/list.php?product_id=${encodeURIComponent(product.id)}`,
      );
      if (requestId !== variantRequestIdRef.current) return;
      setInitialVariants(data.variants ?? []);
      setVariantDrafts(data.variants ?? []);
    } catch (error) {
      if (requestId !== variantRequestIdRef.current) return;
      setVariantLoadError(error instanceof Error ? error.message : "Unable to load variants.");
      showToast(error instanceof Error ? error.message : "Unable to load variants.", "error");
    } finally {
      if (requestId === variantRequestIdRef.current) {
        setVariantsLoading(false);
      }
    }
  }

  async function uploadModel(file: File) {
    if (!/\.glb$/i.test(file.name)) {
      showToast("Choose a .glb model file.", "error");
      if (modelFileInputRef.current) {
        modelFileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast("The 3D model must be 25 MB or smaller.", "error");
      if (modelFileInputRef.current) {
        modelFileInputRef.current.value = "";
      }
      return;
    }

    setUploadingModel(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("kind", "model");

      const result = await apiFetch<{ success: boolean; url?: string }>(
        "/products/upload.php",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!result.url?.trim()) {
        throw new Error("The server did not return a model URL.");
      }

      setModelUrl(result.url);
      setModelFileName(file.name);
      showToast("3D model uploaded.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "3D model upload failed.",
        "error",
      );
      if (modelFileInputRef.current) {
        modelFileInputRef.current.value = "";
      }
    } finally {
      setUploadingModel(false);
    }
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/products/upload.php`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Image upload failed.");
    }

    return data.url as string;
  }

  async function saveProduct() {
    const id = editing?.id;
    const cleanName = name.trim();
    const cleanSlug = slug.trim();
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (
      !cleanName ||
      !cleanSlug ||
      !Number.isFinite(numericPrice) ||
      !Number.isInteger(numericStock)
    ) {
      showToast("Fill all required fields.", "error");
      return;
    }

    if (uploadingModel) {
      showToast("Wait for the 3D model upload to finish.", "error");
      return;
    }
    if (variantsLoading || variantLoadError) {
      showToast(variantLoadError || "Wait for variants to finish loading.", "error");
      return;
    }

    setSaving(true);
    let savedProductId = id || "";

    try {
      let imgUrl = editing?.img_url || null;

      if (imageFile) {
        imgUrl = await uploadImage(imageFile);
      }

      const payload = {
        name: cleanName,
        slug: cleanSlug,
        price_cents: Math.round(numericPrice * 100),
        stock: numericStock,
        category_id: categoryId || null,
        sku: sku.trim() || null,
        description: description.trim() || null,
        img_url: imgUrl,
        model_url: modelUrl.trim() || null,
      };

      if (id) {
        await apiFetch("/products/update.php", {
          method: "PUT",
          body: JSON.stringify({
            id,
            ...payload,
          }),
        });

      } else {
        const result = await apiFetch<{ success: boolean; product: Product }>("/products/create.php", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        savedProductId = result.product.id;
      }

      if (!savedProductId) {
        throw new Error("The server did not return the saved product ID.");
      }
      await saveVariants(savedProductId);
      showToast(id ? "Product updated!" : "Product added!", "success");
      setModalOpen(false);
      await refreshProducts();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unable to save product.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveVariants(productId: string) {
    const baseline = [...initialVariants];
    const drafts = [...variantDrafts];
    const draftIds = new Set(drafts.flatMap((variant) => variant.id ? [variant.id] : []));

    for (const variant of [...baseline]) {
      if (variant.id && !draftIds.has(variant.id)) {
        await apiFetch("/variants/delete.php", {
          method: "POST",
          body: JSON.stringify({ id: variant.id }),
        });
        const index = baseline.findIndex((item) => item.id === variant.id);
        if (index !== -1) baseline.splice(index, 1);
        setInitialVariants([...baseline]);
      }
    }

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const payload = {
        product_id: productId,
        variant_name: draft.variant_name.trim(),
        option_value: draft.option_value.trim(),
        price_adjustment: Math.round(Number(draft.price_adjustment)),
        stock: Math.trunc(Number(draft.stock)),
      };
      if (!payload.variant_name || !payload.option_value || !Number.isFinite(payload.price_adjustment) || !Number.isInteger(payload.stock) || payload.stock < 0) {
        throw new Error("Each variant needs a name, option value, valid price adjustment, and non-negative stock.");
      }

      if (draft.id) {
        await apiFetch("/variants/update.php", {
          method: "PUT",
          body: JSON.stringify({ id: draft.id, ...payload }),
        });
        const baselineIndex = baseline.findIndex((item) => item.id === draft.id);
        const savedVariant = { ...payload, id: draft.id };
        if (baselineIndex === -1) baseline.push(savedVariant);
        else baseline[baselineIndex] = savedVariant;
        setInitialVariants([...baseline]);
      } else {
        const result = await apiFetch<{ success: boolean; variant: ProductVariant }>("/variants/create.php", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const savedVariant = result.variant;
        baseline.push(savedVariant);
        drafts[index] = savedVariant;
        setInitialVariants([...baseline]);
        setVariantDrafts([...drafts]);
      }
    }
  }

  async function deleteProduct(productId: string) {
    const confirmed = window.confirm(
      "Delete this product? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/products/delete.php", {
        method: "DELETE",
        body: JSON.stringify({
          id: productId,
        }),
      });

      showToast("Product deleted.", "info");
      await refreshProducts();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to delete product.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Products</div>
          <div className="adm-ph-sub">{products.length} items in catalog</div>
        </div>

        <button className="adm-btn adm-btn-p" onClick={openAdd}>
          + Add Product
        </button>
      </div>

      <div className="adm-toolbar">
        <div className="adm-search">
          <span className="adm-search-icon">⌕</span>

          <input
            type="text"
            placeholder="Search products…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <select
          className="adm-sel"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All Categories</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="adm-tw">
        {!filteredProducts.length ? (
          <div className="adm-empty">No products found</div>
        ) : (
          <table className="adm-t">
            <thead>
              <tr>
                <th>Img</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <img
                      src={getProductImageUrl(product.img_url)}
                      alt={product.name}
                      onError={handleProductImageError}
                    />
                  </td>

                  <td>
                    <div style={{ fontWeight: 600 }}>{product.name}</div>

                    <div className="adm-small adm-muted">{product.slug}</div>
                  </td>

                  <td>{money(product.price_cents)}</td>

                  <td>
                    {product.stock <= 5 ? (
                      <span className="b b-r">{product.stock}</span>
                    ) : (
                      <span className="b b-g">{product.stock}</span>
                    )}
                  </td>

                  <td>
                    <span className="b b-t">
                      {product.category_name || "—"}
                    </span>
                  </td>

                  <td className="adm-small adm-muted">{product.sku || "—"}</td>

                  <td>
                    <div className="adm-actions">
                      <button
                        className="adm-btn adm-btn-o adm-btn-s"
                        onClick={() => void openEdit(product)}
                      >
                        Edit
                      </button>

                      <button
                        className="adm-btn adm-btn-d adm-btn-s"
                        onClick={() => deleteProduct(product.id)}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="adm-modal">
          <div className="adm-modal-box">
            <div className="adm-mh">
              <div className="adm-mt">
                {editing ? "Edit Product" : "Add Product"}
              </div>

              <button className="adm-mx" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Name *</label>

                <input
                  value={name}
                  placeholder="Arduino UNO R3"
                  onChange={(event) => {
                    const value = event.target.value;
                    setName(value);

                    if (!editing) {
                      setSlug(createSlug(value));
                    }
                  }}
                />
              </div>

              <div className="fg">
                <label>Slug *</label>

                <input
                  value={slug}
                  placeholder="arduino-uno-r3"
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Price (PHP) *</label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  placeholder="1500.00"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>

              <div className="fg">
                <label>Stock *</label>

                <input
                  type="number"
                  min="0"
                  value={stock}
                  placeholder="25"
                  onChange={(event) => setStock(event.target.value)}
                />
              </div>
            </div>

            <div className="fr">
              <div className="fg">
                <label>Category</label>

                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select…</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>SKU</label>

                <input
                  value={sku}
                  placeholder="ARD-001"
                  onChange={(event) => setSku(event.target.value)}
                />
              </div>
            </div>

            <div className="fg">
              <label>Description</label>

              <textarea
                value={description}
                placeholder="Product description…"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="fg">
              <label>
                Image{" "}
                <small
                  style={{
                    textTransform: "none",
                    fontWeight: 400,
                    color: "var(--adm-text2)",
                  }}
                >
                  (JPG/PNG/WEBP)
                </small>
              </label>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] || null)
                }
              />
            </div>

            <div className="fg">
              <label>3D model (.glb)</label>
              <input
                ref={modelFileInputRef}
                type="file"
                accept=".glb,model/gltf-binary"
                disabled={uploadingModel}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];

                  if (file) {
                    void uploadModel(file);
                  }
                }}
              />
              <small className="adm-small adm-muted">
                Maximum file size: 25 MB. {uploadingModel ? "Uploading…" : ""}
              </small>
              <input
                type="url"
                value={modelUrl}
                placeholder="Paste a .glb URL"
                aria-label="3D model URL"
                onChange={(event) => {
                  const value = event.target.value;
                  setModelUrl(value);
                  setModelFileName(
                    value.split(/[?#]/, 1)[0].split("/").pop() || "",
                  );
                }}
              />
              {modelFileName && (
                <div className="adm-small adm-muted">
                  Model file: {modelFileName}
                </div>
              )}
              {modelUrl && (
                <>
                  <button
                    type="button"
                    className="adm-btn adm-btn-d adm-btn-s"
                    disabled={uploadingModel}
                    onClick={() => {
                      setModelUrl("");
                      setModelFileName("");
                      if (modelFileInputRef.current) {
                        modelFileInputRef.current.value = "";
                      }
                    }}
                  >
                    Remove model
                  </button>
                  <div className="adm-model-preview">
                    <ProductModelViewer
                      key={modelUrl}
                      modelUrl={modelUrl}
                      productName={name || "Product preview"}
                      poster={getProductImageUrl(editing?.img_url)}
                    />
                  </div>
                </>
              )}
            </div>

            <section className="an-section">
              <div className="adm-mh">
                <h4>Variants</h4>
                <button
                  type="button"
                  className="adm-btn adm-btn-o adm-btn-s"
                  onClick={() => setVariantDrafts((current) => [
                    ...current,
                    { variant_name: "", option_value: "", price_adjustment: 0, stock: 0 },
                  ])}
                >
                  Add variant
                </button>
              </div>
              <p className="adm-small adm-muted">
                Variant price adjustments are in PHP and added to the base product price.
              </p>
              {!variantDrafts.length && <p className="adm-muted adm-small">No variants added.</p>}
              {variantDrafts.map((variant, index) => (
                <div className="fr" key={variant.id || `new-${index}`}>
                  <div className="fg">
                    <label>Variant name</label>
                    <input value={variant.variant_name} placeholder="Color" onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, variant_name: event.target.value } : row))} />
                  </div>
                  <div className="fg">
                    <label>Option value</label>
                    <input value={variant.option_value} placeholder="Red" onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, option_value: event.target.value } : row))} />
                  </div>
                  <div className="fg">
                    <label>Price adjustment (PHP)</label>
                    <input type="number" step="0.01" value={(variant.price_adjustment / 100).toFixed(2)} onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, price_adjustment: Math.round(Number(event.target.value || 0) * 100) } : row))} />
                  </div>
                  <div className="fg">
                    <label>Stock</label>
                    <input type="number" min="0" step="1" value={variant.stock} onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, stock: Number(event.target.value) } : row))} />
                  </div>
                  <button type="button" className="adm-btn adm-btn-d adm-btn-s" aria-label={`Remove variant ${index + 1}`} onClick={() => setVariantDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
                </div>
              ))}
              <p className="adm-small adm-muted">The legacy variant schema does not support a per-variant SKU.</p>
              {variantsLoading && <p className="adm-small adm-muted">Loading existing variants…</p>}
              {variantLoadError && <p className="adm-small" role="alert">{variantLoadError}. Close and reopen the product to retry.</p>}
            </section>

            <div className="adm-mf">
              <button
                className="adm-btn adm-btn-o"
                onClick={() => setModalOpen(false)}
                disabled={saving || uploadingModel || variantsLoading || Boolean(variantLoadError)}
              >
                Cancel
              </button>

              <button
                className="adm-btn adm-btn-p"
                onClick={saveProduct}
                disabled={saving || uploadingModel || variantsLoading || Boolean(variantLoadError)}
              >
                {saving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
