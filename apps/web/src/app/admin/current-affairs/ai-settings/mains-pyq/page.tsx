import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminCASpace } from "../../../../../components/admin/admin-ca-space";

export const metadata: Metadata = {
  title: "Mains PYQ AI Settings - Current Affairs Admin",
  description: "Configure mains past-year-question AI instructions and style guides.",
  robots: { index: false, follow: false },
};

export default function MainsPyqAiSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Mains PYQ AI Settings...</p>
          </div>
        </main>
      }
    >
      <AdminCASpace overrideTab="ai-settings" overrideSubView="mains-pyq" />
    </Suspense>
  );
}
