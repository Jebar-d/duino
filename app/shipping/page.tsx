import Link from "next/link";
import { BadgeCheck, Package, ShoppingCart, Truck, Zap } from "lucide-react";

const methods = [
  { title: "Standard Delivery", icon: Package, detail: "J&T Express, LBC, Ninja Van · 3–5 business days", price: "₱99.00" },
  { title: "Express Delivery", icon: Zap, detail: "Same-day or next-day delivery for Metro Manila", price: "₱249.00" },
  { title: "FREE Shipping", icon: BadgeCheck, detail: "For orders totaling ₱1,500 or more · Standard delivery", price: "FREE" },
];

export default function ShippingPage() {
  return <main className="container"><article className="account-card" style={{ maxWidth: 900, margin: "0 auto", lineHeight: 1.8 }}>
    <h1 className="page-title-with-icon"><Truck aria-hidden="true" /> Shipping Information</h1><p style={{ color: "var(--muted)", margin: ".5rem 0 1.5rem" }}>Last updated: January 1, 2025</p>
    <h2>Shipping Methods</h2><div style={{ display: "grid", gap: "1rem", margin: "1rem 0 1.5rem" }}>
      {methods.map((method, index) => <div key={method.title} style={{ background: "var(--panel-soft)", border: index === 2 ? "1px dashed var(--border)" : "1px solid var(--border)", padding: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div><strong className="link-with-icon"><method.icon size={18} aria-hidden="true" />{method.title}</strong><p style={{ color: "var(--muted)", fontSize: ".9rem" }}>{method.detail}</p></div><strong style={{ fontSize: "1.2rem", color: index === 2 ? "var(--success)" : "var(--primary)" }}>{method.price}</strong>
      </div>)}
    </div>
    <h2>Coverage Area</h2><p>We ship to all 81 provinces in the Philippines. Delivery times may vary for remote areas (Mindanao, Visayas, island provinces) — add 1–3 business days for areas outside Metro Manila.</p>
    <h2>Order Processing</h2><p>Orders placed before 2:00 PM (Philippine Standard Time) on business days are processed the same day. Orders placed on weekends or holidays are processed the next business day.</p>
    <h2>Tracking Your Order</h2><p>Once your order is shipped, you&apos;ll receive a tracking number via email. You can also track your order in My Account → My Purchases. Real-time tracking is available once the carrier scans your package.</p>
    <h2>Shipping Partners</h2><p>We partner with J&amp;T Express, LBC Express, and Ninja Van for reliable nationwide delivery. The carrier is assigned automatically based on your location.</p>
    <div style={{ marginTop: "2.5rem", textAlign: "center" }}><Link href="/products" className="btn-primary link-with-icon"><ShoppingCart aria-hidden="true" /> Shop Now</Link></div>
  </article></main>;
}
