export type AssessmentStatus = "draft" | "in_review" | "published" | "archived";
export type AssessmentAccessType = "free" | "subscription" | "paid" | "private";
export type AssessmentTestType = "quick_test" | "sectional_test" | "full_length_test" | "pyq_test" | "mains_test" | "diagnostic_test";
export type AttemptStatus = "in_progress" | "submitted" | "expired" | "cancelled";
export type AttemptResponseStatus = "not_visited" | "answered" | "skipped" | "marked_for_review";

export type Exam = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
};

export type ExamLevel = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
};

export type AssessmentTestTemplate = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  exam_level_id: number;
  test_type: AssessmentTestType;
  duration_minutes: number;
  total_marks: number | string;
  access_type: AssessmentAccessType;
  status: AssessmentStatus;
  question_count?: number;
  created_by_user_id?: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TestSection = {
  id: number;
  title: string;
  display_order: number;
  duration_minutes: number | null;
  instructions: string | null;
};

export type QuestionFormat = {
  id: number;
  name: string;
  slug: string;
  question_family: string;
};

export type QuestionVersion = {
  id: number;
  question_id: number;
  question_statement: string;
  supplementary_statement: string | null;
  statements_facts: unknown[];
  question_prompt: string | null;
  options: unknown[];
  content_json: Record<string, unknown>;
  correct_answer?: unknown;
  explanation?: string | null;
};

export type TestQuestionItem = {
  id: number;
  test_section_id: number | null;
  question_version_id: number;
  marks: number | string;
  negative_marks: number | string;
  display_order: number;
  question_format: QuestionFormat;
  question_version: QuestionVersion;
  passage?: { id: number; title: string | null; body: string } | null;
  response?: AttemptResponse | null;
  score_item?: {
    outcome?: "correct" | "incorrect" | "unattempted";
    score?: number | string;
    selected_answer?: unknown;
    correct_answer?: unknown;
    time_spent_seconds?: number;
  } | null;
};

export type TestPaper = AssessmentTestTemplate & {
  exam: Exam;
  exam_level: ExamLevel;
  sections: TestSection[];
  questions: TestQuestionItem[];
};

export type AttemptResponse = {
  id: number;
  question_version_id: number;
  selected_answer: unknown;
  answer_text: string | null;
  status: AttemptResponseStatus;
  is_marked_for_review: boolean;
  time_spent_seconds: number;
  answered_at: string | null;
  updated_at: string;
};

export type AttemptPaper = {
  id: number;
  user_id: number;
  test_template_id: number;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  time_spent_seconds: number;
  test_template: TestPaper;
  sections: TestSection[];
  questions: TestQuestionItem[];
  result: AssessmentResult | null;
};

export type AssessmentResult = {
  id: number;
  attempt_id: number;
  score: number | string;
  max_score: number | string;
  accuracy: number | string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  negative_marks: number | string;
  rank_snapshot: Record<string, unknown>;
  percentile_snapshot: number | string | null;
  cutoff_status: string | null;
  created_at: string;
};

export type ResultReview = AssessmentResult & {
  attempt: AttemptPaper;
  test_template: AssessmentTestTemplate;
  questions: TestQuestionItem[];
  topic_breakdowns?: Array<{
    id: number;
    taxonomy_name: string | null;
    question_nature_name: string | null;
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    unattempted_count: number;
    score: number | string;
    accuracy: number | string;
    avg_time_seconds: number | string;
  }>;
};

export type StudentAttemptSummary = {
  id: number;
  test_template_id: number;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  time_spent_seconds: number;
  test_template: AssessmentTestTemplate;
  result: AssessmentResult | null;
};

export type AssessmentDashboard = {
  summary: {
    attempts: number;
    avg_score: number | string;
    avg_accuracy: number | string;
    correct_count: number;
    incorrect_count: number;
    unattempted_count: number;
  };
  weak_topics: Array<{
    taxonomy_name: string | null;
    question_nature: string | null;
    question_count: number;
    avg_accuracy: number | string;
    avg_score: number | string;
  }>;
  trend: Array<{
    result_date: string;
    avg_score: number | string;
    avg_accuracy: number | string;
    attempts: number;
  }>;
};

export type TestSeries = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  cover_image_url: string | null;
  access_type: AssessmentAccessType;
  status: AssessmentStatus;
  item_count?: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TestSeriesDetail = TestSeries & {
  items: Array<{
    id: number;
    test_template_id: number;
    display_order: number;
    scheduled_at: string | null;
    unlock_at: string | null;
    test_template: AssessmentTestTemplate;
  }>;
};

export function assessmentHref(path = ""): string {
  return `/assessment${path}`;
}

export function testTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function accessLabel(type: string): string {
  if (type === "subscription") return "Plan";
  return type.replace(/_/g, " ");
}

export function formatPercent(value: number | string | null | undefined): string {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return "0%";
  const percent = numberValue <= 1 ? numberValue * 100 : numberValue;
  return `${Math.round(percent)}%`;
}

export function formatMarks(value: number | string | null | undefined): string {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return "0";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

export function normalizeAssessmentPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function optionKey(option: unknown, index: number): string {
  if (typeof option === "object" && option !== null) {
    const record = option as Record<string, unknown>;
    const key = record.id ?? record.key ?? record.value ?? record.label;
    if (key !== undefined) return String(key);
  }
  return String.fromCharCode(65 + index);
}

export function optionText(option: unknown, index: number): string {
  if (typeof option === "object" && option !== null) {
    const record = option as Record<string, unknown>;
    const text = record.text ?? record.label ?? record.value ?? record.statement;
    if (text !== undefined) return String(text);
  }
  if (option !== undefined && option !== null) return String(option);
  return `Option ${String.fromCharCode(65 + index)}`;
}

export function selectedAnswerKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const key = record.id ?? record.key ?? record.value ?? record.label;
    return key === undefined ? JSON.stringify(value) : String(key);
  }
  return String(value);
}

export function isSameAnswer(a: unknown, b: unknown): boolean {
  return selectedAnswerKey(a) === selectedAnswerKey(b);
}
