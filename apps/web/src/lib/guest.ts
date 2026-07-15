const GUEST_TOKEN_KEY = "waytoias_guest_token";
const PENDING_CLAIM_KEY = "waytoias_pending_claim";

export type PendingGuestClaim = {
  attemptId: number;
  guestToken: string;
};

/** Opaque per-device identity for an unauthenticated visitor taking a test. Persisted
 * so it survives page reloads during the attempt, and reused (not regenerated) across
 * a single guest session so the backend can tie their attempt back to them. */
export function getOrCreateGuestToken(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(GUEST_TOKEN_KEY);
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem(GUEST_TOKEN_KEY, token);
  return token;
}

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function clearGuestToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_TOKEN_KEY);
}

/** Recorded right after a guest submits a test, so that once they register/log in the
 * attempt can be claimed into their new account and the same result becomes visible. */
export function setPendingGuestClaim(claim: PendingGuestClaim): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));
}

export function getPendingGuestClaim(): PendingGuestClaim | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PENDING_CLAIM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingGuestClaim;
  } catch {
    return null;
  }
}

export function clearPendingGuestClaim(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_CLAIM_KEY);
}
