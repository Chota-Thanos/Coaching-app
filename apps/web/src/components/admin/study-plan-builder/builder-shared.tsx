"use client";

import type { ReactNode } from "react";
import { BookOpen, CheckCircle2, ClipboardList, FileQuestion, Video } from "lucide-react";
import type { StudyPlanItem, StudyPlanItemType, StudyPlanStatus } from "../../../lib/study-plans";

/** The four stages of building a plan, in the order they actually happen. */
export type BuilderStage = "details" | "curriculum" | "step" | "tests";

/**
 * How a live lecture reaches the student.
 *
 * Deliberately derived from the data rather than stored: a step with a
 * scheduled `live_class` is hosted in the app, a step with a `lecture_url` is
 * linked out, and the two are mutually exclusive in practice. That keeps this
 * a UI concept with no migration behind it, and means existing steps classify
 * themselves correctly the first time an editor opens them.
 */
export type LectureDelivery = "in_app" | "external" | "recording";

export const STEP_TYPES: Array<{ value: StudyPlanItemType; label: string; icon: ReactNode; blurb: string }> = [
  { value: "reading", label: "Reading", icon: <BookOpen className="h-4 w-4" />, blurb: "Material to work through" },
  { value: "revision", label: "Revision", icon: <CheckCircle2 className="h-4 w-4" />, blurb: "Recap of earlier days" },
  { value: "live_lecture", label: "Lecture", icon: <Video className="h-4 w-4" />, blurb: "Taught live or on video" },
  { value: "prelims_test", label: "Prelims test", icon: <ClipboardList className="h-4 w-4" />, blurb: "Objective test" },
  { value: "csat_test", label: "CSAT test", icon: <ClipboardList className="h-4 w-4" />, blurb: "Aptitude test" },
  { value: "mains_test", label: "Mains test", icon: <FileQuestion className="h-4 w-4" />, blurb: "Written answers" }
];

export function stepIcon(type: StudyPlanItemType): ReactNode {
  return STEP_TYPES.find((entry) => entry.value === type)?.icon ?? <BookOpen className="h-4 w-4" />;
}

export function isTestStep(type: StudyPlanItemType): boolean {
  return type === "prelims_test" || type === "csat_test" || type === "mains_test";
}

export function testTypeFromItem(type: StudyPlanItemType) {
  return isTestStep(type) ? (type as "prelims_test" | "csat_test" | "mains_test") : null;
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function levelMatchesTestType(levelName: string, type: StudyPlanItemType): boolean {
  const testType = testTypeFromItem(type);
  if (!testType) return true;
  const name = levelName.toLowerCase();
  const isCsatLevel = name.includes("csat") || name.includes("aptitude");
  const isMainsLevel = name.includes("mains");
  if (testType === "csat_test") return isCsatLevel;
  if (testType === "mains_test") return isMainsLevel;
  return !isCsatLevel && !isMainsLevel;
}

/** A link that plays in place (file, YouTube, Vimeo) versus one that opens out. */
export function looksLikeRecording(url: string): boolean {
  if (!url) return false;
  const value = url.toLowerCase();
  if (/\.(mp4|webm|ogg|m3u8|mov)(\?|#|$)/.test(value)) return true;
  return value.includes("youtube.com") || value.includes("youtu.be") || value.includes("vimeo.com");
}

export function deliveryForItem(item: StudyPlanItem | null): LectureDelivery {
  if (!item) return "in_app";
  if (item.live_class) return "in_app";
  if (item.lecture_url) return looksLikeRecording(item.lecture_url) ? "recording" : "external";
  return "in_app";
}

export const DELIVERY_OPTIONS: Array<{
  value: LectureDelivery;
  label: string;
  blurb: string;
}> = [
  {
    value: "in_app",
    label: "Host it here",
    blurb: "You teach live inside the app. Students join from their plan, and attendance is recorded."
  },
  {
    value: "external",
    label: "External meeting link",
    blurb: "Zoom, Meet or Teams. Students leave the app to attend, and attendance is not recorded."
  },
  {
    value: "recording",
    label: "Recorded video",
    blurb:
      "A video hosted elsewhere — YouTube, Vimeo, or a direct file link. Plays inside the day, and remembers where each student stopped."
  }
];

export const LIVE_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live now",
  ended: "Ended",
  cancelled: "Cancelled"
};

/** Blank step form, shared by "add" and "edit" so the two cannot drift apart. */
export type StepFormState = {
  week_no: string;
  day_no: string;
  item_type: StudyPlanItemType;
  title: string;
  description: string;
  estimated_minutes: string;
  resource_url: string;
  lecture_url: string;
  is_preview: boolean;
  exam_level_id: string;
  duration_minutes: string;
  test_status: StudyPlanStatus;
  delivery: LectureDelivery;
  live_class_scheduled_at: string;
};

export function emptyStepForm(weekNo = 1, dayNo = 1): StepFormState {
  return {
    week_no: String(weekNo),
    day_no: String(dayNo),
    item_type: "reading",
    title: "",
    description: "",
    estimated_minutes: "60",
    resource_url: "",
    lecture_url: "",
    is_preview: false,
    exam_level_id: "",
    duration_minutes: "120",
    test_status: "draft",
    delivery: "in_app",
    live_class_scheduled_at: ""
  };
}

export function stepFormFromItem(item: StudyPlanItem): StepFormState {
  return {
    week_no: String(item.week_no),
    day_no: String(item.day_no),
    item_type: item.item_type,
    title: item.title,
    description: item.description ?? "",
    estimated_minutes: item.estimated_minutes ? String(item.estimated_minutes) : "",
    resource_url: item.resource_url ?? "",
    lecture_url: item.lecture_url ?? "",
    is_preview: item.is_preview,
    exam_level_id: item.test_template?.exam_level_id ? String(item.test_template.exam_level_id) : "",
    duration_minutes: item.test_template?.duration_minutes ? String(item.test_template.duration_minutes) : "90",
    test_status: item.test_template?.status ?? "draft",
    delivery: deliveryForItem(item),
    live_class_scheduled_at: ""
  };
}

/** One labelled field. The hint sits under the control, never as placeholder text. */
export function Field({
  children,
  label,
  hint,
  required
}: {
  children: ReactNode;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-black uppercase tracking-wide text-ink/55">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] font-semibold leading-4 text-ink/45">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink outline-none focus:border-civic";
export const textareaClass =
  "min-h-24 w-full rounded-lg border border-line bg-surface p-3 text-sm font-semibold text-ink outline-none focus:border-civic";
