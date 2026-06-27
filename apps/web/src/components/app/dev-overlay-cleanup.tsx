"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function DevOverlayCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const removeStaleDevOverlays = () => {
      document.querySelectorAll("nextjs-portal, [data-nextjs-dialog-overlay]").forEach((element) => {
        element.remove();
      });
    };

    removeStaleDevOverlays();
    const timer = window.setTimeout(removeStaleDevOverlays, 250);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
