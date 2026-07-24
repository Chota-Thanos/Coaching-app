"use client";

import { type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { DevOverlayCleanup } from "../components/app/dev-overlay-cleanup";
import { AuthProvider } from "../components/auth/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <DevOverlayCleanup />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
