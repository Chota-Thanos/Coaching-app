"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { BookOpenCheck, ChevronDown, Newspaper, Target, LayoutGrid, FileText, BookOpen, HelpCircle, ShieldCheck, BarChart3, Bookmark, Zap, CreditCard } from "lucide-react";
import { useAuth } from "../auth/auth-context";

export function HeaderNav() {
  const { user } = useAuth();
  const showAdmin = user && ["admin", "moderator", "content_editor"].includes(user.role);
  
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [caOpen, setCaOpen] = useState(false);
  const [pyqOpen, setPyqOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const assessmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pyqTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openAssessment = () => {
    if (assessmentTimeoutRef.current) clearTimeout(assessmentTimeoutRef.current);
    setAssessmentOpen(true);
  };
  const closeAssessment = () => {
    assessmentTimeoutRef.current = setTimeout(() => setAssessmentOpen(false), 120);
  };

  const openCa = () => {
    if (caTimeoutRef.current) clearTimeout(caTimeoutRef.current);
    setCaOpen(true);
  };
  const closeCa = () => {
    caTimeoutRef.current = setTimeout(() => setCaOpen(false), 120);
  };

  const openPyq = () => {
    if (pyqTimeoutRef.current) clearTimeout(pyqTimeoutRef.current);
    setPyqOpen(true);
  };
  const closePyq = () => {
    pyqTimeoutRef.current = setTimeout(() => setPyqOpen(false), 120);
  };

  const openAdmin = () => {
    if (adminTimeoutRef.current) clearTimeout(adminTimeoutRef.current);
    setAdminOpen(true);
  };
  const closeAdmin = () => {
    adminTimeoutRef.current = setTimeout(() => setAdminOpen(false), 120);
  };

  return (
    <nav aria-label="Primary sections" className="hidden items-center gap-0.5 lg:flex">
      {/* Assessment Dropdown */}
      <div
        className="relative"
        onMouseEnter={openAssessment}
        onMouseLeave={closeAssessment}
      >
        <button
          aria-expanded={assessmentOpen}
          aria-haspopup="true"
          className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            assessmentOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
          type="button"
        >
          Assessment
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${assessmentOpen ? "rotate-180" : ""}`}
          />
        </button>

        {assessmentOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openAssessment}
            onMouseLeave={closeAssessment}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-4 py-3 bg-paper/50">
              <Target className="h-3.5 w-3.5 text-ink/40" />
              <span className="text-[10px] font-black text-ink/40 uppercase tracking-widest">Assessment & Practice</span>
            </div>
            <div className="p-2 space-y-1">
              <Link
                href="/assessment/gk"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">General Studies</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">GS Prelims self tests & summary</p>
                </div>
              </Link>

              <Link
                href="/assessment/csat"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">CSAT / Aptitude</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Aptitude practice & stats</p>
                </div>
              </Link>

              <Link
                href="/assessment/mains-hub"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Mains Practice</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Answer writing & reviews</p>
                </div>
              </Link>

              <Link
                href="/assessment/dashboard"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Scorecard Radar</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Unified performance overview</p>
                </div>
              </Link>

              <Link
                href="/assessment/gk?view=revision"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <Bookmark className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Bookmarks & Revision</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Category-filtered revision tests</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Study Plans */}
      <Link
        className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
        href="/study-plans"
      >
        Study Plans
      </Link>

      {/* Current Affairs Dropdown */}
      <div
        className="relative"
        onMouseEnter={openCa}
        onMouseLeave={closeCa}
      >
        <button
          aria-expanded={caOpen}
          aria-haspopup="true"
          className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            caOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
          type="button"
        >
          Prelims
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${caOpen ? "rotate-180" : ""}`}
          />
        </button>

        {caOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openCa}
            onMouseLeave={closeCa}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-4 py-3 bg-paper/50">
              <Newspaper className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-black text-ink/40 uppercase tracking-widest">Prelims</span>
            </div>
            <div className="p-2 space-y-1">
              <Link
                href="/current-affairs/daily-news"
                onClick={() => setCaOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <Newspaper className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Daily News</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Prelims current affairs updates</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/prelims-pyq"
                onClick={() => setCaOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-blue-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-blue-800 transition-colors">Prelims PYQs</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Prelims questions by category</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Mains Dropdown */}
      <div
        className="relative"
        onMouseEnter={openPyq}
        onMouseLeave={closePyq}
      >
        <button
          aria-expanded={pyqOpen}
          aria-haspopup="true"
          className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            pyqOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
          type="button"
        >
          Mains
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${pyqOpen ? "rotate-180" : ""}`}
          />
        </button>

        {pyqOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openPyq}
            onMouseLeave={closePyq}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-4 py-3 bg-paper/50">
              <FileText className="h-3.5 w-3.5 text-saffron" />
              <span className="text-[10px] font-black text-ink/40 uppercase tracking-widest">Mains</span>
            </div>
            <div className="p-2 space-y-1">
              <Link
                href="/current-affairs/editorial-summary"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Editorial Summary</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Exam-focused editorials</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/mains-topic-notes"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Mains Topic Notes</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Structured theme notes & data</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/mains-pyq"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-blue-50 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink group-hover:text-blue-800 transition-colors">Mains PYQs</p>
                  <p className="text-[11px] text-ink/50 leading-none mt-0.5">Mains questions by theme</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Notes Space */}
      <Link
        className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
        href="/current-affairs/workspace"
      >
        Notes Space
      </Link>

      {/* Mentors marketplace directory */}
      <Link
        className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
        href="/mentors"
      >
        Mentors
      </Link>

      {/* Pricing */}
      <Link
        className="rounded-lg px-3.5 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-1"
        href="/pricing"
      >
        <Zap className="h-3.5 w-3.5" />
        Pricing
      </Link>

      {/* Admin Dropdown */}
      {showAdmin && (
        <div
          className="relative ml-1"
          onMouseEnter={openAdmin}
          onMouseLeave={closeAdmin}
        >
          {/* Trigger */}
          <button
            aria-expanded={adminOpen}
            aria-haspopup="true"
            className={`flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              adminOpen ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
            type="button"
          >
            Admin
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown Panel */}
          {adminOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl shadow-ink/10 animate-in fade-in slide-in-from-top-2 duration-150"
              onMouseEnter={openAdmin}
              onMouseLeave={closeAdmin}
            >
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-line/60 px-4 py-3 bg-paper/50">
                <LayoutGrid className="h-3.5 w-3.5 text-ink/40" />
                <span className="text-[10px] font-black text-ink/40 uppercase tracking-widest">Admin Modules</span>
              </div>

              <div className="p-2 space-y-1">
                {/* Current Affairs */}
                <Link
                  href="/admin/current-affairs/overview"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                    <Newspaper className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Current Affairs</p>
                    <p className="text-[11px] text-ink/50 leading-none mt-0.5">Articles, PYQs, ingestion</p>
                  </div>
                </Link>

                {/* Assessment */}
                <Link
                  href="/admin/assessment/overview"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-civic/5 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-civic/10 text-civic group-hover:bg-civic/20 transition-colors">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink group-hover:text-civic transition-colors">Assessment</p>
                    <p className="text-[11px] text-ink/50 leading-none mt-0.5">Questions, tests, categories</p>
                  </div>
                </Link>

                {/* Study Plans */}
                <Link
                  href="/admin/study-plans"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                    <BookOpenCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Study Plans</p>
                    <p className="text-[11px] text-ink/50 leading-none mt-0.5">Plans, timeline, test content</p>
                  </div>
                </Link>

                {/* Mentorship Onboarding approvals */}
                {user && ["admin", "moderator"].includes(user.role) && (
                  <Link
                    href="/admin/mentorship"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Mentor Approvals</p>
                      <p className="text-[11px] text-ink/50 leading-none mt-0.5">Onboarding requests review</p>
                    </div>
                  </Link>
                )}

                {/* Admin Purchases / Billing */}
                {user && user.role === "admin" && (
                  <Link
                    href="/admin/purchases"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-indigo-50 transition-colors group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink group-hover:text-indigo-800 transition-colors">Purchase Records</p>
                      <p className="text-[11px] text-ink/50 leading-none mt-0.5">All subscriptions & billing</p>
                    </div>
                  </Link>
                )}
              </div>

              {/* Footer link to hub */}
              <div className="border-t border-line/60 px-4 py-2.5">
                <Link
                  href="/admin"
                  onClick={() => setAdminOpen(false)}
                  className="text-[11px] font-bold text-ink/40 hover:text-civic transition-colors"
                >
                  View all admin modules →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
