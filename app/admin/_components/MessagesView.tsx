import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import type { ContactMessage } from "./types";
import { escapeText } from "./utils";
import { StatusBadge } from "./StatusBadge";

export function MessagesView({ showToast }: { showToast: (message: string, type?: string) => void }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState("unread");
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ success: boolean; messages: ContactMessage[] }>("/admin/contact-messages.php");
      setMessages(data.messages ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load messages.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMessages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const filteredMessages = messages.filter((message) => {
    const isHandled = Number(message.is_handled) === 1;
    return filter === "all" || (filter === "handled" ? isHandled : !isHandled);
  });

  async function toggleHandled(message: ContactMessage) {
    const handled = Number(message.is_handled) === 1;
    try {
      await apiFetch("/admin/contact-messages.php", {
        method: "POST",
        body: JSON.stringify({ id: message.id, is_handled: !handled }),
      });
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_handled: !handled } : item));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update message.", "error");
    }
  }

  return (
    <>
      <div className="adm-ph">
        <div><div className="adm-ph-title">Messages</div><div className="adm-ph-sub">Review customer contact messages.</div></div>
        <select aria-label="Filter messages" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="unread">Unread</option><option value="handled">Handled</option><option value="all">All messages</option>
        </select>
      </div>
      {loading ? <div className="adm-empty">Loading messages...</div> : filteredMessages.length === 0 ? <div className="adm-empty">No messages found.</div> : (
        <div className="adm-message-list">
          {filteredMessages.map((message) => (
            <article className="an-section" key={message.id}>
              <div className="adm-order-info"><strong>{message.subject}</strong><span>{message.name} · {message.email}</span></div>
              <div className="adm-order-info"><span>{new Date(message.created_at.replace(" ", "T")).toLocaleString("en-PH")}</span><StatusBadge status={Number(message.is_handled) === 1 ? "Handled" : "Unread"} /></div>
              <details><summary>View message</summary><p>{message.message}</p></details>
              <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => void toggleHandled(message)}>{message.is_handled ? "Mark unread" : "Mark handled"}</button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
