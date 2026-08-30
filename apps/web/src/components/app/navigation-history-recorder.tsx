"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordPath } from "../../lib/navigation-history";

/**
 * Records each screen the learner visits, so back buttons know where to return.
 *
 * Mounted once in the shell rather than per-page: a trail with gaps in it is
 * worse than no trail, because a back button would confidently return to the
 * wrong screen. Renders nothing.
 */
export function NavigationHistoryRecorder() {
  const pathname = usePathname() || "/";
  const search = useSearchParams()?.toString() ?? "";

  useEffect(() => {
    recordPath(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);

  return null;
}
