"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Status = "checking" | "success" | "error";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "checking" : "error");
  const [message, setMessage] = useState(
    token ? "" : "This verification link is missing its token.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ message: string }>("/auth/verify-email.php", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        if (!cancelled) {
          setStatus("success");
          setMessage(data.message);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            err instanceof Error ? err.message : "Unable to verify your email.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="account-profile-page">
      <div className="account-profile-container">
        <div className="acct-empty">
          {status === "checking" && (
            <>
              <h2>Verifying your email…</h2>
              <p>One moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <h2>Email verified</h2>
              <p>{message}</p>
              <Link href="/products" className="acct-btn primary">
                Start shopping
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h2>Verification failed</h2>
              <p>{message}</p>
              <Link href="/account/security" className="acct-btn primary">
                Request a new link
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="account-profile-page">
          <div className="account-profile-container">
            <p className="acct-muted">Loading…</p>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
