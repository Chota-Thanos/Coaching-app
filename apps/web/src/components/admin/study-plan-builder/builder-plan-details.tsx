"use client";

import { Loader2, Save } from "lucide-react";
import { RichTextMarkdownEditor } from "../../current-affairs/rich-text-editor";
import { PlanFreeSamplePicker } from "../plan-free-sample-picker";
import { Field, inputClass } from "./builder-shared";
import type { StudyPlanDetail } from "../../../lib/study-plans";

type TaxonomyNode = { id: number; name: string };

export type PlanDetailsForm = {
  title: string;
  subtitle: string;
  description: string;
  subject_node_id: string;
  duration_weeks: string;
  price_rupees: string;
  plan_type: string;
  access_mode: string;
  required_entitlement_key: string;
  weekly_hours: string;
  level_label: string;
  target_accuracy: string;
  status: string;
};

type PlanDetailsProps = {
  plan: StudyPlanDetail;
  form: PlanDetailsForm;
  onChange: (next: PlanDetailsForm) => void;
  subjects: TaxonomyNode[];
  busy: string | null;
  onSave: () => void;
  onReloadPlan: () => void;
};

export function BuilderPlanDetails({ plan, form, onChange, subjects, busy, onSave, onReloadPlan }: PlanDetailsProps) {
  const set = (patch: Partial<PlanDetailsForm>) => onChange({ ...form, ...patch });

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <header className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Plan details</p>
        <h2 className="mt-1 text-3xl font-black leading-tight text-ink">What is this plan, and who is it for?</h2>
        <p className="mt-1 text-sm text-ink/60">
          Everything here is what a student sees before they buy. The curriculum comes next.
        </p>
      </header>

      <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Plan title" hint="Shown on the catalogue card and the plan page." required>
            <input className={inputClass} onChange={(event) => set({ title: event.target.value })} value={form.title} />
          </Field>
          <Field label="Subtitle" hint="One line under the title. Optional.">
            <input className={inputClass} onChange={(event) => set({ subtitle: event.target.value })} value={form.subtitle} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject scope" hint="Leave blank if the plan covers the whole exam.">
              <select
                className={inputClass}
                onChange={(event) => set({ subject_node_id: event.target.value })}
                value={form.subject_node_id}
              >
                <option value="">Whole exam</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stage" hint="Prelims, Mains or CSAT — the catalogue filters on this.">
              <input className={inputClass} onChange={(event) => set({ level_label: event.target.value })} value={form.level_label} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-black text-ink">Shape and pace</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Length in weeks" hint="How many weeks the timeline runs.">
              <input
                className={inputClass}
                onChange={(event) => set({ duration_weeks: event.target.value })}
                value={form.duration_weeks}
              />
            </Field>
            <Field label="Hours per week" hint="The commitment you are asking for.">
              <input className={inputClass} onChange={(event) => set({ weekly_hours: event.target.value })} value={form.weekly_hours} />
            </Field>
            <Field label="Target accuracy" hint="The score the tracker judges test results against.">
              <input
                className={inputClass}
                onChange={(event) => set({ target_accuracy: event.target.value })}
                value={form.target_accuracy}
              />
            </Field>
          </div>
          <Field label="Plan type" hint="Decides the card, the plan page and which workspace a learner gets.">
            <select className={inputClass} onChange={(event) => set({ plan_type: event.target.value })} value={form.plan_type}>
              <option value="full_course">Full course — taught, with video</option>
              <option value="self_prep">Self-paced — materials and tests</option>
              <option value="test_series">Test series — tests and discussion</option>
            </select>
          </Field>
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-black text-ink">Price and access</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Access" hint="How a student comes to own this plan.">
              <select className={inputClass} onChange={(event) => set({ access_mode: event.target.value })} value={form.access_mode}>
                <option value="one_time">Sold separately</option>
                <option value="subscription">Included with a subscription</option>
                <option value="free">Free for everyone</option>
              </select>
            </Field>
            <Field label="Price (₹)" hint="Ignored when the plan is free or subscription-only.">
              <input
                className={inputClass}
                onChange={(event) => set({ price_rupees: event.target.value })}
                value={form.price_rupees}
              />
            </Field>
          </div>
          {form.access_mode === "subscription" && (
            <Field label="Unlocking entitlement" hint="Subscribers holding this entitlement key enrol free.">
              <input
                className={inputClass}
                onChange={(event) => set({ required_entitlement_key: event.target.value })}
                value={form.required_entitlement_key}
              />
            </Field>
          )}
          <Field label="Plan status" hint="Draft stays hidden from students.">
            <select className={inputClass} onChange={(event) => set({ status: event.target.value })} value={form.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <RichTextMarkdownEditor
            label="Description"
            minHeightClass="min-h-[240px]"
            onChange={(value) => set({ description: value })}
            placeholder="What the plan covers, who it suits, and what a student walks away able to do."
            value={form.description}
          />
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm font-black text-ink">Free preview days</p>
          <p className="mt-1 text-xs font-semibold text-ink/50">
            Pick the days anyone can open before paying. Choose ones that show the plan at its best.
          </p>
          <div className="mt-4">
            <PlanFreeSamplePicker items={plan.items} onChanged={onReloadPlan} />
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-end gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
          disabled={!form.title || busy === "plan-edit"}
          onClick={onSave}
          type="button"
        >
          {busy === "plan-edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save plan details
        </button>
      </div>
    </div>
  );
}
