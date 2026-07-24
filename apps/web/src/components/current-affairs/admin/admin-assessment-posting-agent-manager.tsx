"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Link2, Loader2, Sparkles, Upload, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";

type ContentType = "gk" | "aptitude" | "mains";

interface TaxNode {
  id: number;
  parent_id: number | null;
  node_type: string;
  name: string;
}

interface AgentQuestion {
  question_statement: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options?: { label: string; text: string }[];
  correct_answer?: string;
  explanation?: string;
  word_limit?: number;
  marks?: number;
  directive?: string;
  taxonomy_node_ids: number[];
  taxonomy_path: string;
  warnings: string[];
}

interface AgentParseResult {
  content_type: ContentType;
  exam_id: number;
  extraction_method: string;
  passage_title?: string;
  passage_text?: string;
  candidates: AgentQuestion[];
}

interface CommitResult {
  mode: "auto" | "review";
  content_type: string;
  exam_id: number;
  created: { question_id: number; version_id: number; statement: string }[];
  failed: { statement: string; error: string }[];
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "gk", label: "GK (Prelims GS)" },
  { value: "aptitude", label: "CSAT (Aptitude)" },
  { value: "mains", label: "Mains" }
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** Builds "Root > Child" path labels + a parent map for the taxonomy tree. */
function buildTaxonomyIndex(nodes: TaxNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const paths = new Map<number, string>();
  for (const n of nodes) {
    const parts: string[] = [n.name];
    let cursor = n.parent_id != null ? byId.get(n.parent_id) : undefined;
    let guard = 0;
    while (cursor && guard < 10) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : undefined;
      guard += 1;
    }
    paths.set(n.id, parts.join(" > "));
  }
  return { byId, paths };
}

/** Ordered node-id path (root → leaf) for a chosen leaf id. */
function ancestryOf(leafId: number, byId: Map<number, TaxNode>): number[] {
  const ids: number[] = [];
  let cursor: TaxNode | undefined = byId.get(leafId);
  let guard = 0;
  while (cursor && guard < 10) {
    ids.unshift(cursor.id);
    cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : undefined;
    guard += 1;
  }
  return ids;
}

export function AdminAssessmentPostingAgentManager() {
  const { token } = useAuth();

  const [examId, setExamId] = useState<number | null>(null);
  const [contentType, setContentType] = useState<ContentType>("gk");
  const [nodes, setNodes] = useState<TaxNode[]>([]);
  const [sourceType, setSourceType] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentParseResult | null>(null);
  const [candidates, setCandidates] = useState<AgentQuestion[]>([]);
  // Indices the admin has chosen to post. Defaults to all after a parse; lets a
  // large batch drop a few bad items without re-parsing.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [publishMode, setPublishMode] = useState<"auto" | "review">("review");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const isMains = contentType === "mains";
  const { byId, paths } = useMemo(() => buildTaxonomyIndex(nodes), [nodes]);

  // Load exams once; default to the first.
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const exams = await authenticatedGet<{ id: number; name: string }[]>("/api/v1/assessment/exams", token);
        const firstId = exams[0]?.id;
        if (firstId) setExamId((prev) => prev ?? firstId);
      } catch {
        setExamId((prev) => prev ?? 1);
      }
    })();
  }, [token]);

  // Load the taxonomy tree whenever exam or content type changes.
  const loadNodes = useCallback(async () => {
    if (!token || !examId) return;
    try {
      const endpoint = isMains
        ? `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${examId}&limit=1000`
        : `/api/v1/assessment/taxonomy-nodes?exam_id=${examId}&content_type=${contentType}&limit=1000`;
      const rows = await authenticatedGet<TaxNode[]>(endpoint, token);
      setNodes(rows);
    } catch {
      setNodes([]);
    }
  }, [token, examId, contentType, isMains]);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  async function runAgent() {
    if (!token || !examId) return;
    setError(null);
    setCommitResult(null);
    setResult(null);
    setCandidates([]);

    if (sourceType === "file" && !file) return setError("Choose a Word or PDF file to parse.");
    if (sourceType === "url" && !url.trim()) return setError("Enter a URL to parse.");

    setParsing(true);
    try {
      let source: Record<string, unknown>;
      if (sourceType === "file" && file) {
        const base64 = await readFileAsBase64(file);
        source = { kind: "file", base64_data: base64, mime_type: file.type || "application/octet-stream", filename: file.name };
      } else {
        source = { kind: "url", url: url.trim() };
      }

      const parsed = await authenticatedPost<AgentParseResult>("/api/v1/assessment/admin/agent/parse", token, {
        content_type: contentType,
        exam_id: examId,
        source,
        instructions: instructions.trim() || undefined
      });
      setResult(parsed);
      setCandidates(parsed.candidates);
      setSelected(new Set(parsed.candidates.map((_, i) => i)));
      if (parsed.candidates.length === 0) setError("No questions could be parsed from this source.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The agent could not parse this source.");
    } finally {
      setParsing(false);
    }
  }

  function updateCandidate(index: number, patch: Partial<AgentQuestion>) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function setCandidateTaxonomy(index: number, leafId: number) {
    const ids = ancestryOf(leafId, byId);
    updateCandidate(index, { taxonomy_node_ids: ids, taxonomy_path: paths.get(leafId) ?? String(leafId) });
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
    if (!token || !examId) return;
    const chosen = candidates.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      setError("Select at least one question to post.");
      return;
    }
    setError(null);
    setCommitting(true);
    try {
      const payload = {
        content_type: contentType,
        exam_id: examId,
        publish_mode: publishMode,
        default_status: publishMode === "auto" ? "published" : "draft",
        passage_title: result?.passage_title,
        passage_text: result?.passage_text,
        questions: chosen.map((c) => ({
          question_statement: c.question_statement,
          supp_question_statement: c.supp_question_statement,
          question_prompt: c.question_prompt,
          options: c.options,
          correct_answer: c.correct_answer,
          explanation: c.explanation,
          word_limit: c.word_limit,
          marks: c.marks,
          directive: c.directive,
          taxonomy_node_ids: c.taxonomy_node_ids
        }))
      };
      const res = await authenticatedPost<CommitResult>("/api/v1/assessment/admin/agent/commit", token, payload);
      setCommitResult(res);
      if (res.failed.length === 0) setCandidates([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the questions.");
    } finally {
      setCommitting(false);
    }
  }

  // A flat, path-labelled option list for the per-question taxonomy picker.
  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: paths.get(n.id) ?? n.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, paths]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-civic" />
          <h2 className="text-xl font-black text-ink">AI Posting Agent — Questions</h2>
        </div>
        <p className="text-sm text-ink/60">
          Upload a Word/PDF (or paste a URL) of questions. The agent parses them and classifies each into the full
          {isMains ? " Mains" : " GK/CSAT"} taxonomy tree. Review, then post — auto-publish or save as drafts.
        </p>

        {/* Content type */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold text-ink">
            Content type
            <select
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-sm font-bold text-ink">
            Taxonomy nodes loaded
            <div className="rounded-lg border border-line bg-paper/40 px-3 py-2 text-sm font-medium text-ink/60">
              {nodes.length} node(s) {nodes.length === 0 && "— create the taxonomy first"}
            </div>
          </div>
        </div>

        {/* Source toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType("file")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
              sourceType === "file" ? "bg-civic text-white" : "bg-paper text-ink/60 hover:bg-surface"
            }`}
          >
            <Upload className="h-4 w-4" /> File
          </button>
          <button
            type="button"
            onClick={() => setSourceType("url")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
              sourceType === "url" ? "bg-civic text-white" : "bg-paper text-ink/60 hover:bg-surface"
            }`}
          >
            <Link2 className="h-4 w-4" /> URL
          </button>
        </div>

        {sourceType === "file" ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-sm">
            <FileText className="h-5 w-5 text-ink/50" />
            <span className="font-medium text-ink/70">{file ? file.name : "Choose a Word or PDF file…"}</span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <input
            type="url"
            placeholder="https://…"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}

        <label className="grid gap-1 text-sm font-bold text-ink">
          Instructions to the agent (optional)
          <textarea
            rows={2}
            placeholder="e.g. These are statement-based questions. Keep explanations concise."
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => void runAgent()}
          disabled={parsing || !examId}
          className="flex items-center gap-2 rounded-lg bg-civic px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {parsing ? "Parsing…" : "Parse with AI"}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Review */}
      {result && candidates.length > 0 && (
        <div className="space-y-4">
          <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-lg font-black text-ink">
                  {selected.size} of {candidates.length} selected
                </h3>
                <p className="text-xs text-ink/55">Extracted via {result.extraction_method}. Set the taxonomy before posting.</p>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-md border border-line px-2.5 py-1 text-xs font-bold text-ink/70 hover:bg-paper"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line bg-paper/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPublishMode("review")}
                  className={`rounded-md px-3 py-1.5 font-bold ${publishMode === "review" ? "bg-civic text-white" : "text-ink/60"}`}
                >
                  Save as drafts
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode("auto")}
                  className={`rounded-md px-3 py-1.5 font-bold ${publishMode === "auto" ? "bg-civic text-white" : "text-ink/60"}`}
                >
                  Publish now
                </button>
              </div>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={committing || selected.size === 0}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {publishMode === "auto" ? `Publish ${selected.size}` : `Save ${selected.size} drafts`}
              </button>
            </div>
          </div>

          {candidates.map((c, index) => (
            <div
              key={index}
              className={`rounded-2xl border bg-surface p-5 shadow-sm space-y-3 ${
                selected.has(index) ? "border-line" : "border-line/50 opacity-55"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  onChange={() => toggleSelected(index)}
                  className="mt-2 h-4 w-4 shrink-0 accent-emerald-600"
                  title="Include in this batch"
                />
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm font-bold text-ink"
                  value={c.question_statement}
                  onChange={(e) => updateCandidate(index, { question_statement: e.target.value })}
                />
              </div>

              {!isMains && c.options && c.options.length > 0 && (
                <div className="space-y-1">
                  {c.options.map((o, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
                        c.correct_answer && o.label.toUpperCase() === c.correct_answer.toUpperCase()
                          ? "bg-emerald-50 font-bold text-emerald-800"
                          : "bg-paper/60 text-ink/75"
                      }`}
                    >
                      <span className="font-black">{o.label}.</span> {o.text}
                    </div>
                  ))}
                </div>
              )}

              {isMains && (
                <p className="text-xs text-ink/55">
                  {c.directive ? `${c.directive} · ` : ""}
                  {c.word_limit ?? 250} words · {c.marks ?? 15} marks
                </p>
              )}

              {/* Taxonomy picker */}
              <div className="grid gap-1">
                <span className="text-xs font-bold text-ink/70">Taxonomy (full tree)</span>
                <select
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    c.taxonomy_node_ids.length === 0 ? "border-amber-400 bg-amber-50" : "border-line bg-paper"
                  }`}
                  value={c.taxonomy_node_ids[c.taxonomy_node_ids.length - 1] ?? ""}
                  onChange={(e) => e.target.value && setCandidateTaxonomy(index, Number(e.target.value))}
                >
                  <option value="">— Select node —</option>
                  {nodeOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {c.taxonomy_node_ids.length > 0 && (
                  <span className="text-[11px] text-emerald-700">{c.taxonomy_path}</span>
                )}
              </div>

              {c.warnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.warnings.map((w, i) => (
                    <span key={i} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">{w}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Commit result */}
      {commitResult && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">
              {commitResult.created.length} question(s) {commitResult.mode === "auto" ? "published" : "saved as drafts"}.
            </span>
          </div>
          {commitResult.failed.length > 0 && (
            <div className="text-sm text-rose-700">
              <p className="font-bold">{commitResult.failed.length} failed:</p>
              <ul className="list-disc pl-5">
                {commitResult.failed.map((f, i) => (
                  <li key={i}>{f.statement.slice(0, 60)} — {f.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
