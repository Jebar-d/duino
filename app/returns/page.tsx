import Link from "next/link";

export default function ReturnsPage() {
  return <main className="container"><article className="account-card" style={{ maxWidth: 900, margin: "0 auto", lineHeight: 1.8 }}>
    <h1>↩ Returns &amp; Refund Policy</h1><p style={{ color: "var(--muted)", margin: ".5rem 0 1.5rem" }}>Last updated: January 1, 2025</p>
    <p>We want you to be completely satisfied with your purchase. If something isn&apos;t right, we&apos;re here to help.</p>
    <h2>Return Window</h2><p>You may return eligible items within <strong>7 days</strong> of delivery for defective, damaged, or incorrectly shipped products. Returns must be requested before this window closes.</p>
    <h2>Eligible for Return</h2><ul><li>Defective or non-functioning products</li><li>Items damaged during shipping</li><li>Incorrect item received (wrong product or variant)</li><li>Items in original, unused condition with packaging</li></ul>
    <h2>Not Eligible for Return</h2><ul><li>Items that have been used, soldered, or modified</li><li>Products with removed labels or damaged packaging due to customer handling</li><li>Digital goods or downloadable content</li><li>Items returned after the 7-day window</li></ul>
    <h2>How to Request a Return</h2><p>1. Take clear photos of the item and any damage or defect.<br />2. Contact us at <a href="mailto:support@arduinostore.ph" style={{ color: "var(--primary)" }}>support@arduinostore.ph</a> within 7 days of delivery.<br />3. Include your Order ID and photos in the email.<br />4. Our team will review within 24 hours and provide a return shipping label if approved.<br />5. Ship the item back using the provided label. Do NOT send without approval.</p>
    <h2>Refund Processing</h2><p>Approved refunds are processed within 3–5 business days after we receive and inspect the returned item. Refunds are issued to the original payment method:</p><ul><li>COD: Refunded via GCash or bank transfer</li><li>GCash / Maya: Refunded to original account (3–5 business days)</li><li>Bank Transfer: Refunded to original bank account (5–7 business days)</li></ul>
    <h2>Replacement Option</h2><p>For defective items, you may choose a replacement instead of a refund. Replacements are shipped within 2 business days of return approval.</p>
    <div style={{ marginTop: "2.5rem", textAlign: "center" }}><Link href="/contact" className="btn-primary">📬 Contact Support</Link></div>
  </article></main>;
}
