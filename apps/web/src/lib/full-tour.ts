// Multi-page guided tour state management
// Tour spans: tests(0) → create-build(1-5) → attempt(6-7) → results(8-9) → dashboard(10-11)
// Tests page navigates to the create page with a pre-filled title so the tour
// starts directly in build mode (step 1 is content-type, not the name input).

export const FULL_TOUR_KEY = "waytoias_full_tour_v2";

export interface FullTourState {
  active: boolean;
  globalStep: number;
}

export const PAGE_TOUR_RANGES = {
  tests: [0, 0] as [number, number],
  create: [1, 5] as [number, number],
  attempt: [6, 7] as [number, number],
  results: [8, 9] as [number, number],
  dashboard: [10, 11] as [number, number],
} as const;

export type TourPageKey = keyof typeof PAGE_TOUR_RANGES;

export const TOTAL_TOUR_STEPS = 12;

export function getFullTourState(): FullTourState {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(FULL_TOUR_KEY) : null;
    if (!raw) return { active: false, globalStep: 0 };
    return JSON.parse(raw) as FullTourState;
  } catch {
    return { active: false, globalStep: 0 };
  }
}

export function setFullTourState(state: FullTourState) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(FULL_TOUR_KEY, JSON.stringify(state));
    }
  } catch { /* ignore */ }
}

export function startFullTour() {
  setFullTourState({ active: true, globalStep: 0 });
}

export function advanceFullTour(to: number) {
  setFullTourState({ active: true, globalStep: to });
}

export function endFullTour() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(FULL_TOUR_KEY);
    }
  } catch { /* ignore */ }
}

export function isFullTourActiveForPage(pageKey: TourPageKey): boolean {
  const state = getFullTourState();
  if (!state.active) return false;
  const [min, max] = PAGE_TOUR_RANGES[pageKey];
  return state.globalStep >= min && state.globalStep <= max;
}

export function getLocalStepForPage(pageKey: TourPageKey): number {
  const state = getFullTourState();
  const [min] = PAGE_TOUR_RANGES[pageKey];
  return Math.max(0, state.globalStep - min);
}
