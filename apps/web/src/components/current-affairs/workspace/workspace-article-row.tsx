"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, Edit3, FileText, Highlighter, Save, StickyNote, Tags, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { StudentCollection, StudentFork } from "../../../lib/api";
import { articleHref, contentKindLabel } from "../../../lib/current-affairs";
import { joinWorkspaceTags, progressLabel, splitWorkspaceTags, visibleWorkspaceTags } from "../../../lib/workspace";
import { authenticatedPatch, authenticatedPut, useAuth } from "../../auth/auth-context";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { RenderedContent } from "../rendered-content";
import { downloadScannedPdf } from "../../../lib/export-pdf";
import { ForkTagQuickEdit } from "./fork-tag-quick-edit";
import { RepositoryAttachControl } from "./repository-attach-control";
import { SourceArticleConnections } from "./source-article-connections";

type WorkspaceArticleRowProps = {
  fork: StudentFork;
  collections: StudentCollection[];
  availableTags?: string[];
  compact?: boolean;
  showRepositoryAttach?: boolean;
  trailingAction?: ReactNode;
  onChanged: () => Promise<void>;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function WorkspaceArticleRow({
  fork,
  collections,
  availableTags,
  compact = false,
  showRepositoryAttach = true,
  trailingAction,
  onChanged
}: WorkspaceArticleRowProps) {
  const { token, user, refreshForks } = useAuth();
  const article = fork.master_article;
  const title = fork.forked_title ?? article?.title ?? `Article #${fork.master_article_id}`;
  const body = fork.forked_body ?? article?.body ?? "";
  const href = article?.slug ? articleHref(article.slug) : "/current-affairs/daily-news";
  const [summary, setSummary] = useState(fork.personal_summary ?? "");
  const [savedSummary, setSavedSummary] = useState(fork.personal_summary ?? "");
  const [editingSummary, setEditingSummary] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState(joinWorkspaceTags(visibleWorkspaceTags(fork.personal_tags)));
  const [savedTags, setSavedTags] = useState<string[]>(visibleWorkspaceTags(fork.personal_tags));
  const [editingTags, setEditingTags] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [articleTitle, setArticleTitle] = useState(title);
  const [articleBody, setArticleBody] = useState(body);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editingCopy, setEditingCopy] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [markReadError, setMarkReadError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const nextTags = visibleWorkspaceTags(fork.personal_tags);
    setSummary(fork.personal_summary ?? "");
    setSavedSummary(fork.personal_summary ?? "");
    setTagsDraft(joinWorkspaceTags(nextTags));
    setSavedTags(nextTags);
    setArticleTitle(fork.forked_title ?? article?.title ?? `Article #${fork.master_article_id}`);
    setArticleBody(fork.forked_body ?? article?.body ?? "");
    setBodyExpanded(false);
  }, [article?.body, article?.title, fork.forked_body, fork.forked_title, fork.id, fork.master_article_id, fork.personal_summary, fork.personal_tags]);

  async function markRead(): Promise<void> {
    if (!token) return;
    setMarkingRead(true);
    setMarkReadError(null);
    try {
      await authenticatedPut(`/api/v1/current-affairs/me/forks/${fork.id}/progress`, token, {
        progress_percent: 100,
        reading_seconds_delta: 0,
        mark_complete: true
      });
      await refreshForks();
      await onChanged();
    } catch {
      setMarkReadError("Could not mark this article as read. Try again.");
    } finally {
      setMarkingRead(false);
    }
  }

  async function savePersonalSummary(): Promise<void> {
    if (!token) return;
    setSavingSummary(true);
    setSummaryMessage(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${fork.id}`, token, {
        personal_summary: summary.trim() || null
      });
      await refreshForks();
      await onChanged();
      setSavedSummary(summary.trim());
      setEditingSummary(false);
      setSummaryMessage("Personal note saved.");
    } catch {
      setSummaryMessage("Could not save personal note.");
    } finally {
      setSavingSummary(false);
    }
  }

  async function saveTags(): Promise<void> {
    if (!token) return;
    const nextTags = splitWorkspaceTags(tagsDraft);
    setSavingTags(true);
    setTagsError(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${fork.id}`, token, {
        personal_tags: nextTags
      });
      await refreshForks();
      await onChanged();
      setSavedTags(nextTags);
      setTagsDraft(joinWorkspaceTags(nextTags));
      setEditingTags(false);
    } catch {
      setTagsError("Could not save tags. Try again.");
    } finally {
      setSavingTags(false);
    }
  }

  function cancelTags(): void {
    setTagsDraft(joinWorkspaceTags(savedTags));
    setTagsError(null);
    setEditingTags(false);
  }

  function cancelSummary(): void {
    setSummary(savedSummary);
    setSummaryMessage(null);
    setEditingSummary(false);
  }

  function cancelArticleCopy(): void {
    setArticleTitle(title);
    setArticleBody(body);
    setCopyError(null);
    setEditingCopy(false);
  }

  async function saveArticleCopy(): Promise<void> {
    if (!token) return;
    const nextTitle = articleTitle.trim();
    const nextBody = articleBody.trim();
    if (!nextTitle || !nextBody) return;

    setSavingCopy(true);
    setCopyError(null);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${fork.id}`, token, {
        forked_title: nextTitle,
        forked_body: nextBody
      });
      await refreshForks();
      await onChanged();
      setArticleTitle(nextTitle);
      setArticleBody(nextBody);
      setEditingCopy(false);
    } catch {
      setCopyError("Could not save your article copy. Try again.");
    } finally {
      setSavingCopy(false);
    }
  }

  async function downloadPdf(): Promise<void> {
    setDownloadingPdf(true);
    setDownloadError(null);
    try {
      const metaParts = [
        article?.content_kind ? contentKindLabel(article.content_kind) : null,
        article?.publication_date ? formatDate(article.publication_date) : null,
        article?.source_name ?? null
      ].filter(Boolean);
      await downloadScannedPdf(
        [
          {
            title: articleTitle,
            meta: metaParts.join(" · "),
            tags: savedTags,
            personalNote: savedSummary || undefined,
            bodyHtml: articleBody
          }
        ],
        articleTitle,
        user?.email ? `Personal copy - ${user.email}` : undefined
      );
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      setDownloadError("Could not generate the PDF. Try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (compact) {
    return (
      <article className="rounded-lg border border-line bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold leading-snug text-ink">
              <Link className="hover:text-civic" href={href}>
                {title}
              </Link>
            </h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink/45">
              {article?.content_kind ? contentKindLabel(article.content_kind) : "Saved article"} - {progressLabel(fork)}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/60">
              <div className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="h-4 w-4 text-civic" />
                <dt className="sr-only">Publication date</dt>
                <dd>{formatDate(article?.publication_date)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="h-4 w-4 text-civic" />
                <dt className="sr-only">Last updated</dt>
                <dd>{formatDate(fork.updated_at)}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!editingCopy && (
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-civic/30 bg-civic/10 px-3 text-xs font-bold text-civic"
                onClick={() => setBodyExpanded((value) => !value)}
                type="button"
              >
                {bodyExpanded ? <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />}
                {bodyExpanded ? "Hide body" : "Body"}
              </button>
            )}
            {!editingCopy && (
              <button className="inline-flex h-9 items-center gap-1 rounded-md bg-civic px-3 text-xs font-bold text-white" onClick={() => setEditingCopy(true)} type="button">
                <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                Edit copy
              </button>
            )}
            <button
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
              disabled={fork.read_status === "read" || markingRead}
              onClick={markRead}
              type="button"
            >
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              {markingRead ? "Saving..." : "Mark read"}
            </button>
            <button
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink disabled:opacity-60"
              disabled={downloadingPdf}
              onClick={downloadPdf}
              type="button"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              {downloadingPdf ? "Preparing..." : "Download PDF"}
            </button>
            <Link
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-xs font-bold text-civic"
              href={`/current-affairs/workspace/articles/${fork.id}`}
            >
              <Highlighter aria-hidden="true" className="h-3.5 w-3.5" />
              Highlight &amp; annotate
            </Link>
            {trailingAction}
          </div>
        </div>
        {markReadError && <p className="mt-2 text-xs font-semibold text-berry">{markReadError}</p>}
        {downloadError && <p className="mt-2 text-xs font-semibold text-berry">{downloadError}</p>}

        {showRepositoryAttach && (
          <div className="mt-3">
            <RepositoryAttachControl
              attachedCollectionIds={fork.collection_ids ?? []}
              collections={collections}
              forkId={fork.id}
              onAdded={onChanged}
            />
          </div>
        )}

        <section className="mt-3 rounded-md border border-saffron/30 bg-saffron/10 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-saffron">
                <StickyNote aria-hidden="true" className="h-3.5 w-3.5" />
                Personal note
              </p>
              {editingSummary ? (
                <div className="mt-2">
                  <textarea
                    className="min-h-16 w-full rounded-md border border-saffron/30 bg-white px-3 py-2 text-sm leading-6 text-ink"
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Add your own summary, reminder, or revision cue."
                    value={summary || ""}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={savingSummary}
                      onClick={savePersonalSummary}
                      type="button"
                    >
                      <Save aria-hidden="true" className="h-3.5 w-3.5" />
                      {savingSummary ? "Saving..." : "Save"}
                    </button>
                    <button className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink" onClick={cancelSummary} type="button">
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    {summaryMessage && <p className="text-xs font-semibold text-civic">{summaryMessage}</p>}
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink/80">
                  {savedSummary || "No personal note yet."}
                </p>
              )}
            </div>
            {!editingSummary && (
              <button className="shrink-0 text-xs font-bold text-civic" onClick={() => setEditingSummary(true)} type="button">
                {savedSummary ? "Edit" : "Add"}
              </button>
            )}
          </div>
        </section>

        <div className="mt-2">
          <section className="rounded-md border border-line bg-paper/20 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
                <Tags aria-hidden="true" className="h-4 w-4 text-civic" />
                Tags
              </p>
              {!editingTags && (
                <button className="text-xs font-bold text-civic" onClick={() => setEditingTags(true)} type="button">
                  {savedTags.length > 0 ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {editingTags ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  className="h-9 rounded-md border border-line bg-white px-3 text-sm text-ink"
                  onChange={(event) => setTagsDraft(event.target.value)}
                  placeholder="Difficult, Revise before mock"
                  value={tagsDraft}
                />
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60" disabled={savingTags} onClick={saveTags} type="button">
                  <Save aria-hidden="true" className="h-3.5 w-3.5" />
                  Save
                </button>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink" onClick={cancelTags} type="button">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  Cancel
                </button>
                {tagsError && <p className="col-span-full text-xs font-semibold text-berry">{tagsError}</p>}
              </div>
            ) : savedTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {savedTags.map((tag) => (
                  <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/55">No personal tags yet.</p>
            )}
            {availableTags && <ForkTagQuickEdit availableTags={availableTags} fork={fork} onChanged={onChanged} />}
          </section>

        </div>

        {(editingCopy || bodyExpanded) && (
        <section className="mt-2 rounded-md border border-line bg-paper/25 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
            <FileText aria-hidden="true" className="h-4 w-4 text-civic" />
            Editable article copy
          </p>
          {editingCopy ? (
            <div className="mt-3 grid gap-2">
              <input
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
                onChange={(event) => setArticleTitle(event.target.value)}
                value={articleTitle}
              />
              <RichTextMarkdownEditor
                value={articleBody}
                onChange={setArticleBody}
                placeholder="Edit your saved copy..."
                minHeightClass="min-h-36"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
                  disabled={savingCopy || !articleTitle.trim() || !articleBody.trim()}
                  onClick={saveArticleCopy}
                  type="button"
                >
                  <Save aria-hidden="true" className="h-3.5 w-3.5" />
                  {savingCopy ? "Saving..." : "Save article copy"}
                </button>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink" onClick={cancelArticleCopy} type="button">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  Cancel
                </button>
                {copyError && <p className="text-xs font-semibold text-berry">{copyError}</p>}
              </div>
            </div>
          ) : bodyExpanded ? (
            <RenderedContent
              className="mt-2 text-sm leading-6 text-ink/70"
              content={articleBody || "The article body is ready to edit after the note is saved."}
            />
          ) : null}
        </section>
        )}

        <div className="mt-2">
          <SourceArticleConnections article={article} />
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold leading-snug text-ink">
            <Link className="hover:text-civic" href={href}>
              {title}
            </Link>
          </h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink/45">
            {article?.content_kind ? contentKindLabel(article.content_kind) : "Saved article"} - {progressLabel(fork)}
          </p>
          <dl className="mt-3 grid gap-2 text-sm text-ink/65 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-civic" />
              <dt className="sr-only">Publication date</dt>
              <dd>{formatDate(article?.publication_date)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="h-4 w-4 text-civic" />
              <dt className="sr-only">Last updated</dt>
              <dd>{formatDate(fork.updated_at)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60"
            disabled={fork.read_status === "read" || markingRead}
            onClick={markRead}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {markingRead ? "Saving..." : "Mark read"}
          </button>
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink disabled:opacity-60"
            disabled={downloadingPdf}
            onClick={downloadPdf}
            type="button"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {downloadingPdf ? "Preparing..." : "Download PDF"}
          </button>
          <Link
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic/10 px-3 text-sm font-bold text-civic"
            href={`/current-affairs/workspace/articles/${fork.id}`}
          >
            <Highlighter aria-hidden="true" className="h-4 w-4" />
            Highlight &amp; annotate
          </Link>
          {trailingAction}
        </div>
      </div>
      {markReadError && <p className="mt-2 text-xs font-semibold text-berry">{markReadError}</p>}
      {downloadError && <p className="mt-2 text-xs font-semibold text-berry">{downloadError}</p>}
      {showRepositoryAttach && (
        <div className="mt-4">
          <RepositoryAttachControl
            attachedCollectionIds={fork.collection_ids ?? []}
            collections={collections}
            forkId={fork.id}
            onAdded={onChanged}
          />
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <section className="rounded-lg border border-line bg-paper/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
              <Tags aria-hidden="true" className="h-4 w-4 text-civic" />
              Tags
            </p>
            {!editingTags && (
              <button className="text-xs font-bold text-civic" onClick={() => setEditingTags(true)} type="button">
                {savedTags.length > 0 ? "Edit" : "Add"}
              </button>
            )}
          </div>
          {editingTags ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
                onChange={(event) => setTagsDraft(event.target.value)}
                placeholder="Difficult, Revise before mock"
                value={tagsDraft}
              />
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60" disabled={savingTags} onClick={saveTags} type="button">
                <Save aria-hidden="true" className="h-4 w-4" />
                Save
              </button>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink" onClick={cancelTags} type="button">
                <X aria-hidden="true" className="h-4 w-4" />
                Cancel
              </button>
              {tagsError && <p className="col-span-full text-xs font-semibold text-berry">{tagsError}</p>}
            </div>
          ) : savedTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {savedTags.map((tag) => (
                <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink/55">No personal tags yet.</p>
          )}
          {availableTags && (
            <ForkTagQuickEdit availableTags={availableTags} fork={fork} onChanged={onChanged} />
          )}
        </section>

        <section className="rounded-lg border border-line bg-paper/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
              <StickyNote aria-hidden="true" className="h-4 w-4 text-civic" />
              Personal note
            </p>
            {!editingSummary && (
              <button className="text-xs font-bold text-civic" onClick={() => setEditingSummary(true)} type="button">
                {savedSummary ? "Edit" : "Add"}
              </button>
            )}
          </div>
          {editingSummary ? (
            <div className="mt-3">
              <textarea
                className="min-h-20 w-full rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-ink"
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Add your own summary, reminder, or revision cue."
                value={summary || ""}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
                  disabled={savingSummary}
                  onClick={savePersonalSummary}
                  type="button"
                >
                  <Save aria-hidden="true" className="h-3.5 w-3.5" />
                  {savingSummary ? "Saving..." : "Save note"}
                </button>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink" onClick={cancelSummary} type="button">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  Cancel
                </button>
                {summaryMessage && <p className="text-xs font-semibold text-civic">{summaryMessage}</p>}
              </div>
            </div>
          ) : savedSummary ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/75">{savedSummary}</p>
          ) : (
            <p className="mt-2 text-sm text-ink/55">No personal note yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-paper/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
              <FileText aria-hidden="true" className="h-4 w-4 text-civic" />
              Editable article copy
            </p>
            {!editingCopy && (
              <button className="inline-flex items-center gap-1 text-xs font-bold text-civic" onClick={() => setEditingCopy(true)} type="button">
                <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                Edit copy
              </button>
            )}
          </div>
          {editingCopy ? (
            <div className="mt-3 grid gap-2">
              <input
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
                onChange={(event) => setArticleTitle(event.target.value)}
                value={articleTitle}
              />
              <RichTextMarkdownEditor
                value={articleBody}
                onChange={setArticleBody}
                placeholder="Edit your saved copy..."
                minHeightClass="min-h-36"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
                  disabled={savingCopy || !articleTitle.trim() || !articleBody.trim()}
                  onClick={saveArticleCopy}
                  type="button"
                >
                  <Save aria-hidden="true" className="h-3.5 w-3.5" />
                  {savingCopy ? "Saving..." : "Save article copy"}
                </button>
                <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink" onClick={cancelArticleCopy} type="button">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                  Cancel
                </button>
                {copyError && <p className="text-xs font-semibold text-berry">{copyError}</p>}
              </div>
            </div>
          ) : (
            <RenderedContent
              className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-ink/65"
              content={articleBody || "The article body is ready to edit after the note is saved."}
            />
          )}
        </section>

        <SourceArticleConnections article={article} />
      </div>
    </article>
  );
}
