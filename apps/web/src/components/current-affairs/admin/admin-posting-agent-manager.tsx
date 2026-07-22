"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Link2, Loader2, Sparkles, Upload, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CategoryNode } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_CONTENT_KINDS,
  ADMIN_ARTICLE_STATUSES,
  contentFamilyForKind,
  statusLabel,
  type MasterArticleStatus
} from "../../../lib/admin-current-affairs";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";

interface AgentCandidate {
  title: string;
  slug: string;
  body: string;
  body_json?: Record<string, unknown>;
  article_role?: "event" | "concept";
  excerpt?: string;
  publication_date?: string;
  category_node_ids: number[];
  category_paths: string[];
  source_name?: string;
  source_url?: string;
  institute_tags?: string[];
  seo_title?: string;
  seo_description?: string;
  keywords?: string[];
  warnings: string[];
}

interface AgentParseResult {
  content_kind: ContentKind;
  content_family: string;
  extraction_method: string;
  source_name?: string;
  source_url?: string;
  candidates: AgentCandidate[];
}

interface CommitResult {
  mode: "auto" | "review";
  content_kind: string;
  published: { id: number; slug: string; title: string }[];
  failed: { title: string; error: string }[];
  job?: { id: number } | null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** Builds "Root > Child > Node" path labels for the category tree client-side. */
function buildCategoryPaths(categories: CategoryNode[]): Map<number, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const paths = new Map<number, string>();
  for (const cat of categories) {
    const parts: string[] = [cat.name];
    let cursor = cat.parent_id != null ? byId.get(cat.parent_id) : undefined;
    let guard = 0;
    while (cursor && guard < 10) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : undefined;
      guard += 1;
    }
    paths.set(cat.id, parts.join(" > "));
  }
  return paths;
}

export function AdminPostingAgentManager() {
  const { token } = useAuth();

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [contentKind, setContentKind] = useState<ContentKind>("daily_current_affairs");
  const [articleRole, setArticleRole] = useState<"event" | "concept" | "auto">("event");
  const [sourceType, setSourceType] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().slice(0, 10));
  const [instructions, setInstructions] = useState("");

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentParseResult | null>(null);
  const [candidates, setCandidates] = useState<AgentCandidate[]>([]);
  // Items chosen to post; defaults to all after a parse so a large batch can drop
  // a few bad items without re-parsing.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [publishMode, setPublishMode] = useState<"auto" | "review">("review");
  const [commitStatus, setCommitStatus] = useState<MasterArticleStatus>("published");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const family = contentFamilyForKind(contentKind);
  const supportsConcept = contentKind === "daily_current_affairs";
  // Role sent to the parser (may be "auto"); when concept isn't supported, force event.
  const parseRole: "event" | "concept" | "auto" = supportsConcept ? articleRole : "event";
  // Top-level role for commit must be a concrete role; in auto mode each item carries its own.
  const commitTopRole: "event" | "concept" | undefined = parseRole === "auto" ? undefined : parseRole;
  const categoryPaths = useMemo(() => buildCategoryPaths(categories), [categories]);
  const familyCategories = useMemo(
    () => categories.filter((c) => c.content_family === family && c.is_active !== false),
    [categories, family]
  );

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const cats = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=500", token);
      setCategories(cats);
    } catch {
      // Non-fatal; the agent still classifies server-side.
    }
  }, [token]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function runAgent() {
    if (!token) return;
    setError(null);
    setCommitResult(null);
    setResult(null);
    setCandidates([]);

    if (sourceType === "file" && !file) {
      setError("Choose a Word or PDF file to parse.");
      return;
    }
    if (sourceType === "url" && !url.trim()) {
      setError("Enter a URL to parse.");
      return;
    }

    setParsing(true);
    try {
      let source: Record<string, unknown>;
      if (sourceType === "file" && file) {
        const base64 = await readFileAsBase64(file);
        source = { kind: "file", base64_data: base64, mime_type: file.type || "application/octet-stream", filename: file.name };
      } else {
        source = { kind: "url", url: url.trim() };
      }

      const parsed = await authenticatedPost<AgentParseResult>(
        "/api/v1/current-affairs/admin/agent/parse",
        token,
        {
          content_kind: contentKind,
          article_role: parseRole,
          source,
          default_publication_date: defaultDate,
          instructions: instructions.trim() || undefined
        }
      );
      setResult(parsed);
      setCandidates(parsed.candidates);
      setSelected(new Set(parsed.candidates.map((_, i) => i)));
      if (parsed.candidates.length === 0) {
        setError("The agent did not find any postable content in this source.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent failed to parse this source.");
    } finally {
      setParsing(false);
    }
  }

  function updateCandidate(index: number, patch: Partial<AgentCandidate>) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCategory(index: number, nodeId: number) {
    setCandidates((prev) =>
      prev.map((c, i) => {
        if (i !== index || c.category_node_ids.includes(nodeId)) return c;
        const ids = [...c.category_node_ids, nodeId];
        return { ...c, category_node_ids: ids, category_paths: ids.map((id) => categoryPaths.get(id) ?? String(id)) };
      })
    );
  }

  function removeCategory(index: number, nodeId: number) {
    setCandidates((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const ids = c.category_node_ids.filter((id) => id !== nodeId);
        return { ...c, category_node_ids: ids, category_paths: ids.map((id) => categoryPaths.get(id) ?? String(id)) };
      })
    );
  }

  function toggleSelected(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(candidates.map((_, i) => i)));
  }

  async function commit() {
    if (!token) return;
    const chosen = candidates.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      setError("Select at least one item to post.");
      return;
    }
    setError(null);
    setCommitting(true);
    try {
      const payload = {
        content_kind: contentKind,
        article_role: commitTopRole,
        publish_mode: publishMode,
        default_status: commitStatus,
        articles: chosen.map((c) => ({
          title: c.title,
          slug: c.slug || undefined,
          body: c.body,
          body_json: c.body_json,
          article_role: supportsConcept ? c.article_role : undefined,
          excerpt: c.excerpt,
          publication_date: c.publication_date,
          category_node_ids: c.category_node_ids,
          source_name: c.source_name,
          source_url: c.source_url,
          institute_tags: c.institute_tags,
          seo_title: c.seo_title,
          seo_description: c.seo_description,
          keywords: c.keywords
        }))
      };
      const res = await authenticatedPost<CommitResult>("/api/v1/current-affairs/admin/agent/commit", token, payload);
      setCommitResult(res);
      if (res.mode === "auto" && res.failed.length === 0) {
        setCandidates([]);
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not commit the batch.");
    } finally {
      setCommitting(false);
    }
  }

  const isPyq = contentKind === "prelims_pyq" || contentKind === "mains_pyq";

  return (
    <div className="space-y-6">
      {/* INPUT */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-black text-ink">AI Posting Agent</h3>
            <p className="text-xs text-ink/60">
              Upload a Word/PDF or paste a URL. The agent extracts, back-dates, and files it into the right categories — you review, then post.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink">
            Content type
            <select
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
              value={contentKind}
              onChange={(e) => setContentKind(e.target.value as ContentKind)}
            >
              {ADMIN_CONTENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Default / back-date (fallback)
            <input
              type="date"
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
            />
          </label>
        </div>

        {supportsConcept && (
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-ink">Article role</span>
            <div className="flex rounded-lg border border-line bg-paper/40 p-0.5 text-xs w-fit">
              <button
                type="button"
                onClick={() => setArticleRole("event")}
                className={`rounded-md px-3 py-1.5 font-bold transition ${
                  articleRole === "event" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                }`}
              >
                Event (dated news)
              </button>
              <button
                type="button"
                onClick={() => setArticleRole("concept")}
                className={`rounded-md px-3 py-1.5 font-bold transition ${
                  articleRole === "concept" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                }`}
              >
                Concept (reusable primer)
              </button>
              <button
                type="button"
                onClick={() => setArticleRole("auto")}
                className={`rounded-md px-3 py-1.5 font-bold transition ${
                  articleRole === "auto" ? "bg-civic text-white shadow-sm" : "text-ink/60 hover:bg-white"
                }`}
              >
                Auto-detect
              </button>
            </div>
            <p className="text-[11px] text-ink/55">
              {articleRole === "concept"
                ? "Evergreen explainer, kept out of the daily feed. The agent writes a self-contained primer rather than dated news."
                : articleRole === "auto"
                ? "The agent classifies each item as Event or Concept on its own (honouring any [CONCEPT]/[EVENT] or Type: markers you embed). Review and flip any misreads on each card below before posting."
                : "A dated news write-up. The agent preserves the original reporting date (back-dating)."}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType("file")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
              sourceType === "file" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-ink/70"
            }`}
          >
            <FileText className="h-4 w-4" /> Word / PDF
          </button>
          <button
            type="button"
            onClick={() => setSourceType("url")}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
              sourceType === "url" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-ink/70"
            }`}
          >
            <Link2 className="h-4 w-4" /> URL / Source
          </button>
        </div>

        {sourceType === "file" ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-sm">
            <Upload className="h-4 w-4 text-ink/50" />
            <span className="font-medium text-ink/70">{file ? file.name : "Choose a .docx or .pdf file"}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <input
            type="url"
            placeholder="https://source.example.com/article"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}

        <label className="grid gap-1 text-sm font-bold text-ink">
          Instructions to the agent (optional)
          <textarea
            rows={2}
            placeholder="e.g. Categories are noted at the top of each item. Keep summaries under 120 words."
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>

        <details className="rounded-lg border border-line bg-paper/40 px-3 py-2 text-xs text-ink/70">
          <summary className="cursor-pointer font-bold text-ink/80">
            Markers you can embed in the file (optional — they override the agent's guesses)
          </summary>
          <ul className="mt-2 space-y-1 pl-1">
            <li><code className="font-mono text-ink">Title:</code> or a heading line above a block → that item's title (for concepts, write the concept name above it).</li>
            <li><code className="font-mono text-ink">Categories:</code> Polity &gt; Constitution; Economy &gt; Fiscal Policy → <span className="italic">&gt;</span> = depth in one tree, <span className="italic">;</span> or <span className="italic">|</span> = separate trees.</li>
            <li><code className="font-mono text-ink">Date:</code> 2026-03-15 → publication date (back-dating).</li>
            <li><code className="font-mono text-ink">[CONCEPT]</code> / <code className="font-mono text-ink">[EVENT]</code> or <code className="font-mono text-ink">Type: concept</code> → sets the role (used by Auto-detect).</li>
            <li><code className="font-mono text-ink">---</code> (three dashes on their own line) → separates two items.</li>
            <li><code className="font-mono text-ink">Instructions:</code> / <code className="font-mono text-ink">Note to editor:</code> → guidance for the agent, never posted as content.</li>
          </ul>
        </details>

        <button
          type="button"
          onClick={() => void runAgent()}
          disabled={parsing}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {parsing ? "Agent is reading & classifying…" : "Run Agent"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* REVIEW */}
      {result && candidates.length > 0 && (
        <div className="space-y-4">
          <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <div>
              <h3 className="text-lg font-black text-ink">
                {selected.size} of {candidates.length} selected
              </h3>
              <p className="text-xs text-ink/55">
                Extracted via {result.extraction_method}. Edit dates and categories before posting.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-bold text-ink/70 hover:bg-paper"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          {candidates.map((candidate, index) => (
            <div
              key={index}
              className={`rounded-2xl border bg-white p-5 shadow-sm space-y-3 ${
                selected.has(index) ? "border-line" : "border-line/50 opacity-55"
              }`}
            >
              <label className="flex items-center gap-2 text-xs font-bold text-ink/70">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => toggleSelected(index)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Include in this batch
              </label>
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <label className="grid gap-1 text-xs font-bold text-ink/70">
                  Title
                  <input
                    className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-bold text-ink"
                    value={candidate.title}
                    onChange={(e) => updateCandidate(index, { title: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-ink/70">
                  Publication date
                  <input
                    type="date"
                    className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
                    value={candidate.publication_date ?? ""}
                    onChange={(e) => updateCandidate(index, { publication_date: e.target.value })}
                  />
                </label>
              </div>

              {/* Article role (per item) — key for Auto-detect, editable to override */}
              {supportsConcept && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink/70">Role</span>
                  <div className="flex rounded-md border border-line bg-paper/40 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => updateCandidate(index, { article_role: "event" })}
                      className={`rounded px-2 py-1 font-bold transition ${
                        (candidate.article_role ?? "event") === "event"
                          ? "bg-civic text-white"
                          : "text-ink/60 hover:bg-white"
                      }`}
                    >
                      Event
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCandidate(index, { article_role: "concept" })}
                      className={`rounded px-2 py-1 font-bold transition ${
                        candidate.article_role === "concept"
                          ? "bg-civic text-white"
                          : "text-ink/60 hover:bg-white"
                      }`}
                    >
                      Concept
                    </button>
                  </div>
                  {articleRole === "auto" && (
                    <span className="text-[11px] text-ink/45">auto-detected · flip if wrong</span>
                  )}
                </div>
              )}

              {/* Categories */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-ink/70">Categories (multiple trees allowed)</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {candidate.category_node_ids.length === 0 && (
                    <span className="text-xs italic text-amber-600">No category — pick one below.</span>
                  )}
                  {candidate.category_node_ids.map((id) => (
                    <span
                      key={id}
                      className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                    >
                      {categoryPaths.get(id) ?? `#${id}`}
                      <button type="button" onClick={() => removeCategory(index, id)} className="hover:text-emerald-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id) addCategory(index, id);
                  }}
                >
                  <option value="">+ Add category…</option>
                  {familyCategories
                    .filter((c) => !candidate.category_node_ids.includes(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryPaths.get(c.id) ?? c.name}
                      </option>
                    ))}
                </select>
              </div>

              <label className="grid gap-1 text-xs font-bold text-ink/70">
                Body
                <textarea
                  rows={6}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-xs font-mono leading-relaxed text-ink"
                  value={candidate.body}
                  onChange={(e) => updateCandidate(index, { body: e.target.value })}
                />
              </label>

              {candidate.warnings.length > 0 && (
                <ul className="space-y-0.5">
                  {candidate.warnings.map((w, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* COMMIT BAR */}
          <div className="sticky bottom-4 rounded-2xl border border-line bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPublishMode("review")}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                    publishMode === "review" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line text-ink/60"
                  }`}
                >
                  Stage for review
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode("auto")}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                    publishMode === "auto" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-line text-ink/60"
                  }`}
                >
                  Publish now
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-ink/70">
                Status
                <select
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
                  value={commitStatus}
                  onChange={(e) => setCommitStatus(e.target.value as MasterArticleStatus)}
                >
                  {ADMIN_ARTICLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={committing}
                className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {publishMode === "auto" ? `Publish ${selected.size}` : `Send ${selected.size} to review`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMIT RESULT */}
      {commitResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 space-y-1">
          <div className="flex items-center gap-2 font-black">
            <CheckCircle2 className="h-5 w-5" />
            {commitResult.mode === "auto"
              ? `Published ${commitResult.published.length} item(s).`
              : "Batch staged in the Ingestion Queue for review."}
          </div>
          {commitResult.mode === "auto" && commitResult.failed.length > 0 && (
            <div className="text-red-700">
              {commitResult.failed.length} failed: {commitResult.failed.map((f) => f.title).join(", ")}
            </div>
          )}
          {commitResult.mode === "review" && commitResult.job?.id && (
            <p className="text-xs">Open the Ingestion Queue to approve & publish (job #{commitResult.job.id}).</p>
          )}
        </div>
      )}
    </div>
  );
}
