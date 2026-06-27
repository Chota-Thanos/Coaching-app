"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, authenticatedGet } from "../components/auth/auth-context";
import { useSubscription } from "../lib/use-subscription";
import { browserBaseUrl, resolveMediaUrl } from "../lib/api";
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
  LayoutGrid,
  Star,
  ShieldCheck,
  Check,
  CheckCircle
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { token, user, isInitialized } = useAuth();
  const { hasAnyActive, subscriptions, loading: loadingSub } = useSubscription(token);
  
  // States for data fetching
  const [stats, setStats] = useState<any>(null);
  const [topicMetrics, setTopicMetrics] = useState<any[]>([]);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [userCollections, setUserCollections] = useState<any[]>([]);
  const [studyPlans, setStudyPlans] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  
  // Loading states
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Cover image fallbacks for current affairs
  const coverFallbacks = [
    "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop"
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

  // Fetch public study plans and mentors for marketing directory preview
  useEffect(() => {
    if (token) return;

    const fetchPublicMarketingData = async () => {
      try {
        const plansRes = await fetch(`${browserBaseUrl}/api/v1/study-plans?limit=3`);
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setStudyPlans(plansData || []);
        }
        
        const mentorsRes = await fetch(`${browserBaseUrl}/api/v1/mentorship/profiles`);
        if (mentorsRes.ok) {
          const mentorsData = await mentorsRes.json();
          setMentors((mentorsData || []).slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to fetch public marketing data", err);
      }
    };
    fetchPublicMarketingData();
  }, [token]);

  // Fetch student dashboard data when logged in
  useEffect(() => {
    if (!token) return;

    const fetchDashboardData = async () => {
      setLoadingDashboard(true);
      try {
        // Fetch dashboard stats
        const statsData = await authenticatedGet<any>("/api/v1/assessment/me/dashboard", token);
        setStats(statsData);

        // Fetch topic metrics
        const metricsData = await authenticatedGet<any[]>("/api/v1/assessment/me/topic-metrics", token);
        setTopicMetrics(metricsData || []);

        // Fetch personal workspace notes
        const notesData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/articles?limit=3", token);
        setUserNotes(notesData || []);

        // Fetch personal workspace collections/repos
        const collectionsData = await authenticatedGet<any[]>("/api/v1/current-affairs/me/collections", token);
        setUserCollections(collectionsData || []);

        // Fetch study plans
        const plansData = await authenticatedGet<any[]>("/api/v1/study-plans?limit=3", token);
        setStudyPlans(plansData || []);

        // Fetch mentors
        const mentorsData = await authenticatedGet<any[]>("/api/v1/mentorship/profiles", token);
        setMentors((mentorsData || []).slice(0, 3));
      } catch (err) {
        console.error("Failed to load authenticated dashboard data", err);
      } finally {
        setLoadingDashboard(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  // Derived dashboard variables
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

  // Selected quote based on username length for consistency
  const motivationalQuotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Your UPSC preparation is a marathon, not a sprint. Consistency is key.",
    "Arise, awake, and stop not until the goal is reached.",
    "The secret of getting ahead is getting started. Make every practice count.",
    "Focus on your progress, not your perfection."
  ];
  const quote = motivationalQuotes[username.length % motivationalQuotes.length];

  // SVG Radar Chart Calculations
  // Core subjects mapped to case-insensitive matching
  const radarSubjects = [
    { label: "Polity", slug: "polity" },
    { label: "Economy", slug: "economy" },
    { label: "History", slug: "history" },
    { label: "Geography", slug: "geography" },
    { label: "Environment", slug: "environment" },
    { label: "S & T", slug: "science" }
  ];

  const getSubjectAccuracy = (slug: string) => {
    const match = topicMetrics.find((m) =>
      m.taxonomy_name.toLowerCase().includes(slug.toLowerCase())
    );
    if (!match) return 0;
    const acc = Number(match.avg_accuracy ?? 0);
    return acc <= 1 ? Math.round(acc * 100) : Math.round(acc);
  };

  const radarPoints = radarSubjects.map((subj) => getSubjectAccuracy(subj.slug));
  const hasRadarData = totalMCQ > 0 && radarPoints.some((pts) => pts > 0);

  // Radar SVG specs
  const center = 110;
  const maxRadius = 70;
  const getCoordinates = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / 6;
    const r = maxRadius * (value / 100);
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  };

  // Generate grid hexagons (at 25%, 50%, 75%, 100%)
  const gridLevels = [25, 50, 75, 100];
  const gridPolygons = gridLevels.map((lvl) => {
    return radarSubjects
      .map((_, i) => {
        const coords = getCoordinates(i, lvl);
        return `${coords.x},${coords.y}`;
      })
      .join(" ");
  });

  // Calculate student data coordinates
  const studentPointsString = radarSubjects
    .map((_, i) => {
      const coords = getCoordinates(i, radarPoints[i] ?? 0);
      return `${coords.x},${coords.y}`;
    })
    .join(" ");

  // Main UI components
  if (!isInitialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto" />
          <p className="text-xs font-bold text-slate-500">Configuring prep platform...</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // LOGGED OUT PUBLIC VIEW
  // -------------------------------------------------------------
  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20">
        {/* Premium Landing Hero Section */}
        <section className="relative overflow-hidden bg-indigo-950 text-white border-b border-indigo-900">
          <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay">
            <img
              src="https://images.unsplash.com/photo-1513258496099-48168024aec0?q=80&w=1200&auto=format&fit=crop"
              alt="UPSC Preparation Portal Background"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-indigo-900/95 to-indigo-950/90 z-0" />
          
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Marketing Copy */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-bold text-indigo-300 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                  <span>Interactive UPSC Aspirants Platform</span>
                </div>
                <h1 className="text-4xl font-black md:text-6xl tracking-tight text-white leading-tight">
                  Clear UPSC CSE with <span className="text-indigo-400">Structured Guidance</span> & AI Tools
                </h1>
                <p className="text-base md:text-lg text-indigo-200/90 max-w-2xl leading-relaxed">
                  Join 10,000+ serious aspirants mastering daily syllabus-aligned current affairs, practice mock tests with custom test building, study plan roadmaps, and 1:1 mentorship from real toppers.
                </p>
                
                {/* Value tags */}
                <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-200">5 Daily Free News Articles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-200">Custom Mock Tests (Up to 10 Qs)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-200">1:1 Zoom Sessions with Toppers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-indigo-200">AI Mains Answer Evaluations</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    href="/register"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-650 px-8 font-bold text-white shadow-lg hover:bg-indigo-750 hover:shadow-indigo-900/20 transition-all duration-200"
                  >
                    Get Started Free
                  </Link>
                  <a
                    href="#pricing"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-all duration-200"
                  >
                    View Pricing Plans
                  </a>
                </div>
              </div>

              {/* Live Preview / Graphics Panel */}
              <div className="lg:col-span-5 relative">
                <div className="absolute -inset-1 rounded-3xl bg-indigo-500/30 blur-2xl z-0" />
                <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl space-y-6 z-10">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-rose-500" />
                      <div className="h-3 w-3 rounded-full bg-amber-500" />
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    </div>
                    <div className="rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                      Interface Preview
                    </div>
                  </div>
                  
                  {/* Scorecard Widget Mockup */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-200">UPSC Accuracy Radar</span>
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">88% Avg Accuracy</span>
                    </div>
                    
                    {/* Hexagon Radar Visual Mock */}
                    <div className="flex justify-center py-2">
                      <svg width="120" height="120" viewBox="0 0 120 120" className="overflow-visible">
                        <polygon points="60,10 100,35 100,85 60,110 20,85 20,35" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
                        <polygon points="60,30 90,48 90,72 60,90 30,72 30,48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                        {/* Active student shape (Polity, Economy, History, etc.) */}
                        <polygon points="60,18 92,42 85,80 60,100 35,78 28,40" fill="rgba(99, 102, 241, 0.4)" stroke="#818cf8" strokeWidth="2"/>
                        {/* Vertex circles */}
                        <circle cx="60" cy="18" r="3.5" fill="#818cf8"/>
                        <circle cx="92" cy="42" r="3.5" fill="#818cf8"/>
                        <circle cx="85" cy="80" r="3.5" fill="#818cf8"/>
                        <circle cx="60" cy="100" r="3.5" fill="#818cf8"/>
                        <circle cx="35" cy="78" r="3.5" fill="#818cf8"/>
                        <circle cx="28" cy="40" r="3.5" fill="#818cf8"/>
                      </svg>
                    </div>
                  </div>

                  {/* Accuracy progress bars */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/5 border border-white/5 p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-indigo-300 font-bold uppercase">
                        <span>Polity</span>
                        <span>85%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-[85%] bg-indigo-500" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-indigo-300 font-bold uppercase">
                        <span>Economy</span>
                        <span>78%</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-[78%] bg-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-20">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-black md:text-4xl text-slate-900 tracking-tight leading-tight">
              Powerful Tools Crafted for Serious Aspirants
            </h2>
            <p className="text-sm text-slate-500">
              Coaching Hub brings together all critical elements of the UPSC preparation cycle under a single unified dashboard, integrated with smart AI features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* GK Self Test Builder */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Target className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">GS Practice Engine</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Build custom tests by selecting specific syllabus subjects, categories, and question count. Free users can test with up to 10 questions.
              </p>
            </div>

            {/* CSAT Practice */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <BookOpenCheck className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">CSAT Aptitude Drills</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Master quantitative aptitude, logical reasoning, and reading comprehension. Track mock scoring averages to lock down your qualify margin.
              </p>
            </div>

            {/* Mains answer evaluation */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <FileText className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">Mains Evaluation Hub</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Submit subjective mock answers and get instant evaluations based on actual UPSC parameters. Grade your essay structure, content, and grammar.
              </p>
            </div>

            {/* Daily news */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <Newspaper className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">Daily Current Affairs</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Read handpicked daily current affairs fact sheets mapped directly to UPSC Prelims topics. Free accounts receive 5 free reads every day.
              </p>
            </div>

            {/* Editorial summary */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-650">
                <BookOpen className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">Mains Editorial Summaries</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Unlock daily mains editorial briefs analyzing the core themes of the day's major issues. Essential context for scoring high in subjective GS papers.
              </p>
            </div>

            {/* Study Planners */}
            <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Calendar className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-bold text-slate-800">Guided Roadmaps</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Follow structured study planners detailing weekly learning metrics, mock tasks, and practice target splits covering the entire syllabus.
              </p>
            </div>
          </div>
        </section>

        {/* Structured Study Plans Showcase */}
        {studyPlans.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-6">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-indigo-650" />
                <span>Structured Study Roadmaps</span>
              </h2>
              <span className="text-xs font-semibold text-slate-400">Join a guided syllabus track</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {studyPlans.map((plan) => {
                const cover = plan.cover_image_url || "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=400&auto=format&fit=crop";
                return (
                  <div key={plan.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="h-32 w-full overflow-hidden relative">
                      <img src={cover} alt={plan.title} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-lg bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                        {plan.duration_weeks} Weeks Roadmap
                      </span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-1">{plan.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{plan.description || "Complete syllabus preparation mapping guide."}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{plan.test_count ?? 5} Practice Tests</span>
                        <Link href="/login" className="text-xs font-black text-slate-700 hover:text-indigo-650 flex items-center gap-1">
                          <span>Enroll Plan</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Connect with Topper Mentors Showcase */}
        {mentors.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-6">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-indigo-650" />
                <span>Connect with Topper Mentors</span>
              </h2>
              <span className="text-xs font-semibold text-slate-400">1:1 guided advice</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mentors.map((mentor) => {
                const avatar = mentor.profile_image_url || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop";
                return (
                  <div key={mentor.id} className="group relative flex flex-col justify-between p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                        <img src={avatar} alt={mentor.display_name} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-slate-800">{mentor.display_name}</h3>
                          {mentor.is_verified && <span className="h-2 w-2 rounded-full bg-blue-500" title="Verified Expert" />}
                        </div>
                        <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block">
                          {mentor.years_experience > 0 ? `${mentor.years_experience} Yrs Experience` : "UPSC Topper Expert"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500 line-clamp-2 leading-relaxed italic">
                      &ldquo;{mentor.headline || "IAS Coach & Mentor for UPSC CSE Mains & Interview preparation."}&rdquo;
                    </p>
                    <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">1:1 Zoom Sessions</span>
                      <Link href="/login" className="inline-flex h-8 items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 px-3.5 text-xs font-bold text-indigo-700 transition-colors duration-200">
                        Book Session
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Latest Current Affairs Preview Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-6">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="h-4.5 w-4.5 text-indigo-650" />
              <span>Latest Current Affairs</span>
            </h2>
            <Link href="/current-affairs/daily-news" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
              View All Articles <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loadingArticles ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white border border-slate-150 p-4 h-72 space-y-3">
                  <div className="bg-slate-200 h-36 rounded-xl" />
                  <div className="bg-slate-200 h-4 w-2/3 rounded" />
                  <div className="bg-slate-200 h-4 w-full rounded" />
                </div>
              ))}
            </div>
          ) : latestArticles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">
              No recent articles found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestArticles.map((article, idx) => {
                const cover = resolveMediaUrl(article.primary_asset?.file_url) || coverFallbacks[idx % coverFallbacks.length];
                const catName = article.category?.name ?? "General Studies";
                const articleDate = article.publication_date
                  ? new Date(article.publication_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })
                  : "Latest";

                return (
                  <Link
                    key={article.id}
                    href={`/current-affairs/articles/slug/${article.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="h-40 w-full overflow-hidden bg-slate-50 relative">
                      <img
                        src={cover}
                        alt={article.title}
                        className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
                      />
                      <span className="absolute left-3 top-3 rounded-lg bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {catName}
                      </span>
                    </div>
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-indigo-600 mb-1">
                          {articleDate}
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-2 group-hover:text-indigo-800 transition-colors">
                          {article.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                          {article.seo_description || article.body.replace(/<[^>]*>/g, '').substring(0, 120)}...
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-black text-indigo-650 group-hover:text-indigo-850">
                        <span>Read full brief</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Subscriptions Pricing Plans Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Transparent Subscriptions</span>
            </div>
            <h2 className="text-3xl font-black md:text-4xl text-slate-900 tracking-tight leading-tight">
              Flexible Plans Mapped to Your UPSC Needs
            </h2>
            <p className="text-sm text-slate-500">
              Access features à la carte or purchase the complete package for total preparation coverage. All plans start with free basic access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free Plan */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Basic Tier</h3>
                  <p className="text-xs text-slate-500">Core features for beginners</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-black text-slate-900">₹0</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Capped Custom Tests (Max 10 Qs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>5 Daily News Article Reads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Basic Bookmarks Workspace</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Check className="h-4 w-4 text-slate-200 shrink-0 mt-0.5" />
                    <span>Sectional GK & CSAT Tests Locked</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Check className="h-4 w-4 text-slate-200 shrink-0 mt-0.5" />
                    <span>Mains Editorial summaries Locked</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full py-3 rounded-xl bg-slate-150 hover:bg-slate-200 text-center font-bold text-slate-700 text-xs transition-colors duration-200">
                Register Free Account
              </Link>
            </div>

            {/* Assessment Premium Plan */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Assessment Premium</h3>
                  <p className="text-xs text-slate-500">For mock practice & analytics</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-black text-slate-900">₹499</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Unlimited Custom Tests (No Q limit)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Full GK & CSAT Sectional Mocks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>AI Subjective Grading (Mains Hub)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Personalized strengths Radar Charts</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Check className="h-4 w-4 text-slate-200 shrink-0 mt-0.5" />
                    <span>Mains Editorial Summaries Locked</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-center font-bold text-indigo-700 text-xs transition-colors duration-200">
                Get Assessment Premium
              </Link>
            </div>

            {/* Current Affairs Pro Plan */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Current Affairs Pro</h3>
                  <p className="text-xs text-slate-500">For daily news & issue summaries</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-black text-slate-900">₹299</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <ul className="space-y-3 text-xs text-slate-600 font-medium">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Unlimited Daily Current Affairs Reads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Full Mains Editorial summaries & briefs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Personal notes workspace repository</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Custom article collections folders</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Check className="h-4 w-4 text-slate-200 shrink-0 mt-0.5" />
                    <span>Custom Test Building limited to 10 Qs</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-center font-bold text-indigo-700 text-xs transition-colors duration-200">
                Get Current Affairs Pro
              </Link>
            </div>

            {/* Complete Prep Bundle */}
            <div className="rounded-3xl border-2 border-indigo-650 bg-indigo-950 p-6 shadow-xl flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200 relative text-white">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                Best Value Plan
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Complete Prep Bundle</h3>
                  <p className="text-xs text-indigo-200">Combined à la carte packages</p>
                </div>
                <div className="flex items-baseline text-white">
                  <span className="text-3xl font-black">₹699</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                </div>
                <div className="h-px bg-white/10 w-full" />
                <ul className="space-y-3 text-xs text-indigo-100 font-medium">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Unlimited Custom Tests (No Q limit)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Full GK & CSAT Sectional Practice Mocks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Unlimited news reads & Mains Summaries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>AI subjective answer evaluations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>Priority 1:1 Booking with Topper Mentors</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8 block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-center font-bold text-white text-xs transition-colors duration-200">
                Subscribe Complete Prep
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
          <div className="rounded-3xl bg-indigo-900 p-8 md:p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
              <div className="flex justify-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <blockquote className="text-base md:text-xl font-bold italic leading-relaxed">
                &ldquo;Coaching Hub completely changed the way I prepared for my GK current affairs. The custom test builder allowed me to test myself on specific subtopics that I was weak at. The scoring analytics accurately highlighted my improvement curves. Highly recommended!&rdquo;
              </blockquote>
              <div>
                <cite className="not-italic text-sm font-black text-indigo-200">Aditya Verma</cite>
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">IAS Officer (AIR 45, UPSC CSE 2025)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24 text-center">
          <div className="max-w-4xl mx-auto rounded-3xl bg-slate-900 border border-slate-800 p-10 space-y-6">
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
              Ready to Accelerate Your UPSC Preparation?
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Join thousands of IAS candidates. Register a free account today to build tests and read syllabus current affairs.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-700 px-6 text-xs font-bold text-white transition-colors duration-200">
                Register Now
              </Link>
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 hover:bg-slate-800 px-6 text-xs font-bold text-slate-300 transition-colors duration-200">
                Student Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // -------------------------------------------------------------
  // LOGGED IN DASHBOARD VIEW
  // -------------------------------------------------------------
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
        
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 animate-pulse" />
                <span>UPSC Study Dashboard</span>
              </div>
              <h1 className="text-3xl font-black md:text-4xl tracking-tight text-white leading-tight">
                Namaste, {username}! 👋
              </h1>
              <p className="text-sm text-indigo-200/90 italic font-medium">
                &ldquo;{quote}&rdquo;
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
              {/* Account / Subscription Status */}
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md min-w-[220px]">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-inner ${hasAnyActive ? "bg-emerald-600" : "bg-amber-600"}`}>
                  <Sparkles className="h-5.5 w-5.5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Subscription</p>
                  {loadingSub ? (
                    <p className="text-xs text-indigo-200">Loading...</p>
                  ) : hasAnyActive ? (
                    <div>
                      <p className="text-xs font-black text-emerald-400">Premium Active</p>
                      <p className="text-[11px] font-bold text-slate-100 line-clamp-1">
                        {subscriptions.map(s => s.plan.name).join(", ")}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-black text-amber-405 text-amber-400">Free Account</p>
                      <p className="text-[10px] font-medium text-indigo-200">Reads: 5/day • Tests: 10 Qs</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick stats on banner */}
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md min-w-[200px]">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-inner">
                  <Award className="h-5.5 w-5.5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Preparation Status</p>
                  <p className="text-xs font-black text-white">{totalMCQ > 0 ? `${totalMCQ} MCQ Tests` : "Journey Initiated"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-12">
              {/* Top Feature Switcher Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Syllabus Tracker */}
          <Link
            href="/assessment/dashboard"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-24 w-full overflow-hidden bg-slate-50 relative">
              <img
                src="https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=600&auto=format&fit=crop"
                alt="Syllabus Tracker"
                className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
              />
              <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 backdrop-blur-sm text-blue-600 shadow-sm">
                <Target className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Syllabus Tracker</h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                  {totalMCQ > 0 ? `${gkAccuracy}% GS | ${csatAccuracy}% CSAT` : "Track GS & CSAT accuracies"}
                </p>
              </div>
            </div>
          </Link>

          {/* Current Affairs Tracker */}
          <Link
            href="/current-affairs/daily-news"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-24 w-full overflow-hidden bg-slate-50 relative">
              <img
                src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop"
                alt="Current Affairs Tracker"
                className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
              />
              <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 backdrop-blur-sm text-teal-600 shadow-sm">
                <Newspaper className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Current Affairs Tracker</h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                  Daily news feeds & summaries
                </p>
              </div>
            </div>
          </Link>

          {/* Structured Study Plans */}
          <Link
            href="/study-plans"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-24 w-full overflow-hidden bg-slate-50 relative">
              <img
                src="https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=600&auto=format&fit=crop"
                alt="Structured Study Plans"
                className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
              />
              <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 backdrop-blur-sm text-purple-650 shadow-sm">
                <Calendar className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Structured Study Plans</h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                  {studyPlans.length > 0 ? `${studyPlans.length} active roadmaps` : "Syllabus prep roadmaps"}
                </p>
              </div>
            </div>
          </Link>

          {/* Connect with Mentors */}
          <Link
            href="/mentors"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="h-24 w-full overflow-hidden bg-slate-50 relative">
              <img
                src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=600&auto=format&fit=crop"
                alt="Connect with Mentors"
                className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
              />
              <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 backdrop-blur-sm text-rose-650 shadow-sm">
                <Users className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-rose-700 transition-colors">Connect with Mentors</h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-tight">
                  Book a 1-on-1 coaching session
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* 1st Row: Assessment Section + Syllabus Preparation Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assessment & Practice (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600 shadow-sm">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Assessment & Practice</h2>
                <p className="text-xs font-semibold text-slate-500">General Studies test builders, CSAT aptitude drills, Mains reviews, and bookmarks.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* General Studies */}
              <Link
                href="/assessment/gk"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Target className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-blue-700 transition-colors">General Studies</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    Syllabus-focused GS self tests, UPSC PYQs, and metrics.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-blue-650">
                  <span>Start GK</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* CSAT */}
              <Link
                href="/assessment/csat"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <BookOpenCheck className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-amber-700 transition-colors">CSAT Aptitude</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    Quantitative analysis, logical reasoning, and reading drills.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-amber-650">
                  <span>Start CSAT</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Mains Hub */}
              <Link
                href="/assessment/mains-hub"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <FileText className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Mains Hub</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    Subjective answer uploads and evaluated score review.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-purple-650">
                  <span>Mains Hub</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Bookmarks */}
              <Link
                href="/assessment/gk?view=revision"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
                    <Bookmark className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-rose-700 transition-colors">Revision Lists</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    Category-filtered revision cards and bookmarked MCQs.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-rose-650">
                  <span>Revise</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* Syllabus Preparation Tracker (1/3 width) */}
          <div className="lg:col-span-1">
            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-650" />
                    <span>Syllabus Prep Tracker</span>
                  </h2>
                  <Link href="/assessment/dashboard" className="text-xs font-bold text-indigo-650 hover:underline">
                    Full Report
                  </Link>
                </div>

                {!hasRadarData ? (
                  /* Blank State CTA for New Users */
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-650">
                      <BrainCircuit className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Your Performance Radar is Empty</h3>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                        Attempt a practice test to start tracking your strengths, weaknesses, and subject accuracy coordinates.
                      </p>
                    </div>
                    <Link
                      href="/assessment/gk"
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-750 px-4 text-xs font-bold text-white shadow-sm transition-colors"
                    >
                      Attempt First GS Test
                    </Link>
                  </div>
                ) : (
                  /* Dynamic SVG Radar Chart */
                  <div className="flex flex-col md:flex-row items-center gap-6 py-2">
                    <div className="relative w-56 h-56 flex-shrink-0">
                      <svg className="w-full h-full" viewBox="0 0 220 220">
                        {/* Grid concentric hexagons */}
                        {gridPolygons.map((pointsStr, i) => (
                          <polygon
                            key={i}
                            points={pointsStr}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                          />
                        ))}
                        {/* Grid axis lines */}
                        {radarSubjects.map((_, i) => {
                          const outerCoords = getCoordinates(i, 100);
                          return (
                            <line
                              key={i}
                              x1={center}
                              y1={center}
                              x2={outerCoords.x}
                              y2={outerCoords.y}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {/* Student performance polygon */}
                        <polygon
                          points={studentPointsString}
                          fill="rgba(79, 70, 229, 0.16)"
                          stroke="rgb(79, 70, 229)"
                          strokeWidth="2"
                        />
                        {/* Subject label strings */}
                        {radarSubjects.map((subj, i) => {
                          const coords = getCoordinates(i, 100);
                          const labelRadius = 88;
                          const labelX = center + labelRadius * Math.cos(coords.angle);
                          const labelY = center + labelRadius * Math.sin(coords.angle) + 4; // slight vertical adjust
                          let anchor: "middle" | "start" | "end" = "middle";
                          if (Math.cos(coords.angle) > 0.15) anchor = "start";
                          if (Math.cos(coords.angle) < -0.15) anchor = "end";

                          return (
                            <text
                              key={i}
                              x={labelX}
                              y={labelY}
                              textAnchor={anchor}
                              className="text-[9px] font-bold fill-slate-500"
                            >
                              {subj.label}
                            </text>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Accuracies list side panel */}
                    <div className="flex-1 w-full space-y-3.5">
                      {radarSubjects.map((subj, i) => {
                        const acc = radarPoints[i] ?? 0;
                        const barColor = acc >= 70 ? "bg-emerald-500" : acc >= 40 ? "bg-amber-500" : "bg-rose-500";
                        return (
                          <div key={subj.slug} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-600">{subj.label}</span>
                              <span className="font-black text-slate-800">{acc}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${acc}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between mt-4">
                <span className="text-[10px] font-semibold text-slate-500 leading-tight">
                  Performance aggregates update immediately upon test completion.
                </span>
                <Link href="/assessment/dashboard" className="text-[11px] font-black text-indigo-650 flex items-center gap-0.5 hover:underline shrink-0 pl-2">
                  View trends <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* 2nd Row: Current Affairs Grid + Section of Notes Making */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Affairs (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600 shadow-sm">
                <Newspaper className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Current Affairs Hub</h2>
                <p className="text-xs font-semibold text-slate-500">UPSC daily briefs, news kapsules, and issue breakdowns.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Daily CA */}
              <Link
                href="/current-affairs/daily-news"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-105 transition-colors">
                    <Newspaper className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Daily News</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    UPSC current affairs updates and prelims facts.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-teal-650">
                  <span>Read News</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Editorial */}
              <Link
                href="/current-affairs/editorial-summary"
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-650 group-hover:bg-indigo-100 transition-colors">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Editorials</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-3">
                    Syllabus-mapped editorial briefs & issue breakdowns.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs font-bold text-indigo-650">
                  <span>Editorials</span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </div>

          {/* Notes Workspace Panel (1/3 width) */}
          <div className="lg:col-span-1">
            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-indigo-650" />
                    <span>Notes Workspace</span>
                  </h2>
                  <Link href="/current-affairs/workspace" className="text-xs font-bold text-indigo-650 hover:underline flex items-center gap-1">
                    Launch Space <PlusCircle className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {userNotes.length === 0 && userCollections.length === 0 ? (
                  /* Blank State CTA for New Users */
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-650">
                      <FileCode className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">No Revision Notes Found</h3>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                        Capture key editorial analysis, bookmark syllabus updates, and create custom revision notes to initiate your active recall workspace.
                      </p>
                    </div>
                    <Link
                      href="/current-affairs/workspace"
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-750 px-4 text-xs font-bold text-white shadow-sm transition-colors"
                    >
                      Open Notes Space
                    </Link>
                  </div>
                ) : (
                  /* Render Notes and Collections preview */
                  <div className="space-y-4">
                    {/* Collections / Repositories list */}
                    {userCollections.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Active Repositories</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {userCollections.slice(0, 4).map((col: any) => (
                            <Link
                              key={col.id}
                              href={`/current-affairs/workspace?collection=${col.id}`}
                              className="flex items-center gap-2.5 rounded-xl border border-slate-150 bg-slate-50/50 p-2.5 hover:bg-slate-50 transition-colors"
                            >
                              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-650">
                                <FolderOpen className="h-4 w-4" />
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate">{col.name}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personal Articles / Notes list */}
                    {userNotes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Recent Notes</p>
                        <div className="space-y-2">
                          {userNotes.slice(0, 3).map((note: any) => (
                            <Link
                              key={note.id}
                              href={`/current-affairs/workspace?note=${note.id}`}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-xs transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-650 shrink-0">
                                  <FileText className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{note.title}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {note.updated_at ? new Date(note.updated_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : "Updated today"}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between mt-4">
                <span className="text-[10px] font-semibold text-slate-500 leading-tight">
                  Notes sync across desktop and mobile.
                </span>
                <Link href="/current-affairs/workspace" className="text-[11px] font-black text-indigo-650 flex items-center gap-0.5 hover:underline shrink-0 pl-2">
                  New note <Plus className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Current Affairs Preview */}
        <section>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              <span>Latest Current Affairs insights</span>
            </h2>
            <Link href="/current-affairs/daily-news" className="text-xs font-bold text-indigo-650 hover:underline">
              View All
            </Link>
          </div>

          {loadingArticles ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white border border-slate-150 p-4 h-72 space-y-3">
                  <div className="bg-slate-200 h-36 rounded-xl" />
                  <div className="bg-slate-200 h-4 w-2/3 rounded" />
                  <div className="bg-slate-200 h-4 w-full rounded" />
                </div>
              ))}
            </div>
          ) : latestArticles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">
              No recent articles found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestArticles.map((article, idx) => {
                const cover = resolveMediaUrl(article.primary_asset?.file_url) || coverFallbacks[idx % coverFallbacks.length];
                const catName = article.category?.name ?? "General Studies";
                const articleDate = article.publication_date
                  ? new Date(article.publication_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })
                  : "Latest";

                return (
                  <Link
                    key={article.id}
                    href={`/current-affairs/articles/slug/${article.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="h-40 w-full overflow-hidden bg-slate-50 relative">
                      <img
                        src={cover}
                        alt={article.title}
                        className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
                      />
                      <span className="absolute left-3 top-3 rounded-lg bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {catName}
                      </span>
                    </div>
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-indigo-650 mb-1">
                          {articleDate}
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug line-clamp-2 group-hover:text-indigo-800 transition-colors">
                          {article.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                          {article.seo_description || article.body.replace(/<[^>]*>/g, '').substring(0, 120)}...
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-black text-indigo-650 group-hover:text-indigo-850">
                        <span>Read full brief</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 3rd Row: Structured Study Plan */}
        {studyPlans.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-5">
              <Calendar className="h-5 w-5 text-indigo-650" />
              <span>Syllabus Structured Study Plans</span>
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
              {studyPlans.map((plan, idx) => {
                const cover = plan.cover_image || coverFallbacks[idx % coverFallbacks.length];
                return (
                  <Link
                    key={plan.id}
                    href={`/study-plans/${plan.slug}`}
                    className="flex-shrink-0 w-80 md:w-96 snap-start group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="h-32 w-full overflow-hidden bg-slate-50 relative">
                      <img
                        src={cover}
                        alt={plan.title}
                        className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-200"
                      />
                    </div>
                    <div className="flex-1 p-5 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug group-hover:text-indigo-800 transition-colors line-clamp-1">
                          {plan.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-550 line-clamp-2 leading-relaxed">
                          {plan.subtitle ?? plan.description ?? "Structured roadmap loaded with test-series and revision briefs."}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-450">{plan.duration_days ?? 30} Days Plan</span>
                        <span className="font-black text-indigo-650 group-hover:underline">Start Road</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 4th Row: Top Mentors Panel */}
        {mentors.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-5">
              <Users className="h-5 w-5 text-indigo-650" />
              <span>Connect with Top Mentors</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mentors.map((mentor, idx) => {
                // Portrait image fallbacks
                const avatarFallbacks = [
                  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=300&auto=format&fit=crop",
                  "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=300&auto=format&fit=crop",
                  "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&auto=format&fit=crop"
                ];
                const avatar = mentor.avatar_url || avatarFallbacks[idx % avatarFallbacks.length];
                const bio = mentor.headline || "IAS Specialist & Prep Educator.";

                return (
                  <Link
                    key={mentor.id}
                    href={`/mentors/${mentor.id ?? mentor.username}`}
                    className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
                  >
                    <div className="shrink-0 h-12 w-12 rounded-xl overflow-hidden bg-slate-50 relative border border-slate-150">
                      <img src={avatar} alt={mentor.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-850 truncate">
                          {mentor.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                          {bio}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-650 group-hover:underline mt-2">
                        View Mentor Profile
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  );
};
