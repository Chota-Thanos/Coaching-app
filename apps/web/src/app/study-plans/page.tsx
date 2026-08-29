import type { Metadata } from "next";
import "./study-plans-design.css";
import { getAssessmentExams } from "../../lib/assessment-api";
import { getStudyPlans } from "../../lib/study-plans-api";
import { StudyPlansCatalogue } from "../../components/study-plans/study-plans-catalogue";

export const dynamic = "force-dynamic";

type StudyPlansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Study Plans",
  description:
    "Guided UPSC study plans — full courses with video lectures, self-paced plans with study material, and test series.",
  alternates: { canonical: "/study-plans" }
};

export default async function StudyPlansPage({ searchParams }: StudyPlansPageProps) {
  const query = await searchParams;
  const examId = first(query.exam_id);

  // Fetched anonymously for a fast first paint; the client refetches with the
  // learner's token to fill in enrolment and subscription coverage. A wide
  // limit because the type/stage/length/subject facets filter client-side.
  const [exams, plans] = await Promise.all([
    getAssessmentExams().catch(() => []),
    getStudyPlans({ examId, page: 1, limit: 60 }).catch(() => [])
  ]);

  return <StudyPlansCatalogue initialPlans={plans} exams={exams} examId={examId} />;
}
