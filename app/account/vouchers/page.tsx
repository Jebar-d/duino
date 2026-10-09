"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/8bit/button";
import { Card } from "../../../components/ui/8bit/card";
import { Alert, AlertDescription } from "../../../components/ui/8bit/alert";
import { Skeleton } from "../../../components/ui/8bit/skeleton";
import { toast } from "../../../components/ui/8bit/toast";
import { getPromoStatus } from "../../../lib/promo-status";

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from: string | null;
  valid_until: string;
  expiration_at?: string | null;
  status?: string | null;
  is_expired?: boolean;
  max_uses: number | null;
  used_count: number;
  is_free_shipping: boolean;
  min_order_cents: number;
  description: string | null;
};

function peso(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}

export default function VouchersPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPromos() {
      try {
        const data = await apiFetch<{ promos: Promo[] }>("/promos/list.php");
        if (!cancelled) {
          setPromos(data.promos);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load vouchers.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast("Voucher code copied.");
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  const available = promos.filter(
    (promo) => promo.max_uses === null || promo.used_count < promo.max_uses,
  );

  return (
    <main className="account-profile-page">
      <div className="account-profile-container">
        <div className="account-profile-header">
          <div>
            <h1>Vouchers</h1>
            <p>Promo codes you can enter at checkout.</p>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {loading ? (
          <p className="acct-muted">Loading vouchers…</p>
        ) : available.length === 0 ? (
          <div className="acct-empty">
            <h2>No vouchers available</h2>
            <p>Check back later for new promo codes.</p>
          </div>
        ) : (
          <div className="voucher-grid">
            {available.map((promo) => {
              const status = getPromoStatus(promo);
              const expired = status === "expired";

              return (
              <Card key={promo.id} className="voucher-card">
                <div className="voucher-value">
                  {promo.is_free_shipping && promo.discount_percent === 0
                    ? "FREE SHIPPING"
                    : `${promo.discount_percent}% OFF`}
                </div>
                <div className="voucher-code">{promo.code}</div>
                <span className={expired ? "b b-r" : status === "active" ? "b b-g" : "b b-o"}>
                  {status === "expired" ? "Expired" : status === "active" ? "Active" : status}
                </span>
                {promo.description && <p>{promo.description}</p>}
                <ul>
                  {promo.is_free_shipping && promo.discount_percent > 0 && (
                    <li>Includes free shipping</li>
                  )}
                  {promo.min_order_cents > 0 && (
                    <li>Min. order {peso(promo.min_order_cents)}</li>
                  )}
                  {promo.max_uses !== null && (
                    <li>
                      {promo.max_uses - promo.used_count} use
                      {promo.max_uses - promo.used_count === 1 ? "" : "s"} left
                    </li>
                  )}
                  <li>
                    Valid until{" "}
                    {new Date(
                      (promo.expiration_at || promo.valid_until).replace(" ", "T"),
                    ).toLocaleDateString("en-PH")}
                  </li>
                </ul>
                <Button
                  variant="outline"
                  type="button"
                  className="acct-btn primary"
                  disabled={status !== "active"}
                  onClick={() => copy(promo.code)}
                >
                  {expired ? "Expired" : copied === promo.code ? "Copied!" : "Copy code"}
                </Button>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
