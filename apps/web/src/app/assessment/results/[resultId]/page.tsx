import type { Metadata } from "next";
import { ResultReview } from "../../../../components/assessment/result-review";

type ResultPageProps = {
  params: Promise<{ resultId: string }>;
};

export const metadata: Metadata = {
  title: "Assessment Result",
  robots: { index: false, follow: false }
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { resultId } = await params;
  return <ResultReview resultId={resultId} />;
}
