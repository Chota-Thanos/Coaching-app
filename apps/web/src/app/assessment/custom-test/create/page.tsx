"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CreateTestWizard } from "../../../../components/assessment/create-test/create-test-wizard";

export default function CreateCustomTestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <CreateTestWizard />
    </Suspense>
  );
}
