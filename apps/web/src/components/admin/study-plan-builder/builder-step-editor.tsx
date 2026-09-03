"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Loader2,
  Radio,
  Save,
  SquarePlay,
  Trash2,
  Trophy
} from "lucide-react";
import { PlanItemResourcesEditor } from "../plan-item-resources-editor";
import {
  DELIVERY_OPTIONS,
  Field,
  inputClass,
  isTestStep,
  levelMatchesTestType,
  LIVE_STATUS_LABEL,
  STEP_TYPES,
  textareaClass,
  type StepFormState
} from "./builder-shared";
import { formatStudyPlanItemType, type StudyPlanItem, type StudyPlanItemType, type StudyPlanStatus } from "../../../lib/study-plans";

type ExamLevel = { id: number; name: string };

type StepEditorProps = {
  mode: "create" | "edit";
  form: StepFormState;
  onChange: (next: StepFormState) => void;
  item: StudyPlanItem | null;
  levels: ExamLevel[];
  busy: string | null;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onScheduleLiveClass: (scheduledAt: string) => void;
  onStartLiveClass: (liveClassId: number) => void;
  onEndLiveClass: (liveClassId: number) => void;
};

export function BuilderStepEditor({
  mode,
  form,
  onChange,
  item,
  levels,
  busy,
  onSave,
  onCancel,
  onDelete,
  onScheduleLiveClass,
  onStartLiveClass,
  onEndLiveClass
}: StepEditorProps) {
  const set = (patch: Partial<StepFormState>) => onChange({ ...form, ...patch });
  const isTest = isTestStep(form.item_type);
  const isLecture = form.item_type === "live_lecture";
  const matchingLevels = levels.filter((level) => levelMatchesTestType(level.name, form.item_type));
  const liveClass = item?.live_class ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <button
        className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-ink/50 hover:text-civic"
        onClick={onCancel}
        type="button"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to the curriculum
      </button>

      <header className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
          {mode === "create" ? "New step" : "Editing step"}
        </p>
        <h2 className="mt-1 text-3xl font-black leading-tight text-ink">
          {form.title || (mode === "create" ? "Add a step" : "Untitled step")}
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Week {form.week_no || "?"}, day {form.day_no || "?"} · {formatStudyPlanItemType(form.item_type)}
        </p>
      </header>

      <div className="space-y-7">
        <section className="space-y-4">
          <p className="text-xs font-black uppercase tracking-wide text-ink/40">What kind of day is this?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {STEP_TYPES.map((type) => {
              const active = form.item_type === type.value;
              return (
                <button
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                      : "border-line bg-surface hover:border-ink/25"
                  }`}
                  key={type.value}
                  onClick={() => set({ item_type: type.value as StudyPlanItemType })}
                  type="button"
                >
                  <span className={active ? "text-emerald-700" : "text-ink/45"}>{type.icon}</span>
                  <span className="text-sm font-black text-ink">{type.label}</span>
                  <span className="text-[11px] font-semibold leading-4 text-ink/45">{type.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Step title" hint="The line a student sees on their day." required>
            <input
              className={inputClass}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="Example: Fundamental Rights — Articles 12 to 18"
              value={form.title}
            />
          </Field>
          <Field label="What the student should do" hint="Instructions for the day. Optional but worth writing.">
            <textarea
              className={textareaClass}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="Example: Read the chapter, then note down every exception to Article 14."
              value={form.description}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Week" hint="Which week of the plan.">
              <input className={inputClass} onChange={(event) => set({ week_no: event.target.value })} value={form.week_no} />
            </Field>
            <Field label="Day" hint="Which day inside that week.">
              <input className={inputClass} onChange={(event) => set({ day_no: event.target.value })} value={form.day_no} />
            </Field>
            {!isTest && (
              <Field label="Minutes" hint="Roughly how long this takes.">
                <input
                  className={inputClass}
                  onChange={(event) => set({ estimated_minutes: event.target.value })}
                  value={form.estimated_minutes}
                />
              </Field>
            )}
          </div>
        </section>

        {/* A lecture can be taught in the app, linked out to, or pre-recorded.
            This used to be a single "Lecture link" box with the in-app option
            hidden below it, which read as though a link were the only way. */}
        {isLecture && (
          <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
            <div>
              <p className="text-sm font-black text-ink">How does this lecture reach the student?</p>
              <p className="mt-1 text-xs font-semibold text-ink/50">Pick one. You can change it later.</p>
            </div>
            <div className="grid gap-2">
              {DELIVERY_OPTIONS.map((option) => {
                const active = form.delivery === option.value;
                return (
                  <button
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      active ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "border-line hover:border-ink/25"
                    }`}
                    key={option.value}
                    onClick={() => set({ delivery: option.value })}
                    type="button"
                  >
                    <span
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-emerald-600 text-white" : "bg-paper text-ink/45"
                      }`}
                    >
                      {option.value === "in_app" ? <Radio className="h-4 w-4" /> : <SquarePlay className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-ink/50">{option.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {form.delivery === "in_app" ? (
              <div className="rounded-xl border border-civic/25 bg-civic/5 p-4">
                {liveClass ? (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-black text-ink">
                        <span
                          className={`h-2 w-2 rounded-full ${liveClass.status === "live" ? "bg-rose-500" : "bg-ink/25"}`}
                        />
                        {LIVE_STATUS_LABEL[liveClass.status] ?? liveClass.status}
                      </p>
                      <p className="mt-1 text-xs font-bold text-ink/55">
                        {new Date(liveClass.scheduled_start).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {liveClass.status === "scheduled" && (
                        <button
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-civic px-3 text-xs font-black text-white disabled:opacity-50"
                          disabled={busy === "live-class-start"}
                          onClick={() => onStartLiveClass(liveClass.id)}
                          type="button"
                        >
                          {busy === "live-class-start" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                          Start the class
                        </button>
                      )}
                      {liveClass.status === "live" && (
                        <>
                          <Link
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-black text-white"
                            href={`/study-plans/live/${liveClass.id}`}
                            target="_blank"
                          >
                            <Radio className="h-3.5 w-3.5" />
                            Open the room
                          </Link>
                          <button
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-black text-ink disabled:opacity-50"
                            disabled={busy === "live-class-end"}
                            onClick={() => onEndLiveClass(liveClass.id)}
                            type="button"
                          >
                            End
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : mode === "edit" ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Class date and time" hint="You host it; students join from their plan.">
                      <input
                        className={inputClass}
                        onChange={(event) => set({ live_class_scheduled_at: event.target.value })}
                        type="datetime-local"
                        value={form.live_class_scheduled_at}
                      />
                    </Field>
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-civic px-4 text-sm font-black text-white disabled:opacity-50"
                      disabled={!form.live_class_scheduled_at || busy === "live-class-schedule"}
                      onClick={() => onScheduleLiveClass(form.live_class_scheduled_at)}
                      type="button"
                    >
                      {busy === "live-class-schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                      Schedule
                    </button>
                  </div>
                ) : (
                  <Field label="Class date and time" hint="Scheduled the moment you save this step. You host it; students join from their plan.">
                    <input
                      className={inputClass}
                      onChange={(event) => set({ live_class_scheduled_at: event.target.value })}
                      type="datetime-local"
                      value={form.live_class_scheduled_at}
                    />
                  </Field>
                )}

                {/* A class taught live still needs somewhere for the people
                    who missed it to go. Optional, and usually filled in after
                    the class rather than before. */}
                <div className="mt-4 border-t border-civic/20 pt-4">
                  <Field
                    label="Recording link (optional)"
                    hint="Add this after the class. Students who missed it watch here — a video file, YouTube or Vimeo."
                  >
                    <input
                      className={inputClass}
                      onChange={(event) => set({ lecture_url: event.target.value })}
                      placeholder="https://youtube.com/watch?v=…"
                      value={form.lecture_url}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Field
                label={form.delivery === "external" ? "Meeting link" : "Video link"}
                hint={
                  form.delivery === "external"
                    ? "The Zoom, Meet or Teams URL students should open."
                    : "A direct video file, or a YouTube or Vimeo link."
                }
              >
                <input
                  className={inputClass}
                  onChange={(event) => set({ lecture_url: event.target.value })}
                  placeholder={form.delivery === "external" ? "https://meet.google.com/…" : "https://youtube.com/watch?v=…"}
                  value={form.lecture_url}
                />
              </Field>
            )}
          </section>
        )}

        {!isLecture && !isTest && (
          <section className="rounded-xl border border-line bg-surface p-5">
            <Field label="Resource link" hint="A single main link for this day. Add more below once the step is saved.">
              <input
                className={inputClass}
                onChange={(event) => set({ resource_url: event.target.value })}
                placeholder="https://…"
                value={form.resource_url}
              />
            </Field>
          </section>
        )}

        {isTest && (
          <section className="space-y-4 rounded-xl border border-civic/25 bg-civic/5 p-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-civic" />
              <p className="text-sm font-black text-ink">The test inside this step</p>
            </div>
            {matchingLevels.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                No matching exam level is configured for {formatStudyPlanItemType(form.item_type)}. Add one under the
                assessment settings before creating this step.
              </p>
            ) : (
              matchingLevels.length > 1 && (
                <Field label="Exam level" hint="Which level this test belongs to.">
                  <select
                    className={inputClass}
                    onChange={(event) => set({ exam_level_id: event.target.value })}
                    value={form.exam_level_id}
                  >
                    <option value="">Choose a level</option>
                    {matchingLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time limit" hint="Minutes a student gets for the attempt.">
                <input
                  className={inputClass}
                  onChange={(event) => set({ duration_minutes: event.target.value })}
                  value={form.duration_minutes}
                />
              </Field>
              <Field label="Test status" hint="Draft keeps it hidden from students.">
                <select
                  className={inputClass}
                  onChange={(event) => set({ test_status: event.target.value as StudyPlanStatus })}
                  value={form.test_status}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </Field>
            </div>
            {item?.test_template_id && (
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-civic px-4 text-sm font-black text-white"
                href={`/admin/study-plans/tests/${item.test_template_id}`}
                rel="noreferrer"
                target="_blank"
              >
                <ClipboardList className="h-4 w-4" />
                Write the questions
              </Link>
            )}
          </section>
        )}

        <section className="rounded-xl border border-line bg-surface p-5">
          <label className="flex items-start gap-3">
            <input
              checked={form.is_preview}
              className="mt-1"
              onChange={(event) => set({ is_preview: event.target.checked })}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-black text-ink">Free preview</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-ink/50">
                Anyone browsing the plan can open this day before paying.
              </span>
            </span>
          </label>
        </section>

        {/* Resources need a saved step to hang off, so they only appear in edit. */}
        {mode === "edit" && item && !isTestStep(item.item_type) && (
          <section className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-3 text-sm font-black text-ink">Everything else this day needs</p>
            <PlanItemResourcesEditor planItemId={item.id} />
          </section>
        )}
      </div>

      {/* The save bar stays put while the form scrolls — a long step should
          never leave an editor hunting for the button. */}
      <div className="sticky bottom-0 -mx-4 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-surface px-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={onDelete}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete this step
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-black text-ink hover:bg-paper"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
            disabled={!form.title || busy === "step" || busy === "step-edit"}
            onClick={onSave}
            type="button"
          >
            {busy === "step" || busy === "step-edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mode === "create" ? "Add this step" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
