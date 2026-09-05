"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../auth/auth-context";
import { StudentDashboard } from "./student-dashboard";

/**
 * Chooses between the signed-out marketing page and the signed-in dashboard.
 *
 * The important detail is the *default*. The previous version of `/` returned a
 * spinner whenever `isInitialized` was false, and `isInitialized` only turns
 * true inside a `useEffect` that reads localStorage. There is no localStorage on
 * the server, so it is always false during SSR — meaning the spinner was the
 * only markup search engines ever received for the home page. Marketing is
 * therefore what we render until we positively know otherwise, never a spinner.
 *
 * `marketing` arrives as an already-rendered element from the server component,
 * so it costs nothing to hold onto while auth resolves.
 */
export function HomeGate({ marketing }: { marketing: ReactNode }) {
  const { token, isInitialized } = useAuth();

  // Signed-in visitors would otherwise see a frame of marketing before the
  // dashboard mounts. `data-auth` on <html> lets CSS hide the marketing block
  // during that frame, set by a blocking inline script in the root layout —
  // the same trick next-themes already uses here to avoid a light-mode flash.
  // Keeping it in sync here matters for the case the script cannot cover: a
  // stored token that turns out to be expired, where the marketing page is what
  // the visitor should end up seeing.
  useEffect(() => {
    if (!isInitialized) return;
    if (token) document.documentElement.setAttribute("data-auth", "1");
    else document.documentElement.removeAttribute("data-auth");
  }, [isInitialized, token]);

  if (isInitialized && token) return <StudentDashboard />;

  return <div data-home-marketing>{marketing}</div>;
}
