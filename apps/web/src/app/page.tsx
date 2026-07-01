"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, authenticatedGet } from "../components/auth/auth-context";
import { useSubscription } from "../lib/use-subscription";
import { browserBaseUrl, resolveMediaUrl } from "../lib/api";
import { OnboardingTour, TourLauncherBanner } from "../components/app/onboarding-tour";
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
  AlertCircle
} from "lucide-react";

export const dynamic = "force-dynamic";

// ─── Sample quiz questions (no backend needed) ───────────────────────────────
const SAMPLE_QUIZ: { q: string; options: string[]; correct: number }[] = [
  {
    q: "Which Article of the Indian Constitution abolishes untouchability?",
    options: ["Article 14", "Article 17", "Article 21", "Article 25"],
    correct: 1,
  },
  {
    q: "The Preamble of the Indian Constitution was amended by which Constitutional Amendment?",
    options: ["42nd", "44th", "52nd", "86th"],
    correct: 0,
  },
  {
    q: "Which of the following is NOT a Fundamental Duty under Article 51A?",
    options: [
      "To protect the environment",
      "To pay taxes honestly",
      "To uphold the Constitution",
      "To develop scientific temper",
    ],
    correct: 1,
  },
  {
    q: "The term 'Secular' was inserted into the Preamble by the ____ Amendment.",
    options: ["40th", "42nd", "44th", "46th"],
    correct: 1,
  },
  {
    q: "Which Directive Principle relates to the organization of village panchayats?",
    options: ["Article 40", "Article 44", "Article 45", "Article 48"],
    correct: 0,
  },
];

export default function HomePage() {
  const { token, user, isInitialized } = useAuth();
  const { hasAnyActive, subscriptions, loading: loadingSub } = useSubscription(token);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [topicMetrics, setTopicMetrics] = useState<any[]>([]);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userCollections, setUserCollections] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);

  // Quiz widget states
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0); // 0 = intro, 1-5 = questions, 6 = result
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Loading
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Tour state (CSR — localStorage persisted per user)
  const [activeTour, setActiveTour] = useState<"test" | "notes" | null>(null);
  const [toursDismissed, setToursDismissed] = useState({ test: false, notes: false });
  useEffect(() => {
    setToursDismissed({
      test: localStorage.getItem("waytoias_tour_test_seen") === "1",
      notes: localStorage.getItem("waytoias_tour_notes_seen") === "1",
    });
  }, []);
  const handleTourClose = () => {
    if (activeTour) {
      localStorage.setItem(`waytoias_tour_${activeTour}_seen`, "1");
      setToursDismissed((prev) => ({ ...prev, [activeTour!]: true }));
    }
    setActiveTour(null);
  };
  const showTourBanner = !toursDismissed.test || !toursDismissed.notes;

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
        const notesData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/articles?limit=3", token);
        setUserNotes(notesData || []);
        const collectionsData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/collections", token);
        setUserCollections(collectionsData || []);
        const mentorsData = await authenticatedGet<any[]>("/api/v1/mentorship/profiles", token);
        setMentors((mentorsData || []).slice(0, 3));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoadingDashboard(false);
      }
    };
    fetchDashboardData();
  }, [token]);

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

  const motivationalQuotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Your UPSC preparation is a marathon, not a sprint. Consistency is key.",
    "Arise, awake, and stop not until the goal is reached.",
    "The secret of getting ahead is getting started. Make every practice count.",
    "Focus on your progress, not your perfection.",
  ];
  const quote = motivationalQuotes[username.length % motivationalQuotes.length];

  // Radar chart
  const radarSubjects = [
    { label: "Polity", slug: "polity" },
    { label: "Economy", slug: "economy" },
    { label: "History", slug: "history" },
    { label: "Geography", slug: "geography" },
    { label: "Environment", slug: "environment" },
    { label: "S & T", slug: "science" },
  ];
  const center = 110;
  const maxRadius = 70;
  const getCoordinates = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / 6;
    const r = maxRadius * (value / 100);
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle), angle };
  };
  const gridLevels = [25, 50, 75, 100];
  const gridPolygons = gridLevels.map((lvl) =>
    radarSubjects.map((_, i) => {
      const c = getCoordinates(i, lvl);
      return `${c.x},${c.y}`;
    }).join(" ")
  );
  const getSubjectAccuracy = (slug: string) => {
    const match = topicMetrics.find((m) => m.taxonomy_name.toLowerCase().includes(slug.toLowerCase()));
    if (!match) return 0;
    const acc = Number(match.avg_accuracy ?? 0);
    return acc <= 1 ? Math.round(acc * 100) : Math.round(acc);
  };
  const radarPoints = radarSubjects.map((s) => getSubjectAccuracy(s.slug));
  const hasRadarData = totalMCQ > 0 && radarPoints.some((p) => p > 0);
  const studentPointsString = radarSubjects.map((_, i) => {
    const c = getCoordinates(i, radarPoints[i] ?? 0);
    return `${c.x},${c.y}`;
  }).join(" ");

  // Quiz helpers
  const quizScore = answers.filter((a, i) => a === SAMPLE_QUIZ[i]?.correct).length;
  const handleQuizAnswer = (idx: number) => {
    setSelected(idx);
  };
  const handleNextQuestion = () => {
    const newAnswers = [...answers];
    newAnswers[quizStep - 1] = selected;
    setAnswers(newAnswers);
    setSelected(null);
    if (quizStep < SAMPLE_QUIZ.length) {
      setQuizStep(quizStep + 1);
    } else {
      setQuizStep(6); // result
    }
  };

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

        {/* ── QUIZ MODAL ───────────────────────────────────────────────────── */}
        {showQuiz && (
          <div className="quiz-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowQuiz(false); }}>
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Close button */}
              <button
                onClick={() => setShowQuiz(false)}
                className="absolute right-4 top-4 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Close quiz"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Intro screen */}
              {quizStep === 0 && (
                <div className="p-8 text-center space-y-6">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Target className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Free GS Diagnostic Quiz</h2>
                    <p className="mt-2 text-sm text-slate-500">5 questions · 2 minutes · No sign-up required</p>
                    <p className="mt-3 text-xs text-slate-400">Test your UPSC General Studies knowledge right now. After completing, you'll see your score and can create a free account to track your progress.</p>
                  </div>
                  <button
                    onClick={() => setQuizStep(1)}
                    className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors pulse-ring"
                  >
                    Start Free Quiz →
                  </button>
                </div>
              )}

              {/* Question screens */}
              {quizStep >= 1 && quizStep <= 5 && (
                <div className="p-6 space-y-5">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Question {quizStep} of 5</span>
                      <span>GS Polity</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${(quizStep / 5) * 100}%` }} />
                    </div>
                  </div>

                  {/* Question */}
                  <h3 className="text-base font-bold text-slate-800 leading-snug">
                    {SAMPLE_QUIZ[quizStep - 1]?.q}
                  </h3>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {SAMPLE_QUIZ[quizStep - 1]?.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuizAnswer(idx)}
                        className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                          selected === idx
                            ? "border-indigo-600 bg-indigo-50 text-indigo-800"
                            : "border-slate-150 bg-slate-50 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}
                      >
                        <span className="font-black mr-2 text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    disabled={selected === null}
                    className="w-full h-11 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {quizStep < 5 ? "Next Question →" : "See My Score →"}
                  </button>
                </div>
              )}

              {/* Results screen */}
              {quizStep === 6 && (
                <div className="p-8 text-center space-y-5">
                  <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center text-2xl font-black ${
                    quizScore >= 4 ? "bg-emerald-50 text-emerald-700" : quizScore >= 3 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                  }`}>
                    {quizScore}/5
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      {quizScore >= 4 ? "Excellent!" : quizScore >= 3 ? "Good Attempt!" : "Room to Improve!"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      You got <strong>{quizScore} out of 5</strong> correct.
                      {quizScore < 5 && " Sign up to see the correct answers and start tracking your weak topics."}
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-indigo-700">🎯 Create a free account to:</p>
                    <ul className="text-xs text-indigo-600 space-y-1 text-left">
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0" />See detailed answer explanations</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0" />Track your subject-wise accuracy</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0" />Claim 3 free custom tests per month</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 shrink-0" />Access unlimited current affairs (free forever)</li>
                    </ul>
                  </div>
                  <Link
                    href="/register"
                    className="block w-full h-12 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setShowQuiz(false)}
                  >
                    Create Free Account → Get Full Results
                  </Link>
                  <button
                    onClick={() => setShowQuiz(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Maybe later
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            SECTION 1 · HERO
        ───────────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-indigo-950 text-white">
          <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay">
            <img
              src="https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop"
              alt="UPSC Preparation"
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 via-indigo-950/90 to-indigo-950 z-0" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 md:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

              {/* ── Copy ── */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-bold text-indigo-300 backdrop-blur-sm border border-indigo-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                  <span>India's Complete UPSC Preparation Platform</span>
                </div>

                <h1 className="text-3xl font-black sm:text-5xl md:text-6xl tracking-tight text-white leading-tight">
                  Master GS Papers and Mains with{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                    Expert Mentorship
                  </span>{" "}
                  &amp; Smart Analytics
                </h1>

                <p className="text-sm sm:text-base text-indigo-200/90 max-w-xl leading-relaxed">
                  Free daily current affairs · Custom practice tests · Smart notes workspace · 1:1 mentorship from verified UPSC toppers.
                </p>

                {/* Trust badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-200">Current Affairs — Always Free</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-200">3 Free Practice Tests / Month</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-200">10 Notes Free per Repository</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded-full bg-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-200">Verified Topper Mentorship</span>
                  </div>
                </div>

                {/* Primary CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => { setQuizStep(0); setAnswers([null,null,null,null,null]); setSelected(null); setShowQuiz(true); }}
                    className="touch-target inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xl bg-white px-7 font-bold text-indigo-900 shadow-lg hover:bg-indigo-50 transition-all duration-200 gap-2 text-sm"
                    id="hero-start-free-test"
                  >
                    <Target className="h-4 w-4" />
                    Start a Free Test
                  </button>
                  <Link
                    href="/register"
                    className="touch-target inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 px-7 font-bold text-white transition-all duration-200 gap-2 text-sm"
                    id="hero-get-started"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#pricing"
                    className="touch-target inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-all duration-200 text-sm"
                  >
                    View Pricing
                  </a>
                </div>

                {/* Social proof ticker */}
                <div className="flex items-center gap-4 pt-2 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-lg font-black text-white">10,000+</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Aspirants</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-black text-white">120+</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Verified Mentors</p>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-black text-white">50,000+</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Tests Taken</p>
                  </div>
                </div>
              </div>

              {/* ── Hero Graphic Panel ── */}
              <div className="lg:col-span-5 relative hidden lg:block">
                <div className="absolute -inset-2 rounded-3xl bg-indigo-500/20 blur-2xl z-0" />
                <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-2xl z-10 space-y-4">
                  {/* Window chrome */}
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="ml-auto text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-md uppercase tracking-wider">Live Dashboard</span>
                  </div>

                  {/* Radar mock */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-200">UPSC Subject Radar</span>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">88% Avg</span>
                  </div>
                  <div className="flex justify-center">
                    <svg width="110" height="110" viewBox="0 0 110 110" className="overflow-visible">
                      <polygon points="55,8 92,30 92,80 55,102 18,80 18,30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                      <polygon points="55,22 78,37 78,73 55,88 32,73 32,37" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                      <polygon points="55,14 86,38 80,78 55,96 30,76 24,38" fill="rgba(99,102,241,0.35)" stroke="#818cf8" strokeWidth="2"/>
                      {[{cx:55,cy:14},{cx:86,cy:38},{cx:80,cy:78},{cx:55,cy:96},{cx:30,cy:76},{cx:24,cy:38}].map((p,i) => (
                        <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="#818cf8"/>
                      ))}
                    </svg>
                  </div>

                  {/* Progress bars */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[{label:"Polity",val:85,color:"bg-indigo-500"},{label:"Economy",val:78,color:"bg-emerald-500"},{label:"History",val:72,color:"bg-amber-500"},{label:"Geography",val:90,color:"bg-blue-500"}].map(s => (
                      <div key={s.label} className="rounded-lg bg-white/5 border border-white/5 p-2.5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-indigo-300 font-bold">
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
                        <Icon className="h-4 w-4 text-indigo-300" />
                        <span className="text-[9px] font-bold text-indigo-300">{label}</span>
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
                  <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Self-Preparation</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">3 Free Tests / Month</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Practice Smart. Track Deeper.
                </h2>
                <p className="text-sm text-slate-500 max-w-lg">
                  Build custom GS &amp; CSAT tests, track topic-wise accuracy, and identify your weak areas with intelligent analytics.
                </p>
              </div>
              <Link href="/register" className="shrink-0 touch-target inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
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

                <button className="w-full h-10 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
                  Generate Test →
                </button>

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
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${free ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
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
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white space-y-1">
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
                      href={`/current-affairs/articles/slug/${article.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="h-40 w-full overflow-hidden bg-slate-50 relative">
                        <img src={cover} alt={article.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        <span className="absolute left-3 top-3 rounded-lg bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">{catName}</span>
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
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3.5 py-1 text-xs font-bold text-purple-300">
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
                    <Target className="h-4 w-4 text-blue-600" />
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
                <Link href="/register" className="mt-6 block w-full py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-center font-bold text-blue-700 text-xs transition-colors">
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
              <div className="w-[85vw] sm:w-[340px] lg:w-auto flex-shrink-0 rounded-2xl border-2 border-indigo-600 bg-indigo-950 p-6 shadow-xl flex flex-col relative">
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
        <section className="bg-slate-900 py-16 px-4 sm:px-6 lg:px-8 text-center">
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
              <Link href="/current-affairs/daily-news" className="touch-target inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 px-8 text-sm font-bold text-slate-300 transition-colors">
                Read Today's News (Free)
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────
            STUDY PLANS — single line, footer placement only
        ───────────────────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border-t border-slate-800 pb-6 text-center">
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

      {/* ── Feature tour overlay ── */}
      {activeTour && <OnboardingTour type={activeTour} onClose={handleTourClose} />}

      {/* ══════════════════════════════════════════════════════
          DASHBOARD HEADER — greeting + status pills
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-indigo-950 text-white">
        <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay">
          <img
            src="https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-indigo-900/95 to-indigo-900/80 z-0" />
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
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
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
      <section className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 border-b border-purple-900/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-800/60 border border-purple-700/40 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-purple-300" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Mentorship &amp; Evaluations</p>
                {hasAnyActive ? (
                  <p className="text-[10px] text-purple-300">You have active sessions — check pending evaluations &amp; upcoming calls</p>
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
                className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-purple-700/40 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-purple-300 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Sample Eval
              </Link>
            </div>
          </div>

          {/* Agenda progress tracker (shown when subscribed) */}
          {hasAnyActive && (
            <div className="mt-4 rounded-xl bg-white/5 border border-purple-800/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-200">Mentorship Agenda Progress</span>
                  <span className="font-black text-white">2 / 5 sessions</span>
                </div>
                <div className="h-2 w-full bg-purple-900/60 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: "40%" }} />
                </div>
                <p className="text-[10px] text-purple-400">Next: GS1 Mains Answer Review — scheduled</p>
              </div>
              <Link
                href="/mentorship"
                className="shrink-0 text-xs font-black text-purple-300 hover:text-white flex items-center gap-1"
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

        {/* Feature Tour launcher (dismissable) */}
        {showTourBanner && (
          <TourLauncherBanner onLaunch={(type) => setActiveTour(type)} />
        )}

        {/* ── Zero-data Onboarding ── */}
        {totalMCQ === 0 && userNotes.length === 0 && userCollections.length === 0 && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-indigo-200" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black text-white">Welcome to WayToIAS, {username}!</h2>
                <p className="text-xs text-indigo-200 mt-1">Your prep workspace is ready. Start with the feature tours or jump straight into a test.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setActiveTour("test")}
                  className="touch-target text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-3.5 py-2 transition-colors flex items-center gap-1.5"
                >
                  <Target className="h-3.5 w-3.5" /> Test Tour
                </button>
                <button
                  onClick={() => setActiveTour("notes")}
                  className="touch-target text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-400 rounded-xl px-3.5 py-2 transition-colors flex items-center gap-1.5"
                >
                  <NotebookPen className="h-3.5 w-3.5" /> Notes Tour
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Self-Prep steps */}
              <div className="rounded-2xl border border-blue-100 bg-white p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5 text-blue-600" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-slate-900">Self-Preparation</h3>
                    <p className="text-xs text-slate-500">3 steps to your first score</p>
                  </div>
                  <button
                    onClick={() => setActiveTour("test")}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Full Tour
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number">1</div>
                      <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[2rem]" />
                    </div>
                    <div className="pb-4 flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">Take a Diagnostic Quiz</p>
                      <p className="text-xs text-slate-500 mt-0.5">A 10-question GS test to establish your subject baseline.</p>
                      <Link href="/assessment/gk" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors pulse-ring">
                        <Target className="h-3.5 w-3.5" /> Start Diagnostic →
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number">2</div>
                      <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[2rem]" />
                    </div>
                    <div className="pb-4 flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">Build a Custom GS Test</p>
                      <p className="text-xs text-slate-500 mt-0.5">Select topics, set question count, generate in seconds.</p>
                      <Link href="/assessment/gk" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                        <Layers className="h-3.5 w-3.5" /> Build Custom Test
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number">3</div>
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">View Your Radar</p>
                      <p className="text-xs text-slate-500 mt-0.5">After 1+ tests, your radar populates automatically.</p>
                      <Link href="/assessment/dashboard" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                        <BarChart3 className="h-3.5 w-3.5" /> Open Scorecard
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes-Making steps */}
              <div className="rounded-2xl border border-indigo-100 bg-white p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <NotebookPen className="h-5 w-5 text-indigo-600" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-slate-900">Notes-Making</h3>
                    <p className="text-xs text-slate-500">3 steps to your first repository</p>
                  </div>
                  <button
                    onClick={() => setActiveTour("notes")}
                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" /> Full Tour
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number" style={{ background: "#4f46e5" }}>1</div>
                      <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[2rem]" />
                    </div>
                    <div className="pb-4 flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">Read Current Affairs (Free)</p>
                      <p className="text-xs text-slate-500 mt-0.5">Browse today's news. No login wall, no limits.</p>
                      <Link href="/current-affairs/daily-news" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors">
                        <Newspaper className="h-3.5 w-3.5" /> Read News →
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number" style={{ background: "#4f46e5" }}>2</div>
                      <div className="w-0.5 flex-1 bg-slate-100 mt-1 min-h-[2rem]" />
                    </div>
                    <div className="pb-4 flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">Create Your First Repository</p>
                      <p className="text-xs text-slate-500 mt-0.5">Name it and import up to 10 articles free.</p>
                      <Link href="/current-affairs/workspace" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors pulse-ring">
                        <Plus className="h-3.5 w-3.5" /> Create Repository →
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="onboarding-step-number" style={{ background: "#4f46e5" }}>3</div>
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-800">Add Revision Lines</p>
                      <p className="text-xs text-slate-500 mt-0.5">Write 3–5 bullets per article for exam-day recall.</p>
                      <Link href="/current-affairs/workspace" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors">
                        <NotebookPen className="h-3.5 w-3.5" /> Open Workspace
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                <span className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-900">Self-Preparation</h2>
                  <p className="text-xs text-slate-500">GS tests, CSAT drills, Mains reviews &amp; revision</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTour("test")}
                className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> How it works
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div id="tour-quick-actions" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: "/assessment/gk", icon: Target, label: "Resume Test", sub: "Continue last GS test", color: "blue", primary: true, id: "tour-action-resume" },
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
                  <p className="text-xs font-black text-slate-800">{label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sub}</p>
                </Link>
              ))}
            </div>

            {/* GS Tracking + Weak Area Focus */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {/* GS paper tracking (3/5) */}
              <div id="tour-gs-tracking" className="sm:col-span-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800">GS Paper Tracking</h3>
                  <Link href="/assessment/dashboard" className="text-xs font-bold text-indigo-600 hover:underline">Full Report →</Link>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Prelims GS1 — Polity & Governance", slug: "polity" },
                    { label: "Prelims GS1 — Economy", slug: "economy" },
                    { label: "Prelims GS1 — Environment", slug: "environment" },
                    { label: "Prelims GS1 — History", slug: "history" },
                    { label: "Prelims GS1 — Geography", slug: "geography" },
                  ].map(({ label, slug }) => {
                    const acc = getSubjectAccuracy(slug);
                    const bar = acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-500" : "bg-rose-400";
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 truncate mr-2">{label}</span>
                          <span className={`font-black shrink-0 ${
                            acc === 0 ? "text-slate-300" : acc >= 70 ? "text-emerald-600" : acc >= 40 ? "text-amber-600" : "text-rose-600"
                          }`}>{acc > 0 ? `${acc}%` : "—"}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          {acc > 0 ? (
                            <div className={`h-full ${bar} rounded-full transition-all duration-500`} style={{ width: `${acc}%` }} />
                          ) : (
                            <div className="h-full w-full bg-slate-100 rounded-full" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalMCQ === 0 && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 font-semibold text-center">
                    Take your first test to start tracking accuracy here
                  </div>
                )}
              </div>

              {/* Weak Area Focus (2/5) */}
              <div id="tour-weak-focus" className="sm:col-span-2 rounded-2xl border border-rose-100 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-rose-600" />
                  <h3 className="text-sm font-black text-slate-800">Weak Area Focus</h3>
                </div>
                {weakTopics.length > 0 ? (
                  <div className="space-y-3">
                    {weakTopics.map((topic, i) => {
                      const acc = Number(topic.avg_accuracy ?? 0);
                      const pct = acc <= 1 ? Math.round(acc * 100) : Math.round(acc);
                      return (
                        <div key={topic.taxonomy_name} className="rounded-xl border border-rose-100 bg-rose-50 p-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-5 w-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</span>
                            <p className="text-xs font-bold text-rose-900 leading-snug line-clamp-1">{topic.taxonomy_name}</p>
                          </div>
                          <div className="h-1.5 w-full bg-rose-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-rose-700">{pct}% accuracy</span>
                            <Link
                              href={`/assessment/gk?topic=${encodeURIComponent(topic.taxonomy_name)}`}
                              className="text-[10px] font-black text-rose-600 hover:underline flex items-center gap-0.5"
                            >
                              Practise now <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 text-center">Updates after each test</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
                    <BrainCircuit className="h-8 w-8 text-slate-200" />
                    <p className="text-xs font-bold text-slate-600">No weak areas identified</p>
                    <p className="text-[10px] text-slate-400">Take 1+ tests to detect problem topics</p>
                    <Link href="/assessment/gk" className="text-xs font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors">
                      Take a Test
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* PDF/Photo Upload Zone */}
            <div id="tour-upload-zone" className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 flex flex-col sm:flex-row items-center gap-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 group cursor-pointer">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                <FileCode className="h-6 w-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-sm font-black text-slate-700 group-hover:text-blue-800">Drag &amp; Drop to Add Questions</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload a PDF or photo of any question paper — OCR extracts questions automatically</p>
                <p className="text-[10px] text-slate-400 mt-1">Free: 5 imports / month · Premium: Unlimited</p>
              </div>
              <Link
                href={hasAnyActive ? "/assessment/import" : "/pricing"}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                <FileCode className="h-3.5 w-3.5" />
                {hasAnyActive ? "Upload File" : "Upgrade to Import"}
              </Link>
            </div>

            {/* Subject Accuracy Radar */}
            <section id="tour-radar-chart" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                  Subject Accuracy Radar
                </h2>
                <Link href="/assessment/dashboard" className="text-xs font-bold text-indigo-600 hover:underline">Full Report</Link>
              </div>
              {!hasRadarData ? (
                <div className="flex flex-col items-center py-6 text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <BrainCircuit className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Radar Empty</h3>
                    <p className="mt-1 text-xs text-slate-500">Complete a practice test to start tracking subject accuracy.</p>
                  </div>
                  <Link href="/assessment/gk" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-bold text-white transition-colors">
                    Take First Test
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="flex justify-center">
                    <svg className="w-48 h-48" viewBox="0 0 220 220">
                      {gridPolygons.map((pts, i) => (
                        <polygon key={i} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2,2" />
                      ))}
                      {radarSubjects.map((_, i) => {
                        const oc = getCoordinates(i, 100);
                        return <line key={i} x1={center} y1={center} x2={oc.x} y2={oc.y} stroke="#e2e8f0" strokeWidth="1" />;
                      })}
                      <polygon points={studentPointsString} fill="rgba(79,70,229,0.16)" stroke="rgb(79,70,229)" strokeWidth="2" />
                      {radarSubjects.map((subj, i) => {
                        const c = getCoordinates(i, 100);
                        const lr = 88;
                        const lx = center + lr * Math.cos(c.angle);
                        const ly = center + lr * Math.sin(c.angle) + 4;
                        let anchor: "middle" | "start" | "end" = "middle";
                        if (Math.cos(c.angle) > 0.15) anchor = "start";
                        if (Math.cos(c.angle) < -0.15) anchor = "end";
                        return <text key={i} x={lx} y={ly} textAnchor={anchor} className="text-[9px] font-bold fill-slate-500">{subj.label}</text>;
                      })}
                    </svg>
                  </div>
                  <div className="space-y-2">
                    {radarSubjects.map((s, i) => {
                      const acc = radarPoints[i] ?? 0;
                      const bar = acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-500" : "bg-rose-500";
                      return (
                        <div key={s.slug} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">{s.label}</span>
                            <span className="font-black text-slate-800">{acc}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${acc}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
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
                          <Link href={`/current-affairs/articles/slug/${article.slug}`}>
                            <p className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-emerald-700 leading-snug">{article.title}</p>
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{catName}</span>
                            <span className="text-[9px] text-slate-300">·</span>
                            <span className="text-[9px] text-slate-400">{articleDate}</span>
                          </div>
                        </div>
                        {/* Import to Notes button */}
                        <button
                          onClick={() => setActiveTour("notes")}
                          id={idx === 0 ? "tour-import-btn" : undefined}
                          title="Import to Notes"
                          className="shrink-0 h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors mt-0.5"
                          aria-label="Import to Notes"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                        </button>
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
                  <button
                    onClick={() => setActiveTour("notes")}
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                  >
                    <Sparkles className="h-3 w-3" /> Tour
                  </button>
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
            SECTION 3 — STUDY PLANS (least priority, bottom)
        ══════════════════════════════════════════════════════ */}
        <section id="tour-study-plans" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Layers className="h-4 w-4 text-slate-500" />
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-700">Structured Study Plans</h2>
                <p className="text-xs text-slate-400">Guided modules for every stage of UPSC prep</p>
              </div>
            </div>
            <Link href="/study-plans" className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline">Browse all →</Link>
          </div>
          <div className="snap-scroll-x lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-x-visible">
            {[
              { title: "UPSC Prelims 90-Day Sprint", desc: "Covers all GS syllabus topics with daily micro-tests and current affairs.", badge: "Most Popular", color: "blue" },
              { title: "Mains GS Answer Writing", desc: "Structured daily writing practice with mentor evaluation and model answers.", badge: "With Mentorship", color: "purple" },
              { title: "CSAT Full Preparation", desc: "Concept-by-concept drills — comprehension, quant, logical reasoning.", badge: "Beginner-Friendly", color: "amber" },
            ].map(({ title, desc, badge, color }) => (
              <Link
                key={title}
                href="/study-plans"
                className="w-[85vw] sm:w-[300px] lg:w-auto flex-shrink-0 group flex flex-col justify-between rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-white p-4 hover:shadow-sm transition-all duration-200"
              >
                <div className="space-y-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest text-${color}-600 bg-${color}-50 px-1.5 py-0.5 rounded`}>{badge}</span>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-slate-900">{title}</h3>
                  <p className="text-[10px] text-slate-500 leading-snug">{desc}</p>
                </div>
                <span className={`mt-3 text-[10px] font-black text-${color}-600 flex items-center gap-0.5 group-hover:underline`}>
                  View plan <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
