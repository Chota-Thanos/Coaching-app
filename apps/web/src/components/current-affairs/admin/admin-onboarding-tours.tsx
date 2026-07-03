"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Save, RefreshCw, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, ArrowUp, ArrowDown } from "lucide-react";
import { browserBaseUrl } from "../../../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TourRow {
  id: number;
  key: string;
  name: string;
  version: number;
  is_active: boolean;
  step_count: number;
}

interface StepRow {
  id?: number;
  display_order: number;
  selector: string;
  badge: string;
  title: string;
  body: string;
  action_trigger: string;
  action_text: string;
  // local only
  _dirty?: boolean;
}

const EMPTY_STEP = (): StepRow => ({
  display_order: 0,
  selector: "",
  badge: "",
  title: "",
  body: "",
  action_trigger: "",
  action_text: "",
  _dirty: true,
});

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminOnboardingToursManager({ token }: { token: string }) {
  const [tours, setTours] = useState<TourRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [tourMeta, setTourMeta] = useState<TourRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Load tour list
  const loadTours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/admin/tours`, { headers });
      if (res.ok) setTours(await res.json());
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTours(); }, [loadTours]);

  // Load steps when a tour is selected
  const selectTour = async (key: string) => {
    setSelectedKey(key);
    setSteps([]);
    setExpandedStep(0);
    const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/admin/tours/${key}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setTourMeta(data.tour);
      setSteps(data.steps.map((s: any) => ({
        ...s,
        action_trigger: s.action_trigger ?? "",
        action_text: s.action_text ?? "",
      })));
    }
  };

  const addStep = () => {
    const newStep = EMPTY_STEP();
    newStep.display_order = steps.length;
    setSteps([...steps, newStep]);
    setExpandedStep(steps.length);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, display_order: i })));
    setExpandedStep(null);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newSteps = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= newSteps.length) return;
    const tmp = newSteps[idx] as StepRow;
    newSteps[idx] = newSteps[target] as StepRow;
    newSteps[target] = tmp;
    setSteps(newSteps.map((s, i) => ({ ...s, display_order: i })));
    setExpandedStep(target);
  };

  const updateStep = (idx: number, field: keyof StepRow, value: string) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, [field]: value, _dirty: true } : s));
  };

  const updateTourMeta = async (field: "name" | "is_active" | "version", value: any) => {
    if (!tourMeta) return;
    const updated = { ...tourMeta, [field]: value };
    setTourMeta(updated);
    await fetch(`${browserBaseUrl}/api/v1/onboarding/admin/tours/${tourMeta.key}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ [field]: value }),
    });
  };

  const save = async () => {
    if (!selectedKey) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const cleanSteps = steps.map(s => ({
        selector: s.selector,
        badge: s.badge,
        title: s.title,
        body: s.body,
        action_trigger: s.action_trigger || null,
        action_text: s.action_text || null,
      }));
      const res = await fetch(`${browserBaseUrl}/api/v1/onboarding/admin/tours/${selectedKey}/steps`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ steps: cleanSteps }),
      });
      if (res.ok) {
        setSaveMsg("Steps saved successfully!");
        await loadTours();
      } else {
        setSaveMsg("Save failed. Please check all fields.");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const bumpVersion = async () => {
    if (!tourMeta) return;
    const newVersion = tourMeta.version + 1;
    await updateTourMeta("version", newVersion);
    setSaveMsg(`Tour version bumped to ${newVersion}. All users will see it again once.`);
    setTimeout(() => setSaveMsg(""), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 min-h-96">
      {/* ── Left: Tour List ── */}
      <div className="lg:col-span-1 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Available Tours</p>
        {tours.map(t => (
          <button
            key={t.key}
            onClick={() => selectTour(t.key)}
            className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
              selectedKey === t.key
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-100 bg-white hover:border-slate-200"
            }`}
          >
            <p className={`text-xs font-black ${selectedKey === t.key ? "text-indigo-800" : "text-slate-800"}`}>{t.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 font-bold">{t.step_count} steps</span>
              <span className="text-[10px] text-slate-300">·</span>
              <span className="text-[10px] font-bold text-indigo-500">v{t.version}</span>
              {!t.is_active && <span className="text-[10px] font-bold text-rose-500">Inactive</span>}
            </div>
          </button>
        ))}
      </div>

      {/* ── Right: Step Editor ── */}
      {selectedKey && tourMeta ? (
        <div className="lg:col-span-3 space-y-4">
          {/* Tour meta controls */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">{tourMeta.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">key: {tourMeta.key}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Active toggle */}
                <button
                  onClick={() => updateTourMeta("is_active", !tourMeta.is_active)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-colors ${
                    tourMeta.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  {tourMeta.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {tourMeta.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>

            {/* Version control */}
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800">Version Control</p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Current version: <strong>v{tourMeta.version}</strong>. Bump version to re-show the tour to all users (including those who already completed it).
                </p>
              </div>
              <button
                onClick={bumpVersion}
                className="shrink-0 rounded-lg bg-amber-600 text-white text-xs font-bold px-3 py-1.5 hover:bg-amber-700 transition-colors"
              >
                Bump Version
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Steps ({steps.length})</p>
              <button onClick={addStep} className="flex items-center gap-1 rounded-lg bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 hover:bg-indigo-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-bold text-slate-400">No steps yet.</p>
                <p className="text-xs text-slate-300 mt-1">Click "Add Step" to create the first guided tour step.</p>
              </div>
            )}

            {steps.map((step, idx) => (
              <div key={idx} className={`rounded-xl border bg-white overflow-hidden transition-all ${expandedStep === idx ? "border-indigo-200 shadow-sm" : "border-slate-100"}`}>
                {/* Step header */}
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}>
                  <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
                  <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${expandedStep === idx ? "text-indigo-600" : "text-slate-400"}`}>
                    Step {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 truncate flex-1">
                    {step.title || <span className="text-slate-300 italic">Untitled</span>}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); moveStep(idx, -1); }} disabled={idx === 0}
                      className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 transition-colors">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveStep(idx, 1); }} disabled={idx === steps.length - 1}
                      className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 transition-colors">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeStep(idx); }}
                      className="h-5 w-5 rounded flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {expandedStep === idx ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </div>

                {/* Step form */}
                {expandedStep === idx && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CSS Selector *</label>
                        <input
                          value={step.selector}
                          onChange={e => updateStep(idx, "selector", e.target.value)}
                          placeholder="#tour-content-type or .my-class"
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-indigo-400"
                        />
                        <p className="text-[10px] text-slate-400">CSS selector of the element to spotlight</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Badge Label</label>
                        <input
                          value={step.badge}
                          onChange={e => updateStep(idx, "badge", e.target.value)}
                          placeholder="Step 1 of 5 · Content Type"
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Step Title *</label>
                      <input
                        value={step.title}
                        onChange={e => updateStep(idx, "title", e.target.value)}
                        placeholder="Select a Content Type"
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description *</label>
                      <textarea
                        value={step.body}
                        onChange={e => updateStep(idx, "body", e.target.value)}
                        rows={3}
                        placeholder="Explain what the user should understand and do at this step..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Action Trigger</label>
                        <select
                          value={step.action_trigger}
                          onChange={e => updateStep(idx, "action_trigger", e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                        >
                          <option value="">None (free next)</option>
                          <option value="click">click — must click the element</option>
                          <option value="input">input — must type in field</option>
                          <option value="change">change — must change a value</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Action Hint Text</label>
                        <input
                          value={step.action_text}
                          onChange={e => updateStep(idx, "action_text", e.target.value)}
                          placeholder="Click the button above to continue"
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                          disabled={!step.action_trigger}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save bar */}
          {steps.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className={`text-xs font-bold ${saveMsg.includes("failed") ? "text-rose-600" : "text-indigo-700"}`}>
                {saveMsg || `${steps.length} step${steps.length !== 1 ? "s" : ""} configured`}
              </p>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold px-4 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : "Save All Steps"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="lg:col-span-3 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <div>
            <p className="text-sm font-bold text-slate-400">Select a tour from the left panel</p>
            <p className="text-xs text-slate-300 mt-1">Then edit its steps, enable/disable it, or bump its version to re-show it to all users.</p>
          </div>
        </div>
      )}
    </div>
  );
}
