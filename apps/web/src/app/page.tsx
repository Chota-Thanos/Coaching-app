"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet, authenticatedPost } from "../components/auth/auth-context";
import { useSubscription } from "../lib/use-subscription";
import { browserBaseUrl, resolveMediaUrl } from "../lib/api";
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
  Loader2
} from "lucide-react";

export const dynamic = "force-dynamic";



export default function HomePage() {
  const router = useRouter();
  const { token, user, isInitialized } = useAuth();
  const { hasAnyActive, subscriptions, loading: loadingSub } = useSubscription(token);

  // Dynamic Subjects & Quick Test States
  const [objectiveSubjects, setObjectiveSubjects] = useState<any[]>([]);
  const [mainsSubjects, setMainsSubjects] = useState<any[]>([]);
  
  const [quickTestType, setQuickTestType] = useState<"gk" | "aptitude" | "mains">("gk");
  const [quickSelectedSubjects, setQuickSelectedSubjects] = useState<number[]>([]);
  const [quickNumQuestions, setQuickNumQuestions] = useState<number>(10);
  const [quickTestName, setQuickTestName] = useState<string>("");
  const [buildingQuickTest, setBuildingQuickTest] = useState(false);
  const [quickTestError, setQuickTestError] = useState<string | null>(null);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [topicMetrics, setTopicMetrics] = useState<any[]>([]);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userCollections, setUserCollections] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<any[]>([]);
  const [mentorshipRequests, setMentorshipRequests] = useState<any[]>([]);
  const [readingDashboard, setReadingDashboard] = useState<any>(null);

  // Quiz state removed — 'Start a Free Test' now goes directly to the real custom test builder
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Loading
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Dashboard tours removed

  const coverFallbacks = [
    "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop",
  ];

  // Fetch public current affairs preview
  useEffect(() => {
    const fetchPublicArticles = async () => {
      try {
        const res = await fetch(`${browserBaseUrl}/api/v1/current-affairs/frontend/articles?limit=3`);
        if (res.ok) {
          const data = await res.json();
          setLatestArticles(data.items || []);
        }
      } catch (err) {
        console.error("Failed to fetch public current affairs preview", err);
      } finally {
        setLoadingArticles(false);
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
  const heroTestHref = diagnosticTestId ? `/assessment/tests/${diagnosticTestId}` : "/assessment/custom-test/create";

  // Fetch student dashboard data when logged in
  useEffect(() => {
    if (!token) return;
    const fetchDashboardData = async () => {
      setLoadingDashboard(true);
      try {
        const statsData = await authenticatedGet<any>("/api/v1/assessment/me/dashboard", token);
        setStats(statsData);
        const metricsData = await authenticatedGet<any[]>("/api/v1/assessment/me/topic-metrics", token);
        setTopicMetrics(metricsData || []);
        const objNodes = await authenticatedGet<any[]>("/api/v1/assessment/taxonomy-nodes?exam_id=1&node_type=subject&limit=100", token);
        setObjectiveSubjects(objNodes || []);
        const mainsNodes = await authenticatedGet<any[]>("/api/v1/assessment/mains/taxonomy-nodes?exam_id=1&limit=100", token);
        setMainsSubjects(mainsNodes || []);
        const notesData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/articles?limit=3", token);
        setUserNotes(notesData || []);
        const collectionsData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/collections", token);
        setUserCollections(collectionsData || []);
        const mentorsData = await authenticatedGet<any[]>("/api/v1/mentorship/profiles", token);
        setMentors((mentorsData || []).slice(0, 3));
        const attemptsData = await authenticatedGet<any[]>("/api/v1/assessment/me/attempts?limit=10", token);
        setMyAttempts(attemptsData || []);
        const requestsData = await authenticatedGet<any[]>("/api/v1/mentorship/requests?mode=user", token);
        setMentorshipRequests(requestsData || []);
        const readingData = await authenticatedGet<any>("/api/v1/current-affairs/me/reading-dashboard?limit=5", token);
        setReadingDashboard(readingData || null);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoadingDashboard(false);
      }
    };
    fetchDashboardData();
  }, [token]);

  // Synchronize Quick Test subjects selection and name
  useEffect(() => {
    if (quickTestType === "gk") {
      const gk = objectiveSubjects.filter(n => n.content_type === "gk").map(n => n.id);
      setQuickSelectedSubjects(gk);
      setQuickTestName("Quick GS Practice Test");
    } else if (quickTestType === "aptitude") {
      const csat = objectiveSubjects.filter(n => n.content_type === "aptitude").map(n => n.id);
      setQuickSelectedSubjects(csat);
      setQuickTestName("Quick CSAT Practice Test");
    } else {
      const mains = mainsSubjects.filter(n => n.node_type === "paper" || n.node_type === "subject").map(n => n.id);
      setQuickSelectedSubjects(mains);
      setQuickTestName("Quick Mains Subjective Test");
    }
    setQuickTestError(null);
  }, [quickTestType, objectiveSubjects, mainsSubjects]);

  const handleCreateQuickTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSelectedSubjects.length === 0) {
      setQuickTestError("Select at least one subject to generate test.");
      return;
    }
    setBuildingQuickTest(true);
    setQuickTestError(null);
    try {
      const allPickedQuestionIds: number[] = [];

      // Step 1: Query and compile question pools for each selected subject
      for (const subjectId of quickSelectedSubjects) {
        let url = "";
        if (quickTestType === "mains") {
          url = `/api/v1/assessment/mains/questions?exam_id=1&topic_node_id=${subjectId}&limit=500`;
        } else {
          url = `/api/v1/assessment/questions?exam_id=1&content_type=${quickTestType}&subject_node_ids=${subjectId}&limit=500`;
        }

        const data = await authenticatedGet<any[]>(url, token || "");
        if (data && data.length > 0) {
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          // Allocate questions proportionally or evenly
          const perSubjectCount = Math.max(1, Math.round(quickNumQuestions / quickSelectedSubjects.length));
          const picked = shuffled
            .slice(0, Math.min(perSubjectCount, shuffled.length))
            .map((q) => q.id);
          allPickedQuestionIds.push(...picked);
        }
      }

      if (allPickedQuestionIds.length === 0) {
        throw new Error("No questions were found in the selected categories. Try checking other categories.");
      }

      // Slice to match the exact target quantity
      const finalPickedIds = allPickedQuestionIds.slice(0, quickNumQuestions);

      // Step 2: Create custom test
      const response = await authenticatedPost<{ id: number }>(
        "/api/v1/assessment/user/custom-tests",
        token || "",
        {
          title: quickTestName.trim() || `Quick ${quickTestType.toUpperCase()} Test`,
          exam_id: 1,
          exam_level_id: 1, // Fallback exam level
          question_ids: finalPickedIds,
          test_type: quickTestType === "mains" ? "mains_test" : "sectional_test"
        }
      );

      // Step 3: Start attempt
      const attemptId = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${response.id}/attempts/start`,
        token || "",
        {}
      );

      // Step 4: Navigate to attempts page
      router.push(`/assessment/attempts/${attemptId.id ?? attemptId}`);
    } catch (err: any) {
      setQuickTestError(err.message || "Failed to generate custom test.");
      setBuildingQuickTest(false);
    }
  };

  // Derived dashboard vars
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
  const mainsAvgScore = stats?.mains?.summary?.avg_score
    ? Number(stats.mains.summary.avg_score).toFixed(1)
    : null;
  const evaluationsPending = stats?.mains?.summary?.pending_count ?? 0;

  const motivationalQuotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Your UPSC preparation is a marathon, not a sprint. Consistency is key.",
    "Arise, awake, and stop not until the goal is reached.",
    "The secret of getting ahead is getting started. Make every practice count.",
    "Focus on your progress, not your perfection.",
  ];
  const quote = motivationalQuotes[username.length % motivationalQuotes.length];

  // ─── Continue where you left off — scans across every feature for activity ──
  const formatRelativeTime = (iso?: string | null) => {
    if (!iso) return "recently";
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffHours = Math.round(diffMs / 3_600_000);
    if (diffHours < 1) return "just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  };
  const formatSessionTime = (iso?: string | null) => {
    if (!iso) return "Scheduled";
    return new Date(iso).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" });
  };

  const inProgressAttempt = myAttempts.find((a) => a.status === "in_progress" && !a.result);
  const pendingEvalRequest = mentorshipRequests.find((r) => r.evaluation_status === "pending");
  const upcomingSession = [...mentorshipRequests]
    .filter((r) => r.session_status === "scheduled" && r.session_starts_at && new Date(r.session_starts_at) > new Date())
    .sort((a, b) => new Date(a.session_starts_at).getTime() - new Date(b.session_starts_at).getTime())[0];
  const continueReadingItem = readingDashboard?.continue_reading?.[0];
  const dueRevisionItem = readingDashboard?.due_revisions?.[0];

  type ActivityAccent = "accent" | "warning" | "danger" | "neutral";
  type ActivityCard = { id: string; title: string; meta: string; cta: string; href: string; accent: ActivityAccent };
  const activityCards: ActivityCard[] = [];
  if (inProgressAttempt) {
    activityCards.push({
      id: `attempt-${inProgressAttempt.id}`,
      title: inProgressAttempt.test_template?.title || "Practice test",
      meta: `In progress · started ${formatRelativeTime(inProgressAttempt.started_at)}`,
      cta: "Resume",
      href: `/assessment/attempts/${inProgressAttempt.id}`,
      accent: "accent",
    });
  }
  if (pendingEvalRequest) {
    activityCards.push({
      id: `eval-${pendingEvalRequest.id}`,
      title: "Mains answer in review",
      meta: `Submitted ${formatRelativeTime(pendingEvalRequest.updated_at || pendingEvalRequest.created_at)}`,
      cta: "View status",
      href: "/mentorship",
      accent: "warning",
    });
  }
  if (upcomingSession) {
    activityCards.push({
      id: `session-${upcomingSession.session_id}`,
      title: `Session with ${upcomingSession.mentor_name || "your mentor"}`,
      meta: formatSessionTime(upcomingSession.session_starts_at),
      cta: "View details",
      href: "/mentorship",
      accent: "accent",
    });
  }
  if (continueReadingItem) {
    const pct = Math.round(Number(continueReadingItem.reading_progress?.progress_percent ?? 0));
    activityCards.push({
      id: `reading-${continueReadingItem.id}`,
      title: continueReadingItem.master_article?.title || "Article",
      meta: `${pct}% read`,
      cta: "Continue reading",
      href: `/current-affairs/articles/${continueReadingItem.master_article?.slug}`,
      accent: "neutral",
    });
  }
  if (dueRevisionItem) {
    activityCards.push({
      id: `revision-${dueRevisionItem.id}`,
      title: dueRevisionItem.master_article?.title || "Article",
      meta: "Revision due",
      cta: "Revise now",
      href: `/current-affairs/articles/${dueRevisionItem.master_article?.slug}`,
      accent: "danger",
    });
  }

  const hasAnyActivity =
    totalMCQ > 0 ||
    userNotes.length > 0 ||
    userCollections.length > 0 ||
    mentorshipRequests.length > 0 ||
    (readingDashboard?.stats?.saved_articles ?? 0) > 0;

  // Category-level extremes table — highest/lowest performing topics across
  // gk, csat and mains, reusing the already-fetched per-user topic metrics.
  const accuracyPct = (raw: unknown) => {
    const acc = Number(raw ?? 0);
    return acc <= 1 ? Math.round(acc * 100) : Math.round(acc);
  };
  const rankedTopics = topicMetrics.filter((t: any) => Number(t.question_count ?? 0) >= 3);
  const highestTopics = [...rankedTopics]
    .sort((a: any, b: any) => accuracyPct(b.avg_accuracy) - accuracyPct(a.avg_accuracy))
    .slice(0, 2);
  const lowestTopics = [...rankedTopics]
    .sort((a: any, b: any) => accuracyPct(a.avg_accuracy) - accuracyPct(b.avg_accuracy))
    .slice(0, 2);

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
      <main className="min-h-screen bg-white">

        {/* Quiz modal removed — CTA buttons now link directly to real features */}

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 1 · HERO
        ───────────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-ink text-white">
          {/* Ambient glow — CSS only, no external images */}
          <div className="absolute -top-32 -right-40 h-[600px] w-[600px] rounded-full bg-civic/10 blur-[140px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-32 h-[350px] w-[350px] rounded-full bg-brand/8 blur-[100px] pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-22 lg:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

              {/* ── Copy ── */}
              <div className="lg:col-span-7 space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  India's Complete UPSC Preparation Platform
                </div>

                <h1 className="text-4xl font-black sm:text-5xl md:text-6xl tracking-tight text-white leading-[1.1]">
                  Prepare Smarter.<br />
                  <span className="text-indigo-400">Clear UPSC.</span>
                </h1>

                <p className="text-sm sm:text-base text-white/55 max-w-xl leading-relaxed">
                  Free daily current affairs · Custom practice tests by topic · Smart notes workspace · 1:1 mentorship from verified UPSC toppers.
                </p>

                {/* Trust badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md">
                  {[
                    "Current Affairs — Always Free",
                    "3 Free Practice Tests / Month",
                    "10 Notes Free per Repository",
                    "Verified Topper Mentorship",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-white/65">{item}</span>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Link
                    href={diagnosticTestId ? `/assessment/tests/${diagnosticTestId}` : "/assessment/custom-test/create"}
                    className="touch-target inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xl bg-civic px-7 font-bold text-white hover:bg-civic/85 transition gap-2 text-sm shadow-lg shadow-civic/20"
                    id="hero-start-free-test"
                  >
                    <Target className="h-4 w-4" />
                    Take Free Diagnostic Test
                  </Link>
                  <Link
                    href="/assessment/custom-test/create"
                    className="touch-target inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xl border border-white/15 bg-white/6 px-6 font-bold text-white hover:bg-white/12 transition gap-2 text-sm"
                    id="hero-build-custom"
                  >
                    <BookOpen className="h-4 w-4" />
                    Build Custom Test
                  </Link>
                </div>
                <p className="text-xs text-white/35 pt-1">
                  No account needed for the diagnostic test ·{" "}
                  <Link href="/register" className="text-white/55 hover:text-white underline underline-offset-2 transition">
                    Create free account →
                  </Link>
                </p>

                {/* Stats */}
                <div className="flex items-center gap-6 pt-3 border-t border-white/8">
                  <div className="text-center">
                    <p className="text-lg font-black text-white">10,000+</p>
                    <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Aspirants</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-black text-white">120+</p>
                    <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Verified Mentors</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-black text-white">50,000+</p>
                    <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Tests Taken</p>
                  </div>
                </div>
              </div>

              {/* ── App Preview Panel ── */}
              <div className="lg:col-span-5 relative hidden lg:block">
                <div className="absolute -inset-4 rounded-3xl bg-civic/12 blur-2xl z-0" />
                <div className="relative rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-md shadow-2xl z-10 space-y-4">
                  {/* Window chrome */}
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="ml-auto text-[10px] font-bold text-white/45 bg-white/8 px-2.5 py-0.5 rounded-md uppercase tracking-wider">Live Dashboard</span>
                  </div>

                  {/* Radar mock */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60">UPSC Subject Radar</span>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">88% Avg</span>
                  </div>
                  <div className="flex justify-center">
                    <svg width="110" height="110" viewBox="0 0 110 110" className="overflow-visible">
                      <polygon points="55,8 92,30 92,80 55,102 18,80 18,30" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
                      <polygon points="55,22 78,37 78,73 55,88 32,73 32,37" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                      <polygon points="55,14 86,38 80,78 55,96 30,76 24,38" fill="rgba(79,70,229,0.28)" stroke="rgba(129,140,248,0.75)" strokeWidth="2"/>
                      {[{cx:55,cy:14},{cx:86,cy:38},{cx:80,cy:78},{cx:55,cy:96},{cx:30,cy:76},{cx:24,cy:38}].map((p,i) => (
                        <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="rgba(129,140,248,0.75)"/>
                      ))}
                    </svg>
                  </div>

                  {/* Progress bars */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[{label:"Polity",val:85,color:"bg-civic"},{label:"Economy",val:78,color:"bg-emerald-500"},{label:"History",val:72,color:"bg-saffron"},{label:"Geography",val:90,color:"bg-brand"}].map(s => (
                      <div key={s.label} className="rounded-lg bg-white/5 border border-white/5 p-2.5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-white/50 font-bold">
                          <span>{s.label}</span><span>{s.val}%</span>
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{width:`${s.val}%`}} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick action row */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
                    {[{icon:Target,label:"GS Test"},{icon:Newspaper,label:"News"},{icon:NotebookPen,label:"Notes"}].map(({icon:Icon,label}) => (
                      <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-2 border border-white/5">
                        <Icon className="h-4 w-4 text-white/45" />
                        <span className="text-[9px] font-bold text-white/45">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 2 · SELF-PREPARATION
        ───────────────────────────────────────────────────────────────────── */}
        <section id="self-prep" className="bg-white section-showcase">
          <div className="mx-auto max-w-7xl">
            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-civic/10 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-civic" />
                  </div>
                  <span className="text-xs font-black text-civic uppercase tracking-widest">Self-Preparation</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">3 Free Tests / Month</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Practice Smart. Track Deeper.
                </h2>
                <p className="text-sm text-slate-500 max-w-lg">
                  Build custom GS &amp; CSAT tests, track topic-wise accuracy, and identify your weak areas with intelligent analytics.
                </p>
              </div>
              <Link href="/assessment/custom-test/create?start_tour=true" className="shrink-0 touch-target inline-flex items-center gap-2 rounded-xl bg-civic px-5 py-2.5 text-sm font-bold text-white hover:bg-civic/90 transition-colors">
                Start Practising Free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: Mock dashboard */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-700">Custom Test Builder</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Free</span>
                </div>

                {/* Topic chip selector mock */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {["Polity","Economy","History","Geography","Environment","Science & Tech","Ethics"].map((t, i) => (
                      <span key={t} className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-default ${i < 3 ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                        {t} {i < 3 && "✓"}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Q count */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Number of Questions</p>
                  <div className="flex items-center gap-2">
                    {[5,10,20,30,50].map(n => (
                      <span key={n} className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-default ${n === 10 ? "bg-indigo-600 text-white" : n > 10 ? "bg-slate-100 text-slate-400 relative" : "bg-slate-100 text-slate-600"}`}>
                        {n}
                        {n > 10 && <Lock className="h-2.5 w-2.5 absolute -top-1 -right-1 text-slate-400" />}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Free tier: up to 10 questions · Upgrade for unlimited</p>
                </div>

                <Link
                  href="/assessment/custom-test/create"
                  className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  Build My Custom Test →
                </Link>

                {/* Tag for revision row */}
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <Tag className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-700 font-semibold">Tag questions for a revision test later</span>
                </div>
              </div>

              {/* Right: Features + premium preview */}
              <div className="space-y-5">
                {/* Feature list */}
                <div className="space-y-3">
                  {[
                    { icon: Target, title: "Topic-wise Practice", desc: "Questions mapped to every UPSC syllabus topic for Prelims & Mains", free: true },
                    { icon: BarChart3, title: "Performance Analytics", desc: "Track strong/weak areas with accuracy graphs per subject", free: true },
                    { icon: Tag, title: "Tag & Revise", desc: "Tag difficult questions and generate a focused revision test", free: true },
                    { icon: TrendingUp, title: "Advanced AI Tracking", desc: "Deep topic-wise trend analysis across GS papers", free: false },
                    { icon: FileCode, title: "Photo/PDF Import", desc: "Add questions from photos or PDFs via OCR (5 imports/month free)", free: false },
                  ].map(({ icon: Icon, title, desc, free }) => (
                    <div key={title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${free ? "bg-civic/10 text-civic" : "bg-slate-100 text-slate-400"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800">{title}</p>
                          {free
                            ? <span className="badge-free">Free</span>
                            : <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Premium</span>
                          }
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Premium teaser */}
                <div className="relative rounded-xl overflow-hidden border border-slate-100">
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-ink text-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-widest">Premium Analytics</span>
                      <Lock className="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 opacity-60 blur-[2px] pointer-events-none select-none">
                      {["Polity 6-Month Trend","GS1 Topic Map","Weak Area Drill"].map(l => (
                        <div key={l} className="bg-white/10 rounded-lg p-2 text-center">
                          <div className="text-[9px] font-bold text-indigo-300">{l}</div>
                          <div className="h-8 bg-indigo-500/30 rounded mt-1" />
                        </div>
                      ))}
                    </div>
                    <Link href="/register" className="mt-3 w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-colors">
                      <Zap className="h-3.5 w-3.5" /> Unlock Premium Analytics
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 3 · CURRENT AFFAIRS (ALWAYS FREE)
        ───────────────────────────────────────────────────────────────────── */}
        <section id="current-affairs" className="bg-slate-50 section-showcase">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Newspaper className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Current Affairs</span>
                  <span className="badge-free">
                    <Unlock className="h-3 w-3" />
                    Always Free · No Daily Limit
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Stay Current. Stay Ahead.
                </h2>
                <p className="text-sm text-slate-500 max-w-lg">
                  Subject &amp; topic-tagged daily current affairs for Prelims and Mains. De-duplicated. Connected topics linked. <strong>No login required. No daily limit. Always free.</strong>
                </p>
              </div>
              <Link href="/current-affairs/daily-news" className="shrink-0 touch-target inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
                Read Today's News <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Live articles preview */}
            {loadingArticles ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse rounded-2xl bg-white border border-slate-100 p-4 h-64 space-y-3">
                    <div className="bg-slate-200 h-36 rounded-xl" />
                    <div className="bg-slate-200 h-4 w-2/3 rounded" />
                    <div className="bg-slate-200 h-4 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {latestArticles.map((article, idx) => {
                  const cover = resolveMediaUrl(article.primary_asset?.file_url) || coverFallbacks[idx % coverFallbacks.length];
                  const catName = article.category?.name ?? "General Studies";
                  const articleDate = article.publication_date
                    ? new Date(article.publication_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                    : "Latest";
                  return (
                    <Link
                      key={article.id}
                      href={`/current-affairs/articles/${article.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="h-40 w-full overflow-hidden bg-slate-50 relative">
                        <img src={cover} alt={article.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        <span className="absolute left-3 top-3 rounded-lg bg-ink/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">{catName}</span>
                        <span className="absolute right-3 top-3 badge-free">Free</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 mb-1">{articleDate}</p>
                          <h3 className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-2 group-hover:text-emerald-800 transition-colors">{article.title}</h3>
                          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">{article.seo_description || article.body?.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-black text-emerald-600 group-hover:text-emerald-800">
                          <span>Read free brief</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {latestArticles.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
                    <Newspaper className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-400">Today's articles are being published. Check back shortly.</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 text-center">
              <Link href="/current-affairs/daily-news" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-800 hover:underline">
                Browse all current affairs — always free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 4 · NOTES-MAKING
        ───────────────────────────────────────────────────────────────────── */}
        <section id="notes-making" className="bg-white section-showcase">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <NotebookPen className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Notes-Making</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Free: 10 Articles / Repo</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Build Your Personal Knowledge Base
                </h2>
                <p className="text-sm text-slate-500 max-w-lg">
                  Import current affairs articles into organized repositories. Add revision notes. Tag by exam category. Recall fast on exam day.
                </p>
              </div>
              <Link href="/register" className="shrink-0 touch-target inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors">
                Build Your First Repo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: Notes workspace mock */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden">
                {/* Header bar */}
                <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-800">My Repositories</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">2 / 1 active (free)</span>
                </div>

                {/* Repo list */}
                <div className="p-4 space-y-2">
                  {[
                    { name: "Polity & Governance", count: 8, tag: "Prelims" },
                    { name: "Environment & Ecology", count: 10, tag: "Both" },
                    { name: "International Relations", count: 3, tag: "Mains", locked: true },
                  ].map(repo => (
                    <div key={repo.name} className={`flex items-center justify-between rounded-xl border px-3.5 py-3 bg-white ${repo.locked ? "opacity-60 border-dashed border-slate-200" : "border-slate-150"}`}>
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <FolderOpen className="h-4 w-4 text-indigo-600" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{repo.name}</p>
                          <p className="text-[10px] text-slate-400">{repo.count} articles · {repo.tag}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{repo.tag}</span>
                        {repo.locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                      </div>
                    </div>
                  ))}

                  {/* Import button */}
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 px-3.5 py-3 bg-indigo-50/30 cursor-default">
                    <span className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Plus className="h-4 w-4 text-indigo-600" />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-indigo-700">Import from Current Affairs</p>
                      <p className="text-[10px] text-indigo-400">Click any article → "Add to Notes"</p>
                    </div>
                  </div>

                  {/* Bulk import — premium locked */}
                  <div className="relative rounded-xl border border-dashed border-slate-200 px-3.5 py-3 bg-slate-50 overflow-hidden">
                    <div className="opacity-40 flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-purple-600" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Bulk Import All Articles</p>
                        <p className="text-[10px] text-slate-400">Import entire category at once</p>
                      </div>
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Premium
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Feature list */}
              <div className="space-y-4">
                <div className="space-y-3">
                  {[
                    { icon: FolderOpen, title: "Multiple Repositories", desc: "Organize notes into separate repos by exam, subject, or time period", free: true },
                    { icon: Import, title: "Import Articles", desc: "One-click import from current affairs into your chosen repository", free: true },
                    { icon: NotebookPen, title: "Quick Revision Lines", desc: "Add 3–5 revision bullets per article for exam-day quick recall", free: true },
                    { icon: Tag, title: "Tag Filtering", desc: "Tag repos by Prelims, Mains, or custom labels for rapid filtering", free: true },
                    { icon: Layers, title: "Bulk Import", desc: "Import an entire category of articles at once into any repo", free: false },
                    { icon: BrainCircuit, title: "Auto-Connected Topics", desc: "AI auto-links related topics across all your repositories", free: false },
                  ].map(({ icon: Icon, title, desc, free }) => (
                    <div key={title} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${free ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{title}</p>
                          {free
                            ? <span className="badge-free">Free</span>
                            : <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Premium</span>
                          }
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-indigo-800">Free tier: 10 articles per repository</p>
                    <p className="text-xs text-indigo-500 mt-0.5">Upgrade to Module Plan for unlimited notes &amp; bulk imports</p>
                  </div>
                  <Link href="/register" className="shrink-0 text-xs font-bold text-indigo-600 hover:underline whitespace-nowrap">
                    Start Free →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 5 · MENTORSHIP SPOTLIGHT (full-width dark band)
        ───────────────────────────────────────────────────────────────────── */}
        <section id="mentorship" className="spotlight-band text-white">
          <div className="mx-auto max-w-7xl">
            {/* Header */}
            <div className="text-center mb-10 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3.5 py-1 text-xs font-bold text-white/65">
                <GraduationCap className="h-3.5 w-3.5" />
                Mentorship &amp; Evaluations
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                Real Guidance from Verified UPSC Toppers
              </h2>
              <p className="text-sm text-indigo-200/80 max-w-xl mx-auto">
                Connect with 120+ verified mentors across India. Get Mains answer evaluations, study strategy guidance, and 1:1 sessions.
              </p>
            </div>

            {/* Flow diagram */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-12">
              {[
                { icon: MessageSquare, label: "Set Agenda", desc: "Tell your mentor your goals" },
                { icon: CheckCircle, label: "Agree Terms", desc: "Define scope & deliverables" },
                { icon: CreditCard, label: "Safe Payment", desc: "Escrow-protected transaction" },
                { icon: GraduationCap, label: "Connect", desc: "Zoom session or async eval" },
              ].map(({ icon: Icon, label, desc }, idx, arr) => (
                <div key={label} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                  <div className="flow-step">
                    <div className="flow-step-icon">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-xs font-black text-white">{label}</p>
                    <p className="text-[10px] text-indigo-300 max-w-[80px]">{desc}</p>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-white/30 rotate-90 sm:rotate-0 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
              {/* Left: Sample eval CTA + social proof */}
              <div className="lg:col-span-2 space-y-5">
                {/* Trust block */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                  <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-white">120+ Verified Mentors</p>
                    <p className="text-xs text-indigo-300">IAS/IPS Officers, UPSC Interview Qualifiers &amp; Subject Experts</p>
                  </div>
                </div>

                {/* Star rating */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">4.9 / 5 avg rating</p>
                    <p className="text-xs text-indigo-300">From 2,400+ mentor sessions</p>
                  </div>
                </div>

                {/* Key CTAs */}
                <Link
                  href="/mentorship/sample-evaluation"
                  className="touch-target block w-full rounded-xl bg-white text-slate-900 px-5 py-3 text-sm font-bold hover:bg-indigo-50 transition-colors text-center"
                  id="mentorship-sample-eval"
                >
                  📄 View a Sample Evaluated Mains Answer
                </Link>
                <Link
                  href="/mentors"
                  className="touch-target block w-full rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/20 transition-colors text-center"
                >
                  Browse All Mentors <ArrowRight className="h-4 w-4 inline ml-1" />
                </Link>
              </div>

              {/* Right: Mentor cards */}
              <div className="lg:col-span-3 snap-scroll-x lg:grid lg:grid-cols-3 gap-4 lg:overflow-x-visible">
                {mentors.length > 0 ? mentors.map((mentor, idx) => {
                  const avatarFallbacks = [
                    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop",
                    "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop",
                    "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop",
                  ];
                  const avatar = mentor.profile_image_url || avatarFallbacks[idx % avatarFallbacks.length];
                  return (
                    <Link
                      key={mentor.id}
                      href={`/mentors/${mentor.id}`}
                      className="w-[260px] lg:w-auto flex-shrink-0 flex flex-col rounded-2xl bg-white/8 border border-white/10 p-4 hover:bg-white/12 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <img src={avatar} alt={mentor.display_name} className="h-12 w-12 rounded-xl object-cover border border-white/20 shrink-0" loading="lazy" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-white truncate">{mentor.display_name}</p>
                            {mentor.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                          </div>
                          <p className="text-[10px] font-bold text-indigo-300 truncate">{mentor.years_experience > 0 ? `${mentor.years_experience} Yrs Exp.` : "UPSC Expert"}</p>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-200/70 line-clamp-2 italic flex-1">"{mentor.headline || "IAS Coach & Mentor for UPSC CSE Mains & Interview."}"</p>
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300">1:1 Sessions</span>
                        <span className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded">Book →</span>
                      </div>
                    </Link>
                  );
                }) : (
                  // Placeholder mentor cards
                  [{name:"Aditya Sharma",role:"IAS 2023 · AIR 12",exp:"2 Yrs"},{name:"Priya Mehta",role:"IPS 2022 · Mains Expert",exp:"3 Yrs"},{name:"Rohan Gupta",role:"UPSC Prelims Topper",exp:"1 Yr"}].map(m => (
                    <div key={m.name} className="w-[260px] lg:w-auto flex-shrink-0 flex flex-col rounded-2xl bg-white/8 border border-white/10 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0">
                          <span className="text-white font-black text-lg">{m.name[0]}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-white">{m.name}</p>
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                          <p className="text-[10px] font-bold text-indigo-300">{m.exp} Experience</p>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-200/70 italic">{m.role}</p>
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300">1:1 Sessions</span>
                        <Link href="/mentors" className="text-[10px] font-bold text-white bg-white/10 px-2 py-0.5 rounded hover:bg-white/20 transition-colors">View →</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 6 · SUBSCRIPTION PRICING MATRIX
        ───────────────────────────────────────────────────────────────────── */}
        <section id="pricing" className="bg-slate-50 section-showcase">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Transparent Pricing — Always
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Plans for Every Stage of Your Journey
              </h2>
              <p className="text-sm text-slate-500">
                Start free. Upgrade only what you need. Current affairs reading is always free for everyone.
              </p>
            </div>

            {/* Mobile: snap carousel | Desktop: grid */}
            <div className="snap-scroll-x lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-x-visible">

              {/* FREE */}
              <div className="w-[85vw] sm:w-[340px] lg:w-auto flex-shrink-0 rounded-2xl border border-slate-150 bg-white p-6 shadow-sm flex flex-col">
                <div className="space-y-1 mb-4">
                  <h3 className="text-base font-black text-slate-800">Free Tier</h3>
                  <p className="text-xs text-slate-500">Core features to get started</p>
                </div>
                <div className="flex items-baseline mb-5">
                  <span className="text-3xl font-black text-slate-900">₹0</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 mb-5" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium flex-1">
                  {[
                    {t:"Current Affairs — Unlimited, Always Free", ok:true, highlight:true},
                    {t:"3 Custom Tests / Month (up to 10 Qs)", ok:true},
                    {t:"Notes: 10 Articles per Repository (free)", ok:true},
                    {t:"1 Active Notes Repository", ok:true},
                    {t:"Sample Mentor Evaluations", ok:true},
                    {t:"Advanced AI Analytics", ok:false},
                    {t:"Unlimited Tests & Questions", ok:false},
                  ].map(({t,ok,highlight}) => (
                    <li key={t} className={`flex items-start gap-2 ${highlight ? "font-bold text-emerald-700" : ok ? "" : "text-slate-350"}`}>
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${highlight ? "text-emerald-500" : ok ? "text-emerald-500" : "text-slate-200"}`} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 block w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-center font-bold text-slate-700 text-xs transition-colors">
                  Create Free Account
                </Link>
              </div>

              {/* SELF-PREP MODULE */}
              <div className="w-[85vw] sm:w-[340px] lg:w-auto flex-shrink-0 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm flex flex-col">
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800">Self-Prep Plan</h3>
                    <Target className="h-4 w-4 text-civic" />
                  </div>
                  <p className="text-xs text-slate-500">For serious mock practice</p>
                </div>
                <div className="flex items-baseline mb-5">
                  <span className="text-3xl font-black text-slate-900">₹499</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 mb-5" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium flex-1">
                  {[
                    {t:"Current Affairs — Unlimited, Always Free", ok:true, highlight:true},
                    {t:"Unlimited Custom Tests (No question limit)", ok:true},
                    {t:"Full GK & CSAT Sectional Mocks", ok:true},
                    {t:"Advanced Subject-wise Analytics Radar", ok:true},
                    {t:"AI Mains Answer Grading", ok:true},
                    {t:"Photo/PDF Question Import (unlimited)", ok:true},
                  ].map(({t,ok,highlight}) => (
                    <li key={t} className={`flex items-start gap-2 ${highlight ? "font-bold text-emerald-700" : ""}`}>
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${highlight ? "text-emerald-500" : "text-blue-500"}`} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 block w-full py-3 rounded-xl bg-civic/10 hover:bg-blue-100 text-center font-bold text-civic text-xs transition-colors">
                  Get Self-Prep Plan
                </Link>
              </div>

              {/* NOTES MODULE */}
              <div className="w-[85vw] sm:w-[340px] lg:w-auto flex-shrink-0 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm flex flex-col">
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800">Notes Plan</h3>
                    <NotebookPen className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="text-xs text-slate-500">For daily notes & workspace</p>
                </div>
                <div className="flex items-baseline mb-5">
                  <span className="text-3xl font-black text-slate-900">₹299</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 mb-5" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium flex-1">
                  {[
                    {t:"Current Affairs — Unlimited, Always Free", ok:true, highlight:true},
                    {t:"Unlimited Notes & Bulk Imports", ok:true},
                    {t:"Multiple Active Repositories (unlimited)", ok:true},
                    {t:"Bulk-import entire article categories", ok:true},
                    {t:"Auto-connected topics across repos", ok:true},
                    {t:"Add your own articles manually", ok:true},
                  ].map(({t,ok,highlight}) => (
                    <li key={t} className={`flex items-start gap-2 ${highlight ? "font-bold text-emerald-700" : ""}`}>
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${highlight ? "text-emerald-500" : "text-indigo-500"}`} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 block w-full py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-center font-bold text-indigo-700 text-xs transition-colors">
                  Get Notes Plan
                </Link>
              </div>

              {/* ALL-ACCESS PREMIUM */}
              <div className="w-[85vw] sm:w-[340px] lg:w-auto flex-shrink-0 rounded-2xl border-2 border-indigo-600 bg-ink p-6 shadow-xl flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider whitespace-nowrap">
                  Best Value
                </div>
                <div className="space-y-1 mb-4">
                  <h3 className="text-base font-black text-white">All-Access Premium</h3>
                  <p className="text-xs text-indigo-300">Everything, for serious UPSC prep</p>
                </div>
                <div className="flex items-baseline mb-5">
                  <span className="text-3xl font-black text-white">₹699</span>
                  <span className="text-xs font-semibold text-indigo-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-white/10 mb-5" />
                <ul className="space-y-3 text-xs text-indigo-100 font-medium flex-1">
                  {[
                    "Current Affairs — Unlimited, Always Free",
                    "Unlimited Tests + Advanced AI Tracking",
                    "Unlimited Notes + Auto-Connected Topics",
                    "2 Live Mentorship Sessions / Month",
                    "Priority Mains Evaluations",
                    "Photo/PDF Import (unlimited)",
                    "All future features included",
                  ].map(t => (
                    <li key={t} className={`flex items-start gap-2 ${t.includes("Always Free") ? "font-bold text-emerald-400" : ""}`}>
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${t.includes("Always Free") ? "text-emerald-400" : "text-indigo-400"}`} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-6 block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-center font-bold text-white text-xs transition-colors">
                  Unlock Everything
                </Link>
              </div>
            </div>

            {/* Always-free reminder */}
            <p className="mt-6 text-center text-xs text-slate-400 font-medium">
              📖 Current Affairs reading is free for everyone, forever — no account or payment required.
            </p>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 7 · TESTIMONIAL
        ───────────────────────────────────────────────────────────────────── */}
        <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-5">
            <div className="flex justify-center gap-1 text-amber-400">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-current" />)}
            </div>
            <blockquote className="text-base sm:text-xl font-bold italic text-slate-700 leading-relaxed">
              &ldquo;WayToIAS completely changed how I prepare. The custom test builder helped me target my weakest topics, and my mentor's Mains evaluation caught mistakes I'd been making for months. The current affairs section is superb — I read it every day for free.&rdquo;
            </blockquote>
            <div>
              <cite className="not-italic text-sm font-black text-slate-900">Aditya Verma</cite>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mt-0.5">IAS Officer (AIR 45, UPSC CSE 2025)</p>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 8 · FINAL CTA
        ───────────────────────────────────────────────────────────────────── */}
        <section className="bg-ink py-16 px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-2xl space-y-5">
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
        <div className="bg-ink border-t border-slate-800 pb-6 text-center">
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
  // LOGGED IN — STUDENT DASHBOARD (CSR — client-side rendered for real-time)
  // ═══════════════════════════════════════════════════════════════════════════

  // Derive top-2 weak topics for weak-area focus panel
  const weakTopics = [...topicMetrics]
    .sort((a, b) => Number(a.avg_accuracy ?? 0) - Number(b.avg_accuracy ?? 0))
    .slice(0, 2);

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">

      {/* Onboarding tour overlay removed */}

      {/* ══════════════════════════════════════════════════════
          DASHBOARD HEADER — greeting + status pills
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay">
          <img
            src="https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-indigo-900/95 to-indigo-900/80 z-0" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 backdrop-blur-sm border border-indigo-500/10">
                <Sparkles className="h-3 w-3 animate-pulse" />
                <span>WayToIAS Dashboard</span>
              </div>
              <h1 className="text-2xl font-black md:text-3xl tracking-tight text-white leading-tight">
                Namaste, {username}! 👋
              </h1>
              <p className="text-xs text-indigo-200/80 italic font-medium max-w-md">&ldquo;{quote}&rdquo;</p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-md">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 ${hasAnyActive ? "bg-emerald-600" : "bg-amber-500"}`}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Plan</p>
                  {loadingSub ? (
                    <p className="text-xs text-indigo-200">…</p>
                  ) : hasAnyActive ? (
                    <p className="text-xs font-black text-emerald-400">Premium Active</p>
                  ) : (
                    <p className="text-xs font-black text-amber-400">Free Account</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-md">
                <div className="h-8 w-8 rounded-lg bg-civic flex items-center justify-center text-white shrink-0">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Tests</p>
                  <p className="text-xs font-black text-white">{totalMCQ > 0 ? `${totalMCQ} taken` : "None yet"}</p>
                </div>
              </div>
              {totalMCQ > 0 && (
                <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-md">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">GK Avg</p>
                    <p className="text-xs font-black text-white">{gkAccuracy}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — MENTORSHIP & EVALUATIONS (always top ribbon)
      ══════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-r from-slate-900 via-purple-950 to-ink border-b border-purple-900/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-800/60 border border-purple-700/40 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-white/65" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Mentorship &amp; Evaluations</p>
                {hasAnyActive ? (
                  <p className="text-[10px] text-white/65">You have active sessions — check pending evaluations &amp; upcoming calls</p>
                ) : (
                  <p className="text-[10px] text-purple-400">Connect with a topper · Book answer evaluation · Track your agenda</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/mentorship"
                className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 px-4 py-2 text-xs font-bold text-white transition-colors"
                id="mentorship-book-eval"
              >
                <Plus className="h-3.5 w-3.5" />
                Book Evaluation
              </Link>
              <Link
                href="/mentors"
                className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-purple-700/40 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-purple-200 transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Find Mentor
              </Link>
              <Link
                href="/mentorship/sample-evaluation"
                className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-purple-700/40 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-white/65 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Sample Eval
              </Link>
            </div>
          </div>

          {/* Real agenda summary — upcoming sessions + pending evaluations */}
          {mentorshipRequests.length > 0 && (
            <div className="mt-4 rounded-xl bg-white/5 border border-purple-800/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 flex items-center gap-4 text-xs">
                <span className="font-bold text-purple-200">
                  {mentorshipRequests.filter((r) => r.session_status === "scheduled" && r.session_starts_at && new Date(r.session_starts_at) > new Date()).length} upcoming session(s)
                </span>
                <span className="font-bold text-purple-200">
                  {mentorshipRequests.filter((r) => r.evaluation_status === "pending").length} evaluation(s) pending
                </span>
              </div>
              <Link
                href="/mentorship"
                className="shrink-0 text-xs font-black text-white/65 hover:text-white flex items-center gap-1"
              >
                View all sessions <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {/* Mobile quick-nav strip */}
        <div className="snap-scroll-x lg:hidden">
          {[
            { href: "/assessment/gk", icon: Target, label: "Self-Prep", color: "blue" },
            { href: "/current-affairs/daily-news", icon: Newspaper, label: "News", color: "emerald" },
            { href: "/current-affairs/workspace", icon: NotebookPen, label: "Notes", color: "indigo" },
            { href: "/mentors", icon: GraduationCap, label: "Mentors", color: "purple" },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link
              key={label}
              href={href}
              className="w-[140px] flex-shrink-0 group flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md transition-all"
            >
              <span className={`h-9 w-9 rounded-xl flex items-center justify-center bg-${color}-50 text-${color}-600 group-hover:scale-105 transition-transform`}>
                <Icon className="h-5 w-5" />
              </span>
              <p className={`text-xs font-bold text-slate-700 group-hover:text-${color}-700`}>{label}</p>
            </Link>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            NEW USER — zero activity anywhere: a single discovery grid
            across all 5 feature areas, replacing the activity + performance
            sections below (which have nothing to show yet).
        ══════════════════════════════════════════════════════ */}
        {!loadingDashboard && !hasAnyActivity && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Welcome, let&rsquo;s set up your prep</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Pick a starting point below — your progress and focus areas will start showing up here once you do.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { href: "/assessment/gk", icon: Target, title: "Take a test", desc: "Build a custom GK, CSAT, or Mains test from any topic.", cta: "Start a GK test" },
                { href: "/study-plans", icon: Layers, title: "Follow a study plan", desc: "Structured week-by-week prep with tests included.", cta: "Browse plans" },
                { href: "/assessment/mains-hub", icon: FileText, title: "Get an answer evaluated", desc: "Expert feedback on your Mains answers.", cta: "Submit an answer" },
                { href: "/current-affairs/daily-news", icon: Newspaper, title: "Read current affairs", desc: "Daily news, editorials, and PYQs, organized into notes.", cta: "Read today's news" },
              ].map(({ href, icon: Icon, title, desc, cta }) => (
                <Link
                  key={title}
                  href={href}
                  className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all"
                >
                  <span className="h-10 w-10 rounded-xl bg-civic/10 text-civic flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-black text-slate-800">{title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-snug flex-1">{desc}</p>
                  <span className="mt-3 text-xs font-black text-civic flex items-center gap-1 group-hover:underline">
                    {cta} <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
              <Link
                href="/mentors"
                className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all sm:col-span-2"
              >
                <span className="h-10 w-10 rounded-xl bg-civic/10 text-civic flex items-center justify-center mb-3">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <p className="text-sm font-black text-slate-800">Talk to a mentor</p>
                <p className="mt-1 text-xs text-slate-500 leading-snug">1:1 sessions with mentors who&rsquo;ve cleared the exam.</p>
                <span className="mt-3 text-xs font-black text-civic flex items-center gap-1 group-hover:underline">
                  Find a mentor <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            CONTINUE WHERE YOU LEFT OFF — scans every feature area for
            anything in progress: a live test attempt, a pending mains
            evaluation, an upcoming mentor session, an unfinished read,
            or a due revision.
        ══════════════════════════════════════════════════════ */}
        {hasAnyActivity && activityCards.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800">Continue where you left off</h2>
              <Link href="/assessment/gk?view=performance&perf=tests" className="text-sm font-bold text-indigo-600 hover:underline">
                View all tests →
              </Link>
            </div>
            <div className="snap-scroll-x">
              {activityCards.map((card) => {
                const accentClasses: Record<ActivityAccent, string> = {
                  accent: "bg-civic",
                  warning: "bg-amber-500",
                  danger: "bg-rose-500",
                  neutral: "bg-slate-300",
                };
                return (
                  <div
                    key={card.id}
                    className="w-[240px] flex-shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className={`h-1 w-8 rounded-full mb-3 ${accentClasses[card.accent]}`} />
                    <p className="text-sm font-black text-slate-800 line-clamp-2 leading-snug">{card.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.meta}</p>
                    <Link
                      href={card.href}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-white transition-colors"
                    >
                      {card.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — MAIN WORKSPACE
            Left 2/3: Self-Preparation | Right 1/3: CA + Notes
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Self-Preparation (2/3) ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-civic/10 text-civic flex items-center justify-center">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-900">Self-Preparation</h2>
                  <p className="text-xs text-slate-500">GS tests, CSAT drills, Mains reviews &amp; revision</p>
                </div>
              </div>
              <Link
                href="/assessment/custom-test/create?start_tour=true"
                className="text-xs font-bold text-civic bg-civic/10 border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> How it works
              </Link>
            </div>

            {/* Quick Action Buttons */}
            <div id="tour-quick-actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: "/assessment/gk?view=performance&perf=tests", icon: Target, label: "My Tests", sub: "In-progress, scored & custom tests", color: "blue", primary: true, id: "tour-action-resume" },
                { href: "/assessment/gk?view=revision", icon: Bookmark, label: "Revision Test", sub: "Tagged questions only", color: "amber", primary: true, id: "tour-action-revision" },
                { href: "/assessment/csat", icon: BookOpenCheck, label: "CSAT Drill", sub: "Aptitude practice", color: "amber", primary: false, id: "tour-action-csat" },
                { href: "/assessment/mains-hub", icon: FileText, label: "Mains Hub", sub: "Upload & get evaluated", color: "purple", primary: false, id: "tour-action-mains" },
              ].map(({ href, icon: Icon, label, sub, color, primary, id }) => (
                <Link
                  key={label}
                  href={href}
                  id={id}
                  className={`group flex flex-col rounded-2xl p-4 border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
                    primary
                      ? `border-${color}-200 bg-${color}-50 hover:border-${color}-300`
                      : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2.5 ${
                    primary ? `bg-${color}-600 text-white` : `bg-${color}-50 text-${color}-600`
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-black text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{sub}</p>
                </Link>
              ))}
            </div>

            {/* Your performance — metric cards, category extremes table, focus areas */}
            {hasAnyActivity && (
              <div id="tour-gs-tracking" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-800">Your performance</h3>
                  <Link href="/assessment/dashboard" className="text-sm font-bold text-indigo-600 hover:underline">Full report →</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">GK accuracy</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{gkAttempts > 0 ? `${gkAccuracy}%` : "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">CSAT accuracy</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{csatAttempts > 0 ? `${csatAccuracy}%` : "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Mains avg score</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">
                      {mainsAvgScore !== null ? mainsAvgScore : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Evaluations pending</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{evaluationsPending}</p>
                  </div>
                </div>

                {(highestTopics.length > 0 || lowestTopics.length > 0) && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                      Category level extremes — lowest and highest performing topics
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left font-bold text-slate-400 text-xs uppercase pb-2 border-b border-slate-200">Performance</th>
                            <th className="text-left font-bold text-slate-400 text-xs uppercase pb-2 border-b border-slate-200">Category / topic</th>
                            <th className="text-left font-bold text-slate-400 text-xs uppercase pb-2 border-b border-slate-200">Level</th>
                            <th className="text-right font-bold text-slate-400 text-xs uppercase pb-2 border-b border-slate-200">Accuracy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {highestTopics.map((topic: any, i: number) => (
                            <tr key={`highest-${i}`} className="border-b border-slate-100">
                              <td className="py-3">
                                <span className="rounded bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1">Highest</span>
                              </td>
                              <td className="py-3">
                                <Link href={`/assessment/gk?topic=${encodeURIComponent(topic.taxonomy_name)}`} className="text-indigo-600 hover:underline font-semibold">
                                  {topic.taxonomy_name}
                                </Link>
                              </td>
                              <td className="py-3 text-slate-500">{(topic.node_type || "topic").replace(/_/g, " ")}</td>
                              <td className="py-3 text-right font-black text-slate-800">{accuracyPct(topic.avg_accuracy)}%</td>
                            </tr>
                          ))}
                          {lowestTopics.map((topic: any, i: number) => (
                            <tr key={`lowest-${i}`} className={i === lowestTopics.length - 1 ? "" : "border-b border-slate-100"}>
                              <td className="py-3">
                                <span className="rounded bg-rose-50 text-rose-700 text-xs font-bold px-2 py-1">Lowest</span>
                              </td>
                              <td className="py-3">
                                <Link href={`/assessment/gk?topic=${encodeURIComponent(topic.taxonomy_name)}`} className="text-indigo-600 hover:underline font-semibold">
                                  {topic.taxonomy_name}
                                </Link>
                              </td>
                              <td className="py-3 text-slate-500">{(topic.node_type || "topic").replace(/_/g, " ")}</td>
                              <td className="py-3 text-right font-black text-slate-800">{accuracyPct(topic.avg_accuracy)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div id="tour-weak-focus" className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-rose-600" />
                    <h3 className="text-base font-black text-slate-800">Focus areas</h3>
                  </div>
                  {weakTopics.length === 0 && !stats?.mains?.consistent_mistakes?.[0] ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
                      <BrainCircuit className="h-8 w-8 text-slate-200" />
                      <p className="text-sm font-bold text-slate-600">No weak areas identified</p>
                      <p className="text-xs text-slate-400">Take 1+ tests to detect problem topics</p>
                      <Link href="/assessment/gk" className="text-sm font-bold text-civic bg-civic/10 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors">
                        Take a test
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {weakTopics.map((topic, i) => {
                        const pct = accuracyPct(topic.avg_accuracy);
                        return (
                          <div key={`${topic.taxonomy_name}-${i}`} className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-rose-900 truncate">{topic.taxonomy_name}</p>
                              <p className="text-xs text-rose-700">{pct}% accuracy over {topic.question_count ?? 0} questions</p>
                            </div>
                            <Link
                              href={`/assessment/gk?topic=${encodeURIComponent(topic.taxonomy_name)}`}
                              className="shrink-0 ml-3 text-xs font-black text-rose-600 hover:underline flex items-center gap-0.5"
                            >
                              Practise <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        );
                      })}
                      {stats?.mains?.consistent_mistakes?.[0] && (
                        <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-rose-900 truncate">Mains — recurring feedback</p>
                            <p className="text-xs text-rose-700 truncate">
                              &ldquo;{stats.mains.consistent_mistakes[0].mistake}&rdquo; — flagged {stats.mains.consistent_mistakes[0].occurrence_count} times
                            </p>
                          </div>
                          <Link
                            href="/assessment/mains-hub"
                            className="shrink-0 ml-3 text-xs font-black text-rose-600 hover:underline flex items-center gap-0.5"
                          >
                            Review <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Custom Test Builder */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-800">Quick Custom Test Builder</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Generate and start a custom mock test instantly</p>
                </div>
              </div>

              <form onSubmit={handleCreateQuickTest} className="space-y-4">
                {/* 1. Test Type Selection */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Test Type</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    {[
                      { value: "gk", label: "GS Prelims" },
                      { value: "aptitude", label: "CSAT Drill" },
                      { value: "mains", label: "Mains subjective" }
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setQuickTestType(tab.value as any)}
                        className={`text-center py-2 text-xs font-black rounded-lg transition-all ${
                          quickTestType === tab.value
                            ? "bg-white text-slate-900 shadow-sm border border-slate-100"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Subjects Selector */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Include Subjects</label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                    {/* Render GK subjects */}
                    {quickTestType === "gk" && (
                      objectiveSubjects.filter(n => n.content_type === "gk").length > 0 ? (
                        objectiveSubjects.filter(n => n.content_type === "gk").map((sub) => {
                          const isChecked = quickSelectedSubjects.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                setQuickSelectedSubjects(prev =>
                                  prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                isChecked
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold"
                                  : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 p-2">Loading GK subjects...</p>
                      )
                    )}

                    {/* Render CSAT subjects */}
                    {quickTestType === "aptitude" && (
                      objectiveSubjects.filter(n => n.content_type === "aptitude").length > 0 ? (
                        objectiveSubjects.filter(n => n.content_type === "aptitude").map((sub) => {
                          const isChecked = quickSelectedSubjects.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                setQuickSelectedSubjects(prev =>
                                  prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                isChecked
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold"
                                  : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 p-2">Loading CSAT subjects...</p>
                      )
                    )}

                    {/* Render Mains subjects */}
                    {quickTestType === "mains" && (
                      mainsSubjects.filter(n => n.node_type === "paper" || n.node_type === "subject").length > 0 ? (
                        mainsSubjects.filter(n => n.node_type === "paper" || n.node_type === "subject").map((sub) => {
                          const isChecked = quickSelectedSubjects.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                setQuickSelectedSubjects(prev =>
                                  prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                isChecked
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold"
                                  : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-400 p-2">Loading Mains papers...</p>
                      )
                    )}
                  </div>
                </div>

                {/* 3. Questions Count & Title */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Question Count</label>
                    <div className="flex gap-2">
                      {[10, 25, 50, 100].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setQuickNumQuestions(count)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all ${
                            quickNumQuestions === count
                              ? "bg-ink border-slate-900 text-white"
                              : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Test Name</label>
                    <input
                      type="text"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-800 focus:outline-indigo-650"
                      placeholder="My Practice Test"
                      value={quickTestName}
                      onChange={(e) => setQuickTestName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Error log */}
                {quickTestError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 leading-relaxed">
                    ⚠️ {quickTestError}
                  </p>
                )}

                {/* Action button */}
                <button
                  type="submit"
                  disabled={buildingQuickTest}
                  className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-black text-white disabled:opacity-60 transition-colors shadow-sm"
                >
                  {buildingQuickTest ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating test and attempt...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create &amp; Start Custom Test
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

          {/* ── RIGHT: Current Affairs + Notes Sidebar (1/3) ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Current Affairs Daily Feed */}
            <section id="tour-daily-feed" className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-emerald-600" />
                  Daily Feed
                  <span className="badge-free">Free</span>
                </h2>
                <Link href="/current-affairs/daily-news" className="text-xs font-bold text-emerald-600 hover:underline">All →</Link>
              </div>
              {/* Category tabs */}
              <div className="snap-scroll-x px-3 pt-2.5 pb-2">
                {["Daily News", "Editorials", "Economy", "PIB"].map((cat, i) => (
                  <Link
                    key={cat}
                    href={`/current-affairs/${cat.toLowerCase().replace(" ", "-")}`}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold border ${i === 0 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300"}`}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
              {/* Article list */}
              <div className="divide-y divide-slate-100">
                {loadingArticles ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 rounded-lg bg-slate-100" />)}
                  </div>
                ) : latestArticles.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Newspaper className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                    Articles are being published. Check back shortly.
                  </div>
                ) : (
                  latestArticles.slice(0, 5).map((article, idx) => {
                    const catName = article.category?.name ?? "GS";
                    const articleDate = article.publication_date
                      ? new Date(article.publication_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                      : "Latest";
                    return (
                      <div key={article.id} className="flex items-start gap-2.5 px-4 py-3 group hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <Link href={`/current-affairs/articles/${article.slug}`}>
                            <p className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-emerald-700 leading-snug">{article.title}</p>
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{catName}</span>
                            <span className="text-[9px] text-slate-300">·</span>
                            <span className="text-[9px] text-slate-400">{articleDate}</span>
                          </div>
                        </div>
                        {/* Import to Notes button */}
                        <Link
                          href={`/current-affairs/workspace?import_article_id=${article.id}`}
                          title="Import to Notes"
                          className="shrink-0 h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors mt-0.5"
                          aria-label="Import to Notes"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 text-center">
                <Link href="/current-affairs/daily-news" className="text-xs font-bold text-emerald-600 hover:underline">
                  View all (always free) →
                </Link>
              </div>
            </section>

            {/* Notes Workspace */}
            <section id="tour-notes-workspace" className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-indigo-600" />
                  Notes Workspace
                </h2>
                <div className="flex items-center gap-2">
                  <Link
                    href="/current-affairs/workspace?start_tour=true"
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                  >
                    <Sparkles className="h-3 w-3" /> Tour
                  </Link>
                  <Link href="/current-affairs/workspace" className="text-xs font-bold text-indigo-600 hover:underline">
                    <PlusCircle className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                {userCollections.length > 0 ? (
                  <>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Repositories</p>
                    {userCollections.slice(0, 3).map((col: any) => (
                      <Link
                        key={col.id}
                        href={`/current-affairs/workspace?collection=${col.id}`}
                        className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                      >
                        <FolderOpen className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate flex-1">{col.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      </Link>
                    ))}
                  </>
                ) : (
                  <div className="py-4 text-center space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto pulse-ring">
                      <Plus className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No repositories yet</p>
                    <Link href="/current-affairs/workspace" className="text-xs font-bold text-indigo-600 hover:underline">Create your first →</Link>
                  </div>
                )}
              </div>
              {/* Revision Lines preview */}
              {userNotes.length > 0 && (
                <div id="tour-revision-lines" className="border-t border-slate-100 px-4 py-3 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recent Revision Lines</p>
                  {userNotes.slice(0, 2).map((note: any) => (
                    <Link
                      key={note.id}
                      href={`/current-affairs/workspace?note=${note.id}`}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200 transition-all"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 truncate flex-1">{note.title}</p>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Free: 10 articles / repo</span>
                <Link href="/current-affairs/workspace" className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-0.5">
                  New Note <Plus className="h-3 w-3" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            EXPLORE MORE — feature discovery for areas not yet used
        ══════════════════════════════════════════════════════ */}
        <section id="tour-study-plans" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Layers className="h-4 w-4 text-slate-500" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-700">Explore more</h2>
                <p className="text-sm text-slate-400">Other ways to prepare, beyond what you're already using</p>
              </div>
            </div>
          </div>
          <div className="snap-scroll-x lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-x-visible">
            {[
              { title: "Study plans", desc: "Structured week-by-week prep with tests built in.", cta: "Browse plans", href: "/study-plans", icon: Layers },
              { title: "Mentorship", desc: "1:1 sessions with mentors who've cleared the exam.", cta: "Find a mentor", href: "/mentors", icon: GraduationCap },
              { title: "Notes workspace", desc: "Turn daily current affairs into your own notes.", cta: "Start a note", href: "/current-affairs/workspace", icon: NotebookPen },
            ].map(({ title, desc, cta, href, icon: Icon }) => (
              <Link
                key={title}
                href={href}
                className="w-[85vw] sm:w-[300px] lg:w-auto flex-shrink-0 group flex flex-col justify-between rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-white p-4 hover:shadow-sm transition-all duration-200"
              >
                <div className="space-y-2">
                  <span className="h-8 w-8 rounded-lg bg-civic/10 text-civic flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-black text-slate-800 group-hover:text-slate-900">{title}</h3>
                  <p className="text-xs text-slate-500 leading-snug">{desc}</p>
                </div>
                <span className="mt-3 text-xs font-black text-civic flex items-center gap-0.5 group-hover:underline">
                  {cta} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
