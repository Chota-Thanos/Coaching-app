'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AssessmentHomePage } from './assessment-home';
import { CategoryPerformancePage } from './category-performance-page';
import { authenticatedGet, useAuth } from '../auth/auth-context';
import { SignInPanel } from '../auth/sign-in-panel';

interface CategoryDetailPageProps {
  nodeId: number;
}

export function CategoryDetailPage({ nodeId }: CategoryDetailPageProps) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-650" /></div>}>
      <CategoryDetailPageInner nodeId={nodeId} />
    </Suspense>
  );
}

function CategoryDetailPageInner({ nodeId }: CategoryDetailPageProps) {
  const { token, isInitialized } = useAuth();
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as 'create' | 'performance' | 'revision') ?? 'create';
  const type = searchParams.get('type') ?? '';

  const [category, setCategory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const fetchCategoryDetails = async () => {
      try {
        const data = await authenticatedGet<any>(`/api/v1/assessment/me/categories/${nodeId}/performance${type ? `?content_type=${type}` : ''}`, token);
        if (data?.category) {
          setCategory(data.category);
        } else {
          setError('Category not found');
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load category details');
      } finally {
        setLoading(false);
      }
    };
    if (isInitialized) {
      void fetchCategoryDetails();
    }
  }, [nodeId, token, isInitialized, type]);

  if (!isInitialized || (loading && !category)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 leading-tight">Category Details</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to view category details, custom tests, and performance breakdown.</p>
          <div className="mt-6">
            <SignInPanel />
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <p className="text-sm text-muted">{error}</p>
        <Link href="/assessment/gk" className="mt-4 text-sm font-semibold text-indigo-650 hover:underline">
          Go back to GK Practice
        </Link>
      </div>
    );
  }

  const backLink =
    category?.content_type === 'aptitude'
      ? '/assessment/csat'
      : category?.content_type === 'mains'
      ? '/assessment/mains-hub'
      : '/assessment/gk';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="border-b border-line/60 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex items-start gap-4">
          <Link href={backLink} className="mt-1 rounded-lg border border-line p-1.5 text-muted hover:bg-slate-50 hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-ink truncate">{category?.name ?? 'Category Details'}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {category?.description ?? 'Customize practice tests and inspect detailed outcomes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
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
              href={`?view=performance`}
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

      {/* Tab Content */}
      <div className="tab-content">
        {view === 'create' && (
          <AssessmentHomePage rootNodeId={nodeId} contentTypeFilter={category?.content_type} />
        )}
        {view === 'performance' && (
          <CategoryPerformancePage nodeId={String(nodeId)} />
        )}
        {view === 'revision' && (
          <AssessmentHomePage
            rootNodeId={nodeId}
            contentTypeFilter="revision"
            revisionContentTypeFilter={category?.content_type}
          />
        )}
      </div>
    </div>
  );
}
