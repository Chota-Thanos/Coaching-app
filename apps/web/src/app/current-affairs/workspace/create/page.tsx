import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateNotesWizard } from "../../../../components/current-affairs/workspace/create-notes-wizard";

export const metadata: Metadata = {
  title: "Create Notes",
  description: "Step-by-step guide to building a current affairs notes repository.",
  alternates: { canonical: "/current-affairs/workspace/create" },
  robots: { index: false, follow: false }
};

export default function CreateNotesPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-surface p-5 text-sm font-semibold text-ink/70">Loading...</p>
      </main>
    }>
      <CreateNotesWizard />
    </Suspense>
  );
}
