import type { Metadata } from "next";
import { Suspense } from "react";
import { AssessmentDashboard } from "../../../components/assessment/assessment-dashboard";

export const metadata: Metadata = {
  title: "Assessment Dashboard",
  robots: { index: false, follow: false }
};

export default function AssessmentDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 pb-20 pt-5 text-center text-sm font-semibold text-slate-400">
          Loading scorecard metrics...
        </main>
      }
    >
      <AssessmentDashboard />
    </Suspense>
  );
}

