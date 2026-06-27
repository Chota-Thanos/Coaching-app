import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminCASpace } from "../../../../../components/admin/admin-ca-space";

export const metadata: Metadata = {
  title: "Create Prelims PYQ | Admin",
  description: "Create and publish Prelims past year questions.",
  robots: { index: false, follow: false },
};

export default function CAPrelimsPyqCreatorPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Prelims PYQ Creator...</p>
          </div>
        </main>
      }
    >
      <AdminCASpace overrideTab="create" overrideSubView="prelims-pyq" />
    </Suspense>
  );
}
