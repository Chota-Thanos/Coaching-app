"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth/auth-context";
import { StudentDashboard } from "../components/home/student-dashboard";
import { browserBaseUrl, resolveMediaUrl } from "../lib/api";
import { PerformanceConsoleSection } from "../components/marketing/performance-console";
// Onboarding tours removed from dashboard
import {
  Target,
  BookOpenCheck,
  FileText,
  BarChart3,
  Calendar,
  Users,
  Newspaper,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  BookOpen,
  Bookmark,
  Plus,
  BrainCircuit,
  Award,
  FolderOpen,
  PlusCircle,
  TrendingUp,
  FileCode,
  Star,
  ShieldCheck,
  Check,
  CheckCircle,
  Lock,
  Unlock,
  X,
  ChevronDown,
  NotebookPen,
  Layers,
  Tag,
  Import,
  GraduationCap,
  MessageSquare,
  CreditCard,
  Clock,
  Zap,
  AlertCircle,
  Loader2,
  Download,
  Edit3,
  FolderInput,
  Compass
} from "lucide-react";

export const dynamic = "force-dynamic";



export default function HomePage() {
  const router = useRouter();
  const { token, isInitialized } = useAuth();

  // Data states
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);

  // Quiz state removed — 'Start a Free Test' now goes directly to the real custom test builder
  const [previewSelectedTopics, setPreviewSelectedTopics] = useState<string[]>(["Polity", "Economy", "History"]);

  const togglePreviewTopic = (topic: string) => {
    setPreviewSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  // Loading

  // Dashboard tours removed


  // Fetch public current affairs preview
  useEffect(() => {
    const fetchPublicArticles = async () => {
      try {
        // content_kind is a required query param on this endpoint (no default) —
        // omitting it made every request here fail schema validation with a 400,
        // which the `if (res.ok)` check swallowed without ever logging, so
        // latestArticles stayed permanently empty. That empty state is invisible
        // on this page's own marketing section (it falls back to placeholder
        // cards below) but shows up plainly as "Articles are being published" in
        // the signed-in dashboard's Daily Feed widget, which has no such fallback.
        const res = await fetch(
          `${browserBaseUrl}/api/v1/current-affairs/frontend/articles?content_kind=daily_current_affairs&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setLatestArticles(data.items || []);
        } else {
          console.error("Failed to fetch public current affairs preview", res.status, await res.text());
        }
      } catch (err) {
        console.error("Failed to fetch public current affairs preview", err);
      }
    };
    fetchPublicArticles();
  }, []);

  // Fetch mentor profiles for marketing
  useEffect(() => {
    if (token) return;
    const fetchMentors = async () => {
      try {
        const mentorsRes = await fetch(`${browserBaseUrl}/api/v1/mentorship/profiles`);
        if (mentorsRes.ok) {
          const data = await mentorsRes.json();
          setMentors((data || []).slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to fetch mentors", err);
      }
    };
    fetchMentors();
  }, [token]);

  // Look for an admin-curated Diagnostic Test to send the hero CTA straight to —
  // falls back to the custom test builder if none has been published yet.
  const [diagnosticTestId, setDiagnosticTestId] = useState<number | null>(null);
  useEffect(() => {
    const fetchDiagnosticTest = async () => {
      try {
        const res = await fetch(
          `${browserBaseUrl}/api/v1/assessment/test-templates?test_type=diagnostic_test&access_type=free&status=published&limit=1`
        );
        if (res.ok) {
          const list = await res.json();
          const first = Array.isArray(list) ? list[0] : null;
          if (first?.id) setDiagnosticTestId(first.id);
        }
      } catch (err) {
        console.error("Failed to check for a published diagnostic test", err);
      }
    };
    fetchDiagnosticTest();
  }, []);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading WayToIAS...</p>
        </div>
      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGED OUT — PUBLIC MARKETING PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  if (!token) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] antialiased transition-colors duration-150">

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 1 · HERO (Command Deck Console)
        ───────────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-12 lg:py-20 omr-tex">
          <div className="absolute -top-32 -right-40 h-[520px] w-[520px] rounded-full bg-[#4a3fe0]/10 dark:bg-[#5b5bf5]/15 blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

              {/* ── Copy & CTAs ── */}
              <div className="lg:col-span-7 space-y-6">
                <div className="eyebrow-cmd">
                  <span className="dot-blip" />
                  <span>India's UPSC Preparation Console</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-[var(--ink)]">
                  Every attempt,{" "}
                  <span className="text-[#4a3fe0] dark:text-[#5b5bf5]">scored, mapped,</span>{" "}
                  and turned into your next move.
                </h1>

                <p className="text-base text-[var(--ink-soft)] max-w-xl leading-relaxed">
                  Free daily current affairs, a custom test builder, a notes workspace, and 1:1 mentorship from verified officers — feeding one live performance console that tracks accuracy down to the topic.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href={diagnosticTestId ? `/assessment/tests/${diagnosticTestId}` : "/assessment/gk"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 transition-transform active:scale-[0.98]"
                    id="hero-diagnostic-test"
                  >
                    <Target className="h-4 w-4" />
                    Take the free diagnostic test
                  </Link>
                  <Link
                    href="/assessment/custom-test/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-6 py-3.5 text-sm font-bold text-[var(--ink)] hover:border-[#c9c4f9] hover:bg-[var(--panel-2)] transition"
                    id="hero-custom-test"
                  >
                    <BookOpen className="h-4 w-4" />
                    Create Test
                  </Link>
                </div>

                <p className="text-xs text-[var(--ink-faint)]">
                  No account needed for the diagnostic test ·{" "}
                  <Link href="/register" className="text-[#4a3fe0] dark:text-[#5b5bf5] font-semibold hover:underline">
                    Create free account →
                  </Link>
                </p>

                {/* Stat Ticker */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-5 border-t border-[var(--panel-border-soft)]">
                  <div>
                    <span className="block font-mono text-xl font-bold tabular-nums text-[var(--ink)]">10,000+</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Aspirants</span>
                  </div>
                  <div>
                    <span className="block font-mono text-xl font-bold tabular-nums text-[var(--ink)]">120+</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Verified Mentors</span>
                  </div>
                  <div>
                    <span className="block font-mono text-xl font-bold tabular-nums text-[var(--ink)]">50,000+</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Tests Taken</span>
                  </div>
                  <div>
                    <span className="block font-mono text-xl font-bold tabular-nums text-[var(--ink)]">4.9/5</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">Mentor Rating</span>
                  </div>
                </div>
              </div>

              {/* ── Console Dashboard Widget ── */}
              <div className="lg:col-span-5 relative">
                <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] overflow-hidden shadow-2xl">
                  {/* Console bar */}
                  <div className="flex items-center gap-2 border-b border-[var(--panel-border)] px-4 py-3 bg-[var(--panel-2)]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                    <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                      Performance Console — Live
                    </span>
                  </div>

                  {/* Console grid */}
                  <div className="grid grid-cols-2 divide-x divide-y divide-[var(--panel-border)] bg-[var(--panel-border)]">
                    {/* Cell 1: Subject Radar */}
                    <div className="bg-[var(--panel)] p-4 space-y-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                        Subject Radar
                      </h4>
                      <svg viewBox="0 0 200 150" className="w-full">
                        <polygon points="100,10 175,50 175,110 100,145 25,110 25,50" fill="none" stroke="var(--panel-border)" strokeWidth="1"/>
                        <polygon points="100,42 148,66 148,98 100,120 52,98 52,66" fill="none" stroke="var(--panel-border-soft)" strokeWidth="1"/>
                        <polygon points="100,22 162,54 156,104 100,132 46,100 38,54" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
                        <circle cx="100" cy="22" r="3" fill="var(--accent)"/>
                        <circle cx="162" cy="54" r="3" fill="var(--accent)"/>
                        <circle cx="156" cy="104" r="3" fill="var(--accent)"/>
                        <circle cx="100" cy="132" r="3" fill="var(--accent)"/>
                        <circle cx="46" cy="100" r="3" fill="var(--accent)"/>
                        <circle cx="38" cy="54" r="3" fill="var(--accent)"/>
                      </svg>
                    </div>

                    {/* Cell 2: 8-Week Trend */}
                    <div className="bg-[var(--panel)] p-4 space-y-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                        8-Week Trend
                      </h4>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xl font-bold text-[var(--ink)]">76%</span>
                        <span className="font-mono text-xs font-bold text-[var(--positive)]">▲ 8pt</span>
                      </div>
                      <svg viewBox="0 0 200 90" className="w-full" preserveAspectRatio="none">
                        <path d="M0,70 L28,64 L56,60 L84,50 L112,46 L140,34 L168,26 L200,18 L200,90 L0,90 Z" fill="var(--accent-soft)"/>
                        <path d="M0,70 L28,64 L56,60 L84,50 L112,46 L140,34 L168,26 L200,18" fill="none" stroke="var(--accent)" strokeWidth="2.5"/>
                        <circle cx="200" cy="18" r="4" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2"/>
                      </svg>
                    </div>

                    {/* Cell 3: Topic accuracy — OMR read */}
                    <div className="col-span-2 bg-[var(--panel)] p-4 space-y-2.5">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                        Topic accuracy — OMR read
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-xs font-semibold text-[var(--ink-soft)]">Polity</span>
                          <span className="flex gap-1">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <span key={i} className={`bubble ${i < 9 ? "f" : ""}`} />
                            ))}
                          </span>
                          <span className="ml-auto font-mono text-xs font-bold text-[var(--ink)]">88%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-xs font-semibold text-[var(--ink-soft)]">Sci &amp; Tech</span>
                          <span className="flex gap-1">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <span key={i} className={`bubble ${i < 6 ? "f warn" : ""}`} />
                            ))}
                          </span>
                          <span className="ml-auto font-mono text-xs font-bold text-[var(--ink)]">63%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            QUICK NAVIGATION BAR (Directly below Hero)
        ───────────────────────────────────────────────────────────────────── */}
        <div className="py-3.5 border-y border-[var(--panel-border-soft)] bg-[var(--panel-2)]/90 backdrop-blur-md sticky top-0 z-20 shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-mono font-bold text-[var(--ink-faint)] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Quick Navigation:
            </span>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link href="#roadmap" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-[#4a3fe0] hover:text-[#4a3fe0] transition flex items-center gap-1.5 shadow-xs">
                <Compass className="h-3.5 w-3.5 text-indigo-500" /> 3-Stage Roadmap
              </Link>
              <Link href="/assessment/gk" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-[#4a3fe0] hover:text-[#4a3fe0] transition flex items-center gap-1.5 shadow-xs">
                <Target className="h-3.5 w-3.5 text-[#4a3fe0]" /> Self-Prep Mocks
              </Link>
              <Link href="/current-affairs/daily-news" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-emerald-500 hover:text-emerald-500 transition flex items-center gap-1.5 shadow-xs">
                <Newspaper className="h-3.5 w-3.5 text-emerald-500" /> Daily News
              </Link>
              <Link href="/current-affairs/workspace" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-indigo-500 hover:text-indigo-500 transition flex items-center gap-1.5 shadow-xs">
                <FolderOpen className="h-3.5 w-3.5 text-indigo-500" /> Notes Workspace
              </Link>
              <Link href="/study-plans" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-amber-500 hover:text-amber-500 transition flex items-center gap-1.5 shadow-xs">
                <BookOpenCheck className="h-3.5 w-3.5 text-amber-500" /> Study Plans
              </Link>
              <Link href="/mentors" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-blue-500 hover:text-blue-500 transition flex items-center gap-1.5 shadow-xs">
                <Users className="h-3.5 w-3.5 text-blue-500" /> 1:1 Mentors
              </Link>
              <Link href="#pricing" className="px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--panel-border)] text-xs font-bold text-[var(--ink)] hover:border-purple-500 hover:text-purple-500 transition flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-500" /> Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            PROCESS GRAPHIC 1 · THE 3 INCREMENTAL STAGES ROADMAP (High Contrast Band)
        ───────────────────────────────────────────────────────────────────── */}
        <section id="roadmap" className="py-16 bg-slate-900 dark:bg-slate-950 text-white relative overflow-hidden border-b border-slate-800">
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 rounded-full inline-block">
                Preparation Roadmap
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                The 3 Incremental Stages of UPSC Mastery
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                A structured, step-by-step pathway designed to take you from targeted self-practice to structured guided learning and direct officer mentorship.
              </p>
            </div>

            {/* 3 Stage Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Stage 1 Card */}
              <Link
                href="/assessment/gk"
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col justify-between hover:border-indigo-400 transition-all shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full uppercase tracking-wider">
                      Stage 01
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/30">
                      Free &amp; Unlimited
                    </span>
                  </div>

                  <div className="h-12 w-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                    <Target className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition leading-snug">
                      Self Preparation
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mt-1">
                      GK · CSAT · Mains Mocks
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Build custom topic-wise GS &amp; CSAT tests. Combine targeted question drills with your daily reading to get maximum retention and error recall.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Topic Tests</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Tag &amp; Revise</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Analytics</span>
                  </div>
                </div>

                <div className="pt-5 flex items-center justify-between text-xs font-bold text-indigo-400 group-hover:underline">
                  <span>Start Self Prep</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Stage 2 Card */}
              <Link
                href="/study-plans"
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col justify-between hover:border-amber-400 transition-all shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-24 w-24 bg-amber-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-3 py-1 rounded-full uppercase tracking-wider">
                      Stage 02
                    </span>
                    <span className="font-mono text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-400/30">
                      Guided Learning
                    </span>
                  </div>

                  <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                    <BookOpenCheck className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition leading-snug">
                      Guided Learning
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mt-1">
                      Structured Subject Study Plans
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Follow structured, syllabus-aligned study plans across all GS subjects. Get daily milestones, recommended sources, and integrated progress checks.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Subject Roadmaps</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Timelines</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Test Schedules</span>
                  </div>
                </div>

                <div className="pt-5 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:underline">
                  <span>Explore Study Plans</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Stage 3 Card */}
              <Link
                href="/mentors"
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col justify-between hover:border-emerald-400 transition-all shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full uppercase tracking-wider">
                      Stage 03
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-400/30">
                      1:1 Officer Guidance
                    </span>
                  </div>

                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                    <Users className="h-6 w-6" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition leading-snug">
                      Connect With Mentors
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mt-1">
                      Direct Officer &amp; Topper Consultation
                    </p>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ask any query or doubt directly with verified available mentors. Receive line-by-line Mains answer evaluations and strategic 1:1 mentorship calls.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Mains Eval</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">Strategy Calls</span>
                    <span className="text-[10px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">1:1 Doubt Solving</span>
                  </div>
                </div>

                <div className="pt-5 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:underline">
                  <span>Connect With Mentors</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 2 · MODULE 01 — PRACTICE & TEST BUILDER
        ───────────────────────────────────────────────────────────────────── */}
        <section id="modules" className="py-16 border-t border-[var(--panel-border-soft)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div className="space-y-2 max-w-2xl">
                <span className="pill-cmd pill-cmd-accent">Module 01 — Self-Prep</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                  Practice smart. Track deeper.
                </h2>
                <p className="text-sm sm:text-base text-[var(--ink-soft)] leading-relaxed">
                  Build custom GS &amp; CSAT tests by topic, tag hard questions for revision, and feed every attempt straight into the performance console.
                </p>
              </div>
              <Link
                href="/assessment/gk"
                className="inline-flex items-center gap-2 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition whitespace-nowrap shrink-0"
              >
                Start practising free →
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Custom Test Builder Card */}
              <div className="lg:col-span-7 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold block mb-3">
                    Custom Test Builder
                  </span>
                  
                  {/* Interactive Chip Selection Preview */}
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 mb-5 space-y-3">
                    <p className="text-xs font-semibold text-[var(--ink-faint)]">Select topics to include:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Polity", "Economy", "History", "Geography", "Environment"].map((topic) => {
                        const isSelected = previewSelectedTopics.includes(topic);
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => togglePreviewTopic(topic)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                              isSelected
                                ? "bg-[#4a3fe0] dark:bg-[#5b5bf5] border-[#4a3fe0] text-white shadow-sm"
                                : "bg-[var(--panel)] border-[var(--panel-border)] text-[var(--ink-soft)] hover:border-[var(--accent-line)]"
                            }`}
                          >
                            {topic} {isSelected ? "✓" : "+"}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[var(--ink-faint)] pt-1">
                      Free tier: up to 10 questions per test · {previewSelectedTopics.length} topics selected
                    </p>
                  </div>

                  <ul className="space-y-3 font-medium text-xs text-[var(--ink-soft)]">
                    {[
                      { title: "Topic-wise practice", paid: false },
                      { title: "Performance analytics", paid: false },
                      { title: "Tag & revise weak items", paid: false },
                      { title: "Advanced AI trend tracking", paid: true },
                      { title: "Photo/PDF question import (OCR)", paid: true },
                    ].map((feat) => (
                      <li key={feat.title} className="flex items-center justify-between border-b border-[var(--panel-border-soft)] pb-2.5 last:border-none last:pb-0">
                        <span className="font-bold text-[var(--ink)]">{feat.title}</span>
                        {feat.paid ? (
                          <span className="font-mono text-[9px] uppercase tracking-wider font-bold bg-[var(--panel-2)] text-[var(--ink-faint)] border border-[var(--panel-border)] px-2 py-0.5 rounded-full">
                            Self-Prep
                          </span>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-wider font-bold bg-[var(--positive-soft)] text-[var(--positive)] px-2 py-0.5 rounded-full">
                            Free
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Why it works card */}
              <div className="lg:col-span-5 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 flex flex-col justify-center space-y-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                  Why it works
                </span>
                <h3 className="text-xl font-bold text-[var(--ink)] leading-snug">
                  Every question is topic-tagged.
                </h3>
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                  So every attempt writes to the same record — there's no separate "practice mode" that doesn't count toward your analytics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 3 · MODULE 02 — ALWAYS FREE CURRENT AFFAIRS & PIPELINE
        ───────────────────────────────────────────────────────────────────── */}
        <section id="current-affairs" className="py-16 border-t-2 border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/25 omr-tex">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="pill-cmd pill-cmd-pos">Module 02 — Always free</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                  Stay current. Stay ahead.
                </h2>
                <p className="text-sm sm:text-base text-[var(--ink-soft)] leading-relaxed">
                  Subject and topic-tagged daily current affairs for Prelims and Mains — de-duplicated, cross-linked, free forever, no login required.
                </p>
              </div>
              <Link
                href="/current-affairs/daily-news"
                className="inline-flex items-center gap-2 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition whitespace-nowrap shrink-0"
              >
                Read today's news →
              </Link>
            </div>

            {/* Visual 5-Step Pipeline Graphic (Above Articles) */}
            <div className="rounded-2xl border border-emerald-500/20 bg-[var(--panel)] p-6 space-y-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--panel-border-soft)] pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--positive)] font-bold block mb-1">
                    Visual Workflow Pipeline
                  </span>
                  <h3 className="text-xl font-bold text-[var(--ink)]">
                    Current Affairs to Revision Notes Workflow
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-faint)]">
                  5 simple steps from daily reading to offline exam-day recall
                </p>
              </div>

              {/* 5 Step Visual Pipeline Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Step 1 */}
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-md bg-[var(--positive-soft)] text-[var(--positive)] font-mono text-xs font-black flex items-center justify-center border border-[var(--positive)]/20">
                        01
                      </span>
                      <Newspaper className="h-4 w-4 text-[var(--positive)]" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--ink)]">Read Daily News</h4>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Best possible presentation with topic tags, PYQ links &amp; key facts.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-[var(--positive)] uppercase tracking-wider bg-[var(--positive-soft)] border border-[var(--positive)]/20 px-2 py-0.5 rounded w-max">
                    Reading
                  </span>
                </div>

                {/* Step 2 */}
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-md bg-[#4a3fe0]/10 dark:bg-[#5b5bf5]/15 text-[#4a3fe0] dark:text-[#5b5bf5] font-mono text-xs font-black flex items-center justify-center border border-[#4a3fe0]/20">
                        02
                      </span>
                      <FolderInput className="h-4 w-4 text-[#4a3fe0] dark:text-[#5b5bf5]" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--ink)]">Save to Repos</h4>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Organize into subject repos (Polity, Econ) &amp; add filter tags.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-[#4a3fe0] dark:text-[#5b5bf5] uppercase tracking-wider bg-[#4a3fe0]/10 border border-[#4a3fe0]/20 px-2 py-0.5 rounded w-max">
                    Repositories
                  </span>
                </div>

                {/* Step 3 */}
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-md bg-amber-500/10 text-[#b8730a] dark:text-[#f59e0b] font-mono text-xs font-black flex items-center justify-center border border-amber-500/20">
                        03
                      </span>
                      <Edit3 className="h-4 w-4 text-[#b8730a] dark:text-[#f59e0b]" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--ink)]">Edit &amp; Add Notes</h4>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Add 3–5 quick revision bullets per article for rapid recall.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-[#b8730a] dark:text-[#f59e0b] uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded w-max">
                    Revision Lines
                  </span>
                </div>

                {/* Step 4 */}
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-xs font-black flex items-center justify-center border border-purple-500/20">
                        04
                      </span>
                      <PlusCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--ink)]">Add Own News</h4>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Insert your own news clips, personal notes, or external editorials.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded w-max">
                    User Notes
                  </span>
                </div>

                {/* Step 5 */}
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--bg-2)] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-black flex items-center justify-center border border-emerald-500/20">
                        05
                      </span>
                      <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--ink)]">Revise &amp; Download</h4>
                    <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed">
                      Filter by tag, recall rapidly, and download your repo offline.
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded w-max">
                    Download &amp; Read
                  </span>
                </div>
              </div>
            </div>

            {/* Articles Grid (Below Pipeline) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                  Today's Featured News Briefs
                </span>
                <Link href="/current-affairs/daily-news" className="text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] hover:underline">
                  View all news →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {latestArticles.length > 0 ? (
                  latestArticles.map((article: any) => (
                    <Link
                      key={article.id}
                      href={`/current-affairs/articles/${article.slug}`}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 flex flex-col justify-between hover:border-[var(--accent-line)] transition space-y-4 group shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--positive)] font-bold">
                          <span>{article.category_name || "General Studies"}</span>
                          <span className="text-[var(--ink-faint)]">
                            {article.published_at ? new Date(article.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Today"}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-[var(--ink)] group-hover:text-[#4a3fe0] dark:group-hover:text-[#5b5bf5] transition line-clamp-2">
                          {article.title}
                        </h4>
                        <p className="text-xs text-[var(--ink-soft)] line-clamp-3 leading-relaxed">
                          {article.summary || article.excerpt || "Click to read full exam brief, key facts & PYQ connections."}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] group-hover:underline">
                        Read free brief →
                      </span>
                    </Link>
                  ))
                ) : (
                  [
                    {
                      category: "Polity",
                      date: "24 Jul",
                      title: "Parliamentary Committee Recommends Reforms to the Anti-Defection Law",
                      snippet: "A joint committee report proposes narrowing the Speaker's discretionary role in disqualification cases.",
                    },
                    {
                      category: "Economy",
                      date: "24 Jul",
                      title: "RBI's Monetary Policy Committee Holds Repo Rate, Cites Core Inflation",
                      snippet: "MPC minutes reveal a 4–2 split on the growth-versus-inflation trade-off for FY27.",
                    },
                    {
                      category: "Environment",
                      date: "23 Jul",
                      title: "Western Ghats ESA Notification Faces Fresh Pushback",
                      snippet: "State governments seek a review of buffer-zone boundaries ahead of the final gazette notification.",
                    }
                  ].map((art) => (
                    <Link
                      key={art.title}
                      href="/current-affairs/daily-news"
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 flex flex-col justify-between hover:border-[var(--accent-line)] transition space-y-4 group shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--positive)] font-bold">
                          <span>{art.category}</span>
                          <span className="text-[var(--ink-faint)]">{art.date}</span>
                        </div>
                        <h4 className="text-base font-bold text-[var(--ink)] group-hover:text-[#4a3fe0] dark:group-hover:text-[#5b5bf5] transition leading-snug">
                          {art.title}
                        </h4>
                        <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                          {art.snippet}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] group-hover:underline">
                        Read free brief →
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 4 · MODULE 03 — NOTES WORKSPACE
        ───────────────────────────────────────────────────────────────────── */}
        <section className="py-16 border-t-2 border-indigo-500/30 bg-indigo-950/10 dark:bg-indigo-950/25">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div className="space-y-2 max-w-2xl">
                <span className="pill-cmd pill-cmd-accent">Module 03 — Notes Workspace</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                  Build your personal knowledge base.
                </h2>
                <p className="text-sm sm:text-base text-[var(--ink-soft)] leading-relaxed">
                  Import current affairs into organised repositories, add revision lines, tag by exam category, recall fast on exam day.
                </p>
              </div>
              <Link
                href="/current-affairs/workspace"
                className="inline-flex items-center gap-2 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition whitespace-nowrap shrink-0 shadow-md"
              >
                Go to Notes Workspace →
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Bento: Repositories Mock */}
              <div className="lg:col-span-7 rounded-2xl border border-indigo-500/20 bg-[var(--panel)] p-6 space-y-4 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)] font-bold">
                    My Repositories — 2 / 1 active (free)
                  </span>
                  <Link href="/current-affairs/workspace" className="text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] hover:underline">
                    Manage workspace →
                  </Link>
                </div>
                <div className="space-y-2.5">
                  <Link href="/current-affairs/workspace" className="flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3.5 bg-[var(--panel-2)] hover:border-indigo-500/40 transition group">
                    <span className="text-sm font-bold text-[var(--ink)] group-hover:text-[#4a3fe0] dark:group-hover:text-[#5b5bf5]">Polity &amp; Governance</span>
                    <span className="font-mono text-xs font-semibold text-[var(--ink-faint)]">8 articles</span>
                  </Link>
                  <Link href="/current-affairs/workspace" className="flex items-center justify-between rounded-xl border border-[var(--panel-border)] p-3.5 bg-[var(--panel-2)] hover:border-indigo-500/40 transition group">
                    <span className="text-sm font-bold text-[var(--ink)] group-hover:text-[#4a3fe0] dark:group-hover:text-[#5b5bf5]">Environment &amp; Ecology</span>
                    <span className="font-mono text-xs font-semibold text-[var(--ink-faint)]">10 articles</span>
                  </Link>
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-[var(--panel-border)] p-3.5 bg-[var(--panel)] opacity-55">
                    <span className="text-sm font-bold text-[var(--ink)]">International Relations</span>
                    <span className="font-mono text-xs font-semibold text-[var(--ink-faint)]">locked</span>
                  </div>
                </div>

                <Link
                  href="/current-affairs/workspace"
                  className="w-full h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-600 hover:text-white transition flex items-center justify-center gap-2 mt-2"
                >
                  <FolderOpen className="h-4 w-4" /> Open Personal Notes Workspace →
                </Link>
              </div>

              {/* Right Bento: Feature Matrix */}
              <div className="lg:col-span-5 rounded-2xl border border-indigo-500/20 bg-[var(--panel)] p-6 space-y-4 shadow-md">
                <ul className="space-y-3 font-medium text-xs text-[var(--ink-soft)]">
                  {[
                    { title: "Multiple repositories", paid: false },
                    { title: "One-click import from news", paid: false },
                    { title: "Quick revision lines", paid: false },
                    { title: "Bulk import categories", paid: true },
                    { title: "Auto-connected topics", paid: true },
                  ].map((feat) => (
                    <li key={feat.title} className="flex items-center justify-between border-b border-[var(--panel-border-soft)] pb-2.5 last:border-none last:pb-0">
                      <span className="font-bold text-[var(--ink)]">{feat.title}</span>
                      {feat.paid ? (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold bg-[var(--panel-2)] text-[var(--ink-faint)] border border-[var(--panel-border)] px-2 py-0.5 rounded-full">
                          Notes Plan
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold bg-[var(--positive-soft)] text-[var(--positive)] px-2 py-0.5 rounded-full">
                          Free
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 5 · PERFORMANCE CONSOLE (FLAGSHIP ANALYTICS)
        ───────────────────────────────────────────────────────────────────── */}
        <PerformanceConsoleSection />

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 6 · MENTORSHIP ROSTER
        ───────────────────────────────────────────────────────────────────── */}
        <section id="mentorship" className="py-16 border-t-2 border-amber-500/30 bg-amber-950/10 dark:bg-amber-950/25">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div className="space-y-2 max-w-2xl">
                <span className="pill-cmd pill-cmd-accent">Mentor roster</span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                  Real guidance from verified officers.
                </h2>
                <p className="text-sm sm:text-base text-[var(--ink-soft)] leading-relaxed">
                  120+ verified mentors across India for Mains evaluation, strategy, and 1:1 sessions — every engagement scoped and escrow-protected before it starts.
                </p>
              </div>
              <Link
                href="/mentors"
                className="inline-flex items-center gap-2 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition whitespace-nowrap shrink-0"
              >
                Browse all mentors →
              </Link>
            </div>

            {/* Officer Roster List */}
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-border)] divide-y divide-[var(--panel-border)] overflow-hidden">
              {mentors.length > 0 ? (
                mentors.map((m: any) => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[var(--panel)]">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#b8730a] to-[#8a5c0a] flex items-center justify-center font-bold text-amber-950 text-base shrink-0">
                        {m.display_name?.[0] || "M"}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[var(--ink)]">{m.display_name}</h4>
                        <span className="font-mono text-xs text-[var(--ink-faint)]">
                          {m.years_experience > 0 ? `${m.years_experience} Yrs Experience` : "Verified UPSC Topper"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--ink-soft)] italic flex-1 max-w-xl">
                      "{m.headline || "Dedicated Mains answer writing evaluation & strategy mentor."}"
                    </p>
                    <Link
                      href={`/mentors/${m.id}`}
                      className="font-mono text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] hover:underline shrink-0"
                    >
                      Book →
                    </Link>
                  </div>
                ))
              ) : (
                [
                  {
                    name: "Aditya Sharma",
                    role: "IAS 2023 · AIR 12",
                    quote: "I review each answer against the actual GS-II marking scheme, not a generic rubric."
                  },
                  {
                    name: "Priya Mehta",
                    role: "IPS 2022 · Mains Expert",
                    quote: "Most students lose marks on structure, not content. That's where I focus first."
                  },
                  {
                    name: "Rohan Gupta",
                    role: "UPSC Prelims Topper",
                    quote: "CSAT is a pacing exam. I teach the clock, not just the concepts."
                  }
                ].map((m) => (
                  <div key={m.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[var(--panel)]">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#b8730a] to-[#8a5c0a] flex items-center justify-center font-bold text-amber-950 text-base shrink-0">
                        {m.name[0]}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[var(--ink)]">{m.name}</h4>
                        <span className="font-mono text-xs text-[var(--ink-faint)]">{m.role}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--ink-soft)] italic flex-1 max-w-xl">
                      "{m.quote}"
                    </p>
                    <Link
                      href="/mentors"
                      className="font-mono text-xs font-bold text-[#4a3fe0] dark:text-[#5b5bf5] hover:underline shrink-0"
                    >
                      Book →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 7 · VERIFIED OUTCOME TESTIMONIAL
        ───────────────────────────────────────────────────────────────────── */}
        <section className="py-20 border-t border-[var(--panel-border-soft)] bg-[var(--bg-2)] omr-tex text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-4">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--ink-faint)]">
              // verified outcome
            </span>
            <blockquote className="text-xl sm:text-2xl font-bold text-[var(--ink)] leading-relaxed max-w-3xl mx-auto">
              "The custom test builder helped me target my weakest topics, and my mentor's Mains evaluation caught mistakes I'd been making for months."
            </blockquote>
            <div>
              <cite className="not-italic text-sm font-bold text-[var(--ink)] block">Aditya Verma</cite>
              <span className="font-mono text-xs uppercase tracking-wider text-[#4a3fe0] dark:text-[#5b5bf5] block mt-0.5">
                IAS Officer · AIR 45, UPSC CSE 2025
              </span>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 8 · PRICING MATRIX
        ───────────────────────────────────────────────────────────────────── */}
        <section id="pricing" className="py-16 border-t border-[var(--panel-border-soft)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-2 mb-10">
              <span className="pill-cmd pill-cmd-accent">Pricing</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                Plans for every stage of your journey.
              </h2>
              <p className="text-sm sm:text-base text-[var(--ink-soft)]">
                Start free. Upgrade only what you need. Current affairs stays free for everyone, always.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* FREE */}
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">Free Tier</h3>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">Core features to get started</p>
                  </div>
                  <div className="font-mono text-3xl font-bold text-[var(--ink)]">
                    ₹0<span className="text-xs text-[var(--ink-faint)] font-normal">/mo</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[var(--ink-soft)] border-t border-[var(--panel-border)] pt-4">
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Current affairs — unlimited, always free</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>3 custom tests / month (up to 10 Qs)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>10 notes articles per repository</span>
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="block w-full text-center py-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--panel-2)] transition"
                >
                  Create free account
                </Link>
              </div>

              {/* SELF-PREP */}
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">Self-Prep</h3>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">For serious mock practice</p>
                  </div>
                  <div className="font-mono text-3xl font-bold text-[var(--ink)]">
                    ₹499<span className="text-xs text-[var(--ink-faint)] font-normal">/mo</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[var(--ink-soft)] border-t border-[var(--panel-border)] pt-4">
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Unlimited custom tests, no cap</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Full GK &amp; CSAT sectional mocks</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Advanced subject-wise analytics</span>
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="block w-full text-center py-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--panel-2)] transition"
                >
                  Get Self-Prep
                </Link>
              </div>

              {/* NOTES */}
              <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">Notes</h3>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">For daily notes &amp; workspace</p>
                  </div>
                  <div className="font-mono text-3xl font-bold text-[var(--ink)]">
                    ₹299<span className="text-xs text-[var(--ink-faint)] font-normal">/mo</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[var(--ink-soft)] border-t border-[var(--panel-border)] pt-4">
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Unlimited notes &amp; bulk imports</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Unlimited active repositories</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Auto-connected topics</span>
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="block w-full text-center py-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--panel-2)] transition"
                >
                  Get Notes Plan
                </Link>
              </div>

              {/* ALL-ACCESS FEATURED */}
              <div className="rounded-2xl border border-[var(--accent-line)] bg-gradient-to-b from-[var(--accent-soft)] to-[var(--panel)] p-6 flex flex-col justify-between space-y-6 shadow-lg">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--ink)]">All-Access</h3>
                    <p className="text-xs text-[var(--ink-faint)] mt-0.5">Everything, for serious prep</p>
                  </div>
                  <div className="font-mono text-3xl font-bold text-[var(--ink)]">
                    ₹699<span className="text-xs text-[var(--ink-faint)] font-normal">/mo</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[var(--ink-soft)] border-t border-[var(--panel-border)] pt-4">
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Unlimited tests + AI trend tracking</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>2 live mentorship sessions / month</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4a3fe0] dark:text-[#5b5bf5] font-bold">›</span>
                      <span>Priority Mains evaluations</span>
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register"
                  className="block w-full text-center py-3 rounded-xl bg-[#4a3fe0] dark:bg-[#5b5bf5] text-xs font-bold text-white hover:brightness-110 transition shadow-md"
                >
                  Unlock everything
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 9 · FAQ ACCORDION
        ───────────────────────────────────────────────────────────────────── */}
        <section className="py-16 border-t border-[var(--panel-border-soft)] bg-[var(--bg-2)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-2 mb-8">
              <span className="pill-cmd pill-cmd-accent">FAQ</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--ink)] tracking-tight">
                Frequently asked.
              </h2>
            </div>

            <div className="max-w-3xl space-y-3">
              {[
                {
                  q: "Is current affairs really free forever?",
                  a: "Yes — every daily brief, topic tag, and PYQ connection is free with no login and no daily limit, on every plan including no plan at all.",
                },
                {
                  q: "How are mentors verified?",
                  a: "Mentors are verified UPSC-qualified officers or subject experts, each with a public track record on their profile before you book.",
                },
                {
                  q: "What analytics do I get on the free plan?",
                  a: "Topic-wise accuracy and the weak-area focus panel on every test — paid tiers add multi-week trend tracking and unlimited test volume.",
                },
                {
                  q: "Can I cancel a paid plan anytime?",
                  a: "Yes, plans are month-to-month with no lock-in. Notes and past test records stay accessible even after downgrading.",
                },
              ].map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-sm text-[var(--ink)]">
                    <span>{q}</span>
                    <span className="font-mono text-lg text-[var(--ink-faint)] group-open:text-[#4a3fe0] dark:group-open:text-[#5b5bf5]">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--ink-soft)] leading-relaxed">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 8 · FINAL CTA
        ───────────────────────────────────────────────────────────────────── */}
        <section className="bg-midnight py-16 px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-2xl space-y-5">
            <span className="font-mono text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Console access is free</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Ready to Start Your UPSC Journey?
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Join 10,000+ aspirants. Free account. No credit card. Start reading current affairs instantly.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/register" className="touch-target inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-8 text-sm font-bold text-white transition-colors">
                Create Free Account →
              </Link>
              <Link href="/current-affairs/daily-news" className="touch-target inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-white/15 hover:bg-white/8 px-8 text-sm font-bold text-slate-300 transition-colors">
                Read Today's News (Free)
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            STUDY PLANS — single line, footer placement only
        ───────────────────────────────────────────────────────────────────── */}
        <div className="bg-midnight border-t border-slate-800 pb-6 text-center">
          <p className="text-xs text-slate-500 italic">
            Prefer a guided path?{" "}
            <Link href="/study-plans" className="text-indigo-400 hover:underline font-semibold">
              Browse structured courses →
            </Link>
          </p>
        </div>

      </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGED IN — STUDENT DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  // The signed-in home page lives in its own component and fetches its own
  // data. The dashboard-only state and the `/me/*` fetch chain that used to sit
  // in this file went with it — leaving those here meant every signed-in visit
  // fired the same seven requests twice, once for a branch that never renders.
  return <StudentDashboard />;
}
