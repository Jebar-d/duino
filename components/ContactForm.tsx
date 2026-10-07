"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../lib/api";

type SendResponse = { success: boolean; message?: string };

export default function ContactForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const result = await apiFetch<SendResponse>("/contact/send.php", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setError(false);
      setMessage(result.message || "Thank you! We'll get back to you within 24 hours.");
      event.currentTarget.reset();
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error ? submitError.message : "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="contact-form-card" style={{ display: "grid", gap: "1rem" }}>
      <h2>Send us a Message</h2>
      <div className="form-group">
        <label htmlFor="cf-name">Your Name *</label>
        <input id="cf-name" name="name" required maxLength={120} autoComplete="name" placeholder="Juan Dela Cruz" />
      </div>
      <div className="form-group">
        <label htmlFor="cf-email">Email Address *</label>
        <input id="cf-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="juan@email.com" />
      </div>
      <div className="form-group">
        <label htmlFor="cf-subject">Subject *</label>
        <select id="cf-subject" name="subject" required defaultValue="">
          <option value="">Select a topic…</option>
          <option>Order Issue</option>
          <option>Product Inquiry</option>
          <option>Technical Support</option>
          <option>Returns &amp; Refunds</option>
          <option>Shipping Question</option>
          <option>Partnership / Bulk Order</option>
          <option>Other</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="cf-message">Message *</label>
        <textarea id="cf-message" name="message" required maxLength={5000} rows={6} placeholder="Describe your concern in detail…" />
      </div>
      <button className="btn-primary" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send Message"}
      </button>
      {message && <p role="status" aria-live="polite" style={{ color: error ? "var(--danger)" : "var(--success)" }}>{message}</p>}
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>We typically respond within 24 hours on business days.</p>
    </form>
  );
}
