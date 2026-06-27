import type {
  StudyPlanAttemptPaper,
  StudyPlanDetail,
  StudyPlanSummary,
  StudyPlanTestTemplate
} from "./study-plans";

const serverBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function studyPlanFetch<T>(path: string, token?: string): Promise<T> {
  const headers: HeadersInit = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Study plan API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export function getStudyPlans(params: { examId?: string; page?: number; limit?: number } = {}): Promise<StudyPlanSummary[]> {
  const limit = params.limit ?? 20;
  const offset = ((params.page ?? 1) - 1) * limit;
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status: "published"
  });
  if (params.examId) search.set("exam_id", params.examId);
  return studyPlanFetch<StudyPlanSummary[]>(`/api/v1/study-plans?${search}`);
}

export function getStudyPlan(id: string, token?: string): Promise<StudyPlanDetail> {
  return studyPlanFetch<StudyPlanDetail>(`/api/v1/study-plans/${id}`, token);
}

export function getStudyPlanAttemptPaper(id: string, token: string): Promise<StudyPlanAttemptPaper> {
  return studyPlanFetch<StudyPlanAttemptPaper>(`/api/v1/study-plan-attempts/${id}/paper`, token);
}

export function getAdminStudyPlanTests(token: string): Promise<StudyPlanTestTemplate[]> {
  return studyPlanFetch<StudyPlanTestTemplate[]>("/api/v1/study-plan-tests?limit=100", token);
}
