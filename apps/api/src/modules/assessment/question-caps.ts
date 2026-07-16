// Per-test question count caps, standardised across GK/CSAT (objective) and
// Mains (subjective) — Mains caps lower since answers are essay-length and
// each one consumes AI/manual evaluation capacity.
export const QUESTION_CAP = {
  free: { mains: 10, objective: 50 },
  premium: { mains: 25, objective: 100 }
} as const;

export function getQuestionCap(hasPremium: boolean, isMains: boolean): number {
  const tier = hasPremium ? QUESTION_CAP.premium : QUESTION_CAP.free;
  return isMains ? tier.mains : tier.objective;
}
