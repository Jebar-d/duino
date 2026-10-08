import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import SiteChrome from "../components/SiteChrome";
import "./globals.css";
import "./style.css";

export const metadata: Metadata = {
  title: "Arduino Store – Premium Components for Makers",
  description:
    "Premium Arduino boards, sensors, and components for makers, students, and engineers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <SiteChrome>{children}</SiteChrome>
        </NuqsAdapter>
      </body>
    </html>
  );
}
