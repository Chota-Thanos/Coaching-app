import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceDashboard } from "../../../components/current-affairs/workspace/workspace-dashboard";

export const metadata: Metadata = {
  title: "Notes Space",
  description: "Save current affairs articles, define custom tags, bulk import articles, and create personal notes repositories.",
  alternates: { canonical: "/current-affairs/workspace" },
  robots: { index: false, follow: false }
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-surface p-5 text-sm font-semibold text-ink/70">Loading Notes Space...</p>
      </main>
    }>
      <WorkspaceDashboard />
    </Suspense>
  );
}
