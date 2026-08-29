import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../../study-plans-design.css";
import { StudyPlanItemScreen } from "../../../../../components/study-plans/study-plan-item-screen";
import { getStudyPlan } from "../../../../../lib/study-plans-api";

export const dynamic = "force-dynamic";

type ItemPageProps = {
  params: Promise<{ id: string; itemId: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function StudyPlanItemPage({ params }: ItemPageProps) {
  const { id, itemId } = await params;
  const plan = await getStudyPlan(id).catch(() => null);
  if (!plan || plan.status !== "published") notFound();

  // The anonymous fetch only carries preview items; the client refetches with
  // the learner's token, which is what unlocks the rest.
  return <StudyPlanItemScreen plan={plan} itemId={Number(itemId)} />;
}
