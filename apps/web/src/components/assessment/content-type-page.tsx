'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Sparkles, ClipboardList } from 'lucide-react';
import { AssessmentHomePage } from './assessment-home';
import { AssessmentDashboard } from './assessment-dashboard';
import { authenticatedGet, useAuth } from '../auth/auth-context';

interface ContentTypePageProps {
  contentType: 'gk' | 'aptitude' | 'mains';
  label: string;
  shortLabel: string;
}

export function ContentTypePage({ contentType, label, shortLabel }: ContentTypePageProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-650 border-t-transparent" /></div>}>
      <ContentTypePageInner contentType={contentType} label={label} shortLabel={shortLabel} />
    </Suspense>
  );
}

function ContentTypePageInner({ contentType, label, shortLabel }: ContentTypePageProps) {
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as 'create' | 'performance' | 'revision') ?? 'create';
  const perfTab = (searchParams.get('perf') as 'summary' | 'tests') ?? 'summary';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b border-line/60 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">{label}</h1>
            <p className="mt-0.5 text-sm text-muted">Practice tests and performance analytics</p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/assessment/custom-test/create?content_type=${contentType === 'aptitude' ? 'aptitude' : contentType === 'mains' ? 'mains' : 'gk'}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <Plus className="h-4 w-4 text-indigo-650" />
              <span>Create Custom Test</span>
            </Link>
            
            <Link
              href={`/assessment/custom-test?content_type=${contentType === 'aptitude' ? 'aptitude' : contentType === 'mains' ? 'mains' : 'gk'}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <ClipboardList className="h-4 w-4 text-indigo-650" />
              <span>My Custom Tests</span>
            </Link>
            
            <Link
              href={`/assessment/ai-parser?content_type=${contentType === 'aptitude' ? 'aptitude' : contentType === 'mains' ? 'mains' : 'gk'}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <Sparkles className="h-4 w-4 text-indigo-300" />
              <span>AI based Parsing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="sticky top-[53px] z-20 border-b border-line/60 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-1">
            <Link
              href={`?view=create`}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                view === 'create'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Create Test
            </Link>
            <Link
              href={`?view=performance&perf=${perfTab}`}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                view === 'performance'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Performance
            </Link>
            <Link
              href={`?view=revision`}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                view === 'revision'
                  ? 'border-indigo-650 text-indigo-650'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Revision
            </Link>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {view === 'create' && (
          <AssessmentHomePage contentTypeFilter={contentType} />
        )}
        {view === 'revision' && (
          <AssessmentHomePage contentTypeFilter="revision" revisionContentTypeFilter={contentType} />
        )}
        {view === 'performance' && (
          <div className="mx-auto max-w-7xl">
            {/* Performance sub-tabs */}
            <div className="sticky top-[101px] z-10 border-b border-line/60 bg-white px-4">
              <div className="flex gap-1">
                <Link
                  href={`?view=performance&perf=summary`}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    perfTab === 'summary'
                      ? 'border-indigo-650 text-indigo-650'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  Summary
                </Link>
                <Link
                  href={`?view=performance&perf=tests`}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    perfTab === 'tests'
                      ? 'border-indigo-650 text-indigo-650'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  My Tests
                </Link>
              </div>
            </div>
            {perfTab === 'summary' && (
              <AssessmentDashboard contentTypeFilter={contentType as 'gk' | 'aptitude' | 'mains'} />
            )}
            {perfTab === 'tests' && (
              <MyTestsList contentType={contentType as 'gk' | 'aptitude' | 'mains'} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MyTestsList({ contentType }: { contentType: string }) {
  const { token, isInitialized } = useAuth();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttempts = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const params = contentType === 'mains' ? 'test_type=mains_test' : `content_type=${contentType}`;
        const data = await authenticatedGet<any[]>(`/api/v1/assessment/me/attempts?limit=50&${params}`, token);
        setAttempts(data || []);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load attempts');
      } finally {
        setLoading(false);
      }
    };
    if (isInitialized) {
      void fetchAttempts();
    }
  }, [contentType, token, isInitialized]);

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;
  if (error) return <div className="py-16 text-center text-sm text-muted">{error}</div>;
  if (attempts.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-sm text-muted">No tests taken yet for this section.</p>
    </div>
  );

  return (
    <div className="space-y-3 p-4">
      {attempts.map((attempt: any) => (
        <div key={attempt.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink truncate">{attempt.test_template?.title ?? 'Practice Session'}</p>
              <p className="mt-1 text-xs text-muted">
                Attempted on {attempt.started_at ? new Date(attempt.started_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : 'Unknown date'}
              </p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
              attempt.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {attempt.status?.toUpperCase()}
            </span>
          </div>
          {attempt.result && (
            <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
              <span>Score: {Number(attempt.result.score ?? 0).toFixed(1)}</span>
              <span>Accuracy: {Math.round((attempt.result.accuracy ?? 0) * 100)}%</span>
            </div>
          )}
          <div className="mt-3">
            <Link
              href={attempt.status === 'completed' && attempt.result?.id ? `/assessment/results/${attempt.result.id}` : `/assessment/attempts/${attempt.id}`}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {attempt.status === 'completed' ? 'View Report →' : 'Resume Test →'}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
