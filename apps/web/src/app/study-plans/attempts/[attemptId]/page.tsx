import type { Metadata } from "next";
import { StudyPlanAttemptEngine } from "../../../../components/study-plans/study-plan-attempt-engine";

export const dynamic = "force-dynamic";

type StudyPlanAttemptPageProps = {
  params: Promise<{ attemptId: string }>;
};

export const metadata: Metadata = {
  title: "Study Plan Test",
  robots: { index: false, follow: false }
};

export default async function StudyPlanAttemptPage({ params }: StudyPlanAttemptPageProps) {
  const { attemptId } = await params;
  return <StudyPlanAttemptEngine attemptId={attemptId} />;
}
