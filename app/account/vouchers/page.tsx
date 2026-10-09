"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { Button } from "../../../components/ui/8bit/button";
import { Card } from "../../../components/ui/8bit/card";
import { Alert, AlertDescription } from "../../../components/ui/8bit/alert";
import { Skeleton } from "../../../components/ui/8bit/skeleton";
import { toast } from "../../../components/ui/8bit/toast";

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  valid_from: string | null;
  valid_until: string;
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

    apiFetch<{ promos: Promo[] }>("/promos/list.php")
      .then((data) => {
        if (!cancelled) setPromos(data.promos);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load vouchers.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
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
            <h2>No active vouchers</h2>
            <p>Check back later for new promo codes.</p>
          </div>
        ) : (
          <div className="voucher-grid">
            {available.map((promo) => (
              <Card key={promo.id} className="voucher-card">
                <div className="voucher-value">
                  {promo.is_free_shipping && promo.discount_percent === 0
                    ? "FREE SHIPPING"
                    : `${promo.discount_percent}% OFF`}
                </div>
                <div className="voucher-code">{promo.code}</div>
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
                      promo.valid_until.replace(" ", "T"),
                    ).toLocaleDateString()}
                  </li>
                </ul>
                <Button
                  variant="outline"
                  type="button"
                  className="acct-btn primary"
                  onClick={() => copy(promo.code)}
                >
                  {copied === promo.code ? "Copied!" : "Copy code"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
