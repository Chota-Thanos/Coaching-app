import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminStudyPlanSpace } from "../../../../components/admin/admin-study-plan-space";

export const metadata: Metadata = {
  title: "Study Plans Admin",
  robots: { index: false, follow: false }
};

export default async function AdminStudyPlansPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  const planId = Number(tab);
  if (!Number.isInteger(planId) || planId <= 0) {
    redirect("/admin/study-plans");
  }
  return <AdminStudyPlanSpace initialPlanId={planId} />;
}
