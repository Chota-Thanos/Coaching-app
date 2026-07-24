"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileDown, FolderPlus, LayoutDashboard, RefreshCw, Sparkles } from "lucide-react";
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
import { BulkImportPanel } from "./bulk-import-panel";
import { PersonalArticlesPanel } from "./personal-articles-panel";
import { RepositoryManager } from "./repository-manager";
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
    selector: "#tour-ai-helper-btn",
    badge: "Step 4 of 5: AI Notes Helper",
    title: "Generate AI Bullet Summaries",
    body: "Use the AI Notes Helper to synthesize custom notes, extract key themes, and summarize core takeaways from your saved current affairs database.",
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

function RepositorySuggestionPanel({
  articles,
  collections,
  forks,
  onChanged
}: {
  articles: StudentMasterArticle[];
  collections: StudentCollection[];
  forks: StudentFork[];
  onChanged: () => Promise<void>;
}) {
  const { token, refreshForks } = useAuth();
  const [collectionId, setCollectionId] = useState(collections[0]?.id ? String(collections[0].id) : "");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCollectionId((current) => current || (collections[0]?.id ? String(collections[0].id) : ""));
  }, [collections]);

  const selectedCollectionId = collectionId ? Number(collectionId) : null;
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? null;

  const articleIdsInSelectedRepository = useMemo(() => {
    if (!selectedCollectionId) return new Set<number>();
    return new Set(
      forks
        .filter((fork) => (fork.collection_ids ?? []).includes(selectedCollectionId))
        .map((fork) => Number(fork.master_article_id))
    );
  }, [forks, selectedCollectionId]);

  const contentSuggestions = useMemo(() => {
    return CURRENT_AFFAIRS_HUBS.map((hub) => ({
      hub,
      count: articles.filter((article) => article.content_kind === hub.contentKind).length
    })).filter((item) => item.count > 0).slice(0, 5);
  }, [articles]);

  const categorySuggestions = useMemo(() => {
    const categories = new Map<string, { name: string; count: number }>();
    for (const article of articles) {
      if (!article.category) continue;
      const key = String(article.category.id);
      const current = categories.get(key);
      categories.set(key, {
        name: article.category.name,
        count: (current?.count ?? 0) + 1
      });
    }
    return Array.from(categories.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [articles]);

  async function addArticle(article: StudentMasterArticle): Promise<void> {
    if (!selectedCollectionId) return;
    setAddingId(article.id);
    setMessage(null);
    try {
      if (!token) {
        const guestForksStr = localStorage.getItem("waytoias_guest_forks");
        const guestForks = guestForksStr ? JSON.parse(guestForksStr) : [];

        if (guestForks.length >= 3) {
          alert("⚡ You've reached the Guest limit of 3 saved articles. Please sign in or register to save unlimited articles and sync your repositories to the cloud!");
          window.location.href = `/login?next=/current-affairs/workspace`;
          return;
        }

        const alreadyAdded = guestForks.some(
          (f: any) =>
            f.master_article_id === article.id &&
            (f.collection_ids ?? []).includes(selectedCollectionId)
        );
        if (alreadyAdded) {
          setMessage("Already added to this repository.");
          return;
        }

        const existingFork = guestForks.find((f: any) => f.master_article_id === article.id);
        if (existingFork) {
          existingFork.collection_ids = [...(existingFork.collection_ids ?? []), selectedCollectionId];
        } else {
          guestForks.push({
            id: -(guestForks.length + 1),
            master_article_id: article.id,
            master_article: article,
            collection_ids: [selectedCollectionId],
            student_id: 0,
            custom_tags: [],
            revision_state: "new",
            created_at: new Date().toISOString()
          });
        }

        localStorage.setItem("waytoias_guest_forks", JSON.stringify(guestForks));
        await onChanged();
        setMessage(`Added locally to guest repository.`);
        return;
      }

      await authenticatedPost(`/api/v1/current-affairs/articles/${article.id}/fork`, token, {
        collection_id: selectedCollectionId
      });
      await refreshForks();
      await onChanged();
      setMessage(`Added to ${selectedCollection?.name ?? "repository"}.`);
    } catch {
      setMessage("Could not add this article.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
            <FolderPlus aria-hidden="true" className="h-4 w-4" />
            Add to repository
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">Suggestions for your notes</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">
            Pick a repository, then add suggested articles or open a repository to import by taxonomy.
          </p>
        </div>
      </div>

      {collections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-paper/40 p-4 text-sm text-ink/65">
          Create a repository first. Suggestions can then be added directly to it.
        </p>
      ) : (
        <>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink/60">
            Target repository
            <select
              id="tour-target-repo-select"
              className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-semibold normal-case tracking-normal text-ink"
              onChange={(event) => setCollectionId(event.target.value)}
              value={collectionId}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>

          {selectedCollection && (
            <Link
              id="tour-open-import-btn"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white"
              href={`/current-affairs/workspace/repositories/${selectedCollection.id}`}
            >
              Open repository import
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </>
      )}

      {contentSuggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink/50">Suggested content types</p>
          <div className="flex flex-wrap gap-2">
            {contentSuggestions.map(({ hub, count }) => (
              <Link
                className="rounded-full border border-civic/25 bg-civic/10 px-3 py-1 text-xs font-bold text-civic hover:bg-civic/15"
                href={`/current-affairs/${hub.path}`}
                key={hub.path}
              >
                {hub.shortLabel} - {count}
              </Link>
            ))}
          </div>
        </div>
      )}

      {categorySuggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink/50">Suggested categories</p>
          <div className="flex flex-wrap gap-2">
            {categorySuggestions.map((category) => (
              <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink/65" key={category.name}>
                {category.name} - {category.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {articles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-paper/40 p-4 text-sm text-ink/65">
            No article suggestions available yet.
          </p>
        ) : (
          articles.slice(0, 5).map((article, idx) => {
            const alreadyAdded = articleIdsInSelectedRepository.has(Number(article.id));
            return (
              <article className="rounded-lg border border-line bg-paper/30 p-3" key={article.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-civic">
                      {contentKindLabel(article.content_kind)}
                      {article.category ? ` - ${article.category.name}` : ""}
                    </p>
                    <h3 className="mt-1 text-sm font-black leading-snug text-ink">
                      <Link className="hover:text-civic" href={articleHref(article.slug)}>
                        {article.title}
                      </Link>
                    </h3>
                  </div>
                  <button
                    id={idx === 0 ? "tour-add-article-btn" : undefined}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:bg-paper disabled:text-ink/45"
                    disabled={!selectedCollectionId || alreadyAdded || addingId === article.id}
                    onClick={() => void addArticle(article)}
                    type="button"
                  >
                    {alreadyAdded ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />}
                    {alreadyAdded ? "Added" : addingId === article.id ? "Adding..." : "Add"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
      {message && <p className="text-xs font-semibold text-civic">{message}</p>}
    </section>
  );
}

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

  useEffect(() => {
    if (isInitialized && searchParams.get("start_tour") === "true") {
      setShowTour(true);
    }
  }, [isInitialized, searchParams]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token) {
        // Guest mode data fetching
        const publicArticlesRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/api/v1/current-affairs/articles?limit=10`
        );
        const publicArticles = await publicArticlesRes.json();
        
        const guestCollectionsStr = localStorage.getItem("waytoias_guest_collections");
        const guestForksStr = localStorage.getItem("waytoias_guest_forks");
        
        const guestCollections = guestCollectionsStr ? JSON.parse(guestCollectionsStr) : [];
        const guestForks = guestForksStr ? JSON.parse(guestForksStr) : [];
        
        setState({
          dashboard: {
            stats: { saved_articles: guestForks.length, completed_articles: 0, due_revisions: 0, reading_seconds_7d: 0 },
            continue_reading: [],
            due_revisions: [],
            latest_unread: [],
            recommended_articles: publicArticles || []
          },
          forks: guestForks,
          collections: guestCollections,
          studentArticles: []
        });
        return;
      }

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

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-5">
      {!token && (
        <section className="rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div>
            <h2 className="text-sm font-black text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Try it out! (Guest Mode)
            </h2>
            <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed max-w-xl">
              You are experiencing Notes Space as a guest. You can create repositories, browse suggested current affairs, and add up to 3 articles. 
              <strong> Sign in or create a free account</strong> to unlock unlimited notes, write custom bullet summaries, and sync your work permanently in the cloud.
            </p>
          </div>
          <Link
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 text-xs font-black text-white hover:bg-indigo-700 shadow transition-all text-center"
            href="/login?next=/current-affairs/workspace"
          >
            Sign In / Register
          </Link>
        </section>
      )}
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
        <div className="flex gap-3">
          <Link
            id="tour-ai-helper-btn"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic text-white px-4 text-sm font-bold shadow hover:bg-civic/90 transition-all"
            href="/current-affairs/workspace/ai-helper"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            AI Notes Helper
          </Link>
          {token && (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-4 text-sm font-bold text-civic disabled:opacity-60"
              disabled={downloadingAll}
              onClick={downloadAllNotes}
              type="button"
            >
              <FileDown aria-hidden="true" className="h-4 w-4" />
              {downloadingAll ? "Preparing PDF..." : "Download all notes"}
            </button>
          )}
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-4 text-sm font-bold text-civic disabled:opacity-60"
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

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_30rem]">
            <RepositoryManager collections={state.collections} onChanged={loadWorkspace} />
            <RepositorySuggestionPanel
              articles={state.dashboard.recommended_articles}
              collections={state.collections}
              forks={state.forks}
              onChanged={loadWorkspace}
            />
          </div>

          <details id="tour-bulk-import" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer text-base font-black text-ink">Bulk import articles</summary>
            <div className="mt-4">
              <BulkImportPanel collections={state.collections} onChanged={loadWorkspace} />
            </div>
          </details>

          <details id="tour-personal-notes" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer text-base font-black text-ink">Write your own note</summary>
            <div className="mt-4">
              <PersonalArticlesPanel
                articles={state.studentArticles}
                collections={state.collections}
                onChanged={loadWorkspace}
              />
            </div>
          </details>

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
