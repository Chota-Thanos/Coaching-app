"use client";

import { useEffect, useState } from "react";
import { Map } from "lucide-react";
import { startFullTour, getFullTourState, FULL_TOUR_KEY } from "../../lib/full-tour";
import { FullTourSegment } from "../app/full-tour-segment";
import { TourStep } from "../app/guided-tour-engine";

// Key that marks "this device has already seen the assessment area"
const SEEN_KEY = "waytoias_assessment_tour_seen_v2";

const TESTS_TOUR_STEPS: TourStep[] = [
  {
    selector: "#tour-create-test-btn",
    badge: "Tour · Step 1 of 12",
    title: "Build Your Own Custom Test",
    body: "Welcome! This app lets you build personalised practice tests by selecting exactly the topics you want. Click 'Next' for a full walkthrough — from creating a test to reviewing your results.",
  },
];

export function TestsPageTour() {
  // Bump this key to force-remount FullTourSegment after auto-starting the tour
  const [segmentKey, setSegmentKey] = useState(0);

  useEffect(() => {
    const alreadySeen = localStorage.getItem(SEEN_KEY);
    const tourActive = getFullTourState().active;

    if (!alreadySeen && !tourActive) {
      // First visit + no tour in progress → auto-start
      localStorage.setItem(SEEN_KEY, "1");
      startFullTour();
      // Force FullTourSegment to remount so it picks up the state we just wrote
      setSegmentKey((k) => k + 1);
    } else {
      // Mark as seen even if we're not starting the tour (e.g. returning visitor)
      if (!alreadySeen) localStorage.setItem(SEEN_KEY, "1");
    }
  }, []);

  return (
    <>
      <button
        onClick={() => {
          startFullTour();
          setSegmentKey((k) => k + 1);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink/70 shadow-sm hover:bg-paper transition"
      >
        <Map className="h-4 w-4 text-civic" />
        Take a Tour
      </button>
      <FullTourSegment
        key={segmentKey}
        pageKey="tests"
        steps={TESTS_TOUR_STEPS}
        nextPageUrl="/assessment/custom-test/create?title=Polity+%26+Governance+Practice&tour=1"
      />
    </>
  );
}
