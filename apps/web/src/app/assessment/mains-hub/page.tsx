import type { Metadata } from "next";
import { ContentTypePage } from "../../../components/assessment/content-type-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mains Practice",
  description: "UPSC Mains answer writing practice, performance analytics, and evaluation for UPSC Mains preparation.",
  alternates: { canonical: "/assessment/mains-hub" },
};

export default function MainsHubPage() {
  return <ContentTypePage contentType="mains" label="Mains" shortLabel="Mains" />;
}
