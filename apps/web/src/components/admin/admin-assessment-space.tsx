"use client";

import {
  BookOpen,
  Brain,
  FolderTree,
  LayoutDashboard,
  LogOut,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  BarChart3,
  ClipboardCheck,
  Settings2,
  FileText,
  ListChecks,
  Target,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SignInPanel } from "../auth/sign-in-panel";
import { useAuth } from "../auth/auth-context";
import { AdminQuizCreator } from "../current-affairs/admin/admin-quiz-creator";
import { AdminQuizManager } from "../current-affairs/admin/admin-quiz-manager";
import { AdminAssessmentTaxonomyManager } from "../current-affairs/admin/admin-assessment-taxonomy-manager";
import { AdminMainsQuestionManager } from "../current-affairs/admin/admin-mains-question-manager";
import { AdminMainsQuestionCreator } from "../current-affairs/admin/admin-mains-question-creator";
import { AdminMainsTaxonomyManager } from "../current-affairs/admin/admin-mains-taxonomy-manager";
import { AdminMainsEvaluationManager } from "../current-affairs/admin/admin-mains-evaluation-manager";
import { AssessmentAiSettingsManager } from "./assessment-ai-settings-manager";
import { AdminAssessmentPostingAgentManager } from "../current-affairs/admin/admin-assessment-posting-agent-manager";
import { AdminDiagnosticTestManager } from "./admin-diagnostic-test-manager";
import { AdminHomeCollectionsManager } from "./admin-home-collections-manager";

type AssessmentTab =
  | "overview"
  | "objective-questions"
  | "mains-questions"
  | "csat-questions"
  | "create-objective"
  | "create-mains"
  | "create-csat"
  | "mains-evaluations"
  | "assessment-categories"
  | "mains-categories"
  | "ai-settings"
  | "ai-posting-agent"
  | "diagnostic-tests"
  | "home-collections";

const ASSESSMENT_NAV: {
  tab: AssessmentTab;
  label: string;
  icon: React.ReactNode;
  group?: string;
}[] = [
  { tab: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, group: "Dashboard" },
  { tab: "diagnostic-tests", label: "Diagnostic Tests", icon: <Target className="h-4 w-4" />, group: "Dashboard" },
  { tab: "home-collections", label: "Home Collections", icon: <Layers className="h-4 w-4" />, group: "Configuration" },
  { tab: "objective-questions", label: "GK Questions", icon: <ListChecks className="h-4 w-4" />, group: "Question Banks" },
  { tab: "csat-questions", label: "CSAT Questions", icon: <ListChecks className="h-4 w-4" />, group: "Question Banks" },
  { tab: "mains-questions", label: "Mains Questions", icon: <FileText className="h-4 w-4" />, group: "Question Banks" },
  { tab: "create-objective", label: "Add GK Question", icon: <Plus className="h-4 w-4" />, group: "Create" },
  { tab: "create-csat", label: "Add CSAT Question", icon: <Plus className="h-4 w-4" />, group: "Create" },
  { tab: "create-mains", label: "Add Mains Question", icon: <Plus className="h-4 w-4" />, group: "Create" },
  { tab: "ai-posting-agent", label: "AI Posting Agent", icon: <Sparkles className="h-4 w-4" />, group: "Create" },
  { tab: "mains-evaluations", label: "Mains Evaluations", icon: <ClipboardCheck className="h-4 w-4" />, group: "Evaluation" },
  { tab: "assessment-categories", label: "Assessment Categories", icon: <FolderTree className="h-4 w-4" />, group: "Configuration" },
  { tab: "mains-categories", label: "Mains Categories", icon: <FolderTree className="h-4 w-4" />, group: "Configuration" },
  { tab: "ai-settings", label: "AI Settings", icon: <Settings2 className="h-4 w-4" />, group: "Configuration" },
];

const GROUPS = ["Dashboard", "Question Banks", "Create", "Evaluation", "Configuration"];

export function AdminAssessmentSpace() {
  const { token, user, logout, isInitialized } = useAuth();
  const params = useParams();

  const rawTab = params?.tab as string | undefined;
  const [activeTab, setActiveTab] = useState<AssessmentTab>((rawTab as AssessmentTab) || "overview");

  // Mains creator in-panel state (for edit flows)
  const [editingMainsId, setEditingMainsId] = useState<number | null>(null);
  const [mainsCreatorOpen, setMainsCreatorOpen] = useState(false);

  useEffect(() => {
    if (rawTab && rawTab !== activeTab) {
      setActiveTab(rawTab as AssessmentTab);
    }
  }, [rawTab, activeTab]);

  useEffect(() => {
    if (activeTab !== "mains-questions") {
      setMainsCreatorOpen(false);
    }
  }, [activeTab]);

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
              <h1 className="text-2xl font-black text-ink">Assessment Admin</h1>
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

  const hasAdminAccess = user && ["admin", "moderator", "content_editor", "evaluator"].includes(user.role);
  if (!hasAdminAccess) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="rounded-2xl border border-berry/30 bg-berry/10 p-6">
          <h1 className="text-2xl font-black text-ink">Access Restricted</h1>
          <p className="mt-2 text-sm font-semibold text-berry">Admin, moderator, content editor, or evaluator role required.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      {/* ── Left Sidebar ── */}
      <aside className="w-full lg:w-72 shrink-0 bg-white border-r border-line p-5 flex flex-col justify-between">
        <div className="space-y-5">
          {/* Module Header */}
          <div>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-xs font-bold text-ink/50 hover:text-civic transition-colors mb-4"
            >
              ← All Modules
            </Link>
            <div className="flex items-center gap-3 px-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-civic text-white shadow-md">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-black text-base text-ink leading-none">Assessment</h1>
                <span className="text-[10px] font-bold text-civic tracking-wider uppercase">Admin Module</span>
              </div>
            </div>
          </div>

          {/* Grouped Navigation */}
          <nav aria-label="Assessment Admin Navigation" className="space-y-4">
            {GROUPS.map((group) => {
              const items = ASSESSMENT_NAV.filter((n) => n.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <p className="text-[10px] font-black text-ink/40 uppercase tracking-widest px-3 mb-1">{group}</p>
                  <div className="space-y-0.5">
                    {items.map(({ tab, label, icon }) => (
                      <Link
                        key={tab}
                        href={`/admin/assessment/${tab}`}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          activeTab === tab
                            ? "bg-civic/10 text-civic border border-civic/20"
                            : "text-ink/65 hover:bg-paper hover:text-ink"
                        }`}
                      >
                        {icon}
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="mt-6 pt-4 border-t border-line/60 space-y-3">
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
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Assessment Module</span>
              <h2 className="text-3xl font-black text-ink mt-1">Assessment Overview</h2>
              <p className="text-sm text-ink/65 mt-1">Question banks, standalone tests, and syllabus configuration.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Objective Questions", icon: <ListChecks className="h-5 w-5" />, href: "/admin/assessment/objective-questions" },
                { label: "Mains Questions", icon: <FileText className="h-5 w-5" />, href: "/admin/assessment/mains-questions" },
                { label: "Mains Evaluations", icon: <ClipboardCheck className="h-5 w-5" />, href: "/admin/assessment/mains-evaluations" },
                { label: "Add Objective Q", icon: <Plus className="h-5 w-5" />, href: "/admin/assessment/create-objective" },
              ].map(({ label, icon, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="bg-white border border-line hover:border-civic rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-civic/10 text-civic group-hover:bg-civic group-hover:text-white transition-all">
                    {icon}
                  </span>
                  <span className="font-black text-sm text-ink group-hover:text-civic transition-colors">{label}</span>
                </Link>
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {[
                { href: "/admin/assessment/assessment-categories", label: "Assessment Categories", desc: "Manage GK/CSAT syllabus tree", icon: <FolderTree className="h-4 w-4" /> },
                { href: "/admin/assessment/mains-categories", label: "Mains Categories", desc: "Manage Mains papers & subjects", icon: <FolderTree className="h-4 w-4" /> },
                { href: "/admin/assessment/ai-settings", label: "AI Settings", desc: "Configure quiz generation prompts", icon: <Settings2 className="h-4 w-4" /> },
              ].map(({ href, label, desc, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white border border-line hover:border-civic rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                >
                  <div>
                    <h4 className="font-black text-sm text-ink group-hover:text-civic transition-colors">{label}</h4>
                    <p className="text-xs text-ink/55 mt-0.5">{desc}</p>
                  </div>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper group-hover:bg-civic/10 text-ink group-hover:text-civic shrink-0 transition-all">
                    {icon}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* OBJECTIVE (GK) QUESTIONS LIBRARY */}
        {activeTab === "objective-questions" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Question Bank</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">GK Questions Library</h2>
              <p className="text-sm text-ink/65 mt-1">Browse, filter, edit, and manage all General Knowledge questions.</p>
            </div>
            <AdminQuizManager initialRepo="gk" hideRepoTabs={true} />
          </div>
        )}

        {/* CSAT QUESTIONS LIBRARY */}
        {activeTab === "csat-questions" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Question Bank</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">CSAT Questions Library</h2>
              <p className="text-sm text-ink/65 mt-1">Browse, filter, edit, and manage all Aptitude, Logical Reasoning, and Reading Comprehension questions.</p>
            </div>
            <AdminQuizManager initialRepo="aptitude" hideRepoTabs={true} />
          </div>
        )}

        {/* MAINS QUESTIONS LIBRARY */}
        {activeTab === "mains-questions" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {mainsCreatorOpen ? (
              <AdminMainsQuestionCreator
                questionId={editingMainsId}
                onBack={() => setMainsCreatorOpen(false)}
                onSaved={() => setMainsCreatorOpen(false)}
              />
            ) : (
              <>
                <div>
                  <span className="text-xs font-bold text-civic uppercase tracking-wider">Question Bank</span>
                  <h2 className="text-2xl font-black text-ink mt-0.5">Mains Questions Library</h2>
                  <p className="text-sm text-ink/65 mt-1">Subjective questions with model answers, rubrics, and mains syllabus mapping.</p>
                </div>
                <AdminMainsQuestionManager
                  onEdit={(id) => {
                    setEditingMainsId(id);
                    setMainsCreatorOpen(true);
                  }}
                  onCreateNew={() => {
                    setEditingMainsId(null);
                    setMainsCreatorOpen(true);
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* CREATE OBJECTIVE (GK) QUESTION */}
        {activeTab === "create-objective" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Question Creator</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Add GK Question</h2>
              <p className="text-sm text-ink/65 mt-1">Create GK questions manually, via AI, or by parsing worksheets.</p>
            </div>
            <AdminQuizCreator initialContentType="gk" hideContentTypeSelector={true} />
          </div>
        )}

        {/* CREATE CSAT QUESTION */}
        {activeTab === "create-csat" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Question Creator</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Add CSAT Question</h2>
              <p className="text-sm text-ink/65 mt-1">Create CSAT & Aptitude math, logic, or comprehension questions manually, via AI, or by parsing worksheets.</p>
            </div>
            <AdminQuizCreator initialContentType="aptitude" hideContentTypeSelector={true} />
          </div>
        )}

        {/* CREATE MAINS QUESTION */}
        {activeTab === "create-mains" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <AdminMainsQuestionCreator
              questionId={null}
              onBack={() => {}}
              onSaved={() => {}}
            />
          </div>
        )}

        {/* MAINS EVALUATION QUEUE */}
        {activeTab === "mains-evaluations" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <AdminMainsEvaluationManager />
          </div>
        )}

        {/* ASSESSMENT CATEGORIES */}
        {activeTab === "assessment-categories" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Taxonomy Configuration</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Assessment Categories</h2>
              <p className="text-sm text-ink/65 mt-1">Configure GK and Aptitude syllabus — Exams, Subjects, Topics, Subtopics, and Question Natures.</p>
            </div>
            <AdminAssessmentTaxonomyManager />
          </div>
        )}

        {/* MAINS CATEGORIES */}
        {activeTab === "mains-categories" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Taxonomy Configuration</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">Mains Categories</h2>
              <p className="text-sm text-ink/65 mt-1">Configure Mains syllabus — Papers, Subject Areas, Themes, Topics, and Subtopics.</p>
            </div>
            <AdminMainsTaxonomyManager />
          </div>
        )}

        {/* DIAGNOSTIC TESTS */}
        {activeTab === "diagnostic-tests" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <AdminDiagnosticTestManager />
          </div>
        )}

        {/* HOME COLLECTIONS */}
        {activeTab === "home-collections" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <AdminHomeCollectionsManager />
          </div>
        )}

        {/* AI SETTINGS */}
        {activeTab === "ai-settings" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">AI Configuration</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">AI Settings</h2>
              <p className="text-sm text-ink/65 mt-1">Configure quiz generation prompts, question schemas, and output styles.</p>
            </div>
            <AssessmentAiSettingsManager />
          </div>
        )}

        {/* AI POSTING AGENT */}
        {activeTab === "ai-posting-agent" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <span className="text-xs font-bold text-civic uppercase tracking-wider">Fast Posting</span>
              <h2 className="text-2xl font-black text-ink mt-0.5">AI Posting Agent</h2>
              <p className="text-sm text-ink/65 mt-1">Post GK, CSAT, and Mains questions from Word/PDF/URL, auto-classified into the full taxonomy tree.</p>
            </div>
            <AdminAssessmentPostingAgentManager />
          </div>
        )}
      </main>
    </div>
  );
}
