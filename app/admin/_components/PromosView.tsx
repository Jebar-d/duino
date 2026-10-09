import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { getPromoStatus } from "../../../lib/promo-status";
import type { Promo } from "./types";

export function PromosView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [description, setDescription] = useState("");

  async function loadPromos() {
    try {
      setLoadingPromos(true);
      const data = await apiFetch<{ success: boolean; promos: Promo[] }>(
        "/promos/list.php",
      );
      setPromos(data.promos ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load promos.",
        "error",
      );
    } finally {
      setLoadingPromos(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPromos();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setDiscountPercent("0");
    setValidFrom("");
    setValidUntil("");
    setMaxUses("");
    setFreeShipping(false);
    setMinOrderAmount("0");
    setDescription("");
  }

  function toDateTimeInput(value: string) {
    return value ? value.replace(" ", "T").slice(0, 16) : "";
  }

  function startEdit(promo: Promo) {
    setEditingId(promo.id);
    setCode(promo.code);
    setDiscountPercent(String(promo.discount_percent));
    setValidFrom(toDateTimeInput(promo.valid_from));
    setValidUntil(toDateTimeInput(promo.valid_until));
    setMaxUses(promo.max_uses === null ? "" : String(promo.max_uses));
    setFreeShipping(promo.is_free_shipping);
    setMinOrderAmount((promo.min_order_cents / 100).toFixed(2));
    setDescription(promo.description ?? "");
  }

  function validateForm() {
    const normalizedCode = code.trim().toUpperCase();
    const discount = Number(discountPercent);
    const minimum = Number(minOrderAmount);
    const uses = maxUses.trim() === "" ? null : Number(maxUses);

    if (!normalizedCode) {
      showToast("Promo code is required.", "error");
      return null;
    }

    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      showToast("Promo code may only contain letters, numbers, underscores, and hyphens.", "error");
      return null;
    }

    if (!Number.isInteger(discount) || discount < 0 || discount > 100) {
      showToast("Discount must be a whole number from 0 to 100.", "error");
      return null;
    }

    if (!validFrom || !validUntil) {
      showToast("Valid from and valid until dates are required.", "error");
      return null;
    }

    if (new Date(validUntil).getTime() <= new Date(validFrom).getTime()) {
      showToast("Valid until must be after valid from.", "error");
      return null;
    }

    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) {
      showToast("Maximum uses must be a whole number of at least 1.", "error");
      return null;
    }

    if (!Number.isFinite(minimum) || minimum < 0) {
      showToast("Minimum order amount cannot be negative.", "error");
      return null;
    }

    return {
      code: normalizedCode,
      discount_percent: discount,
      valid_from: validFrom,
      valid_until: validUntil,
      max_uses: uses,
      is_free_shipping: freeShipping,
      min_order_cents: Math.round(minimum * 100),
      description: description.trim(),
    };
  }

  async function savePromo() {
    const payload = validateForm();

    if (!payload) {
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await apiFetch("/promos/update.php", {
          method: "POST",
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        showToast("Promo updated successfully.", "success");
      } else {
        await apiFetch("/promos/create.php", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Promo created successfully.", "success");
      }

      resetForm();
      await loadPromos();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save promo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePromo(promo: Promo) {
    if (!window.confirm(`Delete promo "${promo.code}"?`)) {
      return;
    }

    try {
      setDeletingId(promo.id);
      await apiFetch("/promos/delete.php", {
        method: "POST",
        body: JSON.stringify({ id: promo.id }),
      });
      showToast("Promo deleted successfully.", "success");

      if (editingId === promo.id) {
        resetForm();
      }

      await loadPromos();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete promo.",
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div>
          <h1>Promos</h1>
          <p>Create and manage discount codes for your store.</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>{editingId ? "Edit Promo" : "Add Promo"}</h2>
              <p>{editingId ? "Update the selected promotion." : "Create a new promotion."}</p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              <span>Promo Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. SAVE10" />
            </label>

            <label>
              <span>Discount Percentage</span>
              <input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
            </label>

            <label>
              <span>Valid From</span>
              <input type="datetime-local" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
            </label>

            <label>
              <span>Valid Until</span>
              <input type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </label>

            <label>
              <span>Maximum Uses</span>
              <input type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder="Unlimited" />
            </label>

            <label>
              <span>Minimum Order Amount (₱)</span>
              <input type="number" min="0" step="0.01" value={minOrderAmount} onChange={(event) => setMinOrderAmount(event.target.value)} />
            </label>

            <label className="admin-checkbox-label">
              <input type="checkbox" checked={freeShipping} onChange={(event) => setFreeShipping(event.target.checked)} />
              <span>Free shipping</span>
            </label>

            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional promo details" rows={3} />
            </label>

            <div className="admin-form-actions">
              <button type="button" className="admin-primary-button" onClick={savePromo} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Promo" : "Add Promo"}
              </button>

              {editingId && (
                <button type="button" className="admin-secondary-button" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Promos</h2>
              <p>{promos.length} active promos</p>
            </div>
          </div>

          {loadingPromos ? (
            <div className="admin-empty-state">Loading promos...</div>
          ) : promos.length === 0 ? (
            <div className="admin-empty-state">No active promos found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Validity</th>
                    <th>Uses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => (
                    <tr key={promo.id}>
                      <td><strong>{promo.code}</strong>{promo.description && <div className="admin-promo-description">{promo.description}</div>}</td>
                      <td>{promo.discount_percent}%{promo.is_free_shipping ? " + Free Shipping" : ""}<div className="admin-promo-description">Min. ₱{(promo.min_order_cents / 100).toFixed(2)}</div></td>
                      <td>
                        {new Date(promo.valid_from.replace(" ", "T")).toLocaleDateString("en-PH")} – {new Date(promo.valid_until.replace(" ", "T")).toLocaleDateString("en-PH")}
                        {" "}
                        <span className={
                          getPromoStatus(promo) === "expired"
                            ? "b b-r"
                            : getPromoStatus(promo) === "active"
                              ? "b b-g"
                              : "b b-o"
                        }>
                          {getPromoStatus(promo)}
                        </span>
                      </td>
                      <td>{promo.used_count} / {promo.max_uses ?? "∞"}</td>
                      <td>
                        <div className="admin-table-actions">
                          <button type="button" className="admin-small-button" onClick={() => startEdit(promo)} disabled={deletingId === promo.id}>Edit</button>
                          <button type="button" className="admin-small-button admin-danger-button" onClick={() => void deletePromo(promo)} disabled={deletingId === promo.id}>
                            {deletingId === promo.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
