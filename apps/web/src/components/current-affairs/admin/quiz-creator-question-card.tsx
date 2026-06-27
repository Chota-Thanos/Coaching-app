"use client";

import { Trash2, ChevronDown, ChevronUp, Edit2 } from "lucide-react";
import { useState } from "react";
import { RichTextMarkdownEditor } from "../rich-text-editor";
import { useKaTeX, renderMathAndMarkdown } from "./katex-renderer";


type Option = {
  label: string;
  text: string;
  is_correct: boolean;
};

type GeneratedQuestion = {
  question_statement: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options: Option[];
  correct_answer: string;
  explanation: string;
  question_nature_id?: string | number;
  exam_id?: number;
  exam_level_id?: number;
  subject_node_id?: number;
  source_node_id?: number;
  topic_node_id?: number;
  subtopic_node_id?: number;
};

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
};

type TaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: string;
  name: string;
  slug: string;
};

type QuestionCardProps = {
  q: GeneratedQuestion;
  idx: number;
  questionNatures: QuestionNature[];
  allTaxonomyNodes: TaxonomyNode[];
  isSelected: boolean;
  onToggleSelect: () => void;
  deleteQuestion: (idx: number) => void;
  updateQuestion: (idx: number, field: keyof GeneratedQuestion, value: any) => void;
  updateOption: (qIdx: number, optIdx: number, value: string) => void;
  onAnswerChange: (idx: number, correctVal: string) => void;
};

export function QuizCreatorQuestionCard({
  q,
  idx,
  questionNatures,
  allTaxonomyNodes,
  isSelected,
  onToggleSelect,
  deleteQuestion,
  updateQuestion,
  updateOption,
  onAnswerChange
}: QuestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  useKaTeX();

  // Resolve taxonomy paths for draft preview badges
  const getTaxonomyPath = () => {
    const parts = [];
    if (q.subject_node_id) {
      const subject = allTaxonomyNodes.find(n => n.id === q.subject_node_id);
      if (subject) parts.push(subject.name);
    }
    if (q.topic_node_id) {
      const topic = allTaxonomyNodes.find(n => n.id === q.topic_node_id);
      if (topic) parts.push(topic.name);
    }
    if (q.subtopic_node_id) {
      const subtopic = allTaxonomyNodes.find(n => n.id === q.subtopic_node_id);
      if (subtopic) parts.push(subtopic.name);
    }
    return parts.join(" > ") || "General Study Node";
  };

  const nature = questionNatures.find(n => String(n.id) === String(q.question_nature_id));
  const natureName = nature ? nature.name : null;

  return (
    <div 
      className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md ${
        isSelected ? "border-civic bg-civic/5 ring-1 ring-civic/25" : "border-line hover:border-civic/30"
      }`}
    >
      {/* ── CARD HEADER ── */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="checkbox"
            className="h-4.5 w-4.5 rounded border-line text-civic focus:ring-civic cursor-pointer"
            checked={isSelected}
            onChange={onToggleSelect}
          />
          
          <span className="text-[10px] font-black uppercase bg-slate-100 text-ink/70 px-2 py-0.5 rounded-full shrink-0">
            Q{idx + 1} (Draft)
          </span>
          
          {natureName && (
            <span className="text-[10px] font-black uppercase bg-civic/10 text-civic px-2.5 py-0.5 rounded-full">
              Nature: {natureName}
            </span>
          )}

          <span className="text-[10px] font-extrabold text-ink/40 bg-slate-100 px-2 py-0.5 rounded">
            {getTaxonomyPath()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              isEditing 
                ? "bg-civic text-white border-civic" 
                : "border-line bg-paper text-ink/80 hover:border-civic hover:text-civic"
            }`}
          >
            <Edit2 className="h-3 w-3" />
            {isEditing ? "Done Editing" : "Edit In-Place"}
          </button>
          
          <button
            onClick={() => deleteQuestion(idx)}
            className="h-7 w-7 rounded-lg border border-line bg-paper text-ink/50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all"
            title="Delete Question"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── QUESTION VIEW ── */}
      <div className="space-y-2.5">
        <p 
          className="text-sm sm:text-base font-black text-ink leading-snug"
          dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_statement || "No question statement entered.")}
        />
        {q.supp_question_statement && (
          <div 
            className="text-xs sm:text-sm font-medium text-ink/75 bg-slate-50 border-l-2 border-line p-2.5 whitespace-pre-line font-serif rounded-r-lg"
            dangerouslySetInnerHTML={renderMathAndMarkdown(q.supp_question_statement)}
          />
        )}
        {q.question_prompt && (
          <p 
            className="text-xs font-bold text-civic italic pl-1"
            dangerouslySetInnerHTML={renderMathAndMarkdown(q.question_prompt)}
          />
        )}
      </div>

      {/* ── OPTIONS LIST (GRID PREVIEW) ── */}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 pl-1">
        {q.options.map((opt) => {
          const isCorrect = opt.label === q.correct_answer || opt.is_correct;
          return (
            <div 
              key={opt.label}
              className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-semibold ${
                isCorrect 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                  : "bg-paper/40 border-line/65 text-ink/70"
              }`}
            >
              <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-ink/60"
              }`}>
                {opt.label}
              </span>
              <span 
                className="line-clamp-1"
                dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text || "(empty)")}
              />
            </div>
          );
        })}
      </div>

      {/* ── EXPLANATION PREVIEW TOGGLE ── */}
      {q.explanation && (
        <div className="pt-1 border-t border-line/40">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-[11px] font-bold text-ink/50 hover:text-civic flex items-center gap-1 transition-all"
          >
            {showExplanation ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showExplanation ? "Hide pedagogical explanation" : "View pedagogical explanation"}
          </button>
          {showExplanation && (
            <div 
              className="mt-2 text-xs text-ink/75 bg-slate-50 border border-line p-3.5 rounded-xl whitespace-pre-line font-serif leading-relaxed"
              dangerouslySetInnerHTML={renderMathAndMarkdown(q.explanation)}
            />
          )}
        </div>
      )}

      {/* ── EXPANDABLE EDIT DRAWER ── */}
      {isEditing && (
        <div className="border-t-2 border-dashed border-line/70 pt-5 mt-2 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <h5 className="text-xs font-black text-civic uppercase tracking-widest">In-Place Editor Workspace</h5>
          
          <div className="space-y-4">
            <label className="grid gap-1 text-xs font-bold text-ink">
              Question Statement (Core directive) *
              <textarea
                className="w-full rounded-lg border border-line p-3 text-sm font-normal bg-white outline-none focus:border-civic min-h-[60px]"
                value={q.question_statement}
                onChange={(e) => updateQuestion(idx, "question_statement", e.target.value)}
                placeholder="e.g. Consider the following statements regarding the RBI Monetary Policy:"
              />
            </label>
            
            <RichTextMarkdownEditor
              label="Supplementary Statements / Rich Text Context (LaTeX formulas, conditions, list, etc. - Optional)"
              value={q.supp_question_statement || ""}
              onChange={(val) => updateQuestion(idx, "supp_question_statement", val)}
              minHeightClass="min-h-[120px]"
            />

            <label className="grid gap-1 text-xs font-bold text-ink">
              Question Prompt (e.g. 'Which of the statements given above is/are correct?', optional)
              <input
                type="text"
                className="h-10 rounded-lg border border-line px-3 text-sm font-normal bg-white outline-none focus:border-civic"
                value={q.question_prompt || ""}
                placeholder="Select the correct answer using the code given below:"
                onChange={(e) => updateQuestion(idx, "question_prompt", e.target.value)}
              />
            </label>

            {/* Options Editing */}
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="grid gap-1">
                  <span className="text-[11px] font-bold text-ink/75">Option ({opt.label}) Choices</span>
                  <input
                    type="text"
                    className={`h-10 rounded-lg border px-3 text-sm font-normal outline-none focus:border-civic ${
                      opt.label === q.correct_answer
                        ? "bg-emerald-50/50 border-emerald-300"
                        : "bg-white border-line"
                    }`}
                    value={opt.text}
                    onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Correct Answer Key */}
              <label className="grid gap-1 text-xs font-bold text-ink">
                Correct Answer Key
                <select
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic"
                  value={q.correct_answer}
                  onChange={(e) => onAnswerChange(idx, e.target.value)}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>

              {/* Question Nature */}
              <label className="grid gap-1 text-xs font-bold text-ink">
                Question Nature
                <select
                  className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic"
                  value={q.question_nature_id || ""}
                  onChange={(e) => updateQuestion(idx, "question_nature_id", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">-- Choose Nature --</option>
                  {questionNatures.map((nature) => (
                    <option key={nature.id} value={nature.id}>
                      {nature.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Explanation */}
            <RichTextMarkdownEditor
              label="Pedagogical Explanation"
              value={q.explanation}
              onChange={(val) => updateQuestion(idx, "explanation", val)}
              minHeightClass="min-h-[120px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
