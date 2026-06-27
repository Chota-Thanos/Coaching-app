import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, FileQuestion, Layers3, Trophy } from "lucide-react";
import { StartAttemptButton } from "../../../../components/assessment/start-attempt-button";
import { getAssessmentTestPaper } from "../../../../lib/assessment-api";
import { assessmentHref, formatMarks, testTypeLabel } from "../../../../lib/assessment";

export const dynamic = "force-dynamic";

type TestDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: TestDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const test = await getAssessmentTestPaper(id);
    return {
      title: test.title,
      description: test.description ?? `${test.duration_minutes} minute assessment practice test.`,
      alternates: { canonical: `/assessment/tests/${id}` },
      openGraph: {
        title: test.title,
        description: test.description ?? "Assessment practice test",
        type: "website",
        url: `/assessment/tests/${id}`
      }
    };
  } catch {
    return {};
  }
}

const DIFFICULTY_MAP: Record<string, { label: string; color: string }> = {
  quick_test: { label: "Easy–Medium", color: "bg-emerald/12 text-emerald" },
  sectional_test: { label: "Medium", color: "bg-saffron/12 text-saffron" },
  full_length_test: { label: "Hard", color: "bg-berry/12 text-berry" },
  pyq_test: { label: "Exam Level", color: "bg-brand/12 text-brand" },
  mains_test: { label: "Advanced", color: "bg-muted/20 text-muted" }
};

export default async function TestDetailPage({ params }: TestDetailPageProps) {
  const { id } = await params;
  const test = await getAssessmentTestPaper(id).catch(() => null);
  if (!test) notFound();

  const difficulty = DIFFICULTY_MAP[test.test_type] ?? { label: "Standard", color: "bg-paper text-muted" };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: test.title,
    description: test.description,
    provider: { "@type": "Organization", name: "Coaching App" }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-5 lg:pb-12">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} type="application/ld+json" />

      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-civic hover:bg-civic/8"
        href={assessmentHref("/tests")}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All Tests
      </Link>

      <article className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Header card */}
          <header className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {/* Gradient top strip */}
            <div className="h-1.5 bg-gradient-to-r from-civic to-emerald" />

            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-civic/12 px-3 py-1 text-xs font-bold text-civic">
                  {testTypeLabel(test.test_type)}
                </span>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-muted">
                  {test.exam.name}
                </span>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-muted">
                  {test.exam_level.name}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${difficulty.color}`}>
                  {difficulty.label}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black leading-tight text-ink md:text-4xl">{test.title}</h1>
              {test.description && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">{test.description}</p>
              )}
            </div>
          </header>

          {/* Stat tiles */}
          <section className="grid grid-cols-3 gap-3">
            {[
              { icon: Clock3, label: "Duration", value: `${test.duration_minutes}`, unit: "min" },
              { icon: Trophy, label: "Total Marks", value: formatMarks(test.total_marks), unit: "marks" },
              { icon: FileQuestion, label: "Questions", value: String(test.questions.length), unit: "Qs" }
            ].map(({ icon: Icon, label, value, unit }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <Icon aria-hidden="true" className="h-5 w-5 text-civic" />
                <p className="mt-1 text-2xl font-black text-ink">{value}</p>
                <p className="text-xs font-semibold text-muted">{unit}</p>
              </div>
            ))}
          </section>

          {/* Sections */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-black text-ink">
              <Layers3 aria-hidden="true" className="h-4.5 w-4.5 text-brand" />
              Sections
            </h2>
            {test.sections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-surface p-5 text-sm text-muted">
                All questions are in a single section.
              </p>
            ) : (
              <div className="grid gap-3">
                {test.sections.map((section, index) => (
                  <div key={section.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-widest text-civic">
                        Section {index + 1}
                      </p>
                      <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold text-muted">
                        {test.questions.filter((q) => q.test_section_id === section.id).length} questions
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-black text-ink">{section.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {section.duration_minutes ? `${section.duration_minutes} min` : "Shared timer"}
                    </p>
                    {section.instructions && (
                      <p className="mt-2 text-sm leading-6 text-muted">{section.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <StartAttemptButton testTemplateId={test.id} createdByUserId={test.created_by_user_id} />

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-sm font-black text-ink">Strategy Tips</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                "Read all sections before answering",
                "Finish sure-shot questions first",
                "Mark doubtful ones for review",
                "Leave time for final review pass"
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-sm leading-snug text-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </article>

      {/* Mobile sticky start bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-7xl">
          <StartAttemptButton testTemplateId={test.id} createdByUserId={test.created_by_user_id} />
        </div>
      </div>
    </main>
  );
}
