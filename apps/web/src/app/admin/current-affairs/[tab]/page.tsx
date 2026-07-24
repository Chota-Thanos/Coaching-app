import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminCASpace } from "../../../../components/admin/admin-ca-space";

export const metadata: Metadata = {
  title: "Current Affairs Admin",
  description: "Admin tools for current affairs content management.",
  robots: { index: false, follow: false },
};

export default function CAAdminTabPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Current Affairs Admin...</p>
          </div>
        </main>
      }
    >
      <AdminCASpace />
    </Suspense>
  );
}
