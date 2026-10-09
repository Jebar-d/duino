import Link from "next/link";
import type { ReactNode } from "react";
import { CircleHelp, CreditCard, Mail, Package, RotateCcw, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/8bit/accordion";
import { Button } from "../../components/ui/8bit/button";

type FaqEntry = [question: string, answer: ReactNode];
type FaqGroup = { title: string; icon: LucideIcon; entries: FaqEntry[] };

const groups: FaqGroup[] = [
  { title: "Orders & Shipping", icon: Package, entries: [
    ["How long does shipping take?", "Standard delivery takes 3–5 business days nationwide. Express delivery is 1–2 business days. We ship to all provinces in the Philippines via J&T Express, LBC, and Ninja Van."],
    ["Do you offer free shipping?", <>Yes! Orders totaling ₱1,500 or more qualify for FREE standard shipping. Just use promo code <strong style={{ color: "var(--primary)" }}>FREESHIP</strong> at checkout, or it may be applied automatically.</>],
    ["Can I track my order?", "Absolutely. Once your order is shipped, you'll receive a tracking number via email. You can also check your order status in My Account → My Purchases."],
    ["Can I cancel my order?", "Orders can be cancelled within 1 hour of placement, as long as they haven't been packed yet. Go to My Account → My Purchases → Cancel Order, or contact us immediately via Live Chat or email."],
  ] },
  { title: "Payment & Promos", icon: CreditCard, entries: [
    ["What payment methods do you accept?", "We accept Cash on Delivery (COD), GCash, Maya/PayMaya, and bank transfers (BPI, BDO, Metrobank). All payments are processed securely."],
    ["How do I use a promo code?", 'Add items to your cart, then go to checkout. On the Cart page, enter your promo code in the "Promo Code" field and click Apply. The discount will be reflected in your order total immediately.'],
    ["Can I use multiple promo codes?", "Only one promo code can be applied per order at this time. We recommend using the code with the highest discount value for your order."],
  ] },
  { title: "Products & Technical", icon: Wrench, entries: [
    ["Are your Arduino products genuine?", "Yes, all our boards are 100% genuine Arduino products sourced from official distributors. We also carry high-quality compatible components that are clearly labeled as compatible (not official Arduino brand)."],
    ["Do you provide technical support?", "Yes! We offer free technical guidance for all customers. Contact us via email or live chat with your project questions. Our team includes experienced Arduino developers who can help troubleshoot and guide you."],
    ["Do you accept bulk or wholesale orders?", <>Yes! We cater to schools, universities, and businesses with bulk pricing available for orders of 10+ units. Contact us at <a href="mailto:sales@arduinostore.ph" style={{ color: "var(--primary)" }}>sales@arduinostore.ph</a> for a quote and special pricing.</>],
  ] },
  { title: "Returns & Refunds", icon: RotateCcw, entries: [
    ["What is your return policy?", <>We accept returns within 7 days of delivery for defective or incorrectly shipped items. Items must be in original packaging and unused. Visit our <Link href="/returns" style={{ color: "var(--primary)" }}>Returns Policy</Link> page for full details.</>],
    ["My item arrived damaged. What do I do?", "Take photos of the damaged item and packaging immediately. Contact us within 48 hours of receipt at support@arduinostore.ph with your order ID and photos. We'll arrange a replacement or full refund."],
  ] },
];

export default function FaqPage() {
  return (
    <main className="container">
      <div className="page-header"><h1 className="page-title-with-icon"><CircleHelp aria-hidden="true" /> Frequently Asked Questions</h1><p>Find quick answers to common questions about orders, shipping, and our products.</p></div>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {groups.map((group) => <section key={group.title} style={{ marginTop: "1.5rem" }}>
          <h2 className="faq-group-heading" style={{ color: "var(--primary)", fontSize: ".9rem", textTransform: "uppercase", marginBottom: ".75rem" }}><group.icon aria-hidden="true" />{group.title}</h2>
          <Accordion type="single" collapsible>
            {group.entries.map(([question, answer], index) => <AccordionItem key={question} value={`${group.title}-${index}`} className="account-card">
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </section>)}
      </div>
      <section className="account-card" style={{ textAlign: "center", margin: "2.5rem auto 0", maxWidth: 800 }}>
        <h2 style={{ marginBottom: ".5rem" }}>Still have questions?</h2><p style={{ color: "var(--muted-foreground)", marginBottom: "1.25rem" }}>Our support team is ready to help you.</p><Button asChild className="btn-primary link-with-icon"><Link href="/contact"><Mail aria-hidden="true" /> Contact Support</Link></Button>
      </section>
    </main>
  );
}
