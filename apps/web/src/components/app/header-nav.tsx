"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  Newspaper,
  Target,
  LayoutGrid,
  FileText,
  BookOpen,
  HelpCircle,
  ShieldCheck,
  BarChart3,
  Bookmark,
  Zap,
  CreditCard
} from "lucide-react";
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

  const navBtnClass = (isOpen: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs xl:text-[13px] font-bold whitespace-nowrap transition-all select-none ${
      isOpen
        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
        : "text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:text-indigo-300"
    }`;

  const navLinkClass =
    "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs xl:text-[13px] font-bold text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:text-indigo-300 whitespace-nowrap transition-all select-none";

  return (
    <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1 xl:gap-1.5 whitespace-nowrap">
      {/* 1. Self-Preparation Dropdown */}
      <div className="relative" onMouseEnter={openAssessment} onMouseLeave={closeAssessment}>
        <button
          aria-expanded={assessmentOpen}
          aria-haspopup="true"
          className={navBtnClass(assessmentOpen)}
          type="button"
        >
          <span>Self-Preparation</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${assessmentOpen ? "rotate-180 opacity-100" : ""}`} />
        </button>

        {assessmentOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-indigo-950/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openAssessment}
            onMouseLeave={closeAssessment}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2 bg-paper/40 rounded-xl mb-1">
              <Target className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-black text-ink/50 uppercase tracking-widest">Assessment & Practice</span>
            </div>
            <div className="space-y-0.5">
              <Link
                href="/assessment/gk"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <Target className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">General Studies</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">GS Prelims self tests & summary</p>
                </div>
              </Link>

              <Link
                href="/assessment/csat"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">CSAT / Aptitude</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Aptitude practice & stats</p>
                </div>
              </Link>

              <Link
                href="/assessment/mains-hub"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Mains Practice</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Answer writing & reviews</p>
                </div>
              </Link>

              <Link
                href="/assessment/dashboard"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Scorecard Radar</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Unified performance overview</p>
                </div>
              </Link>

              <Link
                href="/assessment/gk?view=revision"
                onClick={() => setAssessmentOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <Bookmark className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Bookmarks & Revision</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Category-filtered revision tests</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 2. Current Affairs Dropdown */}
      <div className="relative" onMouseEnter={openCa} onMouseLeave={closeCa}>
        <button
          aria-expanded={caOpen}
          aria-haspopup="true"
          className={navBtnClass(caOpen)}
          type="button"
        >
          <span>Current Affairs</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${caOpen ? "rotate-180 opacity-100" : ""}`} />
        </button>

        {caOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-indigo-950/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openCa}
            onMouseLeave={closeCa}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2 bg-paper/40 rounded-xl mb-1">
              <Newspaper className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-black text-ink/50 uppercase tracking-widest">Prelims</span>
            </div>
            <div className="space-y-0.5">
              <Link
                href="/current-affairs/daily-news"
                onClick={() => setCaOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <Newspaper className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Daily News</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Prelims current affairs updates</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/prelims-pyq"
                onClick={() => setCaOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover:bg-blue-100 transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Prelims PYQs</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Prelims questions by category</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 3. Notes */}
      <Link className={navLinkClass} href="/current-affairs/workspace">
        Notes
      </Link>

      {/* 4. Mains Dropdown */}
      <div className="relative" onMouseEnter={openPyq} onMouseLeave={closePyq}>
        <button
          aria-expanded={pyqOpen}
          aria-haspopup="true"
          className={navBtnClass(pyqOpen)}
          type="button"
        >
          <span>Mains</span>
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${pyqOpen ? "rotate-180 opacity-100" : ""}`} />
        </button>

        {pyqOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-indigo-950/10 animate-in fade-in slide-in-from-top-2 duration-150"
            onMouseEnter={openPyq}
            onMouseLeave={closePyq}
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2 bg-paper/40 rounded-xl mb-1">
              <FileText className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-[10px] font-black text-ink/50 uppercase tracking-widest">Mains Workspace</span>
            </div>
            <div className="space-y-0.5">
              <Link
                href="/current-affairs/editorial-summary"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Editorial Summary</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Exam-focused editorials</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/mains-topic-notes"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Mains Topic Notes</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Structured theme notes & data</p>
                </div>
              </Link>

              <Link
                href="/current-affairs/mains-pyq"
                onClick={() => setPyqOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover:bg-blue-100 transition-colors">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Mains PYQs</p>
                  <p className="text-[10px] text-ink/50 leading-none mt-0.5">Mains questions by theme</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 5. Study Plans */}
      <Link className={navLinkClass} href="/study-plans">
        Study Plans
      </Link>

      {/* 6. Mentorship */}
      <Link className={navLinkClass} href="/mentors">
        Mentorship
      </Link>

      {/* 7. Pricing */}
      <Link
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs xl:text-[13px] font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 whitespace-nowrap transition-all select-none"
        href="/pricing"
      >
        <Zap className="h-3.5 w-3.5 fill-indigo-600/20 text-indigo-600 dark:text-indigo-400" />
        <span>Pricing</span>
      </Link>

      {/* 8. Admin Dropdown */}
      {showAdmin && (
        <div className="relative ml-0.5" onMouseEnter={openAdmin} onMouseLeave={closeAdmin}>
          <button
            aria-expanded={adminOpen}
            aria-haspopup="true"
            className={navBtnClass(adminOpen)}
            type="button"
          >
            <span>Admin</span>
            <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${adminOpen ? "rotate-180 opacity-100" : ""}`} />
          </button>

          {adminOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-indigo-950/10 animate-in fade-in slide-in-from-top-2 duration-150"
              onMouseEnter={openAdmin}
              onMouseLeave={closeAdmin}
            >
              <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2 bg-paper/40 rounded-xl mb-1">
                <LayoutGrid className="h-3.5 w-3.5 text-ink/50" />
                <span className="text-[10px] font-black text-ink/50 uppercase tracking-widest">Admin Modules</span>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/admin/current-affairs/overview"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                    <Newspaper className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Current Affairs</p>
                    <p className="text-[10px] text-ink/50 leading-none mt-0.5">Articles, PYQs, ingestion</p>
                  </div>
                </Link>

                <Link
                  href="/admin/assessment/overview"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Assessment</p>
                    <p className="text-[10px] text-ink/50 leading-none mt-0.5">Questions, tests, categories</p>
                  </div>
                </Link>

                <Link
                  href="/admin/study-plans"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                    <BookOpenCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Study Plans</p>
                    <p className="text-[10px] text-ink/50 leading-none mt-0.5">Plans, timeline, test content</p>
                  </div>
                </Link>

                {user && ["admin", "moderator"].includes(user.role) && (
                  <Link
                    href="/admin/mentorship"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Mentor Approvals</p>
                      <p className="text-[10px] text-ink/50 leading-none mt-0.5">Onboarding requests review</p>
                    </div>
                  </Link>
                )}

                {user && user.role === "admin" && (
                  <Link
                    href="/admin/purchases"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 group-hover:bg-emerald-100 transition-colors">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Purchase Records</p>
                      <p className="text-[10px] text-ink/50 leading-none mt-0.5">All subscriptions & billing</p>
                    </div>
                  </Link>
                )}

                {user && ["admin", "moderator"].includes(user.role) && (
                  <Link
                    href="/admin/payments"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink dark:text-slate-100 group-hover:text-indigo-600 transition-colors">Payments Ledger</p>
                      <p className="text-[10px] text-ink/50 leading-none mt-0.5">Every payment, refunds & disputes</p>
                    </div>
                  </Link>
                )}
              </div>

              <div className="border-t border-line/60 px-3 py-2 mt-1">
                <Link
                  href="/admin"
                  onClick={() => setAdminOpen(false)}
                  className="text-[10px] font-bold text-ink/50 hover:text-indigo-600 transition-colors block text-center"
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
