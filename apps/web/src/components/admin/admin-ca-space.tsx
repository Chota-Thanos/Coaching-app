"use client";

import {
  FileStack,
  FolderTree,
  Newspaper,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  ArrowRight,
  Brain,
  Sparkles,
  BookOpen,
  Plus,
  FileText,
  Inbox,
  Settings2,
  PenLine,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SignInPanel } from "../auth/sign-in-panel";
import { useAuth, authenticatedGet, authenticatedPost } from "../auth/auth-context";
import { AdminArticleManager } from "../current-affairs/admin/admin-article-manager";
import { AdminCategoryManager } from "../current-affairs/admin/admin-category-manager";
import { AdminIngestionManager } from "../current-affairs/admin/admin-ingestion-manager";
import { AdminArticleCreator } from "../current-affairs/admin/admin-article-creator";
import { AiSettingsManager } from "../current-affairs/admin/ai-settings-manager";
import { ContentTypeAiSettings } from "../current-affairs/admin/content-type-ai-settings";
import type { CategoryNode, AdminArticleSummary, IngestionJob, CreateAdminArticlePayload } from "../../lib/api";

type CATab =
  | "overview"
  | "articles"
  | "prelims-pyq"
  | "mains-pyq"
  | "create"
  | "ingestion"
  | "categories"
  | "ai-settings";

const CA_NAV: { tab: CATab; label: string; icon: React.ReactNode; description: string }[] = [
  { tab: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, description: "Dashboard & stats" },
  { tab: "articles", label: "Articles Library", icon: <Newspaper className="h-4 w-4" />, description: "All current affairs articles" },
  { tab: "prelims-pyq", label: "Prelims PYQ Library", icon: <BookOpen className="h-4 w-4" />, description: "Prelims past year questions" },
  { tab: "mains-pyq", label: "Mains PYQ Library", icon: <FileText className="h-4 w-4" />, description: "Mains past year questions" },
  { tab: "create", label: "Create Content", icon: <PenLine className="h-4 w-4" />, description: "Write or generate articles" },
  { tab: "ingestion", label: "Ingestion Queue", icon: <Inbox className="h-4 w-4" />, description: "Review AI-parsed articles" },
  { tab: "categories", label: "Article Categories", icon: <FolderTree className="h-4 w-4" />, description: "Manage CA category tree" },
  { tab: "ai-settings", label: "AI Settings", icon: <Settings2 className="h-4 w-4" />, description: "Prompts & style guides" },
];

interface AdminCASpaceProps {
  overrideTab?: CATab;
  overrideSubView?: "daily-news" | "summaries" | "mains-notes" | "prelims-pyq" | "mains-pyq";
}

export function AdminCASpace({ overrideTab, overrideSubView }: AdminCASpaceProps = {}) {
  const { token, user, logout, isInitialized } = useAuth();
  const params = useParams();
  const router = useRouter();

  const rawTab = params?.tab as string | undefined;
  const [activeTab, setActiveTab] = useState<CATab>(overrideTab || (rawTab as CATab) || "overview");

  useEffect(() => {
    if (overrideTab) {
      setActiveTab(overrideTab);
    } else if (rawTab && rawTab !== activeTab) {
      setActiveTab(rawTab as CATab);
    }
  }, [overrideTab, rawTab, activeTab]);

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [recentArticles, setRecentArticles] = useState<AdminArticleSummary[]>([]);
  const [stats, setStats] = useState({ totalArticles: 0, rootCategories: 0, pendingIngestions: 0, aiGenerated: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [creatorMessage, setCreatorMessage] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    try {
      const fetchedCats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
      setCategories(fetchedCats);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/current-affairs/articles?limit=30&offset=0`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const fetchedArticles = (await response.json()) as AdminArticleSummary[];
        setRecentArticles(fetchedArticles.slice(0, 5));
        setStats({
          totalArticles: fetchedArticles.length,
          rootCategories: fetchedCats.filter((c) => c.parent_id === null).length,
          pendingIngestions: 0,
          aiGenerated: fetchedArticles.filter((a) => a.is_ai_generated).length,
        });
      }

      const fetchedJobs = await authenticatedGet<IngestionJob[]>(
        "/api/v1/current-affairs/admin/ingestion-jobs?limit=50",
        token
      );
      const pending = fetchedJobs.filter((j) => j.status === "queued" || j.status === "parsed").length;
      setStats((prev) => ({ ...prev, pendingIngestions: pending }));
    } catch (err) {
      console.error("Error loading CA dashboard:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadDashboardData();
  }, [token, loadDashboardData]);

  const handleCreateArticleSubmit = async (payload: CreateAdminArticlePayload) => {
    if (!token) return;
    setSavingArticle(true);
    setCreatorMessage(null);
    try {
      const res = await authenticatedPost<{ id: number }>(
        "/api/v1/current-affairs/articles",
        token,
        payload
      );
      setCreatorMessage("Article successfully created and published in library.");
      void loadDashboardData();
      return res;
    } catch {
      setCreatorMessage("Failed to create article. Check that the URL slug is unique.");
    } finally {
      setSavingArticle(false);
    }
  };

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm text-center animate-pulse">
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
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-ink">Current Affairs Admin</h1>
              <p className="mt-2 text-sm text-ink/70">Sign in with an admin or editor account to continue.</p>
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
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">
            Admin, moderator, or content editor role required.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      {/* ── Left Sidebar ── */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border-r border-line p-5 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Module Header */}
          <div>
            <Link href="/admin" className="flex items-center gap-2 text-xs font-bold text-ink/50 hover:text-civic transition-colors mb-4">
              ← All Modules
            </Link>
            <div className="flex items-center gap-3 px-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <Newspaper className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-black text-base text-ink leading-none">Current Affairs</h1>
                <span className="text-[10px] font-bold text-emerald-600 tracking-wider uppercase">Admin Module</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav aria-label="Current Affairs Admin Navigation" className="space-y-0.5">
            {CA_NAV.map(({ tab, label, icon }) => {
              const isCreate = tab === "create";
              const isActive = activeTab === tab;
              
              return (
                <div key={tab} className="space-y-1">
                  <Link
                    href={`/admin/current-affairs/${tab}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "text-ink/65 hover:bg-paper hover:text-ink"
                    }`}
                  >
                    {icon}
                    {label}
                  </Link>
                  
                  {isCreate && (
                    <div className="pl-6 space-y-1 ml-5 border-l border-line/60">
                      {[
                        { label: "Daily News", subView: "daily-news", href: "/admin/current-affairs/create/daily-news" },
                        { label: "Prelims PYQs", subView: "prelims-pyq", href: "/admin/current-affairs/create/prelims-pyq" },
                        { label: "Editorial Summaries", subView: "summaries", href: "/admin/current-affairs/create/summaries" },
                        { label: "Mains Notes", subView: "mains-notes", href: "/admin/current-affairs/create/mains-notes" },
                        { label: "Mains PYQs", subView: "mains-pyq", href: "/admin/current-affairs/create/mains-pyq" },
                      ].map((sublink) => {
                        const isSubActive = overrideTab === "create" && overrideSubView === sublink.subView;
                        return (
                          <Link
                            key={sublink.href}
                            href={sublink.href}
                            className={`block py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                              isSubActive
                                ? "bg-emerald-50 text-emerald-700 font-bold border-l-2 border-emerald-500 pl-1.5"
                                : "text-ink/60 hover:bg-paper hover:text-ink"
                            }`}
                          >
                            {sublink.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="mt-8 pt-4 border-t border-line/60 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-paper font-bold text-ink uppercase text-sm border border-line">
              {user?.email?.charAt(0) ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink truncate">{user?.email}</p>
              <span className="text-[10px] font-bold text-ink/50 uppercase">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 h-9 border border-line hover:border-berry/40 rounded-xl text-xs font-bold text-ink hover:text-berry hover:bg-berry/5 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Current Affairs Module</span>
              <h2 className="text-3xl font-black text-ink mt-1">Content Overview</h2>
              <p className="text-sm text-ink/65 mt-1">Current Affairs content health and recent activity.</p>
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Articles", value: stats.totalArticles, icon: <Newspaper className="h-5 w-5" /> },
                { label: "Article Categories", value: stats.rootCategories, icon: <FolderTree className="h-5 w-5" /> },
                { label: "Pending Ingestion", value: stats.pendingIngestions, icon: <Inbox className="h-5 w-5" /> },
                { label: "AI Generated", value: stats.aiGenerated, icon: <Brain className="h-5 w-5" /> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-white border border-line rounded-2xl p-5 shadow-sm flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">{icon}</span>
                  <div>
                    <span className="text-xs font-bold text-ink/50 block">{label}</span>
                    <span className="text-2xl font-black text-ink">{loadingStats ? "…" : value}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-base font-black text-ink">Recently Added Articles</h3>
                <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden divide-y divide-line/60">
                  {recentArticles.length === 0 ? (
                    <div className="p-6 text-center text-sm text-ink/50">No articles yet.</div>
                  ) : (
                    recentArticles.map((art) => (
                      <div key={art.id} className="p-4 flex items-center justify-between gap-4 hover:bg-paper/30 transition-all">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-ink truncate">{art.title}</h4>
                          <div className="flex gap-2 items-center text-xs text-ink/50 mt-1">
                            <span className="font-semibold text-emerald-600">{art.content_kind.replace(/_/g, " ")}</span>
                            <span>•</span>
                            <span>{art.category?.name ?? "No category"}</span>
                          </div>
                        </div>
                        <Link
                          href="/admin/current-affairs/articles"
                          className="h-8 w-8 shrink-0 rounded-lg border border-line flex items-center justify-center hover:border-emerald-500 text-ink hover:text-emerald-600 transition-all"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-black text-ink">Quick Actions</h3>
                <div className="grid gap-3">
                  {[
                    { href: "/admin/current-affairs/create", title: "Write New Article", desc: "Manual or AI-assisted creation", icon: <PenLine className="h-4 w-4" /> },
                    { href: "/admin/current-affairs/ingestion", title: "Review Ingestion Queue", desc: "Approve & publish parsed articles", icon: <Inbox className="h-4 w-4" /> },
                    { href: "/admin/current-affairs/categories", title: "Manage Article Categories", desc: "Configure subject category tree", icon: <FolderTree className="h-4 w-4" /> },
                  ].map(({ href, title, desc, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="bg-white border border-line hover:border-emerald-400 rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                    >
                      <div>
                        <h4 className="font-black text-sm text-ink group-hover:text-emerald-700 transition-colors">{title}</h4>
                        <p className="text-xs text-ink/55 mt-0.5">{desc}</p>
                      </div>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper group-hover:bg-emerald-50 text-ink group-hover:text-emerald-600 shrink-0 transition-all">
                        {icon}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARTICLES LIBRARY */}
        {activeTab === "articles" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Content Management</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Articles Library</h2>
              <p className="text-sm text-ink/65 mt-1">Browse, search, edit, and manage all current affairs articles.</p>
            </div>
            <AdminArticleManager />
          </div>
        )}

        {/* PRELIMS PYQ LIBRARY */}
        {activeTab === "prelims-pyq" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Assessment Content</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Prelims PYQ Library</h2>
              <p className="text-sm text-ink/65 mt-1">All Prelims past year questions stored as article content.</p>
            </div>
            <AdminArticleManager defaultContentKind="prelims_pyq" />
          </div>
        )}

        {/* MAINS PYQ LIBRARY */}
        {activeTab === "mains-pyq" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Assessment Content</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Mains PYQ Library</h2>
              <p className="text-sm text-ink/65 mt-1">All Mains past year questions stored as article content.</p>
            </div>
            <AdminArticleManager defaultContentKind="mains_pyq" />
          </div>
        )}

        {/* CREATE CONTENT */}
        {activeTab === "create" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Content Publisher</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Create Content</h2>
              <p className="text-sm text-ink/65 mt-1">
                {!overrideSubView 
                  ? "Select the type of Current Affairs content you want to create." 
                  : `Compose and publish ${overrideSubView.replace("-", " ")} articles.`}
              </p>
            </div>
            
            {!overrideSubView ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl pt-2">
                {[
                  {
                    href: "/admin/current-affairs/create/daily-news",
                    title: "Daily News",
                    desc: "Compose daily factual news updates and articles.",
                    icon: <Newspaper className="h-6 w-6 text-emerald-600" />,
                    bg: "hover:border-emerald-500 hover:shadow-emerald-50/50"
                  },
                  {
                    href: "/admin/current-affairs/create/prelims-pyq",
                    title: "Prelims PYQs",
                    desc: "Add and organize Prelims past year questions with answer keys and explanations.",
                    icon: <BookOpen className="h-6 w-6 text-blue-600" />,
                    bg: "hover:border-blue-500 hover:shadow-blue-50/50"
                  },
                  {
                    href: "/admin/current-affairs/create/summaries",
                    title: "Editorial Summaries",
                    desc: "Analyze and summarize daily mains editorials and opinion essays.",
                    icon: <PenLine className="h-6 w-6 text-indigo-600" />,
                    bg: "hover:border-indigo-500 hover:shadow-indigo-50/50"
                  },
                  {
                    href: "/admin/current-affairs/create/mains-notes",
                    title: "Mains Notes",
                    desc: "Compose topic-wise GS syllabus notes and practice questions.",
                    icon: <FileText className="h-6 w-6 text-purple-600" />,
                    bg: "hover:border-purple-500 hover:shadow-purple-50/50"
                  },
                  {
                    href: "/admin/current-affairs/create/mains-pyq",
                    title: "Mains PYQs",
                    desc: "Add and organize Mains past year questions with model answers and approaches.",
                    icon: <Brain className="h-6 w-6 text-pink-600" />,
                    bg: "hover:border-pink-500 hover:shadow-pink-50/50"
                  }
                ].map(({ href, title, desc, icon, bg }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`bg-white border border-line rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between text-left group min-h-[190px] ${bg}`}
                  >
                    <div className="space-y-4">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper group-hover:bg-white group-hover:scale-110 transition-all shrink-0 shadow-xs border border-line/45">
                        {icon}
                      </span>
                      <div>
                        <h3 className="font-black text-base text-ink group-hover:text-emerald-700 transition-colors leading-tight">{title}</h3>
                        <p className="text-xs text-ink/55 mt-2 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-civic group-hover:text-emerald-600 uppercase tracking-wider pt-4 mt-auto">
                      Go to workspace <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <AdminArticleCreator
                categories={categories}
                message={creatorMessage}
                onSubmit={handleCreateArticleSubmit}
                pending={savingArticle}
                createType={overrideSubView}
              />
            )}
          </div>
        )}

        {/* INGESTION QUEUE */}
        {activeTab === "ingestion" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Content Pipeline</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Ingestion Queue</h2>
              <p className="text-sm text-ink/65 mt-1">Review and publish AI-parsed articles awaiting approval.</p>
            </div>
            <AdminIngestionManager />
          </div>
        )}

        {/* ARTICLE CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Taxonomy Management</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Article Categories</h2>
              <p className="text-sm text-ink/65 mt-1">Manage subject and topic categories for current affairs articles.</p>
            </div>
            <AdminCategoryManager />
          </div>
        )}

        {/* AI SETTINGS */}
        {activeTab === "ai-settings" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {overrideSubView ? (
              <ContentTypeAiSettings subView={overrideSubView} />
            ) : (
              <>
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">AI Configuration</span>
                  <h2 className="text-2xl font-black text-ink mt-0.5">AI Settings</h2>
                  <p className="text-sm text-ink/65 mt-1">Configure prompts, style guides, and subject-level AI instructions.</p>
                </div>
                <AiSettingsManager />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
