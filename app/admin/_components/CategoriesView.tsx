import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type { Category } from "./types";

export function CategoriesView({
  showToast,
}: {
  showToast: (message: string, type?: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function loadCategories() {
    try {
      setLoadingCategories(true);

      const data = await apiFetch<{
        success: boolean;
        categories: Category[];
      }>("/categories/list.php");

      setCategories(data.categories ?? []);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load categories.",
        "error",
      );
    } finally {
      setLoadingCategories(false);
    }
  }

  useEffect(() => {
    async function load() {
      await loadCategories();
    }

    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSlug("");
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setSlug(category.slug);
  }

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(value: string) {
    setName(value);

    if (!editingId) {
      setSlug(makeSlug(value));
    }
  }

  async function saveCategory() {
    if (!name.trim()) {
      showToast("Category name is required.", "error");
      return;
    }

    if (!slug.trim()) {
      showToast("Category slug is required.", "error");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await apiFetch("/categories/update.php", {
          method: "POST",
          body: JSON.stringify({
            id: editingId,
            name: name.trim(),
            slug: slug.trim(),
          }),
        });

        showToast("Category updated successfully.", "success");
      } else {
        await apiFetch("/categories/create.php", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
          }),
        });

        showToast("Category created successfully.", "success");
      }

      resetForm();
      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save category.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(categoryId: string, categoryName: string) {
    const confirmed = window.confirm(`Delete category "${categoryName}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await apiFetch("/categories/delete.php", {
        method: "POST",
        body: JSON.stringify({
          id: categoryId,
        }),
      });

      showToast("Category deleted successfully.", "success");

      if (editingId === categoryId) {
        resetForm();
      }

      await loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete category.",
        "error",
      );
    }
  }

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage product categories for your store.</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>{editingId ? "Edit Category" : "Add Category"}</h2>
              <p>
                {editingId
                  ? "Update the selected category."
                  : "Create a new product category."}
              </p>
            </div>
          </div>

          <div className="admin-form">
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="e.g. Arduino Boards"
              />
            </label>

            <label>
              <span>Slug</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="e.g. arduino-boards"
              />
            </label>

            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-primary-button"
                onClick={saveCategory}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Category"
                    : "Add Category"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Categories</h2>
              <p>{categories.length} categories</p>
            </div>
          </div>

          {loadingCategories ? (
            <div className="admin-empty-state">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="admin-empty-state">No categories found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <strong>{category.name}</strong>
                      </td>

                      <td>
                        <code>{category.slug}</code>
                      </td>

                      <td>
                        <div className="admin-table-actions">
                          <button
                            type="button"
                            className="admin-small-button"
                            onClick={() => startEdit(category)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="admin-small-button admin-danger-button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void deleteCategory(category.id, category.name);
                            }}
                          >
                            Delete
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
