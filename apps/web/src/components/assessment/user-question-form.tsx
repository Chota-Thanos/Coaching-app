"use client";

import { useState } from "react";
import { X, Save, HelpCircle, Loader2 } from "lucide-react";
import { authenticatedPost } from "../auth/auth-context";

interface UserQuestionFormProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  examId: number;
  subjectNodeId: number;
  topicNodeId?: number | null;
  subtopicNodeId?: number | null;
  onSuccess?: () => void;
  questionFamily?: "objective" | "mains_subjective";
}

export function UserQuestionForm({
  isOpen,
  onClose,
  token,
  examId,
  subjectNodeId,
  topicNodeId,
  subtopicNodeId,
  onSuccess,
  questionFamily = "objective"
}: UserQuestionFormProps) {
  const [statement, setStatement] = useState("");
  const [suppStatement, setSuppStatement] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<"A" | "B" | "C" | "D">("A");
  const [explanation, setExplanation] = useState("");
  const [markForRevision, setMarkForRevision] = useState(false);

  // Mains specific states
  const [wordLimit, setWordLimit] = useState("250");
  const [marks, setMarks] = useState("15");
  const [directive, setDirective] = useState("Discuss");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMains = questionFamily === "mains_subjective";

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!statement.trim()) {
      setError("Please fill in the question statement.");
      return;
    }

    if (!isMains && (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim())) {
      setError("Please fill in all 4 options.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      exam_id: examId,
      exam_level_id: 1, // Default or placeholder
      subject_node_id: subjectNodeId,
      topic_node_id: topicNodeId || null,
      subtopic_node_id: subtopicNodeId || null,
      mark_for_revision: markForRevision,
      question_family: questionFamily,
      questions: [
        isMains
          ? {
              question_statement: statement,
              supp_question_statement: suppStatement || null,
              word_limit: parseInt(wordLimit, 10) || 250,
              marks: parseFloat(marks) || 15,
              directive: directive || null,
              explanation: explanation || null,
              is_ai_generated: false
            }
          : {
              question_statement: statement,
              supp_question_statement: suppStatement || null,
              options: [
                { label: "A", text: optionA },
                { label: "B", text: optionB },
                { label: "C", text: optionC },
                { label: "D", text: optionD }
              ],
              correct_answer: correctAnswer,
              explanation: explanation || null,
              is_ai_generated: false
            }
      ]
    };

    try {
      await authenticatedPost("/api/v1/assessment/user/ai/save-questions", token, payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save question. Please check details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-3xl bg-surface shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-900">Add Private Question</h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">This question will be private to you and visible in your category.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600">
              {error}
            </div>
          )}

          {/* Statement */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
              Question Statement <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="e.g. Which of the following statements about the biosphere reserves is correct?"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* Supplementary Statement */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
              Supplementary Statement / List (Optional)
            </label>
            <textarea
              rows={2}
              value={suppStatement}
              onChange={(e) => setSuppStatement(e.target.value)}
              placeholder="e.g. 1. Nanda Devi reserve is in Uttarakhand. 2. Gulf of Mannar is in Tamil Nadu."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {isMains ? (
            <>
              {/* Mains Fields: Directive, Marks, Word Limit */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Directive
                  </label>
                  <input
                    type="text"
                    value={directive}
                    onChange={(e) => setDirective(e.target.value)}
                    placeholder="e.g. Discuss, Examine"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Marks
                  </label>
                  <input
                    type="number"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Word Limit
                  </label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Model Answer (Mains) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                  Model Answer / Solution Framework (Optional)
                </label>
                <textarea
                  rows={4}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Provide structured key points or a full model answer guide for this subjective question."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                />
              </div>
            </>
          ) : (
            <>
              {/* Options */}
              <div className="space-y-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                  Options & Correct Answer <span className="text-rose-500">*</span>
                </label>
                
                <div className="grid gap-3">
                  {(["A", "B", "C", "D"] as const).map((label) => {
                    const val = label === "A" ? optionA : label === "B" ? optionB : label === "C" ? optionC : optionD;
                    const setVal = label === "A" ? setOptionA : label === "B" ? setOptionB : label === "C" ? setOptionC : setOptionD;

                    return (
                      <div key={label} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={correctAnswer === label}
                          onChange={() => setCorrectAnswer(label)}
                          className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-extrabold text-slate-700 w-4">{label}</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setVal(e.target.value)}
                          placeholder={`Text for option ${label}`}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                  Explanation / Solution (Optional)
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Add details explaining why the selected answer is correct."
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400"
                />
              </div>
            </>
          )}

          {/* Revision toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex gap-3">
              <HelpCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-800">Mark for Revision</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Pre-bookmark this question so it appears in your revision workspace.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={markForRevision}
              onChange={(e) => setMarkForRevision(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-650 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving to category...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Submit Question
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
