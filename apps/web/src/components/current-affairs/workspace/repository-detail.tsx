"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  BookOpen,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  Filter,
  FolderKanban,
  Printer,
  Save,
  Search,
  Star,
  Tags,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudentArticle, StudentCollectionDetail, StudentCollectionItem } from "../../../lib/api";
import { joinWorkspaceTags, splitWorkspaceTags, visibleWorkspaceTags } from "../../../lib/workspace";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, useAuth } from "../../auth/auth-context";
import { RepositoryBulkImportModal } from "./repository-bulk-import-modal";
import { RepositoryOwnArticleModal } from "./repository-own-article-modal";
import { WorkspaceArticleRow } from "./workspace-article-row";
import { WorkspaceSignIn } from "./workspace-sign-in";

type RepositoryDetailProps = {
  id: string;
};

type Flashcard = {
  answer: string;
  question: string;
  source: string;
};

const PINNED_TAG = "Pinned";
const REVISION_TAGS = new Set([
  "difficult",
  "needs revision",
  "needs_revision",
  "revise",
  "revise before mock",
  "revision",
  "weak topic"
]);

function formatDate(value: string | null | undefined): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function previewText(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= 280) return clean;
  return `${clean.slice(0, 280).trim()}...`;
}

function longerPreviewText(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= 700) return clean;
  return `${clean.slice(0, 700).trim()}...`;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemTitle(item: StudentCollectionItem): string {
  return item.fork?.forked_title ?? item.master_article?.title ?? item.fork?.master_article?.title ?? item.student_article?.title ?? "Untitled item";
}

function itemBody(item: StudentCollectionItem): string {
  return item.fork?.forked_body ?? item.master_article?.body ?? item.fork?.master_article?.body ?? item.student_article?.body ?? "";
}

function itemNote(item: StudentCollectionItem): string {
  return item.fork?.personal_summary ?? "";
}

function itemTags(item: StudentCollectionItem): string[] {
  return visibleWorkspaceTags(item.fork?.personal_tags ?? item.student_article?.personal_tags);
}

function isPinnedItem(item: StudentCollectionItem): boolean {
  return itemTags(item).some((tag) => normalizeTag(tag) === normalizeTag(PINNED_TAG));
}

function isDueRevisionDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now();
}

function isRevisionItem(item: StudentCollectionItem): boolean {
  if (item.fork?.read_status === "needs_revision" || isDueRevisionDate(item.fork?.scheduled_revision_at)) return true;
  return itemTags(item).some((tag) => REVISION_TAGS.has(normalizeTag(tag)));
}

function itemSearchText(item: StudentCollectionItem): string {
  return [
    itemTitle(item),
    itemBody(item),
    itemNote(item),
    itemTags(item).join(" "),
    item.master_article?.source_name,
    item.master_article?.source_url,
    item.student_article?.source_url
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildFlashcards(items: StudentCollectionItem[]): Flashcard[] {
  const cards = items.flatMap((item) => {
    const title = itemTitle(item);
    const note = itemNote(item);
    const body = itemBody(item);
    const tags = itemTags(item);
    const itemCards: Flashcard[] = [];

    if (note.trim()) {
      itemCards.push({
        question: `What personal note did you add for "${title}"?`,
        answer: note.trim(),
        source: title
      });
    }

    if (tags.length > 0) {
      itemCards.push({
        question: `Which revision tags are assigned to "${title}"?`,
        answer: tags.join(", "),
        source: title
      });
    }

    if (body.trim()) {
      itemCards.push({
        question: `Recall the key points from "${title}".`,
        answer: longerPreviewText(body),
        source: title
      });
    }

    return itemCards;
  });

  return cards.slice(0, 60);
}

export function RepositoryDetail({ id }: RepositoryDetailProps) {
  const { token } = useAuth();
  const [repository, setRepository] = useState<StudentCollectionDetail | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagMessage, setTagMessage] = useState<string | null>(null);
  const [editingTagDefinitions, setEditingTagDefinitions] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [ownArticleOpen, setOwnArticleOpen] = useState(false);
  const [editingOwnArticle, setEditingOwnArticle] = useState<StudentArticle | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [revisionOnly, setRevisionOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [savingTags, setSavingTags] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepository = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const record = await authenticatedGet<StudentCollectionDetail>(`/api/v1/current-affairs/me/collections/${id}`, token);
      setRepository(record);
      setTagDraft(joinWorkspaceTags(record.custom_tags));
    } catch {
      setError("Could not load repository.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void loadRepository();
  }, [loadRepository]);

  async function removeItem(itemId: number): Promise<void> {
    if (!token) return;
    await authenticatedDelete(`/api/v1/current-affairs/me/collection-items/${itemId}`, token);
    await loadRepository();
  }

  async function saveRepositoryTags(): Promise<void> {
    if (!token || !repository) return;
    setSavingTags(true);
    setTagMessage(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/collections/${repository.id}`, token, {
        custom_tags: splitWorkspaceTags(tagDraft)
      });
      await loadRepository();
      setEditingTagDefinitions(false);
      setTagMessage("Repository tags updated.");
    } catch {
      setTagMessage("Could not update repository tags.");
    } finally {
      setSavingTags(false);
    }
  }

  function cancelRepositoryTags(): void {
    setTagDraft(joinWorkspaceTags(repository?.custom_tags));
    setEditingTagDefinitions(false);
    setTagMessage(null);
  }

  function openOwnArticleModal(article: StudentArticle | null = null): void {
    setEditingOwnArticle(article);
    setOwnArticleOpen(true);
  }

  function closeOwnArticleModal(): void {
    setOwnArticleOpen(false);
    setEditingOwnArticle(null);
  }

  const repositoryTagFilters = useMemo(() => {
    const tagSet = new Set<string>();
    (repository?.custom_tags ?? []).forEach((tag) => tagSet.add(tag));
    (repository?.items ?? []).forEach((item) => {
      itemTags(item).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [repository?.custom_tags, repository?.items]);

  useEffect(() => {
    if (selectedTagFilter === "all") return;
    if (!repositoryTagFilters.includes(selectedTagFilter)) {
      setSelectedTagFilter("all");
    }
  }, [repositoryTagFilters, selectedTagFilter]);

  const existingMasterArticleIds = useMemo(() => {
    return new Set(
      (repository?.items ?? [])
        .map((item) => Number(item.fork?.master_article_id ?? item.master_article?.id ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
  }, [repository?.items]);

  const filteredItems = useMemo<StudentCollectionItem[]>(() => {
    const items = repository?.items ?? [];
    const search = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (selectedTagFilter !== "all" && !itemTags(item).includes(selectedTagFilter)) return false;
      if (revisionOnly && !isRevisionItem(item)) return false;
      if (pinnedOnly && !isPinnedItem(item)) return false;
      if (search && !itemSearchText(item).includes(search)) return false;
      return true;
    });
  }, [pinnedOnly, repository?.items, revisionOnly, searchQuery, selectedTagFilter]);

  const revisionItemCount = useMemo(() => (repository?.items ?? []).filter(isRevisionItem).length, [repository?.items]);
  const pinnedItemCount = useMemo(() => (repository?.items ?? []).filter(isPinnedItem).length, [repository?.items]);
  const flashcards = useMemo(() => buildFlashcards(filteredItems), [filteredItems]);
  const hasActiveViewFilter = selectedTagFilter !== "all" || revisionOnly || pinnedOnly || searchQuery.trim().length > 0;

  useEffect(() => {
    setFlashcardIndex(0);
  }, [flashcards.length, flashcardsOpen]);

  async function togglePinnedItem(item: StudentCollectionItem): Promise<void> {
    if (!token) return;

    const currentTags = item.fork?.personal_tags ?? item.student_article?.personal_tags ?? [];
    const hasPinned = currentTags.some((tag) => normalizeTag(tag) === normalizeTag(PINNED_TAG));
    const nextTags = hasPinned
      ? currentTags.filter((tag) => normalizeTag(tag) !== normalizeTag(PINNED_TAG))
      : [...currentTags, PINNED_TAG];

    if (item.fork) {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${item.fork.id}`, token, {
        personal_tags: nextTags
      });
    } else if (item.student_article) {
      await authenticatedPatch(`/api/v1/current-affairs/me/articles/${item.student_article.id}`, token, {
        personal_tags: nextTags
      });
    }

    await loadRepository();
  }

  function printRevisionSheet(): void {
    if (!repository) return;
    const printableItems = hasActiveViewFilter ? filteredItems : repository.items;
    const htmlItems = printableItems
      .map((item, index) => {
        const title = escapeHtml(itemTitle(item));
        const note = escapeHtml(itemNote(item) || item.student_article?.body || "");
        const tags = itemTags(item).map(escapeHtml).join(", ");
        const body = escapeHtml(longerPreviewText(itemBody(item)));
        return `
          <article class="item">
            <p class="count">${index + 1}</p>
            <h2>${title}</h2>
            ${tags ? `<p class="tags">${tags}</p>` : ""}
            ${note ? `<div class="note"><strong>Personal note</strong><br>${note.replace(/\n/g, "<br>")}</div>` : ""}
            ${body ? `<p class="body">${body}</p>` : ""}
          </article>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(repository.name)} revision sheet</title>
          <style>
            body { color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
            h1 { font-size: 28px; margin: 0 0 6px; }
            .meta { color: #475569; margin: 0 0 24px; }
            .item { border-top: 1px solid #cbd5e1; padding: 18px 0; page-break-inside: avoid; }
            .count { color: #0f9f8a; font-size: 12px; font-weight: 700; letter-spacing: .08em; margin: 0 0 4px; text-transform: uppercase; }
            h2 { font-size: 18px; margin: 0 0 8px; }
            .tags { color: #0f9f8a; font-size: 13px; font-weight: 700; margin: 0 0 10px; }
            .note { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; line-height: 1.55; margin: 10px 0; padding: 10px 12px; }
            .body { color: #334155; line-height: 1.6; margin: 10px 0 0; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(repository.name)}</h1>
          <p class="meta">${printableItems.length} items for quick revision</p>
          ${htmlItems}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <WorkspaceSignIn />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-5">
      <Link className="inline-flex items-center gap-2 text-sm font-bold text-civic" href="/current-affairs/workspace">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Notes Space
      </Link>

      {error && <p className="rounded-lg border border-berry/30 bg-berry/10 p-4 text-sm font-semibold text-berry">{error}</p>}
      {loading && !repository && (
        <p className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70">Loading repository...</p>
      )}

      {repository && (
        <>
          <section className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-civic">
                <FolderKanban aria-hidden="true" className="h-4 w-4" />
                Notes repository
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-ink md:text-4xl">{repository.name}</h1>
              {repository.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">{repository.description}</p>}
              <p className="mt-3 text-sm font-semibold text-ink/65">{repository.items.length} items</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white hover:bg-civic/90"
                onClick={() => openOwnArticleModal()}
                type="button"
              >
                <FilePlus2 aria-hidden="true" className="h-4 w-4" />
                Add own article
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-civic/35 bg-white px-4 text-sm font-bold text-civic hover:bg-civic/10"
                onClick={() => setImportOpen(true)}
                type="button"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Import articles
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-civic/35 bg-white px-4 text-sm font-bold text-civic hover:bg-civic/10 disabled:opacity-50"
                disabled={repository.items.length === 0}
                onClick={() => setFlashcardsOpen(true)}
                type="button"
              >
                <Brain aria-hidden="true" className="h-4 w-4" />
                Flashcards
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-civic/35 bg-white px-4 text-sm font-bold text-civic hover:bg-civic/10 disabled:opacity-50"
                disabled={repository.items.length === 0}
                onClick={printRevisionSheet}
                type="button"
              >
                <Printer aria-hidden="true" className="h-4 w-4" />
                Print sheet
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-civic/10 text-civic">
                <Tags aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-black text-ink">Repository tag definitions</h2>
                    <p className="mt-1 text-sm leading-6 text-ink/65">
                      These are the quick-edit tag choices for this repository.
                    </p>
                  </div>
                  {!editingTagDefinitions && (
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white"
                      onClick={() => setEditingTagDefinitions(true)}
                      type="button"
                    >
                      <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit tags
                    </button>
                  )}
                </div>
                {editingTagDefinitions ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input
                      className="h-10 rounded-md border border-line px-3 text-sm text-ink"
                      onChange={(event) => setTagDraft(event.target.value)}
                      placeholder="Weak topic, Revise before mock, Done"
                      value={tagDraft}
                    />
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60"
                      disabled={savingTags}
                      onClick={saveRepositoryTags}
                      type="button"
                    >
                      <Save aria-hidden="true" className="h-4 w-4" />
                      {savingTags ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
                      onClick={cancelRepositoryTags}
                      type="button"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                ) : repository.custom_tags && repository.custom_tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {repository.custom_tags.map((tag) => (
                      <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-line bg-paper/40 px-3 py-2 text-sm text-ink/60">
                    No custom tag definitions yet.
                  </p>
                )}
                {tagMessage && <p className="mt-2 text-xs font-semibold text-civic">{tagMessage}</p>}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
                  <Filter aria-hidden="true" className="h-4 w-4 text-civic" />
                  Revision controls
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  Showing {filteredItems.length} of {repository.items.length} items.
                </p>
              </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold ${
                      revisionOnly
                        ? "border-civic bg-civic text-white"
                        : "border-civic/30 bg-white text-civic hover:bg-civic/10"
                    }`}
                    onClick={() => setRevisionOnly((value) => !value)}
                    type="button"
                  >
                    <Brain aria-hidden="true" className="h-3.5 w-3.5" />
                    Revision mode
                    <span className={revisionOnly ? "text-white/80" : "text-civic/70"}>{revisionItemCount}</span>
                  </button>
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold ${
                      pinnedOnly
                        ? "border-civic bg-civic text-white"
                        : "border-civic/30 bg-white text-civic hover:bg-civic/10"
                    }`}
                    onClick={() => setPinnedOnly((value) => !value)}
                    type="button"
                  >
                    <Star aria-hidden="true" className={`h-3.5 w-3.5 ${pinnedOnly ? "fill-white" : ""}`} />
                    Pinned
                    <span className={pinnedOnly ? "text-white/80" : "text-civic/70"}>{pinnedItemCount}</span>
                  </button>
                </div>
              </div>

              <label className="relative block">
                <span className="sr-only">Search repository</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
                <input
                  className="h-11 w-full rounded-md border border-line bg-white pl-10 pr-3 text-sm text-ink outline-none focus:border-civic"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search title, notes, body, tags, or source"
                  value={searchQuery}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-bold ${
                    selectedTagFilter === "all"
                      ? "border-civic bg-civic text-white"
                      : "border-civic/30 bg-white text-civic hover:bg-civic/10"
                  }`}
                  onClick={() => setSelectedTagFilter("all")}
                  type="button"
                >
                  All tags
                </button>
                {repositoryTagFilters.map((tag) => (
                  <button
                    className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-bold ${
                      selectedTagFilter === tag
                        ? "border-civic bg-civic text-white"
                        : "border-civic/30 bg-white text-civic hover:bg-civic/10"
                    }`}
                    key={tag}
                    onClick={() => setSelectedTagFilter(tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {repository.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">
              Import institute articles or add your own article to start building this repository.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">
              No repository items match this tag filter.
            </p>
          ) : (
            <section className="grid gap-3" aria-label="Repository items">
              {filteredItems.map((item) => {
                if (item.fork) {
                  const fork = {
                    ...item.fork,
                    collection_ids: [repository.id],
                    collection_names: [repository.name],
                    master_article: item.master_article ?? item.fork.master_article
                  };

                  return (
                    <WorkspaceArticleRow
                      availableTags={repository.custom_tags ?? []}
                      compact
                      collections={[repository]}
                      fork={fork}
                      key={item.id}
                      onChanged={loadRepository}
                      showRepositoryAttach={false}
                      trailingAction={(
                        <>
                          <button
                            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold ${
                              isPinnedItem(item)
                                ? "border-civic bg-civic text-white"
                                : "border-civic/30 bg-civic/10 text-civic hover:bg-civic/15"
                            }`}
                            onClick={() => void togglePinnedItem(item)}
                            type="button"
                          >
                            <Star aria-hidden="true" className={`h-4 w-4 ${isPinnedItem(item) ? "fill-white" : ""}`} />
                            {isPinnedItem(item) ? "Pinned" : "Pin"}
                          </button>
                          <button
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-berry/30 bg-berry/10 px-3 text-sm font-bold text-berry hover:bg-berry/15"
                            onClick={() => void removeItem(item.id)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                            Remove
                          </button>
                        </>
                      )}
                    />
                  );
                }

                const studentArticle = item.student_article;
                const title = studentArticle?.title ?? "Untitled own article";
                const studentTags = visibleWorkspaceTags(studentArticle?.personal_tags);
                const bodyPreview = previewText(studentArticle?.body);
                return (
                  <article className="rounded-lg border border-line bg-white p-4 shadow-sm" key={item.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className="mb-2 inline-flex rounded-md bg-saffron/10 px-2 py-1 text-xs font-bold text-saffron">
                          Own article
                        </span>
                        <h2 className="text-base font-extrabold leading-snug text-ink">{title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink/65">
                          <span className="inline-flex items-center gap-2">
                            <BookOpen aria-hidden="true" className="h-4 w-4 text-civic" />
                            Added {formatDate(item.created_at)}
                          </span>
                          {studentArticle?.source_url && (
                            <a
                              className="inline-flex items-center gap-1 font-bold text-civic hover:underline"
                              href={studentArticle.source_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Source
                              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold ${
                            isPinnedItem(item)
                              ? "border-civic bg-civic text-white"
                              : "border-civic/30 bg-civic/10 text-civic hover:bg-civic/15"
                          }`}
                          onClick={() => void togglePinnedItem(item)}
                          type="button"
                        >
                          <Star aria-hidden="true" className={`h-4 w-4 ${isPinnedItem(item) ? "fill-white" : ""}`} />
                          {isPinnedItem(item) ? "Pinned" : "Pin"}
                        </button>
                        {studentArticle && (
                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white hover:bg-civic/90"
                            onClick={() => openOwnArticleModal(studentArticle)}
                            type="button"
                          >
                            <Edit3 aria-hidden="true" className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-berry/30 bg-berry/10 px-3 text-sm font-bold text-berry hover:bg-berry/15"
                          onClick={() => void removeItem(item.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                    {studentTags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {studentTags.map((tag) => (
                          <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {bodyPreview && (
                      <p className="mt-3 rounded-md border border-saffron/25 bg-saffron/10 px-3 py-2 text-sm leading-6 text-ink/80">
                        {bodyPreview}
                      </p>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          <RepositoryBulkImportModal
            existingArticleIds={existingMasterArticleIds}
            open={importOpen}
            repository={repository}
            onClose={() => setImportOpen(false)}
            onImported={loadRepository}
          />
          <RepositoryOwnArticleModal
            article={editingOwnArticle}
            open={ownArticleOpen}
            repository={repository}
            onClose={closeOwnArticleModal}
            onSaved={loadRepository}
          />
          {flashcardsOpen && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4 py-8">
              <div className="w-full max-w-2xl rounded-lg border border-line bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
                      <Brain aria-hidden="true" className="h-4 w-4" />
                      Quick revision flashcards
                    </p>
                    <h2 className="mt-2 text-2xl font-black leading-tight text-ink">{repository.name}</h2>
                    <p className="mt-1 text-sm text-ink/60">
                      {flashcards.length} cards from the current filtered view.
                    </p>
                  </div>
                  <button
                    aria-label="Close flashcards"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-white text-ink hover:bg-paper"
                    onClick={() => setFlashcardsOpen(false)}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>

                {flashcards.length === 0 ? (
                  <div className="p-5">
                    <p className="rounded-lg border border-dashed border-line bg-paper/30 p-4 text-sm text-ink/65">
                      Add notes, tags, or article body text to generate quick revision flashcards.
                    </p>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="rounded-lg border border-civic/20 bg-civic/5 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-civic">
                        Card {flashcardIndex + 1} of {flashcards.length}
                      </p>
                      <h3 className="mt-3 text-xl font-black leading-tight text-ink">
                        {flashcards[flashcardIndex]?.question}
                      </h3>
                      <div className="mt-4 rounded-md border border-saffron/25 bg-saffron/10 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-saffron">Answer</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/80">
                          {flashcards[flashcardIndex]?.answer}
                        </p>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-ink/55">
                        Source: {flashcards[flashcardIndex]?.source}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-paper disabled:opacity-50"
                        disabled={flashcardIndex === 0}
                        onClick={() => setFlashcardIndex((value) => Math.max(0, value - 1))}
                        type="button"
                      >
                        Previous
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-md bg-civic px-4 text-sm font-bold text-white hover:bg-civic/90"
                        onClick={() => setFlashcardIndex((value) => (value + 1) % flashcards.length)}
                        type="button"
                      >
                        Next card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
