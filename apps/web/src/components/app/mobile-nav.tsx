"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Target,
  Newspaper,
  FolderOpen,
  Users,
  BookOpenCheck,
  Zap,
  FileText,
  ShieldCheck,
  ChevronRight,
  Home,
  UserCheck,
  CreditCard,
  BookOpen,
  Award,
  Compass
} from "lucide-react";
import { useAuth } from "../auth/auth-context";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const showAdmin = user && ["admin", "moderator", "content_editor"].includes(user.role);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/current-affairs/daily-news") {
      return pathname.startsWith("/current-affairs") && !pathname.startsWith("/current-affairs/workspace");
    }
    if (href === "/current-affairs/workspace") {
      return pathname.startsWith("/current-affairs/workspace");
    }
    return pathname.startsWith(href);
  };

  const drawerModal = isOpen ? (
    <div className="fixed inset-0 z-[100] lg:hidden flex h-screen w-screen overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-over Sheet Panel */}
      <div className="relative ml-auto w-full max-w-[320px] xs:max-w-sm bg-surface dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 border-l border-line/60 dark:border-slate-800 animate-in slide-in-from-right duration-250">
        {/* Sheet Header */}
        <div className="flex items-center justify-between p-4 border-b border-line/60 dark:border-slate-800 bg-paper/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] text-white shadow-xs">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-extrabold text-sm text-ink dark:text-white leading-none">WayToIAS Menu</h2>
              <p className="text-[11px] text-ink/50 dark:text-slate-400 font-mono mt-0.5">Full Platform Navigation</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="h-9 w-9 rounded-xl bg-paper dark:bg-slate-800 text-ink dark:text-slate-200 flex items-center justify-center hover:bg-line/40 transition shadow-xs"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Home Link */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
              isActive("/", true)
                ? "bg-[#4a3fe0] text-white border-[#4a3fe0] shadow-xs font-bold"
                : "bg-paper/60 dark:bg-slate-800/40 border-line/60 dark:border-slate-800 hover:bg-paper dark:hover:bg-slate-800 text-ink dark:text-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="h-4 w-4" />
              <span className="text-xs font-extrabold">Home Page</span>
            </div>
            <ChevronRight className="h-4 w-4 opacity-50" />
          </Link>

          {/* Group 1: Self-Preparation & Drills */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-[#4a3fe0] dark:text-[#5b5bf5] uppercase tracking-widest block px-2">
              🎯 Stage 1: Self-Preparation
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/assessment/gk"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-[#4a3fe0] dark:text-[#5b5bf5] flex items-center justify-center font-bold">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">GS Prelims Self-Tests</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Topic-wise syllabus drills</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/assessment/csat"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">CSAT Aptitude</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Quantitative &amp; reasoning tests</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/assessment/mains-hub"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Mains Evaluation Hub</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Answer writing &amp; review</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Group 2: Current Affairs Hubs */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block px-2">
              📰 Stage 2: Guided Current Affairs
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/current-affairs/daily-news"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Newspaper className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Daily News Briefs</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Categorized daily GS updates</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/current-affairs/editorial-summary"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Editorial Summaries</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Deep Mains opinion analysis</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/current-affairs/mains-topic-notes"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Mains Topic Notes</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Structured syllabus notes</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/current-affairs/prelims-pyq"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-[#4a3fe0]/10 text-[#4a3fe0] flex items-center justify-center font-bold">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Prelims PYQ Archive</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Past year questions repository</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Group 3: Notes Workspace & Repositories */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block px-2">
              📂 Notes Workspace
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/current-affairs/workspace"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">My Repositories</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Custom note collections &amp; tags</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Group 4: Mentorship & Officers */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block px-2">
              👥 Stage 3: Connect With Mentors
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/mentors"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">1:1 Mentors</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Verified officer guidance</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/profile/apply"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Apply as Topper/Officer</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Join our mentorship panel</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Group 5: Study Plans */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block px-2">
              📖 Guided Study Plans
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/study-plans"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <BookOpenCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Subject Study Plans</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Structured timelines &amp; targets</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Group 6: Account & Pricing */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block px-2">
              Pricing &amp; Account
            </span>
            <div className="space-y-1 bg-paper/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-line/40 dark:border-slate-800">
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink dark:text-slate-100">Pricing &amp; Subscriptions</p>
                    <p className="text-[10px] text-ink/50 dark:text-slate-400">Upgrade your prep features</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {user ? (
                <Link
                  href="/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface dark:hover:bg-slate-800 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink dark:text-slate-100">{user.username || user.email}</p>
                      <p className="text-[10px] text-ink/50 dark:text-slate-400 font-mono capitalize">{user.role}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink/30 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] text-white text-xs font-bold hover:brightness-110 transition shadow-xs mt-2"
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </div>

          {/* Group 7: Admin Panel (If Authorized) */}
          {showAdmin && (
            <div className="space-y-2 pt-2 border-t border-line/60 dark:border-slate-800">
              <span className="text-[10px] font-mono font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block px-2">
                Admin Tools
              </span>
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition border border-amber-500/20"
              >
                <span>Go to Admin Dashboard</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Burger Menu Button inside Header */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="lg:hidden h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shrink-0"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Render Portal directly attached to document.body */}
      {mounted && drawerModal && createPortal(drawerModal, document.body)}
    </>
  );
}
