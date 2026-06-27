import type { Metadata } from "next";
import { AttemptEngine } from "../../../../components/assessment/attempt-engine";

type AttemptPageProps = {
  params: Promise<{ attemptId: string }>;
};

export const metadata: Metadata = {
  title: "Assessment Attempt",
  robots: { index: false, follow: false }
};

export default async function AttemptPage({ params }: AttemptPageProps) {
  const { attemptId } = await params;
  return <AttemptEngine attemptId={attemptId} />;
}
