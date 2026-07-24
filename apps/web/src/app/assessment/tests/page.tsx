import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus, Map } from "lucide-react";
import { TestCard } from "../../../components/assessment/test-card";
import { TestFilters } from "../../../components/assessment/test-filters";
import { getAssessmentExamLevels, getAssessmentExams, getAssessmentTests } from "../../../lib/assessment-api";
import { normalizeAssessmentPage } from "../../../lib/assessment";
import { TestsPageTour } from "../../../components/assessment/tests-page-tour";

export const dynamic = "force-dynamic";

type TestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Assessment Tests",
  description: "Browse published practice tests by exam, level, and access type.",
  alternates: { canonical: "/assessment/tests" }
};

export default async function AssessmentTestsPage({ searchParams }: TestsPageProps) {
  const query = await searchParams;
  const examId = first(query.exam_id);
  const examLevelId = first(query.exam_level_id);
  const accessType = first(query.access_type);
  const page = normalizeAssessmentPage(query.page);

  const exams = await getAssessmentExams().catch(() => []);
  const levels = examId ? await getAssessmentExamLevels(examId).catch(() => []) : [];
  const tests = await getAssessmentTests({ examId, examLevelId, accessType, page, limit: 24 }).catch(() => []);

  return (
    <main className="list-page mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-5">
      <section className="border-b border-line pb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-civic">
              <ClipboardList aria-hidden="true" className="h-4 w-4" />
              Tests
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-ink md:text-4xl">Find the right test</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
              Use filters to find admin-curated tests, or build your own from any topic.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TestsPageTour />
            <Link
              href="/assessment/custom-test/create"
              id="tour-create-test-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-civic px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-civic/90 transition"
            >
              <Plus className="h-4 w-4" />
              Create Custom Test
            </Link>
          </div>
        </div>
      </section>

      <TestFilters
        exams={exams}
        levels={levels}
        selectedAccess={accessType}
        selectedExam={examId}
        selectedLevel={examLevelId}
      />

      {tests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface p-6 text-center text-sm text-ink/65">
          No published tests match these filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => <TestCard key={test.id} test={test} />)}
        </div>
      )}
    </main>
  );
}
