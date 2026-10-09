import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";

export default function RulesPage() {
  return <main className="container"><article className="account-card" style={{ maxWidth: 900, margin: "0 auto", lineHeight: 1.8 }}>
    <h1 className="page-title-with-icon"><ListChecks aria-hidden="true" /> Rules &amp; Regulations</h1><p style={{ color: "var(--muted)", margin: ".5rem 0 1.5rem" }}>Last updated: January 1, 2025</p>
    <p>These rules govern the use of the Arduino Store platform. Violation of these rules may result in account suspension or termination.</p>
    <h2>1. Account Rules</h2><ul><li>One account per person. Creating multiple accounts to abuse promos is prohibited.</li><li>You must provide accurate personal information during registration.</li><li>Sharing account credentials with others is strictly prohibited.</li><li>You must be at least 18 years of age, or have parental/guardian consent.</li></ul>
    <h2>2. Purchasing Rules</h2><ul><li>Orders must be placed for personal or legitimate business use only.</li><li>Reselling counterfeit products claiming to be Arduino Store items is prohibited.</li><li>Bulk orders above ₱50,000 require identity verification.</li><li>Fraudulent chargebacks or payment disputes will result in permanent account bans.</li></ul>
    <h2>3. Promo Code Rules</h2><ul><li>Promo codes are for single use per account unless stated otherwise.</li><li>Selling or trading promo codes is not allowed.</li><li>Promo codes cannot be combined with other offers unless explicitly stated.</li><li>Abuse of promotional offers will result in immediate account termination.</li></ul>
    <h2>4. Reviews and Feedback</h2><ul><li>Reviews must be honest and based on your genuine experience with the product.</li><li>Spam, fake reviews, or harassment of other users is prohibited.</li><li>Reviews containing personal information of others will be removed.</li><li>We reserve the right to remove reviews that violate our community guidelines.</li></ul>
    <h2>5. Communication Rules</h2><ul><li>Treat our support team and other customers with respect.</li><li>Threats, abusive language, or harassment towards our staff is grounds for immediate termination.</li><li>Spam or unsolicited commercial messages are not permitted.</li></ul>
    <h2>6. Prohibited Activities</h2><ul><li>Attempting to hack, scrape, or reverse-engineer our platform.</li><li>Using bots or automated tools to place orders or abuse promotions.</li><li>Attempting to circumvent stock limits or purchase restrictions.</li><li>Any activity that violates Philippine law or international regulations.</li></ul>
    <h2>7. Consequences of Violations</h2><p>Violations may result in: warning notices, order cancellations, temporary account suspension, or permanent account bans — depending on the severity. Serious violations may be reported to appropriate authorities.</p>
    <div style={{ marginTop: "2.5rem", textAlign: "center" }}><Link href="/" className="btn-primary link-with-icon"><ArrowLeft aria-hidden="true" /> Back to Store</Link></div>
  </article></main>;
}

