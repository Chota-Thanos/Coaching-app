import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminStudyPlanTestContent } from "../../../../../components/admin/admin-study-plan-test-content";

export const metadata: Metadata = {
  title: "Study Plan Test Content",
  robots: { index: false, follow: false }
};

export default async function AdminStudyPlanTestContentPage({ params }: { params: Promise<{ testTemplateId: string }> }) {
  const { testTemplateId } = await params;
  const id = Number(testTemplateId);
  if (!Number.isInteger(id) || id <= 0) {
    redirect("/admin/study-plans");
  }
  return <AdminStudyPlanTestContent testTemplateId={id} />;
}
