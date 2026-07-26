import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { BookOpen } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";
import { SignInPanel } from "../components/auth/sign-in-panel";
import { HeaderNav } from "../components/app/header-nav";
import { CURRENT_AFFAIRS_HUBS } from "../lib/current-affairs";
import { WayToIASLogo } from "../components/app/logo";
import { ThemeToggle } from "../components/app/theme-toggle";

import { MobileNav } from "../components/app/mobile-nav";

export const metadata: Metadata = {
  title: {
    default: "WayToIAS — UPSC Preparation Platform",
    template: "%s | WayToIAS"
  },
  description: "India's most complete UPSC CSE preparation platform — free current affairs, self-assessment tests, smart notes workspace, and 1:1 mentorship from toppers.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased" suppressHydrationWarning>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <Providers>
          <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/95 shadow-card backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
              {/* Logo */}
              <Link className="flex items-center gap-2 text-ink shrink-0 hover:opacity-90 transition-opacity" href="/" title="WayToIAS Home">
                <WayToIASLogo className="h-9 w-auto" />
              </Link>

              {/* Desktop nav */}
              <HeaderNav />

              <div className="flex items-center gap-2.5">
                <ThemeToggle />
                <SignInPanel compact />
                <MobileNav />
              </div>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
