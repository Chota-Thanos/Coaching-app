import type { Metadata } from "next";
import { StudyPlanResultReview } from "../../../../components/study-plans/study-plan-result-review";

type ResultPageProps = {
  params: Promise<{ resultId: string }>;
};

export const metadata: Metadata = {
  title: "Study Plan Test Result",
  robots: { index: false, follow: false }
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { resultId } = await params;
  return <StudyPlanResultReview resultId={resultId} />;
}
