"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../lib/api";
import { Button } from "./ui/8bit/button";
import { Input } from "./ui/8bit/input";
import { Label } from "./ui/8bit/label";
import { Textarea } from "./ui/8bit/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/8bit/select";
import { toast } from "./ui/8bit/toast";

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
      toast(result.message || "Message sent successfully.");
      event.currentTarget.reset();
    } catch (submitError) {
      setError(true);
      setMessage(submitError instanceof Error ? submitError.message : "Could not send your message. Please try again.");
      toast(submitError instanceof Error ? submitError.message : "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="contact-form-card" style={{ display: "grid", gap: "1rem" }}>
      <h2>Send us a Message</h2>
      <div className="form-group">
        <Label htmlFor="cf-name">Your Name *</Label>
        <Input id="cf-name" name="name" required maxLength={120} autoComplete="name" placeholder="Juan Dela Cruz" />
      </div>
      <div className="form-group">
        <Label htmlFor="cf-email">Email Address *</Label>
        <Input id="cf-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="juan@email.com" />
      </div>
      <div className="form-group">
        <Label htmlFor="cf-subject">Subject *</Label>
        <Select name="subject" defaultValue="">
          <SelectTrigger id="cf-subject" aria-label="Subject"><SelectValue placeholder="Select a topic…" /></SelectTrigger>
          <SelectContent>
            {["Order Issue", "Product Inquiry", "Technical Support", "Returns & Refunds", "Shipping Question", "Partnership / Bulk Order", "Other"].map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="form-group">
        <Label htmlFor="cf-message">Message *</Label>
        <Textarea id="cf-message" name="message" required maxLength={5000} rows={6} placeholder="Describe your concern in detail…" />
      </div>
      <Button className="btn-primary" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send Message"}
      </Button>
      {message && <p role="status" aria-live="polite" style={{ color: error ? "var(--danger)" : "var(--success)" }}>{message}</p>}
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>We typically respond within 24 hours on business days.</p>
    </form>
  );
}
