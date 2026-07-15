"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuidedTourEngine, TourStep } from "./guided-tour-engine";
import {
  PAGE_TOUR_RANGES,
  TourPageKey,
  advanceFullTour,
  endFullTour,
  isFullTourActiveForPage,
  getLocalStepForPage,
} from "../../lib/full-tour";

interface FullTourSegmentProps {
  pageKey: TourPageKey;
  steps: TourStep[];
  /** URL to navigate to after this page's segment completes */
  nextPageUrl?: string;
}

export function FullTourSegment({ pageKey, steps, nextPageUrl }: FullTourSegmentProps) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [localStart, setLocalStart] = useState(0);

  useEffect(() => {
    if (!isFullTourActiveForPage(pageKey)) return;
    const start = getLocalStepForPage(pageKey);
    setLocalStart(start);
    // Small delay so the page has rendered its elements
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, [pageKey]);

  if (!show) return null;

  const visibleSteps = steps.slice(localStart);
  if (visibleSteps.length === 0) return null;

  return (
    <GuidedTourEngine
      steps={visibleSteps}
      onClose={(finished) => {
        setShow(false);
        if (finished) {
          const nextGlobal = PAGE_TOUR_RANGES[pageKey][1] + 1;
          advanceFullTour(nextGlobal);
          if (nextPageUrl) router.push(nextPageUrl);
        } else {
          endFullTour();
        }
      }}
    />
  );
}
