// Mirrors apps/api/src/modules/assessment/question-caps.ts — kept in sync
// manually since the frontend needs these numbers for live UI clamping
// (the server re-validates independently, so a mismatch here is a UX papercut,
// not a security issue).
export const QUESTION_CAP = {
  free: { mains: 10, objective: 50 },
  premium: { mains: 25, objective: 100 }
} as const;

export const GUEST_QUESTION_CAP = 10;
export const FREE_TEST_LIMIT = 3;

export function getQuestionCap(hasPremium: boolean, isMains: boolean): number {
  const tier = hasPremium ? QUESTION_CAP.premium : QUESTION_CAP.free;
  return isMains ? tier.mains : tier.objective;
}
