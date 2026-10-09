import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import SiteChrome from "../components/SiteChrome";
import { SessionProvider } from "../components/SessionProvider";
import "./globals.css";
import "./style.css";
import "./extras.css";
import "./store-ui.css";

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
          <SessionProvider>
            <SiteChrome>{children}</SiteChrome>
          </SessionProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
