"use client";

import { LockKeyhole } from "lucide-react";
import { SignInPanel } from "../../auth/sign-in-panel";

export function WorkspaceSignIn() {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-civic/10 text-civic">
          <LockKeyhole aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black leading-tight text-ink">Notes Space</h1>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Sign in to save articles, define tags, import in bulk, and organize your current affairs notes repositories.
          </p>
          <div className="mt-4">
            <SignInPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
