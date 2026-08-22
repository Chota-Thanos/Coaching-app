"use client";

// Step-by-step onboarding flow for the Notes Space, mirroring the assessment
// module's Create Test wizard: create/pick a repository, add articles into
// it, tag them, try editing a personal copy, then download — each step is a
// real action (not just an explainer), so a new student ends the flow with
// an actual working repository instead of just having read about one.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Edit3,
  FileDown,
  FolderKanban,
  Loader2,
  Plus,
  Save,
  Tags
} from "lucide-react";
import type { StudentCollection, StudentCollectionDetail, StudentCollectionItem } from "../../../lib/api";
import { splitWorkspaceTags, workspaceSlug } from "../../../lib/workspace";
import { authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";
import { downloadScannedPdf, type PdfSection } from "../../../lib/export-pdf";
import { RepositoryBulkImportModal } from "./repository-bulk-import-modal";
import { ForkTagQuickEdit } from "./fork-tag-quick-edit";
import { WorkspaceSignIn } from "./workspace-sign-in";

type Step = "repo" | "articles" | "tags" | "edit" | "download" | "done";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "repo", label: "Repository" },
  { id: "articles", label: "Add articles" },
  { id: "tags", label: "Tag them" },
  { id: "edit", label: "Edit your copy" },
  { id: "download", label: "Download" }
];

function itemTitle(item: StudentCollectionItem): string {
  return item.fork?.forked_title ?? item.master_article?.title ?? item.fork?.master_article?.title ?? item.student_article?.title ?? "Untitled item";
}

function itemBody(item: StudentCollectionItem): string {
  return item.fork?.forked_body ?? item.master_article?.body ?? item.fork?.master_article?.body ?? item.student_article?.body ?? "";
}

function StepHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-civic">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-black leading-tight text-ink md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">{description}</p>
    </div>
  );
}

function StepProgress({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => {
        const done = currentIndex > index;
        const active = currentIndex === index;
        return (
          <div className="flex items-center gap-2" key={step.id}>
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${
                active
                  ? "border-civic bg-civic text-white"
                  : done
                    ? "border-civic/30 bg-civic/10 text-civic"
                    : "border-line bg-surface text-ink/45"
              }`}
            >
              {done ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
              {step.label}
            </span>
            {index < STEPS.length - 1 && <span className="h-px w-4 bg-line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

export function CreateNotesWizard() {
  const { token, user, isInitialized } = useAuth();

  const [step, setStep] = useState<Step>("repo");

  // Step 1 — repository
  const [repoTab, setRepoTab] = useState<"new" | "existing">("new");
  const [collections, setCollections] = useState<StudentCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customTags, setCustomTags] = useState("");
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);
  const [submittingRepo, setSubmittingRepo] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [repository, setRepository] = useState<StudentCollectionDetail | null>(null);
  const [loadingRepository, setLoadingRepository] = useState(false);

  // Step 2 — articles
  const [importOpen, setImportOpen] = useState(false);

  // Step 3 — tags
  const [tagDraft, setTagDraft] = useState("");
  const [savingTagVocabulary, setSavingTagVocabulary] = useState(false);

  // Step 4 — edit a personal copy
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  // Step 5 — download
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!token || repoTab !== "existing" || collections.length > 0) return;
    let cancelled = false;
    setLoadingCollections(true);
    authenticatedGet<StudentCollection[]>("/api/v1/current-affairs/me/collections", token)
      .then((records) => {
        if (!cancelled) setCollections(records || []);
      })
      .catch(() => {
        if (!cancelled) setRepoError("Could not load your repositories.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCollections(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, repoTab]);

  const loadRepository = useCallback(
    async (id: number) => {
      if (!token) return;
      setLoadingRepository(true);
      try {
        const record = await authenticatedGet<StudentCollectionDetail>(`/api/v1/current-affairs/me/collections/${id}`, token);
        setRepository(record);
      } finally {
        setLoadingRepository(false);
      }
    },
    [token]
  );

  async function createRepository(): Promise<void> {
    if (!token || !name.trim()) return;
    setSubmittingRepo(true);
    setRepoError(null);
    try {
      const created = await authenticatedPost<StudentCollection>("/api/v1/current-affairs/me/collections", token, {
        name: name.trim(),
        slug: workspaceSlug(name),
        description: description.trim() || undefined,
        custom_tags: splitWorkspaceTags(customTags)
      });
      await loadRepository(created.id);
      setStep("articles");
    } catch {
      setRepoError("Could not create the repository. Try a different name.");
    } finally {
      setSubmittingRepo(false);
    }
  }

  async function continueWithExisting(): Promise<void> {
    if (!selectedExistingId) return;
    await loadRepository(selectedExistingId);
    setStep("articles");
  }

  async function saveTagVocabulary(): Promise<void> {
    if (!token || !repository) return;
    setSavingTagVocabulary(true);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/collections/${repository.id}`, token, {
        custom_tags: splitWorkspaceTags(tagDraft)
      });
      await loadRepository(repository.id);
      setTagDraft("");
    } finally {
      setSavingTagVocabulary(false);
    }
  }

  function startEditing(item: StudentCollectionItem): void {
    setEditingItemId(item.id);
    setEditTitle(itemTitle(item));
    setEditBody(itemBody(item));
    setEditSaved(false);
  }

  async function saveEdit(): Promise<void> {
    if (!token || !repository) return;
    const item = repository.items.find((entry) => entry.id === editingItemId);
    if (!item?.fork) return;
    setSavingEdit(true);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${item.fork.id}`, token, {
        forked_title: editTitle.trim() || undefined,
        forked_body: editBody
      });
      await loadRepository(repository.id);
      setEditSaved(true);
    } finally {
      setSavingEdit(false);
    }
  }

  async function downloadRepository(): Promise<void> {
    if (!repository) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const sections: PdfSection[] = repository.items.map((item) => ({
        title: itemTitle(item),
        tags: item.fork?.personal_tags ?? item.student_article?.personal_tags ?? [],
        personalNote: item.fork?.personal_summary || undefined,
        bodyHtml: itemBody(item)
      }));
      await downloadScannedPdf(sections, repository.name, user?.email ? `Personal copy - ${user.email}` : undefined);
      setDownloaded(true);
    } catch {
      setDownloadError("Could not generate the PDF. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  const forkItems = repository?.items.filter((item) => Boolean(item.fork)) ?? [];
  const editingItem = repository?.items.find((item) => item.id === editingItemId) ?? null;

  useEffect(() => {
    const firstItem = forkItems[0];
    if (step === "edit" && !editingItemId && firstItem) {
      startEditing(firstItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, forkItems.length, editingItemId]);

  if (!isInitialized) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <p className="rounded-lg border border-line bg-surface p-5 text-sm font-semibold text-ink/70">Loading...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <WorkspaceSignIn />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-5">
      <Link className="inline-flex items-center gap-2 text-sm font-bold text-civic" href="/current-affairs/workspace">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Notes Space
      </Link>

      <StepProgress current={step} />

      {step === "repo" && (
        <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
          <StepHeader
            eyebrow="Step 1 of 5"
            title="Start a repository"
            description="A repository groups related current-affairs articles and notes together — one per subject, exam, or revision cycle, whatever suits how you study."
          />

          <div className="inline-flex rounded-md border border-line bg-paper/40 p-1">
            <button
              className={`h-9 rounded px-4 text-sm font-bold transition ${repoTab === "new" ? "bg-civic text-white" : "text-ink/60 hover:text-ink"}`}
              onClick={() => setRepoTab("new")}
              type="button"
            >
              New repository
            </button>
            <button
              className={`h-9 rounded px-4 text-sm font-bold transition ${repoTab === "existing" ? "bg-civic text-white" : "text-ink/60 hover:text-ink"}`}
              onClick={() => setRepoTab("existing")}
              type="button"
            >
              Use an existing one
            </button>
          </div>

          {repoTab === "new" ? (
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm font-bold text-ink">
                Repository name
                <input
                  className="h-11 rounded-md border border-line px-3 text-base font-normal"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Prelims GS Revision"
                  value={name}
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-ink">
                Description (optional)
                <textarea
                  className="min-h-20 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
              <label className="grid gap-1 text-sm font-bold text-ink">
                Tag choices (optional)
                <input
                  className="h-11 rounded-md border border-line px-3 text-base font-normal"
                  onChange={(event) => setCustomTags(event.target.value)}
                  placeholder="Weak topic, Revise before mock, Done"
                  value={customTags}
                />
                <span className="text-xs font-medium text-ink/55">
                  You'll use these as one-tap tags in Step 3 — you can always add more later.
                </span>
              </label>
              {repoError && <p className="text-sm font-semibold text-berry">{repoError}</p>}
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                disabled={submittingRepo || !name.trim()}
                onClick={createRepository}
                type="button"
              >
                {submittingRepo ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
                Create & continue
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {loadingCollections ? (
                <p className="text-sm font-semibold text-ink/60">Loading your repositories...</p>
              ) : collections.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line bg-paper/40 px-3 py-4 text-sm text-ink/60">
                  You don't have any repositories yet — create a new one instead.
                </p>
              ) : (
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                  {collections.map((collection) => (
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 ${
                        selectedExistingId === collection.id ? "border-civic bg-civic/5" : "border-line bg-surface hover:border-civic/50"
                      }`}
                      key={collection.id}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-ink">{collection.name}</span>
                        <span className="text-xs font-semibold text-ink/55">{collection.item_count ?? 0} items</span>
                      </span>
                      <input
                        checked={selectedExistingId === collection.id}
                        className="h-4 w-4 accent-civic"
                        name="existing-repository"
                        onChange={() => setSelectedExistingId(collection.id)}
                        type="radio"
                      />
                    </label>
                  ))}
                </div>
              )}
              {repoError && <p className="text-sm font-semibold text-berry">{repoError}</p>}
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                disabled={!selectedExistingId || loadingRepository}
                onClick={continueWithExisting}
                type="button"
              >
                {loadingRepository ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                Continue
              </button>
            </div>
          )}
        </section>
      )}

      {step !== "repo" && repository && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-civic/20 bg-civic/5 px-4 py-3">
            <FolderKanban aria-hidden="true" className="h-4 w-4 shrink-0 text-civic" />
            <p className="text-sm font-bold text-ink">
              Building <span className="text-civic">{repository.name}</span>
              <span className="ml-2 font-semibold text-ink/55">{repository.items.length} items so far</span>
            </p>
          </div>

          {step === "articles" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <StepHeader
                eyebrow="Step 2 of 5"
                title="Add current affairs articles"
                description="Browse institute articles, filter by subject and date, and add the ones you want into this repository. Each one becomes your own editable copy."
              />

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow"
                onClick={() => setImportOpen(true)}
                type="button"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Browse & add articles
              </button>

              {forkItems.length > 0 && (
                <div className="grid gap-1.5">
                  {forkItems.map((item) => (
                    <p className="truncate rounded-md bg-paper/40 px-3 py-2 text-sm font-semibold text-ink/80" key={item.id}>
                      {itemTitle(item)}
                    </p>
                  ))}
                </div>
              )}

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-40"
                disabled={forkItems.length === 0}
                onClick={() => setStep("tags")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Continue
              </button>
              {forkItems.length === 0 && (
                <p className="text-xs font-semibold text-ink/50">Add at least one article to continue.</p>
              )}
            </section>
          )}

          {step === "tags" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <StepHeader
                eyebrow="Step 3 of 5"
                title="Tag them for quick revision"
                description="Tags let you filter this repository later — mark what's weak, what needs another pass, or what's done. Tap a tag to toggle it on an article."
              />

              {(repository.custom_tags?.length ?? 0) === 0 && (
                <div className="grid gap-2 rounded-lg border border-dashed border-line bg-paper/40 p-3 sm:grid-cols-[1fr_auto]">
                  <input
                    className="h-10 rounded-md border border-line px-3 text-sm text-ink"
                    onChange={(event) => setTagDraft(event.target.value)}
                    placeholder="Weak topic, Revise before mock, Done"
                    value={tagDraft}
                  />
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60"
                    disabled={savingTagVocabulary || !tagDraft.trim()}
                    onClick={saveTagVocabulary}
                    type="button"
                  >
                    <Tags aria-hidden="true" className="h-4 w-4" />
                    {savingTagVocabulary ? "Saving..." : "Add tag choices"}
                  </button>
                </div>
              )}

              <div className="grid gap-3">
                {forkItems.map((item) => (
                  <div className="rounded-lg border border-line bg-paper/30 p-3" key={item.id}>
                    <p className="truncate text-sm font-black text-ink">{itemTitle(item)}</p>
                    {item.fork && (
                      <ForkTagQuickEdit
                        availableTags={repository.custom_tags ?? []}
                        fork={item.fork}
                        onChanged={() => loadRepository(repository.id)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow"
                onClick={() => setStep("edit")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Continue
              </button>
            </section>
          )}

          {step === "edit" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <StepHeader
                eyebrow="Step 4 of 5"
                title="This is your copy — try editing it"
                description="Every article you add becomes a personal copy. Edit the title or body freely; the original institute article never changes."
              />

              {forkItems.length > 1 && (
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Pick an article to try editing
                  <select
                    className="h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink"
                    onChange={(event) => {
                      const item = repository.items.find((entry) => entry.id === Number(event.target.value));
                      if (item) startEditing(item);
                    }}
                    value={editingItem?.id ?? ""}
                  >
                    {forkItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {itemTitle(item)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {editingItem && (
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-bold text-ink">
                    Title
                    <input
                      className="h-11 rounded-md border border-line px-3 text-base font-normal"
                      onChange={(event) => setEditTitle(event.target.value)}
                      value={editTitle}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-ink">
                    Body
                    <textarea
                      className="min-h-40 rounded-md border border-line px-3 py-2 text-sm font-normal leading-6"
                      onChange={(event) => setEditBody(event.target.value)}
                      value={editBody}
                    />
                  </label>
                  <button
                    className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                    disabled={savingEdit}
                    onClick={saveEdit}
                    type="button"
                  >
                    {savingEdit ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                    Save my edit
                  </button>
                  {editSaved && (
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-civic">
                      <Check aria-hidden="true" className="h-4 w-4" />
                      Saved — this is your personal copy now.
                    </p>
                  )}
                </div>
              )}

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow"
                onClick={() => setStep("download")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Continue
              </button>
            </section>
          )}

          {step === "download" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <StepHeader
                eyebrow="Step 5 of 5"
                title="Download your repository"
                description="Take this repository with you as a personal PDF — every article, your edits, tags, and notes included. You can re-download anytime from the repository page."
              />

              <div className="flex items-center gap-3">
                <Edit3 aria-hidden="true" className="hidden h-4 w-4 text-ink/40 sm:block" />
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                  disabled={downloading}
                  onClick={downloadRepository}
                  type="button"
                >
                  {downloading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <FileDown aria-hidden="true" className="h-4 w-4" />}
                  {downloading ? "Preparing PDF..." : "Download as PDF"}
                </button>
              </div>
              {downloadError && <p className="text-sm font-semibold text-berry">{downloadError}</p>}
              {downloaded && (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-civic">
                  <Check aria-hidden="true" className="h-4 w-4" />
                  Downloaded.
                </p>
              )}

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow"
                onClick={() => setStep("done")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Finish
              </button>
            </section>
          )}

          {step === "done" && (
            <section className="space-y-5 rounded-lg border border-civic/30 bg-civic/5 p-6 text-center shadow-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-civic text-white">
                <Check aria-hidden="true" className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-ink">{repository.name} is ready</h1>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  You now know how to build a repository, add articles, tag them, edit your own copy, and download it.
                  Keep going from the repository page — import more articles, highlight text while reading, and revisit your tags anytime.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-5 text-sm font-bold text-white shadow"
                  href={`/current-affairs/workspace/repositories/${repository.id}`}
                >
                  Open {repository.name}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-paper"
                  href="/current-affairs/workspace"
                >
                  Back to Notes Space
                </Link>
              </div>
            </section>
          )}

          <RepositoryBulkImportModal
            existingArticleIds={new Set(repository.items.map((item) => Number(item.fork?.master_article_id ?? item.master_article?.id ?? 0)).filter((id) => id > 0))}
            open={importOpen}
            repository={repository}
            onClose={() => setImportOpen(false)}
            onImported={() => loadRepository(repository.id)}
          />
        </>
      )}
    </main>
  );
}
