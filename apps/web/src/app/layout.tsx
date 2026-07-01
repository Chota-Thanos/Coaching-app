import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";
import { SignInPanel } from "../components/auth/sign-in-panel";
import { HeaderNav } from "../components/app/header-nav";
import { CURRENT_AFFAIRS_HUBS } from "../lib/current-affairs";

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
  themeColor: "#4f46e5"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/95 shadow-card backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
              {/* Logo */}
              <Link className="flex items-center gap-2.5 font-extrabold text-ink" href="/">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm">
                  <BookOpen aria-hidden="true" className="h-4.5 w-4.5" />
                </span>
                <span className="leading-tight">
                  <span className="block text-base font-black text-ink">WayToIAS</span>
                  <span className="block text-xs font-semibold text-indigo-650">UPSC Prep Platform</span>
                </span>
              </Link>

              {/* Desktop nav */}
              <HeaderNav />

              <div className="flex items-center gap-3">
                <SignInPanel compact />
              </div>
            </div>

            {/* Mobile nav — ordered by module priority per design spec v2 */}
            <nav aria-label="Mobile primary sections" className="flex gap-2 overflow-x-auto px-4 pb-2.5 lg:hidden" style={{scrollbarWidth:'none'}}>
              {/* 1. Self-Preparation */}
              <Link
                className="shrink-0 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white"
                href="/assessment/gk"
              >
                Self-Prep
              </Link>
              {/* 2. Current Affairs (always free) */}
              <Link
                className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700"
                href="/current-affairs/daily-news"
              >
                Current Affairs
              </Link>
              {/* 3. Notes Making */}
              <Link
                className="shrink-0 rounded-lg border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700"
                href="/current-affairs/workspace"
              >
                Notes
              </Link>
              {/* 4. Mentorship */}
              <Link
                className="shrink-0 rounded-lg border border-purple-100 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700"
                href="/mentors"
              >
                Mentorship
              </Link>
              {/* 5. CSAT */}
              <Link
                className="shrink-0 rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700"
                href="/assessment/csat"
              >
                CSAT
              </Link>
              {/* 6. Mains */}
              <Link
                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                href="/assessment/mains-hub"
              >
                Mains
              </Link>
              {/* 7. Study Plans — low priority, at end */}
              <Link
                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-500"
                href="/study-plans"
              >
                Study Plans
              </Link>
            </nav>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
