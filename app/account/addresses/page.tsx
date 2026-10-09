"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type Address = {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  contact_number: string;
};

const emptyAddress: Address = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  address_line: "",
  city: "",
  province: "",
  postal_code: "",
  contact_number: "",
};

const MAX_ADDRESSES = 10;

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<Address>(emptyAddress);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ addresses: Partial<Address>[] }>(
        "/auth/user/addresses.php",
      );
      setAddresses(data.addresses.map((a) => ({ ...emptyAddress, ...a })));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load addresses.";
      if (/authentication/i.test(message)) {
        setNeedsLogin(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function openAdd() {
    setForm(emptyAddress);
    setEditingIndex(null);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function openEdit(index: number) {
    setForm(addresses[index]);
    setEditingIndex(index);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function setField(field: keyof Address, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/auth/user/addresses.php", {
        method: "POST",
        body: JSON.stringify(
          editingIndex === null
            ? { action: "add", address: form }
            : { action: "update", index: editingIndex, address: form },
        ),
      });
      await load();
      setShowForm(false);
      setSuccess(editingIndex === null ? "Address added." : "Address updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(index: number) {
    if (!window.confirm("Delete this address?")) {
      return;
    }

    try {
      await apiFetch("/auth/user/addresses.php", {
        method: "POST",
        body: JSON.stringify({ action: "delete", index }),
      });
      await load();
      setSuccess("Address deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete address.");
    }
  }

  if (needsLogin) {
    return (
      <main className="account-profile-page">
        <div className="account-profile-container">
          <div className="acct-empty">
            <h2>Please log in</h2>
            <p>Log in to manage your saved addresses.</p>
            <Link href="/login" className="acct-btn primary">
              Log In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="account-profile-page">
      <div className="account-profile-container">
        <div className="account-profile-header">
          <div>
            <h1>Saved Addresses</h1>
            <p>
              Up to {MAX_ADDRESSES} delivery addresses ({addresses.length}{" "}
              saved).
            </p>
          </div>

          {!showForm && (
            <button
              type="button"
              className="acct-btn primary"
              onClick={openAdd}
              disabled={addresses.length >= MAX_ADDRESSES}
            >
              + Add address
            </button>
          )}
        </div>

        {error && <div className="acct-message error">{error}</div>}
        {success && <div className="acct-message success">{success}</div>}

        {showForm && (
          <form className="account-profile-card addr-form" onSubmit={submit}>
            <h2>{editingIndex === null ? "New address" : "Edit address"}</h2>

            <div className="account-profile-grid">
              {(
                [
                  ["first_name", "First name", true],
                  ["middle_name", "Middle name", false],
                  ["last_name", "Last name", true],
                  ["suffix", "Suffix", false],
                  ["address_line", "Street, house no., barangay", true],
                  ["city", "City / municipality", true],
                  ["province", "Province", true],
                  ["postal_code", "Postal code (4 digits)", true],
                  ["contact_number", "Contact number (11–13 digits)", true],
                ] as [keyof Address, string, boolean][]
              ).map(([field, label, required]) => (
                <div
                  key={field}
                  className={`account-profile-field${field === "address_line" ? " account-profile-field-full" : ""}`}
                >
                  <label htmlFor={`addr-${field}`}>{label}</label>
                  <input
                    id={`addr-${field}`}
                    value={form[field]}
                    required={required}
                    inputMode={
                      field === "postal_code" || field === "contact_number"
                        ? "numeric"
                        : undefined
                    }
                    onChange={(event) => setField(field, event.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="acct-actions">
              <button type="submit" className="acct-btn primary" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </button>
              <button
                type="button"
                className="acct-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="acct-muted">Loading addresses…</p>
        ) : addresses.length === 0 && !showForm ? (
          <div className="acct-empty">
            <h2>No saved addresses</h2>
            <p>Add one to make checkout faster.</p>
          </div>
        ) : (
          <div className="addr-grid">
            {addresses.map((address, index) => (
              <article key={index} className="addr-card">
                <strong>
                  {[address.first_name, address.middle_name, address.last_name, address.suffix]
                    .filter(Boolean)
                    .join(" ")}
                </strong>
                <p>{address.address_line}</p>
                <p>
                  {[address.city, address.province, address.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>{address.contact_number}</p>
                <div className="acct-actions">
                  <button
                    type="button"
                    className="acct-btn small"
                    onClick={() => openEdit(index)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="acct-btn small danger"
                    onClick={() => remove(index)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
