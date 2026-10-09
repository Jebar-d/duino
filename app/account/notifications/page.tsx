"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type Notification = {
  id: number;
  order_id: string | null;
  title: string;
  message: string;
  type: string | null;
  is_read: number | boolean;
  created_at: string;
};

function announce() {
  window.dispatchEvent(new Event("store:counts-changed"));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{
        notifications: Notification[];
        unread_count: number;
      }>("/notifications/list.php?limit=100");
      setItems(data.notifications);
      setUnread(data.unread_count);
      setError("");
      setNeedsLogin(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load notifications.";
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

  async function act(endpoint: string, body: Record<string, unknown>) {
    try {
      await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) });
      await load();
      announce();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const readCount = items.filter((item) => Boolean(Number(item.is_read))).length;

  if (loading) {
    return (
      <main className="account-profile-page">
        <div className="account-profile-container">
          <p className="acct-muted">Loading notifications…</p>
        </div>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="account-profile-page">
        <div className="account-profile-container">
          <div className="acct-empty">
            <h2>Please log in</h2>
            <p>Log in to see your notifications.</p>
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
            <h1>Notifications</h1>
            <p>
              {unread > 0
                ? `You have ${unread} unread notification${unread === 1 ? "" : "s"}.`
                : "You're all caught up."}
            </p>
          </div>

          <div className="acct-actions">
            <button
              type="button"
              className="acct-btn"
              disabled={unread === 0}
              onClick={() => act("/notifications/mark-read.php", { all: true })}
            >
              Mark all read
            </button>
            <button
              type="button"
              className="acct-btn"
              disabled={readCount === 0}
              onClick={() =>
                act("/notifications/delete.php", { all_read: true })
              }
            >
              Clear read
            </button>
          </div>
        </div>

        {error && <div className="acct-message error">{error}</div>}

        {items.length === 0 ? (
          <div className="acct-empty">
            <h2>No notifications yet</h2>
            <p>Order updates and store news will show up here.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {items.map((item) => {
              const isRead = Boolean(Number(item.is_read));

              return (
                <li
                  key={item.id}
                  className={`notif-item${isRead ? "" : " unread"}`}
                >
                  <div className="notif-body">
                    <div className="notif-title">
                      {!isRead && <span className="notif-dot" aria-hidden />}
                      {item.title}
                    </div>
                    <p>{item.message}</p>
                    <div className="notif-meta">
                      {new Date(item.created_at.replace(" ", "T")).toLocaleString()}
                      {item.order_id && (
                        <>
                          {" · "}
                          <Link href={`/account/orders/${item.order_id}`}>
                            View order
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="notif-actions">
                    {!isRead && (
                      <button
                        type="button"
                        className="acct-btn small"
                        onClick={() =>
                          act("/notifications/mark-read.php", { id: item.id })
                        }
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      className="acct-btn small danger"
                      onClick={() =>
                        act("/notifications/delete.php", { id: item.id })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
