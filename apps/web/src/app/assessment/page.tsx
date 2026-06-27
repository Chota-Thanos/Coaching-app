"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, authenticatedGet } from "../../components/auth/auth-context";
import {
  Target,
  BookOpenCheck,
  FileText,
  BarChart3,
  Calendar,
  Users,
  Newspaper,
  Compass,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Award,
  ChevronRight,
  Sparkles,
  BookOpen,
  ArrowUpRight,
  Bookmark,
  Plus
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function AssessmentPage() {
  const { token, user, isInitialized } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [studyPlans, setStudyPlans] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);

  useEffect(() => {
    if (!token) {
      if (isInitialized) {
        setLoadingStats(false);
        setLoadingAttempts(false);
        setLoadingPlans(false);
        setLoadingMentors(false);
      }
      return;
    }

    const fetchStats = async () => {
      try {
        const data = await authenticatedGet<any>("/api/v1/assessment/me/dashboard", token);
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoadingStats(false);
      }
    };

    const fetchAttempts = async () => {
      try {
        const data = await authenticatedGet<any[]>("/api/v1/assessment/me/attempts?limit=5", token);
        setAttempts(data || []);
      } catch (err) {
        console.error("Failed to load recent attempts", err);
      } finally {
        setLoadingAttempts(false);
      }
    };

    const fetchPlans = async () => {
      try {
        const data = await authenticatedGet<any[]>("/api/v1/study-plans?limit=3", token);
        setStudyPlans(data || []);
      } catch (err) {
        console.error("Failed to load study plans", err);
      } finally {
        setLoadingPlans(false);
      }
    };

    const fetchMentors = async () => {
      try {
        const data = await authenticatedGet<any[]>("/api/v1/mentorship/profiles", token);
        setMentors((data || []).slice(0, 3));
      } catch (err) {
        console.error("Failed to load mentors", err);
      } finally {
        setLoadingMentors(false);
      }
    };

    fetchStats();
    fetchAttempts();
    fetchPlans();
    fetchMentors();
  }, [token, isInitialized]);

  const username = user?.username ?? "Student";
  const gkAttempts = stats?.gk?.summary?.attempts ?? 0;
  const csatAttempts = stats?.aptitude?.summary?.attempts ?? 0;
  const totalMCQ = gkAttempts + csatAttempts;

  const gkAccuracy = stats?.gk?.summary?.avg_accuracy
    ? Math.round(Number(stats.gk.summary.avg_accuracy) * 100)
    : 0;
  const csatAccuracy = stats?.aptitude?.summary?.avg_accuracy
    ? Math.round(Number(stats.aptitude.summary.avg_accuracy) * 100)
    : 0;

  // Curated motivational quote
  const motivationalQuotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Your IAS preparation is a marathon, not a sprint. Consistency is key.",
    "Arise, awake, and stop not until the goal is reached.",
    "The secret of getting ahead is getting started. Make every practice count.",
    "Focus on your progress, not your perfection."
  ];
  // Stable select quote based on username length
  const quote = motivationalQuotes[username.length % motivationalQuotes.length];

  // Cover image fallbacks for study plans
  const coverFallbacks = [
    "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=600&auto=format&fit=crop"
  ];

  // Portrait image fallbacks for mentors
  const avatarFallbacks = [
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=300&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=300&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop"
  ];

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">
      {/* Visual Header Banner */}
      <section className="relative overflow-hidden bg-indigo-950 text-white">
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
          <img
            src="https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop"
            alt="UPSC Preparation Background"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-indigo-900/90 to-transparent z-0" />
        
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 animate-pulse" />
                <span>UPSC Preparation Portal</span>
              </div>
              <h1 className="text-3xl font-black md:text-4xl tracking-tight text-white leading-tight">
                Namaste, {username}! 👋
              </h1>
              <p className="text-sm text-indigo-200/90 italic font-medium">
                &ldquo;{quote}&rdquo;
              </p>
            </div>
            {/* Quick stats on banner */}
            <div className="shrink-0 flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
              <div className="h-10 w-10 rounded-xl bg-indigo-550 flex items-center justify-center text-white shadow-inner">
                <Award className="h-5.5 w-5.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Preparation Status</p>
                <p className="text-sm font-black text-white">{totalMCQ > 0 ? `${totalMCQ} MCQ Tests Attempted` : "Journey Initiated"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Columns */}
      <div className="mx-auto max-w-7xl px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Main Navigation Cards & Modules) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main Content-Type Assessment Modules */}
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <Compass className="h-4.5 w-4.5 text-indigo-650" />
              <span>Assessment & Self Practice</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* General Studies */}
              <Link 
                href="/assessment/gk"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Target className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-blue-700 transition-colors">General Studies</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Syllabus-focused GS self test builder, PYQs, and performance metrics.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-blue-650">
                  <span>Start practice</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* CSAT / Aptitude */}
              <Link 
                href="/assessment/csat"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <BookOpenCheck className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-amber-700 transition-colors">CSAT Aptitude</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Quantitative analysis, reasoning skills, and reading comprehension practice.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-amber-650">
                  <span>Start drill</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Mains Writing */}
              <Link 
                href="/assessment/mains-hub"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <FileText className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Mains Hub</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Subjective answer writing upload, PYQs archive, and evaluation reviews.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-purple-650">
                  <span>Submit answer</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Revision Bookmarks */}
              <Link 
                href="/assessment/gk?view=revision"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <Bookmark className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-rose-700 transition-colors">Bookmarks & Revision</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Access category-filtered bookmarked questions and compile custom revision tests.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-rose-650">
                  <span>Revise questions</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

            </div>
          </div>

          {/* Sub-features / Integration Modules Grid */}
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <BrainCircuit className="h-4.5 w-4.5 text-indigo-650" />
              <span>Prep Resources & Mentorship</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Study Plans */}
              <Link
                href="/study-plans"
                className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
              >
                <div className="shrink-0 h-12 w-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Calendar className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Structured Study Plans</h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Follow detailed duration-based syllabus timelines loaded with specific practice tests.
                  </p>
                </div>
              </Link>

              {/* Mentors marketplace */}
              <Link
                href="/mentors"
                className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
              >
                <div className="shrink-0 h-12 w-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Users className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Top Mentor Panel</h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Book sessions with top IAS toppers and educators for personal guidance and feedback.
                  </p>
                </div>
              </Link>

              {/* Daily News Feed */}
              <Link
                href="/current-affairs/daily-news"
                className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
              >
                <div className="shrink-0 h-12 w-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Newspaper className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Daily Current Affairs</h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Stay updated with handpicked news, PYQ links, and Prelims capsule briefs.
                  </p>
                </div>
              </Link>

              {/* Editorial Summary */}
              <Link
                href="/current-affairs/editorial-summary"
                className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
              >
                <div className="shrink-0 h-12 w-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <BookOpen className="h-5.5 w-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Editorial Analysis</h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Syllabus-mapped editorial briefs and core issue breakdowns for Mains preparation.
                  </p>
                </div>
              </Link>

            </div>
          </div>

        </div>

        {/* Right Column (Performance Stats & Recent Attempts Logs) */}
        <div className="space-y-8">
          
          {/* Stats Radar Summary */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-650" />
                <span>Performance Radar</span>
              </h2>
              <Link href="/assessment/dashboard" className="text-xs font-bold text-indigo-600 hover:underline">
                Full Report
              </Link>
            </div>

            {loadingStats ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-650 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Accuracy cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GS Accuracy</p>
                    <p className="mt-1.5 text-2xl font-black text-indigo-950">{gkAccuracy}%</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-slate-500">
                      <span>{gkAttempts} tests</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CSAT Accuracy</p>
                    <p className="mt-1.5 text-2xl font-black text-indigo-950">{csatAccuracy}%</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-slate-500">
                      <span>{csatAttempts} tests</span>
                    </div>
                  </div>
                </div>
                {/* Visual meter */}
                <div className="space-y-3.5 mt-2 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">General Studies</span>
                      <span className="font-black text-slate-800">{gkAccuracy}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${gkAccuracy}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">CSAT / Aptitude</span>
                      <span className="font-black text-slate-800">{csatAccuracy}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${csatAccuracy}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent attempts checklist */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-650" />
                <span>Recent Attempts</span>
              </h2>
            </div>

            {loadingAttempts ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-650 border-t-transparent" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-slate-400">No test attempts logged yet.</p>
                <Link 
                  href="/assessment/gk" 
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  <span>Build your first test</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {attempts.map((attempt) => {
                  const title = attempt.test_template?.title ?? "Self-built practice test";
                  const date = attempt.started_at
                    ? new Date(attempt.started_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short"
                      })
                    : "Recent";
                  const status = attempt.status ?? "in_progress";
                  const score = attempt.result?.score;

                  return (
                    <div 
                      key={attempt.id} 
                      className="group flex items-start justify-between gap-3 border-b border-slate-100/70 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-700 truncate leading-tight group-hover:text-indigo-650 transition-colors">
                          {title}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-450 flex items-center gap-2 font-medium">
                          <span>{date}</span>
                          <span>•</span>
                          <span className={status === "completed" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                            {status.toUpperCase()}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {score !== undefined && score !== null ? (
                          <span className="text-xs font-black text-slate-800">
                            {Number(score).toFixed(1)} mks
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">--</span>
                        )}
                        <Link
                          href={status === "completed" && attempt.result?.id ? `/assessment/results/${attempt.result.id}` : `/assessment/attempts/${attempt.id}`}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          {status === "completed" ? "Report" : "Resume"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Showcase Row 1: Structured Study Plans */}
      <section className="mx-auto max-w-7xl px-4 mt-12 pt-8 border-t border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-indigo-650" />
              <span>Latest Structured Study Plans</span>
            </h2>
            <p className="text-xs text-slate-550 mt-1">
              Carefully scaffolded preparation paths aligned with UPSC timelines.
            </p>
          </div>
          <Link
            href="/study-plans"
            className="inline-flex items-center gap-1 text-xs font-black text-indigo-650 hover:underline"
          >
            <span>Explore All Plans</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loadingPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : studyPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
            <p className="text-sm text-slate-400">No active study plans available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {studyPlans.map((plan) => {
              const coverImg = plan.cover_image_url ?? coverFallbacks[Math.abs(plan.id) % coverFallbacks.length];
              return (
                <div
                  key={plan.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Header Image */}
                    <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                      <img
                        src={coverImg}
                        alt={plan.title}
                        className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-350"
                      />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-black uppercase text-indigo-700 shadow-sm backdrop-blur-sm">
                        {plan.level_label ?? "PRELIMS"}
                      </span>
                    </div>

                    <div className="p-5">
                      <h3 className="text-base font-bold text-slate-800 leading-snug group-hover:text-indigo-700 transition-colors">
                        {plan.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {plan.subtitle ?? plan.description ?? "Complete UPSC Exam schedule preparation."}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <div className="flex gap-4">
                      <span>{plan.duration_weeks ?? plan.durationWeeks} Weeks</span>
                      {plan.test_count !== undefined && (
                        <span>{plan.test_count} Tests</span>
                      )}
                    </div>
                    <Link
                      href={`/study-plans/${plan.id}`}
                      className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>View Plan</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Showcase Row 2: Top Mentors */}
      <section className="mx-auto max-w-7xl px-4 mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
              <Users className="h-5 w-5 text-indigo-650" />
              <span>Connect with Top Mentors</span>
            </h2>
            <p className="text-xs text-slate-550 mt-1">
              Direct consultation and essay validation reviews with experienced educators.
            </p>
          </div>
          <Link
            href="/mentors"
            className="inline-flex items-center gap-1 text-xs font-black text-indigo-650 hover:underline"
          >
            <span>View All Mentors</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loadingMentors ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
            <p className="text-sm text-slate-400">No active mentors available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mentors.map((mentor) => {
              const avatar = mentor.profile_image_url ?? avatarFallbacks[Math.abs(mentor.userId) % avatarFallbacks.length];
              return (
                <div
                  key={mentor.id}
                  className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {/* Left Column avatar */}
                  <div className="relative shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/60">
                    <img
                      src={avatar}
                      alt={mentor.display_name ?? mentor.displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Details column */}
                  <div className="min-w-0 flex-1 flex flex-col justify-between h-full space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-750 transition-colors">
                          {mentor.display_name ?? mentor.displayName}
                        </h3>
                        {mentor.is_verified && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-100">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-450 leading-relaxed line-clamp-2">
                        {mentor.headline ?? "IAS Trainer & Content Educator."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 mt-1.5 text-[11px]">
                      <span className="font-semibold text-slate-500">
                        {mentor.years_experience ?? mentor.yearsExperience > 0 ? `${mentor.years_experience ?? mentor.yearsExperience} yrs exp` : "Expert Guidance"}
                      </span>
                      <Link
                        href={`/mentors/${mentor.mentor_id ?? mentor.userId}`}
                        className="inline-flex items-center gap-1 font-bold text-indigo-650 hover:text-indigo-805"
                      >
                        <span>Book 1:1</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
