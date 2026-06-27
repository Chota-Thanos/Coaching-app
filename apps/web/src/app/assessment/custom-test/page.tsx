"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Trash2,
  Play,
  Plus,
  Loader2,
  Calendar,
  Layers,
  Award,
  Globe,
  BookOpenCheck
} from "lucide-react";
import { useAuth, authenticatedGet, authenticatedDelete, authenticatedPost } from "../../../components/auth/auth-context";

type CustomTest = {
  id: number;
  title: string;
  slug: string;
  test_type: string;
  duration_minutes: number;
  total_marks: number;
  question_count?: number;
  created_at: string;
};

export default function CustomTestsListPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    }>
      <CustomTestsListInner />
    </Suspense>
  );
}

function CustomTestsListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isInitialized } = useAuth();
  
  const contentParam = searchParams.get("content_type") || "gk";
  const [tests, setTests] = useState<CustomTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomTests = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // access_type=private retrieves the user's custom tests
      const data = await authenticatedGet<CustomTest[]>("/api/v1/assessment/test-templates?access_type=private&limit=100", token);
      
      // Filter client-side by content_type if needed, or show all
      // The API lists all. Let's list all and categorize them or show them with tags.
      setTests(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load custom tests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && token) {
      fetchCustomTests();
    }
  }, [token, isInitialized]);

  const handleStartAttempt = async (testId: number) => {
    if (!token) return;
    setStartingId(testId);
    setError(null);
    try {
      const attempt = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${testId}/attempts/start`,
        token,
        {}
      );
      router.push(`/assessment/attempts/${attempt.id ?? attempt}`);
    } catch (err: any) {
      setError(err.message || "Failed to start attempt.");
      setStartingId(null);
    }
  };

  const handleDeleteTest = async (testId: number) => {
    if (!token || !window.confirm("Are you sure you want to delete this custom test template?")) return;
    setDeletingId(testId);
    setError(null);
    try {
      await authenticatedDelete(`/api/v1/assessment/test-templates/${testId}`, token);
      setTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (err: any) {
      setError(err.message || "Failed to delete custom test.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isInitialized || (loading && tests.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  const backUrl = `/assessment/${contentParam === "aptitude" ? "csat" : contentParam}`;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="border-b border-line bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-5 w-5 text-slate-655" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">My Custom Tests</h1>
              <p className="text-xs text-slate-500">View and practice with tests you constructed</p>
            </div>
          </div>
          <Link
            href={`/assessment/custom-test/create?content_type=${contentParam}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Test</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 mt-8">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {tests.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white max-w-md mx-auto mt-12 px-6">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-black text-slate-800">No custom tests found</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              You haven't built any custom tests yet. Build a tailored practice session based on specific syllabus categories and question counts.
            </p>
            <div className="mt-6">
              <Link
                href={`/assessment/custom-test/create?content_type=${contentParam}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Build First Test</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => {
              const isMains = test.test_type === "mains_test";
              const typeLabel = isMains
                ? "Mains"
                : test.title.toLowerCase().includes("csat") || test.title.toLowerCase().includes("aptitude")
                ? "CSAT"
                : "GS";

              const badgeColor = typeLabel === "Mains"
                ? "bg-rose-50 text-rose-700 border-rose-100"
                : typeLabel === "CSAT"
                ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-indigo-50 text-indigo-700 border-indigo-100";

              return (
                <div
                  key={test.id}
                  className="group relative flex flex-col justify-between border border-slate-200 rounded-2xl bg-white p-5 hover:shadow-md hover:border-slate-300 transition duration-150"
                >
                  <div>
                    {/* Header: Badge & Date */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-md ${badgeColor}`}>
                        {typeLabel} Test
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(test.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit"
                        })}
                      </span>
                    </div>

                    {/* Test Title */}
                    <h3 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                      {test.title}
                    </h3>

                    {/* Meta stats */}
                    <div className="flex items-center gap-4 mt-4 text-xs font-semibold text-slate-500 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <strong>{test.question_count ?? Math.round(test.total_marks)}</strong> Qs
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <strong>{test.duration_minutes}</strong> Min
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-slate-400" />
                        <strong>{test.total_marks}</strong> Marks
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 mt-5 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleStartAttempt(test.id)}
                      disabled={startingId === test.id}
                      className="flex-1 h-9.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 px-4 text-xs font-bold text-white shadow-sm transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {startingId === test.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      <span>Attempt</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      disabled={deletingId === test.id}
                      className="grid h-9.5 w-9.5 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50/30 transition disabled:bg-slate-50 disabled:text-slate-200"
                    >
                      {deletingId === test.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
