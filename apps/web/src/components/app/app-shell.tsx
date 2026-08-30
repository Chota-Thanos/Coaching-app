"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "../auth/auth-context";
import { HeaderNav } from "./header-nav";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { SignInPanel } from "../auth/sign-in-panel";
import { WayToIASLogo } from "./logo";
import { TopBar } from "./top-bar";
import { SidebarNav } from "./sidebar-nav";
import { isMentorArea } from "./mentor-corner-button";
import { NavigationHistoryRecorder } from "./navigation-history-recorder";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isInitialized } = useAuth();
  const pathname = usePathname() || "/";

  if (!isInitialized || !user) {
    return (
      <>
        <Suspense fallback={null}><NavigationHistoryRecorder /></Suspense>
        <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/95 shadow-card backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
            <Link className="flex flex-col items-center justify-center shrink-0 hover:opacity-90 transition-opacity group select-none py-0.5" href="/" title="Way To IAS Home">
              <WayToIASLogo className="h-7 w-auto transition-transform group-hover:scale-105" />
              <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-ink group-hover:text-indigo-600 transition-colors leading-tight mt-0.5">
                Way To IAS
              </span>
            </Link>

            <HeaderNav />

            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <SignInPanel compact />
              <MobileNav />
            </div>
          </div>
        </header>
        {children}
      </>
    );
  }

  // The Mentor's Corner supplies its own complete chrome -- brand, profile,
  // navigation, sign-out. Wrapping it in the student shell as well put two
  // navigations on screen at once, the outer one full of Study Plans and
  // Current Affairs links that have nothing to do with mentoring, and on a
  // phone cost the desk a third of its width. Mentors get their own surface.
  if (isMentorArea(pathname)) {
    return (
      <>
        <Suspense fallback={null}><NavigationHistoryRecorder /></Suspense>
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}><NavigationHistoryRecorder /></Suspense>
      <TopBar />
      <div className="flex flex-1">
        <SidebarNav className="hidden lg:flex" />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
