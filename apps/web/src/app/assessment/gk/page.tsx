import type { Metadata } from "next";
import { ContentTypePage } from "../../../components/assessment/content-type-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "General Studies Practice",
  description: "GK and General Studies practice tests, performance analytics, and syllabus-based self tests for UPSC preparation.",
  alternates: { canonical: "/assessment/gk" },
};

export default function GKPage() {
  return <ContentTypePage contentType="gk" label="General Studies" shortLabel="GS" />;
}
