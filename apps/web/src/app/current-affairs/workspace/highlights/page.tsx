import type { Metadata } from "next";
import "../notes-design.css";
import { HighlightsReview } from "../../../../components/current-affairs/workspace/highlights-review";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Highlights",
  description: "Every highlight and margin note you have made across your saved articles.",
  robots: { index: false, follow: false }
};

export default function HighlightsPage() {
  return <HighlightsReview />;
}
