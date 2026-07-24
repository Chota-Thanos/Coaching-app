"use client";

import { FileText, Plus, RefreshCw, Trash2, Search, Calendar, Award, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { authenticatedDelete, authenticatedGet, authenticatedPatch, useAuth } from "../../auth/auth-context";

type MainsQuestion = {
  id: number;
  question_family: string;
  status: "draft" | "in_review" | "approved" | "published" | "archived";
  created_at: string;
  current_version: {
    question_statement: string;
    supplementary_statement?: string;
    question_prompt?: string;
  };
  mains_details: {
    word_limit?: number;
    marks: string;
    directive?: string;
  };
};

type AdminMainsQuestionManagerProps = {
  onEdit: (id: number) => void;
  onCreateNew: () => void;
};

export function AdminMainsQuestionManager({ onEdit, onCreateNew }: AdminMainsQuestionManagerProps) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<MainsQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      // Build query string
      let url = "/api/v1/assessment/mains/questions?limit=100";
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const data = await authenticatedGet<MainsQuestion[]>(url, token);
      setQuestions(data || []);
    } catch (err) {
      console.error(err);
      setMessage("Could not load Mains questions library.");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleDelete = async (id: number, title: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete this Mains question:\n"${title.slice(0, 60)}..."?`)) {
      return;
    }

    try {
      await authenticatedDelete(`/api/v1/assessment/mains/questions/${id}`, token);
      await loadQuestions();
      alert("Question deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete question.");
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/mains/questions/${id}`, token, { status: newStatus });
      await loadQuestions();
      setMessage(`Question ${newStatus === "published" ? "published" : "unpublished"} successfully.`);
    } catch (err) {
      console.error(err);
      setMessage("Failed to update question status.");
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const text = (q.current_version?.question_statement || "").toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-black text-ink">Mains Question Bank</h2>
          <p className="text-xs text-ink/60 mt-0.5">Manage published mains practice questions and grading rubrics.</p>
        </div>
        
        <button
          onClick={onCreateNew}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-civic px-4 text-sm font-bold text-white shadow-sm hover:bg-civic/90 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          Create Mains Question
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            placeholder="Search questions by statement keywords..."
            className="w-full h-11 rounded-xl border border-line pl-10 pr-4 text-sm outline-none focus:border-civic"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-2">
          <select
            className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink outline-none focus:border-civic"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink disabled:opacity-60"
            disabled={loading}
            onClick={loadQuestions}
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {message && (
        <p className="p-3 rounded-lg bg-berry/5 text-berry border border-berry/10 text-sm font-semibold">{message}</p>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 text-civic animate-spin" />
          <span className="text-sm font-medium text-ink/60">Fetching Mains library...</span>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-line rounded-2xl bg-surface">
          <FileText className="h-10 w-10 text-ink/30 mx-auto mb-2" />
          <p className="text-sm font-bold text-ink/70">No questions found</p>
          <p className="text-xs text-ink/50 mt-1">Try resetting your filters or write a new subjective question.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuestions.map((q) => (
            <article
              key={q.id}
              className="bg-surface border border-line rounded-2xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-3 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                    q.status === "published" ? "bg-emerald/10 text-emerald" :
                    q.status === "approved" ? "bg-civic/10 text-civic" :
                    q.status === "in_review" ? "bg-amber/10 text-amber" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {q.status}
                  </span>
                  
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink/50">
                    <Award className="h-3 w-3" />
                    {q.mains_details?.marks || "10"} Marks
                  </span>

                  {q.mains_details?.word_limit && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink/50 border-l border-line pl-2">
                      Limit: {q.mains_details.word_limit} Words
                    </span>
                  )}

                  {q.mains_details?.directive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink/50 border-l border-line pl-2 uppercase">
                      Type: {q.mains_details.directive}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-ink leading-snug line-clamp-3">
                  {q.current_version?.question_statement}
                </h3>
                
                {q.current_version?.supplementary_statement && (
                  <p className="text-xs text-ink/60 line-clamp-2 italic bg-paper/30 p-2 rounded">
                    {q.current_version.supplementary_statement}
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-ink/40">
                  <Calendar className="h-3 w-3" />
                  Created: {new Date(q.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-start">
                <button
                  onClick={() => onEdit(q.id)}
                  className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-line hover:border-civic text-xs font-bold text-ink hover:text-civic transition-all"
                  type="button"
                >
                  Edit Question
                </button>

                {q.status !== "published" && (
                  <button
                    onClick={() => handleUpdateStatus(q.id, "published")}
                    className="flex-1 sm:flex-none h-9 px-3 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all shadow-sm"
                    type="button"
                  >
                    Publish
                  </button>
                )}
                
                {q.status === "published" && (
                  <button
                    onClick={() => handleUpdateStatus(q.id, "draft")}
                    className="flex-1 sm:flex-none h-9 px-3 rounded-lg border border-amber-500 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-all"
                    type="button"
                  >
                    Unpublish
                  </button>
                )}
                
                <button
                  onClick={() => handleDelete(q.id, q.current_version?.question_statement || "this question")}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-line text-ink/60 hover:text-rose-500 hover:border-rose-200 transition-all"
                  type="button"
                  title="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
