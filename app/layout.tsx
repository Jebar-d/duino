import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import SiteChrome from "../components/SiteChrome";
import { SessionProvider } from "../components/SessionProvider";
import { Toaster } from "../components/ui/sonner";
import "./globals.css";
import "./style.css";
import "./extras.css";
import "./store-ui.css";

const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-press-start" });

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
    <html lang="en" className={`dark ${pressStart.variable}`}>
      <body>
        <NuqsAdapter>
          <SessionProvider>
            <SiteChrome>{children}</SiteChrome>
            <Toaster />
          </SessionProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
