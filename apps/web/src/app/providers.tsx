"use client";

import { type ReactNode } from "react";
import { DevOverlayCleanup } from "../components/app/dev-overlay-cleanup";
import { AuthProvider } from "../components/auth/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DevOverlayCleanup />
      {children}
    </AuthProvider>
  );
}
