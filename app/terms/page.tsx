import Link from "next/link";

export default function TermsPage() {
  return <main className="container"><article className="account-card" style={{ maxWidth: 900, margin: "0 auto", lineHeight: 1.8 }}>
    <h1>📜 Terms &amp; Conditions</h1><p style={{ color: "var(--muted)", margin: ".5rem 0 1.5rem" }}>Last updated: January 1, 2025</p>
    <p>Welcome to Arduino Store. By accessing and using our website and services, you agree to be bound by these Terms and Conditions. Please read them carefully before making any purchase.</p>
    <h2>1. Acceptance of Terms</h2><p>By using the Arduino Store website, you confirm that you are at least 18 years old (or have parental consent) and agree to these terms. We reserve the right to update these terms at any time without prior notice.</p>
    <h2>2. Products and Pricing</h2><p>All product prices are listed in Philippine Pesos (₱) and include VAT where applicable. We reserve the right to change prices at any time. In case of a pricing error, we will notify you before processing your order.</p>
    <ul><li>Product images are for illustration purposes and may slightly differ from actual products.</li><li>Stock availability is displayed in real-time but is not guaranteed until order confirmation.</li><li>We do not accept orders for prohibited items under Philippine law.</li></ul>
    <h2>3. Orders and Payment</h2><p>Orders are considered confirmed once payment is received or verified (for COD, upon delivery). We reserve the right to cancel any order at our discretion, including orders affected by pricing errors or suspected fraud.</p>
    <h2>4. Shipping and Delivery</h2><p>Delivery times are estimates and not guaranteed. Arduino Store is not responsible for delays caused by shipping carriers, weather events, or force majeure. Risk of loss and title for items purchased pass to you upon delivery.</p>
    <h2>5. Returns and Refunds</h2><p>Returns are accepted within 7 days for defective or incorrectly shipped items. Please refer to our <Link href="/returns" style={{ color: "var(--primary)" }}>Returns Policy</Link> for full details. Used or opened items cannot be returned unless defective.</p>
    <h2>6. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use. We reserve the right to terminate accounts that violate our policies.</p>
    <h2>7. Intellectual Property</h2><p>All content on this website, including text, graphics, and logos, is the property of Arduino Store and is protected by Philippine intellectual property laws. You may not reproduce or distribute any content without written permission.</p>
    <h2>8. Limitation of Liability</h2><p>Arduino Store shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services. Our maximum liability is limited to the amount paid for the specific product in question.</p>
    <h2>9. Privacy</h2><p>Your use of our website is also governed by our Privacy Policy. We collect and process personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
    <h2>10. Contact</h2><p>For questions about these terms, contact us at <a href="mailto:legal@arduinostore.ph" style={{ color: "var(--primary)" }}>legal@arduinostore.ph</a> or visit our <Link href="/contact" style={{ color: "var(--primary)" }}>Contact Page</Link>.</p>
    <div style={{ marginTop: "2.5rem", textAlign: "center" }}><Link href="/" className="btn-primary">← Back to Store</Link></div>
  </article></main>;
}
