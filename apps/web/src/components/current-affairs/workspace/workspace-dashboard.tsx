"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileDown, FolderPlus, Highlighter, LayoutDashboard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ReadingDashboard,
  StudentArticle,
  StudentCollection,
  StudentFork,
  StudentMasterArticle
} from "../../../lib/api";
import { CURRENT_AFFAIRS_HUBS, articleHref, contentKindLabel } from "../../../lib/current-affairs";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";
import { downloadScannedPdf, type PdfSection } from "../../../lib/export-pdf";
import { RepositoryManager } from "./repository-manager";
import { WorkspaceLimitBar, useWorkspaceLimits } from "./workspace-limit-bar";
import { WorkspaceQueuePanel } from "./workspace-queue-panel";
import { WorkspaceSignIn } from "./workspace-sign-in";
import { WorkspaceStatGrid } from "./workspace-stat-grid";
import { GuidedTourEngine } from "../../app/guided-tour-engine";

const WORKSPACE_TOUR_STEPS = [
  {
    selector: "#tour-create-repo-btn",
    badge: "Step 1 of 5: Create Repository",
    title: "Create a Notes Repository",
    body: "First, you need a repository to categorize your current affairs notes. Click the 'New repository' button above to open the creation form.",
    actionTrigger: "click" as const,
    actionText: "Click on the 'New repository' button above."
  },
  {
    selector: "#tour-target-repo-select",
    badge: "Step 2 of 5: Select Target Repository",
    title: "Select Active Repository",
    body: "Once your repository is created, select it from the dropdown. This is where newly added article suggestions and notes will be saved.",
    actionTrigger: "change" as const,
    actionText: "Select your newly created repository from the target repository dropdown."
  },
  {
    selector: "#tour-add-article-btn",
    badge: "Step 3 of 5: Save Suggestions",
    title: "Add Articles to Repository",
    body: "Browse through the suggested institute current affairs articles. Click the 'Add' button next to an article to fork it directly into your active repository.",
    actionTrigger: "click" as const,
    actionText: "Click the 'Add' button next to a suggested article above."
  },
  {
    selector: "#tour-create-notes-btn",
    badge: "Step 4 of 5: AI-Assisted Notes",
    title: "Let AI Help You Build a Repository",
    body: "Click 'Create Notes' and choose AI-Assisted mode — pick a topic and a range of your own selected articles, and AI will summarize just those into your first note.",
  },
  {
    selector: "#tour-bulk-import",
    badge: "Step 5 of 5: Advanced Features",
    title: "Bulk Import & Custom Notes",
    body: "Expand this section to import multiple matching articles at once, or use the section below to write manual notes from scratch. You're ready to organize your notes like a pro!"
  }
];

type WorkspaceState = {
  dashboard: ReadingDashboard | null;
  forks: StudentFork[];
  collections: StudentCollection[];
  studentArticles: StudentArticle[];
};

const initialState: WorkspaceState = {
  dashboard: null,
  forks: [],
  collections: [],
  studentArticles: []
};

function forkTitle(fork: StudentFork): string {
  return fork.forked_title ?? fork.master_article?.title ?? `Article #${fork.master_article_id}`;
}

function forkBody(fork: StudentFork): string {
  return fork.forked_body ?? fork.master_article?.body ?? "";
}

export function WorkspaceDashboard() {
  const { token, user, isInitialized } = useAuth();
  const searchParams = useSearchParams();
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);
  const { limits: workspaceLimits, reload: reloadLimits } = useWorkspaceLimits();

  useEffect(() => {
    if (isInitialized && searchParams.get("start_tour") === "true") {
      setShowTour(true);
    }
  }, [isInitialized, searchParams]);

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboard, forks, collections, studentArticles] = await Promise.all([
        authenticatedGet<ReadingDashboard>("/api/v1/current-affairs/me/reading-dashboard?limit=6", token),
        authenticatedGet<StudentFork[]>("/api/v1/current-affairs/me/forks?limit=100", token),
        authenticatedGet<StudentCollection[]>("/api/v1/current-affairs/me/collections", token),
        authenticatedGet<StudentArticle[]>("/api/v1/current-affairs/me/articles?limit=50", token)
      ]);
      setState({ dashboard, forks, collections, studentArticles });
    } catch {
      setError("Could not load Notes Space. Check that the API is running.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function downloadAllNotes(): Promise<void> {
    setDownloadingAll(true);
    setDownloadAllError(null);
    try {
      const forkSections: PdfSection[] = state.forks.map((fork) => ({
        title: forkTitle(fork),
        meta: [
          fork.collection_names && fork.collection_names.length > 0
            ? `Repository: ${fork.collection_names.join(", ")}`
            : "Repository: Unfiled",
          fork.master_article?.content_kind ? contentKindLabel(fork.master_article.content_kind) : null
        ]
          .filter(Boolean)
          .join(" · "),
        tags: fork.personal_tags,
        personalNote: fork.personal_summary || undefined,
        bodyHtml: forkBody(fork)
      }));

      const ownSections: PdfSection[] = state.studentArticles.map((article) => ({
        title: article.title,
        meta: "Repository: My own articles",
        tags: article.personal_tags,
        bodyHtml: article.body
      }));

      const allSections = [...forkSections, ...ownSections];
      if (allSections.length === 0) {
        setDownloadAllError("Nothing to export yet - save or write an article first.");
        return;
      }

      await downloadScannedPdf(allSections, "My Notes Space", user?.email ? `Personal copy - ${user.email}` : undefined);
    } catch (err) {
      console.error("Failed to generate master notes PDF:", err);
      setDownloadAllError("Could not generate the PDF. Try again.");
    } finally {
      setDownloadingAll(false);
    }
  }

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-surface p-5 text-sm font-semibold text-ink/70">Verifying Notes Space session...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <WorkspaceSignIn />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-5">
      <section className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-civic">
            <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
            Notes Space
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink md:text-4xl">Organize current affairs like a notes app</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70 md:text-base">
            Save institute articles into repositories, define your own tags, quick-edit personal notes, and import filtered articles in bulk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link
            id="tour-create-notes-btn"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic text-white px-3 text-xs font-bold shadow hover:bg-civic/90 transition-all sm:h-11 sm:px-4 sm:text-sm"
            href="/current-affairs/workspace/create"
          >
            <FolderPlus aria-hidden="true" className="h-4 w-4" />
            Create Notes
          </Link>
          {token && (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-xs font-bold text-civic sm:h-11 sm:px-4 sm:text-sm"
              href="/current-affairs/workspace/highlights"
            >
              <Highlighter aria-hidden="true" className="h-4 w-4" />
              My highlights
            </Link>
          )}
          {token && (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-xs font-bold text-civic disabled:opacity-60 sm:h-11 sm:px-4 sm:text-sm"
              disabled={downloadingAll}
              onClick={downloadAllNotes}
              type="button"
            >
              <FileDown aria-hidden="true" className="h-4 w-4" />
              {downloadingAll ? "Preparing PDF..." : "Download all notes"}
            </button>
          )}
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-xs font-bold text-civic disabled:opacity-60 sm:h-11 sm:px-4 sm:text-sm"
            disabled={loading}
            onClick={loadWorkspace}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      {downloadAllError && <p className="rounded-lg border border-berry/30 bg-berry/10 p-4 text-sm font-semibold text-berry">{downloadAllError}</p>}
      {error && <p className="rounded-lg border border-berry/30 bg-berry/10 p-4 text-sm font-semibold text-berry">{error}</p>}
      {loading && !state.dashboard && (
        <p className="rounded-lg border border-line bg-surface p-5 text-sm font-semibold text-ink/70">Loading Notes Space...</p>
      )}

      {state.dashboard && (
        <>
          <WorkspaceStatGrid dashboard={state.dashboard} />

          <WorkspaceLimitBar limits={workspaceLimits} />

          {(state.dashboard.continue_reading.length > 0 || state.dashboard.due_revisions.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {state.dashboard.continue_reading.length > 0 && (
                <WorkspaceQueuePanel
                  emptyText=""
                  forks={state.dashboard.continue_reading}
                  title="Continue reading"
                />
              )}
              {state.dashboard.due_revisions.length > 0 && (
                <WorkspaceQueuePanel
                  emptyText=""
                  forks={state.dashboard.due_revisions}
                  title="Revision due"
                />
              )}
            </div>
          )}

          {/* Suggestions used to sit beside this, and ran before anyone had made
              a folder -- telling a learner with nothing saved to pick a
              repository they had not created. They now live inside each folder,
              where the articles already there are something to reason from. */}
          <RepositoryManager
            collections={state.collections}
            onChanged={async () => {
              await loadWorkspace();
              reloadLimits();
            }}
          />

          {/* Bulk import and writing your own note both need a folder to put
              the result in, so they live inside a folder now rather than on the
              list of folders, where they asked which folder to use before the
              learner had opened one. */}

        </>
      )}
      {showTour && (
        <GuidedTourEngine
          steps={WORKSPACE_TOUR_STEPS}
          onClose={() => setShowTour(false)}
        />
      )}
    </main>
  );
}
