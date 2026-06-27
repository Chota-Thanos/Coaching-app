import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAssessmentSpace } from "../../../../components/admin/admin-assessment-space";

export const metadata: Metadata = {
  title: "Assessment Admin",
  description: "Admin tools for assessment content and question bank management.",
  robots: { index: false, follow: false },
};

export default function AssessmentAdminTabPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm text-center animate-pulse">
            <p className="text-sm font-semibold text-ink/50">Loading Assessment Admin...</p>
          </div>
        </main>
      }
    >
      <AdminAssessmentSpace />
    </Suspense>
  );
}
