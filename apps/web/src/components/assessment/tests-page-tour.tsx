"use client";

import { Map } from "lucide-react";
import { startFullTour } from "../../lib/full-tour";
import { FullTourSegment } from "../app/full-tour-segment";
import { TourStep } from "../app/guided-tour-engine";

const TESTS_TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-create-test-btn",
    badge: "Tour · Step 1 of 13",
    title: "Build Your Own Custom Test",
    body: "This app lets you create personalized practice tests by picking exactly which topics you want to cover. Click 'Next' to see how — we'll walk through the entire flow from test creation to results.",
  },
];

export function TestsPageTour() {
  return (
    <>
      <button
        onClick={() => {
          startFullTour();
          window.location.reload();
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink/70 shadow-sm hover:bg-paper transition"
      >
        <Map className="h-4 w-4 text-civic" />
        Take a Tour
      </button>
      <FullTourSegment
        pageKey="tests"
        steps={TESTS_TOUR_STEPS}
        nextPageUrl="/assessment/custom-test/create?title=Polity+%26+Governance+Practice&tour=1"
      />
    </>
  );
}
