import type {
  AssessmentDashboard,
  AssessmentTestTemplate,
  Exam,
  ExamLevel,
  ResultReview,
  StudentAttemptSummary,
  TestPaper,
  TestSeries,
  TestSeriesDetail
} from "./assessment";

const serverBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

async function assessmentFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Assessment API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export type AssessmentTestListParams = {
  examId?: string;
  examLevelId?: string;
  accessType?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export function getAssessmentTests(params: AssessmentTestListParams = {}): Promise<AssessmentTestTemplate[]> {
  const limit = params.limit ?? 24;
  const offset = ((params.page ?? 1) - 1) * limit;
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status: params.status ?? "published"
  });
  if (params.examId) search.set("exam_id", params.examId);
  if (params.examLevelId) search.set("exam_level_id", params.examLevelId);
  if (params.accessType) search.set("access_type", params.accessType);
  return assessmentFetch<AssessmentTestTemplate[]>(`/api/v1/assessment/test-templates?${search}`);
}

export function getAssessmentTestPaper(id: string): Promise<TestPaper> {
  return assessmentFetch<TestPaper>(`/api/v1/assessment/test-templates/${id}/paper`);
}

export function getAssessmentExams(): Promise<Exam[]> {
  return assessmentFetch<Exam[]>("/api/v1/assessment/exams?limit=100");
}

export function getAssessmentExamLevels(examId: string): Promise<ExamLevel[]> {
  return assessmentFetch<ExamLevel[]>(`/api/v1/assessment/exams/${examId}/levels?limit=100`);
}

export function getAssessmentSeries(params: { examId?: string; page?: number; limit?: number } = {}): Promise<TestSeries[]> {
  const limit = params.limit ?? 20;
  const offset = ((params.page ?? 1) - 1) * limit;
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status: "published"
  });
  if (params.examId) search.set("exam_id", params.examId);
  return assessmentFetch<TestSeries[]>(`/api/v1/assessment/test-series?${search}`);
}

export function getAssessmentSeriesDetail(id: string): Promise<TestSeriesDetail> {
  return assessmentFetch<TestSeriesDetail>(`/api/v1/assessment/test-series/${id}`);
}

export function getAssessmentDashboard(token: string): Promise<AssessmentDashboard> {
  return assessmentFetchWithToken<AssessmentDashboard>("/api/v1/assessment/me/dashboard", token);
}

export function getMyAssessmentAttempts(token: string): Promise<StudentAttemptSummary[]> {
  return assessmentFetchWithToken<StudentAttemptSummary[]>("/api/v1/assessment/me/attempts?limit=20", token);
}

export function getResultReview(id: string, token: string): Promise<ResultReview> {
  return assessmentFetchWithToken<ResultReview>(`/api/v1/assessment/results/${id}/review`, token);
}

async function assessmentFetchWithToken<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Assessment API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}
