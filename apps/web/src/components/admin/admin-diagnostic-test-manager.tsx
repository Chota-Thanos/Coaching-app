"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, ChevronLeft, Search, X, BookOpen, RefreshCw, ChevronRight, Check } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { authenticatedGet, authenticatedPost, authenticatedPatch, authenticatedDelete } from "../auth/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type Exam = { id: number; name: string };
type ExamLevel = { id: number; name: string; exam_id: number };
type TaxonomyNode = { id: number; exam_id: number; parent_id?: number | null; node_type: string; name: string; content_type?: string };

type DiagnosticTest = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  exam_level_id: number;
  status: string;
  duration_minutes: number;
  total_marks: number | null;
  question_count: number;
  created_at: string;
};

type PaperQuestion = {
  id: number;
  marks: number;
  negative_marks: number;
  display_order: number;
  question_version: { id: number; question_statement: string };
};

type BankQuestion = {
  id: number;
  current_version?: { id: number; question_statement: string };
};

type QuestionTab = "gk" | "csat" | "mains";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: string) {
  const cfg: Record<string, { dot: string; label: string }> = {
    published: { dot: "bg-emerald-500", label: "Published" },
    draft:     { dot: "bg-saffron",     label: "Draft" },
    archived:  { dot: "bg-line",        label: "Archived" },
  };
  const { dot, label } = cfg[status] ?? { dot: "bg-line", label: status };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

const TAB_LABELS: Record<QuestionTab, string> = { gk: "GK", csat: "CSAT", mains: "Mains" };

// ─── Question Manager ─────────────────────────────────────────────────────────

function QuestionManager({ test, token, onBack }: { test: DiagnosticTest; token: string; onBack: () => void }) {
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestion[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyNode[]>([]);
  const [activeTab, setActiveTab] = useState<QuestionTab>("gk");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [search, setSearch] = useState("");
  const [loadingPaper, setLoadingPaper] = useState(true);
  const [loadingBank, setLoadingBank] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load paper (current questions)
  const loadPaper = useCallback(async () => {
    setLoadingPaper(true);
    try {
      const data = await authenticatedGet<{ questions: PaperQuestion[] }>(
        `/api/v1/assessment/test-templates/${test.id}/paper`, token
      );
      setPaperQuestions(data?.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoadingPaper(false);
    }
  }, [test.id, token]);

  useEffect(() => { void loadPaper(); }, [loadPaper]);

  // Load taxonomy subjects for the active tab
  const loadSubjects = useCallback(async (tab: QuestionTab) => {
    setLoadingSubjects(true);
    setSubjects([]);
    try {
      let nodes: TaxonomyNode[] = [];
      if (tab === "mains") {
        nodes = await authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/mains/taxonomy-nodes?limit=500", token) ?? [];
      } else {
        nodes = await authenticatedGet<TaxonomyNode[]>("/api/v1/assessment/taxonomy-nodes?limit=500", token) ?? [];
        const contentType = tab === "csat" ? "aptitude" : "gk";
        nodes = nodes.filter(n => !n.content_type || n.content_type === contentType);
      }
      // Only top-level subjects
      setSubjects(nodes.filter(n => !n.parent_id && n.node_type === "subject"));
    } catch {
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, [token]);

  // Load question bank
  const loadBank = useCallback(async (tab: QuestionTab, subjectId: string) => {
    setLoadingBank(true);
    setBankQuestions([]);
    try {
      const params = new URLSearchParams({ status: "published", limit: "300" });
      if (tab === "gk")   { params.set("content_type", "gk");      params.set("question_family", "objective"); }
      if (tab === "csat") { params.set("content_type", "aptitude"); params.set("question_family", "objective"); }
      if (tab === "mains"){ params.set("question_family", "mains_subjective"); }
      if (subjectId) params.set("subject_node_id", subjectId);
      const data = await authenticatedGet<BankQuestion[]>(`/api/v1/assessment/questions?${params}`, token) ?? [];
      setBankQuestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoadingBank(false);
    }
  }, [token]);

  // Switch tab
  useEffect(() => {
    setSelectedSubject("");
    setSearch("");
    void loadSubjects(activeTab);
    void loadBank(activeTab, "");
  }, [activeTab, loadSubjects, loadBank]);

  // Reload when subject filter changes
  useEffect(() => {
    void loadBank(activeTab, selectedSubject);
    setSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject]);

  const filtered = useMemo(() => {
    if (!search.trim()) return bankQuestions;
    const q = search.toLowerCase();
    return bankQuestions.filter(bq =>
      stripHtml(bq.current_version?.question_statement ?? "").toLowerCase().includes(q)
    );
  }, [bankQuestions, search]);

  const alreadyInTest = useMemo(
    () => new Set(paperQuestions.map(q => q.question_version.id)),
    [paperQuestions]
  );

  async function addQuestion(versionId: number) {
    setAddingId(versionId);
    try {
      await authenticatedPost(`/api/v1/assessment/test-templates/${test.id}/questions`, token,
        { question_version_id: versionId, marks: 2, negative_marks: 0.67 }
      );
      await loadPaper();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add question"); }
    finally { setAddingId(null); }
  }

  async function removeQuestion(itemId: number) {
    setRemovingId(itemId);
    try {
      await authenticatedDelete(`/api/v1/assessment/test-question-items/${itemId}`, token);
      setPaperQuestions(prev => prev.filter(q => q.id !== itemId));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to remove question"); }
    finally { setRemovingId(null); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-paper transition shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> All Tests
          </button>
          <div className="min-w-0">
            {statusDot(test.status)}
            <h2 className="text-base font-bold text-ink truncate">{test.title}</h2>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {test.status === "draft" && (
            <button onClick={async () => {
              try {
                await authenticatedPatch(`/api/v1/assessment/test-templates/${test.id}`, token,
                  { status: "published", published_at: new Date().toISOString() }
                );
                onBack();
              } catch (e) { setError(e instanceof Error ? e.message : "Failed to publish"); }
            }}
              className="rounded-lg border border-ink bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition"
            >
              Publish
            </button>
          )}
          {test.status === "published" && (
            <button onClick={async () => {
              try {
                await authenticatedPatch(`/api/v1/assessment/test-templates/${test.id}`, token, { status: "draft" });
                onBack();
              } catch (e) { setError(e instanceof Error ? e.message : "Failed to unpublish"); }
            }}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:bg-paper transition"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-muted">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 text-muted/50" /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        {/* ── Left: questions in this test ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              In this test · {paperQuestions.length}
            </span>
            <button onClick={() => void loadPaper()} className="text-muted/40 hover:text-muted transition">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loadingPaper ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted animate-pulse">Loading…</div>
          ) : paperQuestions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-8 text-center">
              <p className="text-xs text-muted">No questions yet — add from the bank →</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
              {paperQuestions.map((q, i) => (
                <div key={q.id} className="group flex items-start gap-2 rounded-lg border border-line/50 bg-white px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold text-muted/40 w-4">{i + 1}</span>
                  <p className="flex-1 text-xs text-ink leading-relaxed line-clamp-2">
                    {stripHtml(q.question_version.question_statement)}
                  </p>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    disabled={removingId === q.id}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-muted/40 hover:text-muted disabled:opacity-30 transition"
                  >
                    {removingId === q.id
                      ? <span className="h-3 w-3 border border-muted/40 border-t-transparent rounded-full animate-spin block" />
                      : <X className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: question bank ── */}
        <div className="space-y-3">
          {/* Type tabs */}
          <div className="flex gap-px rounded-lg border border-line bg-paper p-0.5">
            {(["gk", "csat", "mains"] as QuestionTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  activeTab === tab ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Subject filter */}
          <select
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink focus:border-muted focus:outline-none disabled:text-muted/50"
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            disabled={loadingSubjects || subjects.length === 0}
          >
            <option value="">
              {loadingSubjects ? "Loading subjects…" : subjects.length === 0 ? "No subjects found" : `All ${TAB_LABELS[activeTab]} subjects`}
            </option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Keyword filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted/40 pointer-events-none" />
            <input
              className="w-full rounded-lg border border-line bg-white py-2 pl-8 pr-8 text-xs text-ink placeholder:text-muted/40 focus:border-muted focus:outline-none"
              placeholder="Filter by keyword…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-muted/40 hover:text-muted" />
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted">
            {loadingBank ? "Loading…" : `${filtered.length}${filtered.length !== bankQuestions.length ? ` of ${bankQuestions.length}` : ""} questions`}
            {search && ` matching "${search}"`}
          </p>

          {/* List */}
          {loadingBank ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted animate-pulse">
              Loading {TAB_LABELS[activeTab]} questions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted">
              {search ? `No matches for "${search}"` : `No ${TAB_LABELS[activeTab]} questions found`}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
              {filtered.map(q => {
                const versionId = q.current_version?.id;
                const added = versionId !== undefined && alreadyInTest.has(versionId);
                const isAdding = addingId === versionId;
                return (
                  <div key={q.id}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 transition ${added ? "border-line/50 bg-paper" : "border-line/50 bg-white"}`}
                  >
                    <p className={`flex-1 text-xs leading-relaxed line-clamp-2 ${added ? "text-muted/60" : "text-ink"}`}>
                      {stripHtml(q.current_version?.question_statement ?? "") || <em className="text-muted/40">No statement</em>}
                    </p>
                    <button
                      onClick={() => !added && versionId && void addQuestion(versionId)}
                      disabled={added || isAdding || !versionId}
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                        added
                          ? "text-muted/50 cursor-default"
                          : "border border-line bg-white text-muted hover:border-muted hover:text-ink disabled:opacity-40"
                      }`}
                    >
                      {added ? <Check className="h-3 w-3" /> : isAdding
                        ? <span className="h-3 w-3 border border-muted border-t-transparent rounded-full animate-spin block" />
                        : <Plus className="h-3 w-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Manager ──────────────────────────────────────────────────────────────

export function AdminDiagnosticTestManager() {
  const { token } = useAuth();
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examLevels, setExamLevels] = useState<ExamLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [managingTest, setManagingTest] = useState<DiagnosticTest | null>(null);
  const [form, setForm] = useState({ title: "", exam_id: "", exam_level_id: "", duration_minutes: "30", description: "" });

  const loadTests = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<DiagnosticTest[]>(
        "/api/v1/assessment/test-templates?test_type=diagnostic_test&limit=50", token
      );
      setTests(data || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void loadTests(); }, [loadTests]);

  useEffect(() => {
    if (!token) return;
    void authenticatedGet<Exam[]>("/api/v1/assessment/exams?limit=100", token).then(setExams).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !form.exam_id) return;
    void authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${form.exam_id}/levels?limit=100`, token)
      .then(setExamLevels).catch(() => {});
  }, [token, form.exam_id]);

  async function handleCreate() {
    if (!token || !form.title.trim() || !form.exam_id || !form.exam_level_id) return;
    setSaving(true);
    try {
      const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const created = await authenticatedPost<DiagnosticTest>("/api/v1/assessment/test-templates", token, {
        title: form.title.trim(), slug,
        description: form.description.trim() || undefined,
        exam_id: Number(form.exam_id), exam_level_id: Number(form.exam_level_id),
        test_type: "diagnostic_test", access_type: "free", status: "draft",
        duration_minutes: Number(form.duration_minutes),
      });
      setShowCreate(false);
      setForm({ title: "", exam_id: "", exam_level_id: "", duration_minutes: "30", description: "" });
      await loadTests();
      if (created) setManagingTest(created);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  }

  async function setStatus(id: number, status: "draft" | "published" | "archived") {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/test-templates/${id}`, token, {
        status, published_at: status === "published" ? new Date().toISOString() : undefined,
      });
      await loadTests();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update"); }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Delete this diagnostic test permanently?")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${id}`, token);
      await loadTests();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete"); }
  }

  if (managingTest && token) {
    return (
      <QuestionManager
        test={managingTest}
        token={token}
        onBack={async () => { await loadTests(); setManagingTest(null); }}
      />
    );
  }

  if (loading) return <div className="p-12 text-center text-xs text-muted">Loading…</div>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-xs text-muted">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-muted/50 hover:text-muted"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">Diagnostic Tests</h2>
          <p className="text-xs text-muted mt-0.5">
            Premade tests shown to new users on the homepage. Only one should be published at a time.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink/90 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> New Test
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-line bg-white p-5 space-y-4">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wide">New Diagnostic Test</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Title *</label>
              <input
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/40 focus:bg-white focus:border-muted focus:outline-none"
                placeholder="e.g. UPSC Prelims Diagnostic Test 2025"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Exam *</label>
              <select
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:bg-white focus:border-muted focus:outline-none"
                value={form.exam_id}
                onChange={e => setForm(f => ({ ...f, exam_id: e.target.value, exam_level_id: "" }))}
              >
                <option value="">Select exam…</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Level *</label>
              <select
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:bg-white focus:border-muted focus:outline-none"
                value={form.exam_level_id}
                onChange={e => setForm(f => ({ ...f, exam_level_id: e.target.value }))}
                disabled={!form.exam_id}
              >
                <option value="">Select level…</option>
                {examLevels.map(el => <option key={el.id} value={el.id}>{el.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Duration (min) *</label>
              <input
                type="number" min={5} max={180}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:bg-white focus:border-muted focus:outline-none"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Description</label>
              <input
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/40 focus:bg-white focus:border-muted focus:outline-none"
                placeholder="Short description (optional)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim() || !form.exam_id || !form.exam_level_id}
              className="rounded-lg border border-ink bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/90 disabled:opacity-40 transition"
            >
              {saving ? "Creating…" : "Create & Add Questions →"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-muted hover:bg-paper transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test list */}
      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-14 text-center">
          <BookOpen className="h-8 w-8 text-line mb-3" />
          <p className="text-xs font-semibold text-muted">No diagnostic tests yet</p>
          <p className="text-[11px] text-muted/60 mt-1">Create one above — it will appear on the homepage for new users.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map(t => (
            <div key={t.id} className="rounded-xl border border-line bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    {statusDot(t.status)}
                    <span className="text-[11px] text-muted/40">#{t.id}</span>
                    <span className="text-[11px] text-muted">{t.question_count} questions · {t.duration_minutes} min</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-ink">{t.title}</h3>
                  {t.description && <p className="text-[11px] text-muted mt-0.5">{t.description}</p>}
                  {t.question_count === 0 && (
                    <p className="mt-1.5 text-[11px] text-saffron">No questions added yet — click Manage before publishing.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => setManagingTest(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-muted hover:text-ink transition"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Manage
                    <ChevronRight className="h-3 w-3 text-muted/40" />
                  </button>
                  {t.status === "draft" && (
                    <button onClick={() => void setStatus(t.id, "published")}
                      className="rounded-lg border border-ink bg-ink px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition"
                    >Publish</button>
                  )}
                  {t.status === "published" && (
                    <button onClick={() => void setStatus(t.id, "draft")}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-paper transition"
                    >Unpublish</button>
                  )}
                  {t.status !== "archived" && (
                    <button onClick={() => void setStatus(t.id, "archived")}
                      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted/60 hover:bg-paper transition"
                    >Archive</button>
                  )}
                  <button onClick={() => void handleDelete(t.id)}
                    className="rounded-lg border border-line/50 bg-white p-1.5 text-muted/40 hover:text-berry hover:border-berry/30 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
