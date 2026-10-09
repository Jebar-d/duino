import Link from "next/link";
import ContactForm from "../../components/ContactForm";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/8bit/card";

const contactItems = [
  ["Email Us", "support@arduinostore.ph", "sales@arduinostore.ph"],
  ["Call or Text", "+63 917 123 4567", "Mon–Fri, 9AM–6PM (PHT)"],
  ["Live Chat", "Available Mon–Sat 9AM–8PM", "● Currently Online"],
  ["Office Address", "123 Maker Street, Makati City", "Metro Manila, Philippines 1200"],
  ["Order Support", "For order issues, include your Order ID", "Response within 2 business hours"],
  ["Technical Support", "Free technical guidance for all customers", "Visit our FAQ page for quick answers"],
];

export default function ContactPage() {
  return (
    <main className="container">
      <div className="page-header"><h1>Contact Us</h1><p>We&apos;re here to help! Reach out to us and we&apos;ll respond within 24 hours.</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "2rem", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "1rem" }}>
          {contactItems.map(([title, first, second]) => (
            <article className="account-card" key={title}>
              <h2 style={{ fontSize: "1rem", marginBottom: ".5rem" }}>{title}</h2>
              <p>{title === "Technical Support" ? <>{first}. <Link href="/faq" style={{ color: "var(--primary)" }}>{second}</Link></> : first}</p>
              <p style={{ color: title === "Live Chat" ? "var(--success)" : "var(--muted)" }}>{second}</p>
            </article>
          ))}
        </div>
        <ContactForm />
      </div>
      <section className="account-card" style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Customer Service Hours</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
          <p><strong>Monday – Friday</strong><br /><span style={{ color: "var(--primary)" }}>9:00 AM – 6:00 PM</span></p>
          <p><strong>Saturday</strong><br /><span style={{ color: "var(--primary)" }}>10:00 AM – 4:00 PM</span></p>
          <p><strong>Sunday</strong><br /><span style={{ color: "var(--muted)" }}>Closed</span></p>
          <p><strong>Holidays</strong><br /><span style={{ color: "var(--muted)" }}>Limited support via email</span></p>
        </div>
      </section>
    </main>
  );
}
