import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpenCheck, ClipboardList } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "../../components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Coaching App to continue tests, review results, and manage your Notes Space.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Login | Coaching App",
    description: "Sign in for assessment attempts, review reports, and current affairs Notes Space tools.",
    type: "website",
    url: "/login"
  }
};

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
      <section className="order-2 space-y-5 lg:order-1">
        <p className="text-sm font-black uppercase tracking-wide text-civic">Student login</p>
        <div>
          <h2 className="text-3xl font-black leading-tight text-ink md:text-5xl">Return to the next useful step</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70 md:text-base">
            Continue an attempt, review weak topics, or organize current affairs notes from one account.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { Icon: ClipboardList, title: "Attempts", copy: "Resume saved test work." },
            { Icon: BookOpenCheck, title: "Review", copy: "Check solutions and reports." },
            { Icon: BarChart3, title: "Analytics", copy: "Track topic signals." }
          ].map(({ Icon, title, copy }) => (
            <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={title}>
              <Icon aria-hidden="true" className="h-5 w-5 text-civic" />
              <h3 className="mt-3 text-base font-black text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink/65">{copy}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link className="text-civic" href="/assessment/tests">Browse tests</Link>
          <Link className="text-civic" href="/current-affairs/workspace">Notes Space</Link>
        </div>
      </section>

      <section className="order-1 lg:order-2">
        <Suspense fallback={<div className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70 shadow-sm">Loading sign in...</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
