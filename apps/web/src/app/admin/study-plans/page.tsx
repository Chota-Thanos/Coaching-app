import type { Metadata } from "next";
import { AdminStudyPlanManagement } from "../../../components/admin/admin-study-plan-management";

export const metadata: Metadata = {
  title: "Study Plans Management",
  robots: { index: false, follow: false }
};

export default function AdminStudyPlansIndexPage() {
  return <AdminStudyPlanManagement />;
}
