import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminModuleHub } from "../../components/admin/admin-module-hub";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Coaching app admin module selector.",
  robots: { index: false, follow: false },
};

export default function AdminHubPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
          <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading admin portal...</p>
          </div>
        </main>
      }
    >
      <AdminModuleHub />
    </Suspense>
  );
}
