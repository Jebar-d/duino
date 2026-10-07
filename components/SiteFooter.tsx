import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/rules", label: "Rules" },
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
];

export default function SiteFooter() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" aria-label="Arduino Store home">
              <Image src="/logo1.png" alt="Arduino Store" width={90} height={32} />
            </Link>
            <p>Your one-stop shop for Arduino components in the Philippines.</p>
          </div>
          <div className="footer-column">
            <h3>Shop</h3>
            <Link href="/products">All Products</Link>
          </div>
          <div className="footer-column">
            <h3>Company</h3>
            {footerLinks.slice(0, 3).map((link) => (
              <Link href={link.href} key={link.href}>{link.label}</Link>
            ))}
          </div>
          <div className="footer-column">
            <h3>Information</h3>
            {footerLinks.slice(3).map((link) => (
              <Link href={link.href} key={link.href}>{link.label}</Link>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2025 Arduino Store. Built with care for makers.</p>
        </div>
      </div>
    </footer>
  );
}
