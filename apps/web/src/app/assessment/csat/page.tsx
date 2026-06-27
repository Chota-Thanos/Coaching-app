import type { Metadata } from "next";
import { ContentTypePage } from "../../../components/assessment/content-type-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CSAT Practice",
  description: "CSAT and Aptitude practice tests, performance analytics, and syllabus-based self tests for UPSC preparation.",
  alternates: { canonical: "/assessment/csat" },
};

export default function CSATPage() {
  return <ContentTypePage contentType="aptitude" label="CSAT / Aptitude" shortLabel="CSAT" />;
}
