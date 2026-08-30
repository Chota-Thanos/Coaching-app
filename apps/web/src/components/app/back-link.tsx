"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hasAppHistory } from "../../lib/navigation-history";

/**
 * A back control that goes back.
 *
 * Most back arrows in this app are plain links to a fixed parent. For a screen
 * with exactly one parent — an admin section, a plan catalogue — that is
 * correct and reads as a breadcrumb. For a screen reachable from several
 * places it is wrong twice over: it lands the reader somewhere they were not,
 * and because a link pushes rather than pops, the browser's own back button
 * returns them to the screen they just left. Press either one again and they
 * bounce between the two.
 *
 * This renders a real anchor, so middle-click, right-click and "open in new
 * tab" still work and the fallback is what a crawler sees. On an ordinary
 * click, when the session trail shows somewhere to return to, it pops instead —
 * which both lands the reader where they actually came from and leaves the
 * history stack the length it was.
 */
export function BackLink({
  fallbackHref,
  className = "",
  title,
  children
}: {
  /** Where to go when there is no history — a direct link, or a fresh tab. */
  fallbackHref: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const search = useSearchParams()?.toString();

  return (
    <Link
      className={className}
      href={fallbackHref}
      onClick={(event) => {
        // Let the browser handle anything that is not a plain left click, so
        // new-tab and new-window keep working.
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.button !== 0) return;

        const current = search ? `${pathname}?${search}` : pathname;
        if (!hasAppHistory(current)) return; // Follow the href.

        event.preventDefault();
        router.back();
      }}
      title={title}
    >
      {children}
    </Link>
  );
}
