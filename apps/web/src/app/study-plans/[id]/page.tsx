import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudyPlanDetailClient } from "../../../components/study-plans/study-plan-detail-client";
import { getStudyPlan } from "../../../lib/study-plans-api";

export const dynamic = "force-dynamic";

type StudyPlanPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: StudyPlanPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const plan = await getStudyPlan(id);
    return {
      title: plan.title,
      description: plan.subtitle ?? plan.description ?? "Structured UPSC study plan.",
      robots: plan.status === "published" ? undefined : { index: false, follow: false }
    };
  } catch {
    return {};
  }
}

export default async function StudyPlanPage({ params }: StudyPlanPageProps) {
  const { id } = await params;
  const plan = await getStudyPlan(id).catch(() => null);
  if (!plan || plan.status !== "published") notFound();

  return (
    <main className="pb-16">
      <StudyPlanDetailClient initialPlan={plan} />
    </main>
  );
}
