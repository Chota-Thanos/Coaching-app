"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FolderPlus, LayoutDashboard, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ReadingDashboard,
  StudentArticle,
  StudentCollection,
  StudentFork,
  StudentMasterArticle
} from "../../../lib/api";
import { CURRENT_AFFAIRS_HUBS, articleHref, contentKindLabel } from "../../../lib/current-affairs";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";
import { BulkImportPanel } from "./bulk-import-panel";
import { PersonalArticlesPanel } from "./personal-articles-panel";
import { RepositoryManager } from "./repository-manager";
import { WorkspaceQueuePanel } from "./workspace-queue-panel";
import { WorkspaceSignIn } from "./workspace-sign-in";
import { WorkspaceStatGrid } from "./workspace-stat-grid";

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
    if (!token || !selectedCollectionId) return;
    setAddingId(article.id);
    setMessage(null);
    try {
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
    <section className="space-y-4 rounded-lg border border-line bg-white p-4 shadow-sm">
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
              className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
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
          articles.slice(0, 5).map((article) => {
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

export function WorkspaceDashboard() {
  const { token, isInitialized } = useAuth();
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!token) {
      setState(initialState);
      return;
    }

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
      setError("Could not load Notes Space. Check that the API is running and sign in again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70">Verifying Notes Space session...</p>
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
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-5">
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic text-white px-4 text-sm font-bold shadow hover:bg-civic/90 transition-all"
            href="/current-affairs/workspace/ai-helper"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            AI Notes Helper
          </Link>
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

      {error && <p className="rounded-lg border border-berry/30 bg-berry/10 p-4 text-sm font-semibold text-berry">{error}</p>}
      {loading && !state.dashboard && (
        <p className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70">Loading Notes Space...</p>
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

          <details className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-base font-black text-ink">Bulk import articles</summary>
            <div className="mt-4">
              <BulkImportPanel collections={state.collections} onChanged={loadWorkspace} />
            </div>
          </details>

          <details className="rounded-lg border border-line bg-white p-4 shadow-sm">
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
    </main>
  );
}
