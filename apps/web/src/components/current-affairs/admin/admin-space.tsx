"use client";

import { 
  FileStack, 
  FolderTree, 
  Newspaper, 
  ShieldCheck, 
  LayoutDashboard, 
  PlusCircle, 
  LogOut, 
  ArrowRight, 
  Brain, 
  Sparkles,
  BookOpen,
  Plus
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { SignInPanel } from "../../auth/sign-in-panel";
import { useAuth, authenticatedGet, authenticatedPost } from "../../auth/auth-context";
import { AdminArticleManager } from "./admin-article-manager";
import { AdminCategoryManager } from "./admin-category-manager";
import { AdminIngestionManager } from "./admin-ingestion-manager";
import { AdminArticleCreator } from "./admin-article-creator";
import { AiSettingsManager } from "./ai-settings-manager";
import { AdminQuizCreator } from "./admin-quiz-creator";
import { AdminQuizManager } from "./admin-quiz-manager";
import { AdminAssessmentTaxonomyManager } from "./admin-assessment-taxonomy-manager";
import { AdminMainsQuestionManager } from "./admin-mains-question-manager";
import { AdminMainsQuestionCreator } from "./admin-mains-question-creator";
import type { CategoryNode, AdminArticleSummary, IngestionJob, CreateAdminArticlePayload } from "../../../lib/api";

type AdminTab = "overview" | "articles" | "create_article" | "categories" | "ingestion" | "ai_settings" | "quiz_creator" | "quiz_library" | "mains_questions" | "assessment_taxonomy";

export function AdminSpace() {
  const { token, user, logout, isInitialized } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const tabParam = params?.tab as AdminTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(tabParam || "overview");
  const [editingMainsQuestionId, setEditingMainsQuestionId] = useState<number | null>(null);
  const [mainsCreatorMode, setMainsCreatorMode] = useState<boolean>(false);
  
  const editId = searchParams.get("edit");

  // Sync activeTab state with path params changes (back/forward or route updates)
  useEffect(() => {
    const tabParam = params?.tab as AdminTab;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [params, activeTab]);

  // Sync editId parameter
  useEffect(() => {
    if (editId) {
      setActiveTab("articles");
    }
  }, [editId]);

  // Reset creator mode when moving away from Mains tab
  useEffect(() => {
    if (activeTab !== "mains_questions") {
      setMainsCreatorMode(false);
    }
  }, [activeTab]);


  // Overview stats and caching categories for the creator
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [recentArticles, setRecentArticles] = useState<AdminArticleSummary[]>([]);
  const [stats, setStats] = useState({
    totalArticles: 0,
    rootCategories: 0,
    pendingIngestions: 0,
    aiGenerated: 0
  });

  const [loadingStats, setLoadingStats] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [creatorMessage, setCreatorMessage] = useState<string | null>(null);

  // Load essential statistics and data
  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      // 1. Fetch categories
      const fetchedCats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
      setCategories(fetchedCats);

      // 2. Fetch recent articles
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/current-affairs/articles?limit=30&offset=0`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const fetchedArticles = await response.json() as AdminArticleSummary[];
        setRecentArticles(fetchedArticles.slice(0, 5));
        
        // Calculate stats
        const aiCount = fetchedArticles.filter(a => a.is_ai_generated).length;
        setStats({
          totalArticles: fetchedArticles.length,
          rootCategories: fetchedCats.filter(c => c.parent_id === null).length,
          pendingIngestions: 0, // Will load from ingestion jobs
          aiGenerated: aiCount
        });
      }

      // 3. Fetch Ingestions
      const fetchedJobs = await authenticatedGet<IngestionJob[]>("/api/v1/current-affairs/admin/ingestion-jobs?limit=50", token);
      const pendingJobsCount = fetchedJobs.filter(j => j.status === "queued" || j.status === "parsed").length;
      setStats(prev => ({
        ...prev,
        pendingIngestions: pendingJobsCount
      }));

    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadDashboardData();
    }
  }, [token, loadDashboardData]);

  // Handle article creation
  const handleCreateArticleSubmit = async (payload: CreateAdminArticlePayload) => {
    if (!token) return;
    setSavingArticle(true);
    setCreatorMessage(null);
    try {
      const res = await authenticatedPost<{ id: number }>("/api/v1/current-affairs/articles", token, payload);
      setCreatorMessage("Article successfully created and published in library.");
      void loadDashboardData(); // Reload stats & recent items
      return res;
    } catch {
      setCreatorMessage("Failed to create article. Please check that the URL slug is unique and inputs are correct.");
    } finally {
      setSavingArticle(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm text-center">
          <p className="text-sm font-semibold text-ink/50">Verifying session...</p>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-civic/10 text-civic">
              <ShieldCheck aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-black leading-tight text-ink">Current affairs admin</h1>
              <p className="mt-2 text-sm leading-6 text-ink/70">Sign in with an admin or editor account to access coaching operations.</p>
              <div className="mt-6">
                <SignInPanel />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const hasAdminAccess = user && ["admin", "moderator", "content_editor"].includes(user.role);
  if (!hasAdminAccess) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border border-berry/30 bg-berry/10 p-6">
          <h1 className="text-2xl font-black text-ink">Access restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">Current affairs admin access requires an admin, moderator, or content editor role. Contact your system administrator to elevate your profile.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      {/* ── Left Sidebar Navigation ── */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border-r border-line p-6 flex flex-col justify-between">
        <div className="space-y-8">
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic text-white shadow-md">
              <ShieldCheck className="h-5.5 w-5.5" />
            </span>
            <div>
              <h1 className="font-black text-lg text-ink leading-none">Coaching Hub</h1>
              <span className="text-[10px] font-bold text-civic tracking-wider uppercase">Admin Terminal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Admin Navigation Links" className="space-y-1">
            <Link
              href="/current-affairs/admin/overview"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "overview"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              Overview
            </Link>
            
            <Link
              href="/current-affairs/admin/articles"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "articles"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <Newspaper className="h-4.5 w-4.5" />
              Articles Library
            </Link>

            <Link
              href="/current-affairs/admin/create_article"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "create_article"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <PlusCircle className="h-4.5 w-4.5" />
              Create Article
            </Link>

            <Link
              href="/current-affairs/admin/categories"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "categories"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <FolderTree className="h-4.5 w-4.5" />
              Categories Taxonomy
            </Link>

            <Link
              href="/current-affairs/admin/ingestion"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "ingestion"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <FileStack className="h-4.5 w-4.5" />
              Ingestion Reviews
            </Link>

            <Link
              href="/current-affairs/admin/ai_settings"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "ai_settings"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <Brain className="h-4.5 w-4.5" />
              AI System Settings
            </Link>

            <Link
              href="/current-affairs/admin/quiz_creator"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "quiz_creator"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <Sparkles className="h-4.5 w-4.5" />
              AI Quiz Creator
            </Link>

            <Link
              href="/current-affairs/admin/quiz_library"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "quiz_library"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <BookOpen className="h-4.5 w-4.5" />
              Questions Library
            </Link>

            <Link
              href="/current-affairs/admin/mains_questions"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "mains_questions"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <FileStack className="h-4.5 w-4.5" />
              Mains Questions
            </Link>

            <Link
              href="/current-affairs/admin/assessment_taxonomy"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === "assessment_taxonomy"
                  ? "bg-civic/10 text-civic"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              }`}
            >
              <FolderTree className="h-4.5 w-4.5" />
              Assessment Taxonomies
            </Link>
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="mt-8 pt-4 border-t border-line/60 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-paper font-bold text-ink uppercase text-sm border border-line">
              {user?.email?.charAt(0) ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink truncate leading-tight">{user?.email}</p>
              <span className="text-[10px] font-bold text-ink/50 uppercase">{user?.role} Access</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 h-10 border border-line hover:border-berry/40 rounded-xl text-xs font-bold text-ink hover:text-berry hover:bg-berry/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Pane ── */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Render Active Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Overview Header */}
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Operational Dashboard</span>
              <h2 className="text-3xl font-black text-ink mt-1">Hello, Administrator</h2>
              <p className="text-sm text-ink/65 mt-1">Here is a quick summary of the coaching content databases and systems.</p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-civic/10 text-civic">
                  <Newspaper className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-xs font-bold text-ink/50 block">Total Articles</span>
                  <span className="text-2xl font-black text-ink leading-tight">{loadingStats ? "..." : stats.totalArticles}</span>
                </div>
              </div>

              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-civic/10 text-civic">
                  <FolderTree className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-xs font-bold text-ink/50 block">Root Subjects</span>
                  <span className="text-2xl font-black text-ink leading-tight">{loadingStats ? "..." : stats.rootCategories}</span>
                </div>
              </div>

              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-civic/10 text-civic">
                  <FileStack className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-xs font-bold text-ink/50 block">Pending Ingestion</span>
                  <span className="text-2xl font-black text-ink leading-tight">{loadingStats ? "..." : stats.pendingIngestions}</span>
                </div>
              </div>

              <div className="bg-white border border-line rounded-2xl p-5 shadow-sm flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-civic/10 text-civic">
                  <Brain className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-xs font-bold text-ink/50 block">AI Generated</span>
                  <span className="text-2xl font-black text-ink leading-tight">{loadingStats ? "..." : stats.aiGenerated}</span>
                </div>
              </div>
            </div>

            {/* Main Dashboard Layout */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column: Recent Articles */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-black text-ink">Recently Added Articles</h3>
                <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden divide-y divide-line/60">
                  {recentArticles.length === 0 ? (
                    <div className="p-6 text-center text-sm text-ink/50">No articles available. Clean and seed database to populate items.</div>
                  ) : (
                    recentArticles.map(art => (
                      <div className="p-4 flex items-center justify-between gap-4 hover:bg-paper/30 transition-all" key={art.id}>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-ink truncate">{art.title}</h4>
                          <div className="flex gap-2 items-center text-xs text-ink/50 mt-1">
                            <span className="font-semibold text-civic">{art.content_kind.replace(/_/g, " ")}</span>
                            <span>•</span>
                            <span>{art.category?.name ?? "Undefined category"}</span>
                          </div>
                        </div>
                        <Link
                          href="/current-affairs/admin/articles"
                          className="h-8 w-8 shrink-0 rounded-lg border border-line flex items-center justify-center hover:border-civic text-ink hover:text-civic transition-all"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
 
              {/* Right Column: Shortcuts */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-ink">Quick Shortcuts</h3>
                <div className="grid gap-3">
                  <Link
                    href="/current-affairs/admin/create_article"
                    className="bg-white border border-line hover:border-civic rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <h4 className="font-black text-sm text-ink group-hover:text-civic transition-colors">Write Manual Article</h4>
                      <p className="text-xs text-ink/55 mt-1">Open raw text markdown editor workspace.</p>
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper group-hover:bg-civic/10 text-ink group-hover:text-civic shrink-0 transition-all">
                      <Plus className="h-4 w-4" />
                    </span>
                  </Link>
 
                  <Link
                    href="/current-affairs/admin/create_article"
                    className="bg-white border border-line hover:border-civic rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <h4 className="font-black text-sm text-ink group-hover:text-civic transition-colors">Generate via AI Creator</h4>
                      <p className="text-xs text-ink/55 mt-1">Input keywords and let AI write the paper.</p>
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper group-hover:bg-civic/10 text-ink group-hover:text-civic shrink-0 transition-all">
                      <Sparkles className="h-4 w-4" />
                    </span>
                  </Link>
 
                  <Link
                    href="/current-affairs/admin/categories"
                    className="bg-white border border-line hover:border-civic rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <h4 className="font-black text-sm text-ink group-hover:text-civic transition-colors">Manage Taxonomies</h4>
                      <p className="text-xs text-ink/55 mt-1">Configure subjects, topics, and subtopics.</p>
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper group-hover:bg-civic/10 text-ink group-hover:text-civic shrink-0 transition-all">
                      <FolderTree className="h-4 w-4" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "articles" && <AdminArticleManager />}
        
        {activeTab === "create_article" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Coaching Publisher</span>
              <h2 className="text-3xl font-black text-ink mt-1">Create current affairs article</h2>
              <p className="text-sm text-ink/65 mt-1">Publish fresh content dynamically into the student library.</p>
            </div>
            <AdminArticleCreator
              categories={categories}
              message={creatorMessage}
              onSubmit={handleCreateArticleSubmit}
              pending={savingArticle}
            />
          </div>
        )}

        {activeTab === "categories" && <AdminCategoryManager />}
        
        {activeTab === "ingestion" && <AdminIngestionManager />}

        {activeTab === "ai_settings" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">AI Operations</span>
              <h2 className="text-3xl font-black text-ink mt-1">AI Configuration Center</h2>
              <p className="text-sm text-ink/65 mt-1">Configure global style instructions and subject override prompts.</p>
            </div>
            <AiSettingsManager />
          </div>
        )}

        {activeTab === "quiz_creator" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Assessment Portal</span>
              <h2 className="text-3xl font-black text-ink mt-1">AI Quiz Creator</h2>
              <p className="text-sm text-ink/65 mt-1">Design mock GK, reading passage tests, and LaTeX maths assessments using AI prompts.</p>
            </div>
            <AdminQuizCreator />
          </div>
        )}

        {activeTab === "quiz_library" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Assessment Portal</span>
              <h2 className="text-3xl font-black text-ink mt-1">Quizzes Library</h2>
              <p className="text-sm text-ink/65 mt-1">Manage generated assessments, edit metadata, view questions, and publish to students.</p>
            </div>
            <AdminQuizManager />
          </div>
        )}

        {activeTab === "mains_questions" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {mainsCreatorMode ? (
              <AdminMainsQuestionCreator
                questionId={editingMainsQuestionId}
                onBack={() => setMainsCreatorMode(false)}
                onSaved={() => {
                  setMainsCreatorMode(false);
                  void loadDashboardData();
                }}
              />
            ) : (
              <AdminMainsQuestionManager
                onEdit={(id) => {
                  setEditingMainsQuestionId(id);
                  setMainsCreatorMode(true);
                }}
                onCreateNew={() => {
                  setEditingMainsQuestionId(null);
                  setMainsCreatorMode(true);
                }}
              />
            )}
          </div>
        )}

        {activeTab === "assessment_taxonomy" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <AdminAssessmentTaxonomyManager />
          </div>
        )}
      </main>
    </div>
  );
}
