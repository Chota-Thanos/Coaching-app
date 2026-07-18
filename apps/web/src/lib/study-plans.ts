export type StudyPlanStatus = "draft" | "in_review" | "published" | "archived";
export type StudyPlanTestType = "prelims_test" | "csat_test" | "mains_test";
export type StudyPlanItemType =
  | "reading"
  | "revision"
  | "prelims_test"
  | "csat_test"
  | "mains_test"
  | "live_lecture";
export type StudyPlanProgressStatus = "not_started" | "in_progress" | "completed";

export type StudyPlanSummary = {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  exam_id: number;
  subject_node_id: number | null;
  exam_name?: string;
  subject_name?: string | null;
  duration_weeks: number;
  level_label: string | null;
  language: string;
  cover_image_url: string | null;
  preview_video_url: string | null;
  price_amount_minor: number;
  currency: string;
  status: StudyPlanStatus;
  item_count?: number;
  test_count?: number;
  published_at: string | null;
};

export type StudyPlanTestTemplate = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  exam_id: number;
  exam_level_id: number;
  test_type: StudyPlanTestType;
  duration_minutes: number;
  total_marks: number | string;
  negative_marks_per_question: number | string;
  instructions: string | null;
  status: StudyPlanStatus;
  question_count?: number;
};

export type StudyPlanLiveClassStatus = "scheduled" | "live" | "ended" | "cancelled";

export type StudyPlanLiveClassSummary = {
  id: number;
  title: string;
  status: StudyPlanLiveClassStatus;
  scheduled_start: string;
  scheduled_end: string | null;
  host_user_id: number;
};

export type StudyPlanItem = {
  id: number;
  plan_id: number;
  week_no: number;
  day_no: number;
  display_order: number;
  item_type: StudyPlanItemType;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  resource_url: string | null;
  lecture_url: string | null;
  test_template_id: number | null;
  is_preview: boolean;
  test_template: StudyPlanTestTemplate | null;
  live_class_id: number | null;
  live_class: StudyPlanLiveClassSummary | null;
  progress: {
    id: number;
    status: StudyPlanProgressStatus;
    completed_at: string | null;
    test_attempt_id: number | null;
  } | null;
};

export type StudyPlanDetail = StudyPlanSummary & {
  exam: { id: number; name: string; slug: string };
  subject: { id: number; name: string; slug: string } | null;
  has_access: boolean;
  enrollment: {
    id: number;
    status: string;
    completed_items: number;
    total_items: number;
    completed_tests: number;
    total_tests: number;
  } | null;
  progress_summary: {
    completed_items: number;
    total_items: number;
    completed_tests: number;
    total_tests: number;
  } | null;
  items: StudyPlanItem[];
  week_overviews?: {
    week_no: number;
    title: string;
    description: string | null;
  }[];
  reviews_summary?: {
    average_rating: number;
    total_reviews: number;
  };
};

export type StudyPlanQuestion = {
  id: number;
  test_template_id?: number;
  display_order: number;
  question_family: "objective" | "mains_subjective";
  question_statement: string;
  supplementary_statement: string | null;
  question_prompt: string | null;
  options: unknown[];
  correct_answer?: unknown;
  explanation?: string | null;
  model_answer?: string | null;
  marks: number | string;
  negative_marks: number | string;
  subject_node_id?: number | null;
  topic_node_id?: number | null;
  subtopic_node_id?: number | null;
  question_nature_id?: number | null;
  source_payload?: Record<string, unknown> | null;
  response?: {
    id: number;
    selected_answer: unknown;
    answer_text: string | null;
    status: StudyPlanProgressStatus | "answered" | "skipped" | "marked_for_review" | "not_visited";
    is_marked_for_review: boolean;
  } | null;
};

export type StudyPlanAttemptPaper = {
  id: number;
  status: "in_progress" | "submitted" | "expired" | "cancelled";
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  time_spent_seconds: number;
  test_template: StudyPlanTestTemplate;
  result: { id: number; score: number | string; max_score: number | string } | null;
  questions: StudyPlanQuestion[];
};

export function studyPlanHref(path = ""): string {
  return `/study-plans${path}`;
}

export function formatPlanPrice(amountMinor: number | string | null | undefined, currency = "INR"): string {
  const amount = Number(amountMinor ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount);
}

export function formatStudyPlanItemType(type: string): string {
  if (type === "prelims_test") return "Prelims test";
  if (type === "csat_test") return "CSAT test";
  if (type === "mains_test") return "Mains test";
  if (type === "live_lecture") return "Live lecture";
  return type.replace(/_/g, " ");
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
