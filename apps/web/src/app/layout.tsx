import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "../components/app/app-shell";

export const metadata: Metadata = {
  title: {
    default: "WayToIAS — UPSC Preparation Platform",
    template: "%s | WayToIAS"
  },
  description: "India's most complete UPSC CSE preparation platform — free current affairs, self-assessment tests, smart notes workspace, and 1:1 mentorship from toppers.",
  // Every canonical and og:url on the site is resolved against this. When
  // NEXT_PUBLIC_SITE_URL is missing from the production environment the old
  // localhost fallback silently shipped <link rel="canonical"
  // href="http://localhost:3000/..."> on every page, which tells Google the
  // real URL is not the one it crawled -- pages got indexed and then dropped.
  // robots.ts and sitemap.ts already default to the live origin; this matches
  // them, so a missing env var can never de-index the site again.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://waytoias.com")
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
        {/*
          Marks <html> as signed-in before first paint, so the home page's
          marketing block can be hidden by CSS for the frame between hydration
          and the dashboard mounting. The home page now server-renders marketing
          by default (it has to, or search engines see nothing), which without
          this would flash the signed-out page at logged-in visitors. Same
          blocking-script approach next-themes already uses here for dark mode.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("coaching_hub_token"))document.documentElement.setAttribute("data-auth","1")}catch(e){}'
          }}
        />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
