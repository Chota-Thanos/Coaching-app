"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, FileQuestion, LockKeyhole, Play } from "lucide-react";
import type { AssessmentTestTemplate } from "../../lib/assessment";
import { accessLabel, assessmentHref, formatMarks, testTypeLabel } from "../../lib/assessment";
import { useAuth, authenticatedDelete, authenticatedPatch } from "../auth/auth-context";

type TestCardProps = {
  test: AssessmentTestTemplate;
};

const TEST_TYPE_COLORS: Record<string, string> = {
  quick_test: "from-indigo-650/80 to-indigo-400/70",
  sectional_test: "from-indigo-500/80 to-indigo-300/50",
  full_length_test: "from-slate-650/80 to-slate-400/50",
  pyq_test: "from-muted/60 to-muted/40",
  mains_test: "from-rose-600/70 to-rose-400/50"
};

export function TestCard({ test }: TestCardProps) {
  const { token, user } = useAuth();
  const router = useRouter();
  
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit Form States
  const [editTitle, setEditTitle] = useState(test.title);
  const [editDescription, setEditDescription] = useState(test.description || "");
  const [editDuration, setEditDuration] = useState(test.duration_minutes);
  const [editMarks, setEditMarks] = useState(Number(test.total_marks));
  const [editAccessType, setEditAccessType] = useState(test.access_type);
  const [editStatus, setEditStatus] = useState(test.status);

  const isLocked = test.access_type !== "free";
  const gradientClass = TEST_TYPE_COLORS[test.test_type] ?? "from-indigo-500/80 to-indigo-300/50";
  const isAdmin = user && ["admin", "moderator", "content_editor"].includes(user.role);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete this assessment test:\n"${test.title}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${test.id}`, token);
      router.refresh();
    } catch (err) {
      alert("Failed to delete test.");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/test-templates/${test.id}`, token, {
        title: editTitle,
        description: editDescription || null,
        duration_minutes: Number(editDuration),
        total_marks: Number(editMarks),
        access_type: editAccessType,
        status: editStatus
      });
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      alert("Failed to update test. Please check inputs.");
      console.error(err);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      {/* Gradient header strip */}
      <div className={`relative h-2 bg-gradient-to-r ${gradientClass}`} />

      <div className="flex flex-1 flex-col p-5">
        {/* Badges row */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-bold text-muted">
            {testTypeLabel(test.test_type)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isLocked ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-indigo-50 text-indigo-700 border border-indigo-100/50"
            }`}
          >
            {isLocked && <LockKeyhole aria-hidden="true" className="h-3 w-3" />}
            {isLocked ? accessLabel(test.access_type) : "Free"}
          </span>
        </div>

        {/* Title */}
        <h2 className="mt-3 flex-1 text-base font-black leading-snug text-ink transition-colors group-hover:text-indigo-600">
          {test.title}
        </h2>
        {test.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">{test.description}</p>
        )}

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center rounded-xl bg-paper px-2 py-2">
            <Clock3 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="mt-1 text-sm font-black text-ink">{test.duration_minutes}</span>
            <span className="text-[10px] font-semibold text-muted">min</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-paper px-2 py-2">
            <FileQuestion className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="mt-1 text-sm font-black text-ink">{test.question_count ?? "—"}</span>
            <span className="text-[10px] font-semibold text-muted">Qs</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-paper px-2 py-2">
            <span className="text-xs text-muted">🎯</span>
            <span className="mt-1 text-sm font-black text-ink">{formatMarks(test.total_marks)}</span>
            <span className="text-[10px] font-semibold text-muted">marks</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <Link
            href={assessmentHref(`/tests/${test.id}`)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-600 active:scale-[0.98]"
          >
            <Play aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            Start
          </Link>
          <Link
            href={assessmentHref(`/tests/${test.id}`)}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-600 hover:text-indigo-600"
          >
            Preview
            <ArrowRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>

        {/* Admin management buttons */}
        {isAdmin && (
          <div className="mt-2.5 flex gap-2 border-t border-line/60 pt-2.5">
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-600 hover:bg-indigo-50/20 hover:text-indigo-600 cursor-pointer select-none"
            >
              Edit Test
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-600 hover:text-white hover:bg-rose-600 cursor-pointer select-none disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Test"}
            </button>
          </div>
        )}
      </div>

      {/* Edit Form Overlay Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleEditSubmit}
            className="relative w-full max-w-md bg-surface rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left"
          >
            <button
              className="absolute top-4 right-4 h-8 w-8 rounded-full border border-slate-200 bg-surface hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center font-bold text-sm transition-all"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              ✕
            </button>
            
            <h3 className="text-lg font-black text-ink">Edit Test Template</h3>
            
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Title
              <input
                type="text"
                required
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal bg-surface outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </label>
            
            <label className="grid gap-1.5 text-xs font-bold text-ink">
              Description (Optional)
              <textarea
                className="h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal bg-surface outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-none"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Duration (minutes)
                <input
                  type="number"
                  required
                  min="1"
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal bg-surface outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                />
              </label>
              
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Total Marks
                <input
                  type="number"
                  required
                  min="0"
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-normal bg-surface outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  value={editMarks}
                  onChange={(e) => setEditMarks(Number(e.target.value))}
                />
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Access Type
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-surface px-3 text-xs font-normal outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  value={editAccessType}
                  onChange={(e) => setEditAccessType(e.target.value as any)}
                >
                  <option value="free">Free</option>
                  <option value="subscription">Subscription</option>
                  <option value="paid">Paid</option>
                  <option value="private">Private</option>
                </select>
              </label>
              
              <label className="grid gap-1.5 text-xs font-bold text-ink">
                Status
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-surface px-3 text-xs font-normal outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                >
                  <option value="draft">Draft</option>
                  <option value="in_review">In Review</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 h-10 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-10 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
