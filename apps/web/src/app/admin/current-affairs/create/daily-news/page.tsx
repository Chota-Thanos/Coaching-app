import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminCASpace } from "../../../../../components/admin/admin-ca-space";

export const metadata: Metadata = {
  title: "Create Daily News | Admin",
  description: "Create and publish daily current affairs news and prelims PYQs.",
  robots: { index: false, follow: false },
};

export default function CADailyNewsCreatorPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Daily News Creator...</p>
          </div>
        </main>
      }
    >
      <AdminCASpace overrideTab="create" overrideSubView="daily-news" />
    </Suspense>
  );
}
