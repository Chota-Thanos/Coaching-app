"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Globe, Archive, Edit2, CheckCircle2, Clock, FileText } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { authenticatedGet, authenticatedPost, authenticatedPatch, authenticatedDelete } from "../auth/auth-context";

type Exam = { id: number; name: string };
type ExamLevel = { id: number; name: string; exam_id: number };

type DiagnosticTest = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  exam_level_id: number;
  test_type: string;
  status: string;
  access_type: string;
  duration_minutes: number;
  total_marks: number | null;
  question_count: number;
  created_at: string;
};

export function AdminDiagnosticTestManager() {
  const { token } = useAuth();
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examLevels, setExamLevels] = useState<ExamLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    exam_id: "",
    exam_level_id: "",
    duration_minutes: "30",
    description: "",
  });

  const loadTests = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<DiagnosticTest[]>(
        "/api/v1/assessment/test-templates?test_type=diagnostic_test&limit=50",
        token
      );
      setTests(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostic tests");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  useEffect(() => {
    if (!token) return;
    void authenticatedGet<Exam[]>("/api/v1/assessment/exams?limit=100", token).then(setExams).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !form.exam_id) return;
    void authenticatedGet<ExamLevel[]>(`/api/v1/assessment/exams/${form.exam_id}/levels?limit=100`, token)
      .then(setExamLevels)
      .catch(() => {});
  }, [token, form.exam_id]);

  async function handleCreate() {
    if (!token || !form.title.trim() || !form.exam_id || !form.exam_level_id) return;
    setSaving(true);
    try {
      const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      await authenticatedPost("/api/v1/assessment/test-templates", token, {
        title: form.title.trim(),
        slug,
        description: form.description.trim() || undefined,
        exam_id: Number(form.exam_id),
        exam_level_id: Number(form.exam_level_id),
        test_type: "diagnostic_test",
        access_type: "free",
        status: "draft",
        duration_minutes: Number(form.duration_minutes),
      });
      setShowCreate(false);
      setForm({ title: "", exam_id: "", exam_level_id: "", duration_minutes: "30", description: "" });
      await loadTests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create test");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: number, status: "draft" | "published" | "archived") {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/test-templates/${id}`, token, {
        status,
        published_at: status === "published" ? new Date().toISOString() : undefined,
      });
      await loadTests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Delete this diagnostic test? This cannot be undone.")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${id}`, token);
      await loadTests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete test");
    }
  }

  const statusBadge = (status: string) => {
    if (status === "published") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" />Published</span>;
    if (status === "archived") return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 border border-slate-200"><Archive className="h-3 w-3" />Archived</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200"><Clock className="h-3 w-3" />Draft</span>;
  };

  if (loading) return <div className="flex items-center justify-center p-16 text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button className="ml-3 text-rose-500 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Diagnostic Tests</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            These free tests appear on the homepage and welcome screen for new users. Only one should be published at a time.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" />
          New Diagnostic Test
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 space-y-4">
          <h3 className="font-extrabold text-slate-800 text-sm">Create New Diagnostic Test</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title *</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                placeholder="e.g. UPSC Prelims Diagnostic Test 2025"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Exam *</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                value={form.exam_id}
                onChange={(e) => setForm((f) => ({ ...f, exam_id: e.target.value, exam_level_id: "" }))}
              >
                <option value="">Select exam…</option>
                {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Exam Level *</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                value={form.exam_level_id}
                onChange={(e) => setForm((f) => ({ ...f, exam_level_id: e.target.value }))}
                disabled={!form.exam_id}
              >
                <option value="">Select level…</option>
                {examLevels.map((el) => <option key={el.id} value={el.id}>{el.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Duration (minutes) *</label>
              <input
                type="number"
                min={5}
                max={180}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Description (optional)</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                placeholder="Short description shown to users"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <strong>After creating:</strong> The test starts as a draft with 0 questions. Use the <strong>Question Bank</strong> tabs to find questions, then come back here to add them by ID. Publish the test once questions are added.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim() || !form.exam_id || !form.exam_level_id}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {saving ? "Creating…" : "Create Test"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <FileText className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">No diagnostic tests yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one above — it will appear on the homepage for new users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(t.status)}
                    <span className="text-xs text-slate-400 font-mono">#{t.id}</span>
                  </div>
                  <h3 className="mt-1.5 text-base font-extrabold text-slate-900 truncate">{t.title}</h3>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span><strong>{t.question_count}</strong> questions</span>
                    <span><strong>{t.duration_minutes}</strong> min</span>
                    <span>access: <strong>{t.access_type}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.status === "draft" && (
                    <button
                      onClick={() => setStatus(t.id, "published")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Publish
                    </button>
                  )}
                  {t.status === "published" && (
                    <button
                      onClick={() => setStatus(t.id, "draft")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Unpublish
                    </button>
                  )}
                  {t.status !== "archived" && (
                    <button
                      onClick={() => setStatus(t.id, "archived")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {t.question_count === 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 font-medium">
                  ⚠ No questions added yet. Add questions via the API or question import tools, then publish this test.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
