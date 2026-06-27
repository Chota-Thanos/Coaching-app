import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminCASpace } from "../../../../../components/admin/admin-ca-space";

export const metadata: Metadata = {
  title: "Daily News AI Settings - Current Affairs Admin",
  description: "Configure daily current affairs AI instructions and style guides.",
  robots: { index: false, follow: false },
};

export default function DailyNewsAiSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Daily News AI Settings...</p>
          </div>
        </main>
      }
    >
      <AdminCASpace overrideTab="ai-settings" overrideSubView="daily-news" />
    </Suspense>
  );
}
