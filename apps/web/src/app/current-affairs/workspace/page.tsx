import type { Metadata } from "next";
import { WorkspaceDashboard } from "../../../components/current-affairs/workspace/workspace-dashboard";

export const metadata: Metadata = {
  title: "Notes Space",
  description: "Save current affairs articles, define custom tags, bulk import articles, and create personal notes repositories.",
  alternates: { canonical: "/current-affairs/workspace" },
  robots: { index: false, follow: false }
};

export default function WorkspacePage() {
  return <WorkspaceDashboard />;
}
