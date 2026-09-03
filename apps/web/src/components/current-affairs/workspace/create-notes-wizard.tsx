"use client";

// Step-by-step onboarding flow for the Notes Space, mirroring the assessment
// module's Create Test wizard: create/pick a repository, add articles into
// it, tag them, try editing a personal copy, then download — each step is a
// real action (not just an explainer), so a new student ends the flow with
// an actual working repository instead of just having read about one.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  Download,
  Edit3,
  FileDown,
  FolderKanban,
  Loader2,
  Plus,
  Save,
  Tags,
  Wand2
} from "lucide-react";
import type { StudentArticle, StudentCollection, StudentCollectionDetail, StudentCollectionItem } from "../../../lib/api";
import { splitWorkspaceTags, workspaceSlug } from "../../../lib/workspace";
import { ApiError, authenticatedGet, authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";
import { RenderedContent } from "../rendered-content";
import { SUMMARY_PRESETS } from "./ai-summarise-panel";
import { CapReachedNotice, isCapError } from "../../billing/cap-reached-notice";
import { downloadScannedPdf, type PdfSection } from "../../../lib/export-pdf";
import { useSubscription } from "../../../lib/use-subscription";
import { PremiumLockOverlay } from "../../billing/premium-lock-overlay";
import { RepositoryBulkImportModal } from "./repository-bulk-import-modal";
import { ForkTagQuickEdit } from "./fork-tag-quick-edit";
import { WorkspaceSignIn } from "./workspace-sign-in";

type Mode = "choose" | "manual" | "ai";
type Step = "repo" | "articles" | "summary" | "customize" | "download" | "done";

type StepDef = { id: Step; label: string };

const MANUAL_STEPS: StepDef[] = [
  { id: "repo", label: "Repository" },
  { id: "articles", label: "Add articles" },
  { id: "customize", label: "Customize" },
  { id: "download", label: "Download" }
];

// AI mode gets its own "Summarize" step between adding articles and
// customizing — a dedicated screen with its own article selection and
// result, not a question bundled into the articles step.
const AI_STEPS: StepDef[] = [
  { id: "repo", label: "Repository" },
  { id: "articles", label: "Add articles" },
  { id: "summary", label: "Summarize" },
  { id: "customize", label: "Customize" },
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

function StepProgress({ current, steps }: { current: Step; steps: StepDef[] }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
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
            {index < steps.length - 1 && <span className="h-px w-4 bg-line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function ModeSelectStep({ onSelect }: { onSelect: (mode: "manual" | "ai") => void }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelect("manual")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-line bg-surface p-6 text-left transition hover:border-civic hover:bg-civic/5"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-civic/10 text-civic transition group-hover:bg-civic group-hover:text-white">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-black text-ink">Manual</h2>
          <p className="mt-1 text-sm font-medium text-ink/60">Create a repository and add articles yourself, step by step.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("ai")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-line bg-surface p-6 text-left transition hover:border-civic hover:bg-civic/5"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-civic/10 text-civic transition group-hover:bg-civic group-hover:text-white">
          <Wand2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-black text-ink">AI-Assisted</h2>
          <p className="mt-1 text-sm font-medium text-ink/60">
            Pick a topic and a range of your own articles — AI will summarize just those into your first note. Nothing invented.
          </p>
        </div>
      </button>
    </div>
  );
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-civic text-white shadow-sm">
        <Bot className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-civic/15 bg-civic/5 px-4 py-3.5">{children}</div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-ink px-4 py-2.5 text-sm font-bold text-white">{children}</div>
    </div>
  );
}

export function CreateNotesWizard() {
  const { token, user, isInitialized } = useAuth();
  const searchParams = useSearchParams();
  const { hasEntitlement } = useSubscription(token);
  const hasAiAccess = hasEntitlement("current_affairs.notes_workspace") || hasEntitlement("current_affairs.editorial_access");

  const modeParam = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(modeParam === "manual" || modeParam === "ai" ? modeParam : "choose");

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
  const [capError, setCapError] = useState<ApiError | null>(null);

  const [repository, setRepository] = useState<StudentCollectionDetail | null>(null);
  const [loadingRepository, setLoadingRepository] = useState(false);

  // Step 2 — articles
  const [importOpen, setImportOpen] = useState(false);

  // Step 3 — customize: tag vocabulary, per-article edit (opt-in), notes, tags
  const [tagDraft, setTagDraft] = useState("");
  const [savingTagVocabulary, setSavingTagVocabulary] = useState(false);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);

  // Step 4 — download
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  // AI-Assisted mode only — presentation state for the chat turns, plus the
  // grounded-summary step (its own selection + result, not bundled into
  // adding articles). Everything else (repo creation, article import, tags,
  // edit, download) reuses the exact same state/handlers as Manual.
  const [aiRepoChoiceMade, setAiRepoChoiceMade] = useState(false);
  const [selectedForSummary, setSelectedForSummary] = useState<Set<number>>(new Set());
  const [generatedSummary, setGeneratedSummary] = useState<{ title: string; body: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Within-step chat pacing (repo step's progressive reveal) scrolls to the
  // latest turn. Switching steps entirely, on the other hand, always
  // scrolls back to the top of the new step — so a long article or tag list
  // never leaves the student stranded below the fold with no visible way
  // back to the step's own controls.
  useEffect(() => {
    if (mode !== "ai" || step !== "repo") return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mode, step, aiRepoChoiceMade, repoTab]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

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
    setCapError(null);
    try {
      const created = await authenticatedPost<StudentCollection>("/api/v1/current-affairs/me/collections", token, {
        name: name.trim(),
        slug: workspaceSlug(name),
        description: description.trim() || undefined,
        custom_tags: splitWorkspaceTags(customTags)
      });
      await loadRepository(created.id);
      setStep("articles");
    } catch (err) {
      // A free account out of repositories gets a 402 naming the limit; telling
      // them to "try a different name" sent them renaming instead of upgrading.
      if (isCapError(err)) setCapError(err);
      else setRepoError("Could not create the repository. Try a different name.");
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

  function noteValue(item: StudentCollectionItem): string {
    if (item.fork && notesDraft[item.fork.id] !== undefined) return notesDraft[item.fork.id]!;
    return item.fork?.personal_summary ?? "";
  }

  async function saveNote(forkId: number, value: string): Promise<void> {
    if (!token || !repository) return;
    setSavingNotesId(forkId);
    try {
      await authenticatedPatch(`/api/v1/current-affairs/me/forks/${forkId}`, token, { personal_summary: value });
      await loadRepository(repository.id);
    } finally {
      setSavingNotesId(null);
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

  // AI-Assisted only — summarizes exactly the fork IDs the student picked
  // on the dedicated Summarize step (real content, scoped server-side to
  // their own forks). Never generates from a bare topic. Saved as a
  // personal article and attached to the repository the same way the
  // manual "own article" flow does; the result is shown right there on
  // that step rather than jumping ahead automatically.
  async function generateSummary(forkIds: number[]): Promise<void> {
    if (!token || !repository || forkIds.length === 0) return;
    setSummarizing(true);
    setSummaryError(null);
    setCapError(null);
    setGeneratedSummary(null);
    try {
      const note = await authenticatedPost<{ title: string; body: string }>(
        "/api/v1/current-affairs/me/ai/generate-notes",
        token,
        {
          collection_id: repository.id,
          fork_ids: forkIds,
          instructions: aiInstructions.trim() || undefined
        }
      );
      const slug = `${workspaceSlug(note.title)}-${Date.now().toString().slice(-4)}`;
      const articleRecord = await authenticatedPost<StudentArticle>("/api/v1/current-affairs/me/articles", token, {
        title: note.title,
        slug,
        body: note.body,
        status: "published"
      });
      await authenticatedPost(`/api/v1/current-affairs/me/collections/${repository.id}/items`, token, {
        student_article_id: articleRecord.id
      });
      await loadRepository(repository.id);
      setGeneratedSummary(note);
    } catch (err) {
      // Two different walls land here: the AI Notes Helper needs Current
      // Affairs Pro outright (premium_required), and the personal-article
      // allowance can also be spent (cap_exceeded). Both are an upgrade
      // prompt, not "try again later".
      if (isCapError(err)) setCapError(err);
      else setSummaryError("Could not generate a summary right now. You can still continue without one.");
    } finally {
      setSummarizing(false);
    }
  }

  function toggleSummarySelection(forkId: number): void {
    setSelectedForSummary((prev) => {
      const next = new Set(prev);
      if (next.has(forkId)) next.delete(forkId);
      else next.add(forkId);
      return next;
    });
  }

  // Default to every added article selected when the Summarize step first
  // appears — the student can deselect any they don't want included.
  useEffect(() => {
    if (step === "summary" && selectedForSummary.size === 0 && forkItems.length > 0) {
      setSelectedForSummary(new Set(forkItems.map((item) => item.fork!.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, forkItems.length]);

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

  // AI mode keeps this turn focused on naming the repository — tag choices
  // get their own dedicated turn later, at the actual "Tag them" step, so
  // the conversation asks one thing at a time instead of bundling tags into
  // "what should I call it?". Manual mode keeps the field here since that's
  // an established, separate flow this change isn't touching.
  function renderNewRepoForm(showTagField: boolean) {
    return (
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
        {showTagField && (
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
        )}
        {repoError && <p className="text-sm font-semibold text-berry">{repoError}</p>}
      {capError && <CapReachedNotice error={capError} module="current_affairs" compact />}
        {capError && <CapReachedNotice error={capError} module="current_affairs" compact />}
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
    );
  }

  const existingRepoPicker = (
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
  );

  const steps = mode === "ai" ? AI_STEPS : MANUAL_STEPS;
  function stepEyebrow(id: Step): string {
    const index = steps.findIndex((entry) => entry.id === id);
    return `Step ${index + 1} of ${steps.length}`;
  }

  if (mode === "choose") {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-5">
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-civic" href="/current-affairs/workspace">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Notes Space
        </Link>
        <StepHeader eyebrow="Create Notes" title="How would you like to build this repository?" description="" />
        <ModeSelectStep onSelect={setMode} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-5">
      <div className="flex items-center justify-between gap-3">
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-civic" href="/current-affairs/workspace">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Notes Space
        </Link>
        {step === "repo" && (
          <button
            className="text-xs font-bold text-ink/50 hover:text-ink"
            onClick={() => setMode("choose")}
            type="button"
          >
            Choose a different way
          </button>
        )}
      </div>

      <StepProgress current={step} steps={steps} />
      <div ref={topRef} />

      {mode === "manual" && step === "repo" && (
        <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
          <StepHeader
            eyebrow={stepEyebrow("repo")}
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

          {repoTab === "new" ? renderNewRepoForm(true) : existingRepoPicker}
        </section>
      )}

      {mode === "ai" && step === "repo" && (
        <div className="space-y-4">
          <AiBubble>
            <p className="text-sm font-bold text-ink">
              Hi! I'll help you build a notes repository — a few quick questions, then I'll summarize the real
              articles you pick. I never invent notes on my own.
            </p>
          </AiBubble>

          <AiBubble>
            <p className="text-sm font-bold text-ink">New repository, or add into one you already have?</p>
            {!aiRepoChoiceMade ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRepoTab("new");
                    setAiRepoChoiceMade(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink/75 transition hover:border-civic hover:bg-civic/5"
                >
                  New repository
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepoTab("existing");
                    setAiRepoChoiceMade(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink/75 transition hover:border-civic hover:bg-civic/5"
                >
                  Use an existing one
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs font-semibold text-civic">Answered</p>
            )}
          </AiBubble>
          {aiRepoChoiceMade && <UserBubble>{repoTab === "new" ? "New repository" : "Use an existing one"}</UserBubble>}

          {aiRepoChoiceMade && (
            <AiBubble>
              <p className="text-sm font-bold text-ink">
                {repoTab === "new" ? "What should I call it?" : "Which repository should I add to?"}
              </p>
              <div className="mt-3">{repoTab === "new" ? renderNewRepoForm(false) : existingRepoPicker}</div>
            </AiBubble>
          )}

          <div ref={bottomRef} />
        </div>
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

          {mode === "manual" && step === "articles" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <StepHeader
                eyebrow={stepEyebrow("articles")}
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
                onClick={() => setStep("customize")}
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

          {mode === "ai" && step === "articles" && (
            <div className="space-y-4">
              <AiBubble>
                <p className="text-sm font-bold text-ink">
                  What topic or articles would you like in this repository? Browse and pick the real ones you want —
                  I'll only ever work from what you actually select.
                </p>
                <button
                  className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow"
                  onClick={() => setImportOpen(true)}
                  type="button"
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Browse & add articles
                </button>
                {forkItems.length > 0 && (
                  <div className="mt-3 grid max-h-48 gap-1.5 overflow-y-auto pr-1">
                    {forkItems.map((item) => (
                      <p className="truncate rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink/80" key={item.id}>
                        {itemTitle(item)}
                      </p>
                    ))}
                  </div>
                )}
              </AiBubble>
              {forkItems.length > 0 && <UserBubble>Added {forkItems.length} article{forkItems.length === 1 ? "" : "s"}</UserBubble>}

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-40"
                disabled={forkItems.length === 0}
                onClick={() => setStep("summary")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Continue
              </button>
              {forkItems.length === 0 && (
                <p className="text-xs font-semibold text-ink/50">Add at least one article to continue.</p>
              )}
            </div>
          )}

          {mode === "ai" && step === "summary" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              <AiBubble>
                <p className="text-sm font-bold text-ink">
                  Want an AI summary of your articles as your first note? Pick which ones to include below — I'll
                  only ever summarize what you select, nothing invented.
                </p>
              </AiBubble>

              <StepHeader
                eyebrow={stepEyebrow("summary")}
                title="Summarize your articles"
                description="Select which of your added articles to include, then generate a note built only from their real content."
              />

              {!hasAiAccess ? (
                <PremiumLockOverlay
                  title="AI summaries are a Current Affairs Pro feature"
                  description="Summarize your selected articles into a note automatically. Upgrade to Current Affairs Pro, or continue without one."
                  planName="Current Affairs Pro"
                />
              ) : generatedSummary ? (
                <div className="space-y-3 rounded-lg border border-civic/20 bg-civic/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-civic">Saved to your repository</p>
                  <h3 className="text-lg font-black text-ink">{generatedSummary.title}</h3>
                  {/* The note comes back as HTML, like every other article
                      body on the platform — printed as text it would show the
                      reader its own tags. */}
                  <RenderedContent
                    className="rich-html max-h-64 overflow-y-auto rounded-md bg-surface p-3 text-sm leading-relaxed text-ink/80"
                    content={generatedSummary.body}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-lg border border-line bg-paper/30 p-2 pr-1.5">
                    {forkItems.map((item) => (
                      <label
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface"
                        key={item.id}
                      >
                        <input
                          checked={!!item.fork && selectedForSummary.has(item.fork.id)}
                          className="h-4 w-4 accent-civic"
                          onChange={() => item.fork && toggleSummarySelection(item.fork.id)}
                          type="checkbox"
                        />
                        <span className="truncate text-sm font-semibold text-ink/80">{itemTitle(item)}</span>
                      </label>
                    ))}
                  </div>
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">
                      What kind of summary do you want?
                    </span>
                    <textarea
                      className="min-h-20 rounded-md border border-line bg-surface p-2.5 text-xs font-semibold text-ink outline-none focus:border-civic"
                      onChange={(event) => setAiInstructions(event.target.value)}
                      placeholder="Example: ten one-line prelims pointers, focusing on the schemes and their ministries."
                      value={aiInstructions}
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUMMARY_PRESETS.map((preset) => (
                      <button
                        className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink/70 hover:border-civic hover:text-civic"
                        key={preset.label}
                        onClick={() => setAiInstructions(preset.prompt)}
                        type="button"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                    disabled={summarizing || selectedForSummary.size === 0}
                    onClick={() => void generateSummary(Array.from(selectedForSummary))}
                    type="button"
                  >
                    {summarizing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                    {summarizing
                      ? "Summarizing..."
                      : `Summarize ${selectedForSummary.size || ""} article${selectedForSummary.size === 1 ? "" : "s"}`}
                  </button>
                  {summaryError && <p className="text-sm font-semibold text-berry">{summaryError}</p>}
                  {capError && <CapReachedNotice error={capError} module="current_affairs" compact />}
                </div>
              )}

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white shadow disabled:opacity-60"
                disabled={summarizing}
                onClick={() => setStep("customize")}
                type="button"
              >
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
                Continue
              </button>
            </section>
          )}

          {step === "customize" && (
            <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-sm">
              {mode === "ai" && (
                <AiBubble>
                  <p className="text-sm font-bold text-ink">
                    Now let's customise your notes — edit any article if you like, add quick-revision notes, and tag
                    them for filtering.
                  </p>
                </AiBubble>
              )}

              <StepHeader
                eyebrow={stepEyebrow("customize")}
                title="Customise your notes content"
                description="You can edit them as per your need, add notes to them for quick revision, and assign tags for quick filtering."
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

              <div className="grid max-h-[32rem] gap-3 overflow-y-auto pr-1">
                {forkItems.map((item) => {
                  const isEditing = editingItemId === item.id;
                  return (
                    <div className="space-y-3 rounded-lg border border-line bg-paper/30 p-4" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-black text-ink">{itemTitle(item)}</p>
                        <button
                          className="shrink-0 text-xs font-bold text-civic hover:text-civic/80"
                          onClick={() => (isEditing ? setEditingItemId(null) : startEditing(item))}
                          type="button"
                        >
                          {isEditing ? "Close editor" : "Edit"}
                        </button>
                      </div>

                      {isEditing && (
                        <div className="grid gap-2 rounded-md border border-line bg-surface p-3">
                          <label className="grid gap-1 text-xs font-bold text-ink/70">
                            Title
                            <input
                              className="h-10 rounded-md border border-line px-3 text-sm font-normal"
                              onChange={(event) => setEditTitle(event.target.value)}
                              value={editTitle}
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-ink/70">
                            Body
                            <textarea
                              className="min-h-32 rounded-md border border-line px-3 py-2 text-sm font-normal leading-6"
                              onChange={(event) => setEditBody(event.target.value)}
                              value={editBody}
                            />
                          </label>
                          <button
                            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-civic px-4 text-xs font-bold text-white shadow disabled:opacity-60"
                            disabled={savingEdit}
                            onClick={saveEdit}
                            type="button"
                          >
                            {savingEdit ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                            Save my edit
                          </button>
                          {editSaved && editingItemId === item.id && (
                            <p className="inline-flex items-center gap-1.5 text-xs font-bold text-civic">
                              <Check aria-hidden="true" className="h-4 w-4" />
                              Saved — this is your personal copy now.
                            </p>
                          )}
                        </div>
                      )}

                      <label className="grid gap-1 text-xs font-bold text-ink/70">
                        Notes (for quick revision)
                        <textarea
                          className="min-h-16 rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal leading-6"
                          onChange={(event) => {
                            if (!item.fork) return;
                            const forkId = item.fork.id;
                            setNotesDraft((prev) => ({ ...prev, [forkId]: event.target.value }));
                          }}
                          onBlur={() => item.fork && void saveNote(item.fork.id, noteValue(item))}
                          placeholder="A quick line or two to jog your memory later..."
                          value={noteValue(item)}
                        />
                      </label>
                      {item.fork && (
                        <button
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-civic/30 bg-civic/5 px-3 text-xs font-bold text-civic disabled:opacity-60"
                          disabled={savingNotesId === item.fork.id}
                          onClick={() => item.fork && void saveNote(item.fork.id, noteValue(item))}
                          type="button"
                        >
                          {savingNotesId === item.fork.id ? (
                            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {savingNotesId === item.fork.id ? "Saving..." : "Save note"}
                        </button>
                      )}

                      {item.fork && (
                        <ForkTagQuickEdit
                          availableTags={repository.custom_tags ?? []}
                          fork={item.fork}
                          onChanged={() => loadRepository(repository.id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

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
                eyebrow={stepEyebrow("download")}
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
