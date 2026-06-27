import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpenCheck, ClipboardList, type LucideIcon } from "lucide-react";
import { Suspense } from "react";
import { RegisterForm } from "../../components/auth/register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a Coaching App account to attempt tests, track progress, and review performance.",
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Register | Coaching App",
    description: "Create an account for assessment practice and current affairs Notes Space tools.",
    type: "website",
    url: "/register"
  }
};

export default function RegisterPage() {
  const benefits: Array<{ Icon: LucideIcon; title: string; copy: string }> = [
    { Icon: ClipboardList, title: "Attempt", copy: "Start tests from public lists." },
    { Icon: BookOpenCheck, title: "Review", copy: "Read explanations after submit." },
    { Icon: BarChart3, title: "Improve", copy: "Track weak topics over time." }
  ];

  return (
    <main className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
      <section className="order-2 space-y-5 lg:order-1">
        <p className="text-sm font-black uppercase tracking-wide text-civic">Student account</p>
        <div>
          <h2 className="text-3xl font-black leading-tight text-ink md:text-5xl">Practice flow with progress built in</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70 md:text-base">
            Register once, start an attempt, return to saved progress, and use review reports to decide the next step.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {benefits.map(({ Icon, title, copy }) => (
            <div className="rounded-lg border border-line bg-white p-4 shadow-sm" key={title}>
              <Icon aria-hidden="true" className="h-5 w-5 text-civic" />
              <h3 className="mt-3 text-base font-black text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink/65">{copy}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link className="text-civic" href="/assessment/tests">Browse tests</Link>
          <Link className="text-civic" href="/current-affairs/daily-news">Read current affairs</Link>
        </div>
      </section>

      <section className="order-1 lg:order-2">
        <Suspense fallback={<div className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70 shadow-sm">Loading registration...</div>}>
          <RegisterForm />
        </Suspense>
      </section>
    </main>
  );
}
