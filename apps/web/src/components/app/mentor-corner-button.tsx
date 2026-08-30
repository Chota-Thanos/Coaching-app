"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../auth/auth-context";

/**
 * The way into the Mentor's Corner.
 *
 * Mentoring is a different job from studying, and it was previously reached
 * only by typing the URL or finding one entry buried in the account dropdown.
 * A mentor signing in landed on a student dashboard with no indication that
 * their own desk existed.
 *
 * Deliberately styled unlike everything else in the header: mentors are a
 * small minority of signed-in users, and for them this is the most important
 * control on the page.
 */

/** Who has a corner. Matches the workspace's own guard, so the button never
 *  leads somewhere that immediately redirects. */
export function canEnterMentorCorner(role: string | undefined): boolean {
  return role === "mentor" || role === "admin" || role === "moderator";
}

/** True inside the mentor's own panel, where this button would point at the
 *  page you are already on. */
export function isMentorArea(pathname: string): boolean {
  // `/mentors` is the public directory and `/mentorship/...` is the student
  // side; neither is the corner.
  return pathname === "/mentor" || pathname.startsWith("/mentor/");
}

export function MentorCornerButton({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname() || "/";

  if (!canEnterMentorCorner(user?.role)) return null;
  if (isMentorArea(pathname)) return null;

  if (compact) {
    return (
      <Link
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 text-[12px] font-extrabold text-white shadow-sm transition hover:brightness-110"
        href="/mentor/workspace"
        title="Mentor's Corner"
      >
        <GraduationCap aria-hidden="true" className="h-4 w-4 shrink-0" />
        {/* The words are the point of the button. On a phone the header
            cannot hold them next to everything else, so the icon carries it
            there and the sidebar's full-width version does the naming. */}
        <span className="hidden sm:inline">Mentor&apos;s Corner</span>
        <span className="sr-only sm:hidden">Mentor&apos;s Corner</span>
      </Link>
    );
  }

  return (
    <Link
      className="flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:brightness-110"
      href="/mentor/workspace"
    >
      <GraduationCap aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span className="truncate">Mentor&apos;s Corner</span>
    </Link>
  );
}
