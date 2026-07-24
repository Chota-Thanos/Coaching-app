"use client";

import { useState } from "react";
import { Newspaper, Target, ShieldCheck, ArrowRight, Brain, BookOpen, BookOpenCheck, ClipboardCheck, FileText, Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../auth/auth-context";
import { SignInPanel } from "../auth/sign-in-panel";
import { AdminOnboardingToursManager } from "../current-affairs/admin/admin-onboarding-tours";

export function AdminModuleHub() {
  const { token, user, isInitialized } = useAuth();
  const [showToursManager, setShowToursManager] = useState(false);

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm text-center animate-pulse">
          <p className="text-sm font-semibold text-ink/50">Verifying session...</p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <section className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-civic/10 text-civic">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-ink">Admin Portal</h1>
              <p className="mt-2 text-sm text-ink/70">Sign in with an admin or editor account to access coaching operations.</p>
              <div className="mt-6">
                <SignInPanel />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const hasAccess = user && ["admin", "moderator", "content_editor", "evaluator"].includes(user.role);
  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
        <section className="rounded-2xl border border-berry/30 bg-berry/10 p-8">
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">Admin, moderator, content editor, or evaluator role required.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      {/* Header */}
      <div className="mb-10">
        <span className="text-xs font-bold text-civic uppercase tracking-wider">Coaching App</span>
        <h1 className="text-4xl font-black text-ink mt-1">Admin Portal</h1>
        <p className="text-base text-ink/60 mt-2">
          Choose a module to manage content, assessments, and AI configurations.
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Affairs Module */}
        <div className="bg-surface border border-line rounded-3xl shadow-sm overflow-hidden hover:shadow-lg transition-all group">
          {/* Color bar */}
          <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Newspaper className="h-7 w-7" />
              </span>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Content Module
              </span>
            </div>

            <h2 className="text-2xl font-black text-ink mb-2">Current Affairs</h2>
            <p className="text-sm text-ink/60 leading-relaxed mb-6">
              Manage daily current affairs articles, Prelims and Mains PYQs, article categories, AI ingestion queues, and generation settings.
            </p>

            {/* Sub-links */}
            <div className="grid gap-2 mb-6">
              {[
                { href: "/admin/current-affairs/articles", label: "Articles Library", icon: <BookOpen className="h-3.5 w-3.5" /> },
                { href: "/admin/current-affairs/create", label: "Create Content", icon: <Plus className="h-3.5 w-3.5" /> },
                { href: "/admin/current-affairs/ingestion", label: "Ingestion Queue", icon: <Brain className="h-3.5 w-3.5" /> },
              ].map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-ink/70 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </div>

            <Link
              href="/admin/current-affairs/overview"
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md"
            >
              Enter Current Affairs Admin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Assessment Module */}
        <div className="bg-surface border border-line rounded-3xl shadow-sm overflow-hidden hover:shadow-lg transition-all group">
          {/* Color bar */}
          <div className="h-2 bg-gradient-to-r from-civic to-blue-500" />
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-civic/10 text-civic">
                <Target className="h-7 w-7" />
              </span>
              <span className="text-[10px] font-black text-civic bg-civic/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Assessment Module
              </span>
            </div>

            <h2 className="text-2xl font-black text-ink mb-2">Assessment</h2>
            <p className="text-sm text-ink/60 leading-relaxed mb-6">
              Manage objective and mains question banks, standalone tests, assessment categories, and quiz AI configurations.
            </p>

            {/* Sub-links */}
            <div className="grid gap-2 mb-6">
              {[
                { href: "/admin/assessment/objective-questions", label: "Objective Questions Library", icon: <BookOpen className="h-3.5 w-3.5" /> },
                { href: "/admin/assessment/mains-questions", label: "Mains Questions Library", icon: <FileText className="h-3.5 w-3.5" /> },
                { href: "/admin/assessment/mains-evaluations", label: "Mains Evaluation Queue", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
                { href: "/admin/assessment/create-objective", label: "Add Objective Question", icon: <Plus className="h-3.5 w-3.5" /> },
              ].map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-ink/70 hover:bg-civic/5 hover:text-civic transition-all"
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </div>

            <Link
              href="/admin/assessment/overview"
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-civic hover:bg-civic/90 text-white font-bold text-sm transition-all shadow-md"
            >
              Enter Assessment Admin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Study Plans Module */}
        <div className="bg-surface border border-line rounded-3xl shadow-sm overflow-hidden hover:shadow-lg transition-all group">
          <div className="h-2 bg-gradient-to-r from-emerald-600 to-civic" />
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <BookOpenCheck className="h-7 w-7" />
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                LMS Module
              </span>
            </div>

            <h2 className="text-2xl font-black text-ink mb-2">Study Plans</h2>
            <p className="text-sm text-ink/60 leading-relaxed mb-6">
              Manage paid week-wise study plans, plan tests, reading and revision timeline items, and live lecture links.
            </p>

            <div className="grid gap-2 mb-6">
              {[
                { href: "/admin/study-plans", label: "Plans List", icon: <BookOpen className="h-3.5 w-3.5" /> },
                { href: "/admin/study-plans", label: "Create New", icon: <Plus className="h-3.5 w-3.5" /> },
                { href: "/admin/study-plans", label: "Open Details", icon: <FileText className="h-3.5 w-3.5" /> },
              ].map(({ href, label, icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-ink/70 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                >
                  {icon}
                  {label}
                </Link>
              ))}
            </div>

            <Link
              href="/admin/study-plans"
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-all shadow-md"
            >
              Enter Study Plans Management
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Onboarding Tours Module */}
        <div className={`bg-surface border rounded-3xl shadow-sm overflow-hidden hover:shadow-lg transition-all group md:col-span-3 ${showToursManager ? "border-indigo-300" : "border-line"}`}>
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />
          <div className="p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-5 flex-1">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                  <Sparkles className="h-7 w-7" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-ink">Onboarding Tours</h2>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">New</span>
                  </div>
                  <p className="text-sm text-ink/60 leading-relaxed mt-1">
                    Create and manage step-by-step guided tours for product features. Control which elements are spotlighted, required actions, and when the tour re-appears by bumping its version.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowToursManager(!showToursManager)}
                className={`shrink-0 ml-4 flex items-center gap-2 h-10 rounded-2xl font-bold text-sm transition-all px-5 shadow-md ${
                  showToursManager
                    ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {showToursManager ? <><X className="h-4 w-4" /> Close</> : <>Manage Tours <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>

            {showToursManager && token && (
              <div className="mt-8 border-t border-indigo-100 pt-6">
                <AdminOnboardingToursManager token={token} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-ink/40">
          Signed in as <span className="font-bold text-ink/60">{user?.email}</span> · Role: <span className="font-bold text-ink/60 uppercase">{user?.role}</span>
        </p>
      </div>
    </main>
  );
}
