"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, HelpCircle, Award, BookOpen, Clock } from "lucide-react";
import { useKaTeX, renderMathAndMarkdown } from "./admin/katex-renderer";

type Option = {
  label: string; // A, B, C, D
  text: string;
};

type PrelimsPyqData = {
  year?: string;
  question_statement?: string;
  supp_question_statement?: string;
  question_prompt?: string;
  options?: Option[];
  correct_answer?: string; // A, B, C, D
  explanation?: string;
};

type MainsPyqData = {
  year?: string;
  question_statement?: string;
  word_limit?: number | string;
  max_marks?: number | string;
  answer_approach?: string;
  model_answer?: string;
};

type InteractivePrelimsPyqProps = {
  data: PrelimsPyqData;
};

export function InteractivePrelimsPyq({ data }: InteractivePrelimsPyqProps) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  useKaTeX();

  const options = data.options || [];
  const correctAnswer = (data.correct_answer || "").trim().toUpperCase();

  const handleOptionClick = (label: string) => {
    if (selectedLabel) return; // Prevent changing answer after selection
    setSelectedLabel(label);
    setShowExplanation(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center gap-3">
        {data.year && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-civic/10 px-3 py-1.5 text-xs font-black text-civic">
            <Award className="h-3.5 w-3.5" />
            UPSC Prelims {data.year}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-black text-ink/75">
          <HelpCircle className="h-3.5 w-3.5 text-civic" />
          Multiple Choice Question
        </span>
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-6 space-y-4">
        <h2 
          className="text-lg font-black leading-snug text-ink md:text-xl"
          dangerouslySetInnerHTML={renderMathAndMarkdown(data.question_statement || "No question statement provided.")}
        />

        {data.supp_question_statement && (
          <div 
            className="rounded-xl border border-line/40 bg-white p-4 text-sm md:text-base text-ink/80 whitespace-pre-line leading-relaxed font-semibold font-serif"
            dangerouslySetInnerHTML={renderMathAndMarkdown(data.supp_question_statement)}
          />
        )}

        {data.question_prompt && (
          <p 
            className="text-sm md:text-base font-extrabold text-ink/90"
            dangerouslySetInnerHTML={renderMathAndMarkdown(data.question_prompt)}
          />
        )}

        {/* Options Grid */}
        <div className="grid gap-3 pt-2">
          {options.map((opt) => {
            const isSelected = selectedLabel === opt.label;
            const isCorrectOption = opt.label.toUpperCase() === correctAnswer;
            const isAnswered = selectedLabel !== null;

            let buttonStyles = "border-line bg-white text-ink hover:border-civic hover:bg-civic/5";
            let badgeStyles = "bg-paper text-ink/70";

            if (isAnswered) {
              if (isCorrectOption) {
                buttonStyles = "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-2 ring-emerald-500/20";
                badgeStyles = "bg-emerald-500 text-white";
              } else if (isSelected) {
                buttonStyles = "border-rose-500 bg-rose-50 text-rose-950 font-semibold ring-2 ring-rose-500/20";
                badgeStyles = "bg-rose-500 text-white";
              } else {
                buttonStyles = "border-line bg-white text-ink/50 opacity-70";
                badgeStyles = "bg-paper text-ink/40";
              }
            }

            return (
              <button
                key={opt.label}
                onClick={() => handleOptionClick(opt.label)}
                disabled={isAnswered}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm md:text-base transition-all duration-200 active:scale-[0.99] ${buttonStyles}`}
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-colors ${badgeStyles}`}>
                  {opt.label}
                </span>
                <span 
                  className="flex-1 pt-0.5 leading-relaxed"
                  dangerouslySetInnerHTML={renderMathAndMarkdown(opt.text)}
                />
                {isAnswered && isCorrectOption && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                {isAnswered && isSelected && !isCorrectOption && (
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation Section */}
      {showExplanation && (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="flex items-center gap-2 text-base font-black text-ink">
              <BookOpen className="h-5 w-5 text-civic" />
              Explanation & Key Insights
            </h3>
            <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700">
              Answer: ({correctAnswer})
            </span>
          </div>

          <div className="text-sm md:text-base text-ink/80 leading-relaxed font-serif">
            {data.explanation ? (
              <div dangerouslySetInnerHTML={renderMathAndMarkdown(data.explanation)} />
            ) : (
              <p>No detailed explanation available for this question.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type InteractiveMainsPyqProps = {
  data: MainsPyqData;
};

export function InteractiveMainsPyq({ data }: InteractiveMainsPyqProps) {
  const [expanded, setExpanded] = useState(false);
  useKaTeX();

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-wrap items-center gap-2.5">
        {data.year && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-civic/10 px-3 py-1.5 text-xs font-black text-civic">
            <Award className="h-3.5 w-3.5" />
            UPSC Mains {data.year}
          </span>
        )}
        {data.max_marks && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-700">
            <Award className="h-3.5 w-3.5" />
            {data.max_marks} Marks
          </span>
        )}
        {data.word_limit && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-xs font-black text-sky-700">
            <Clock className="h-3.5 w-3.5" />
            {data.word_limit} Words
          </span>
        )}
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-6 space-y-3">
        <span className="text-xs font-bold text-ink/50 uppercase tracking-widest">Question</span>
        <h2 
          className="text-lg font-black leading-snug text-ink md:text-xl"
          dangerouslySetInnerHTML={renderMathAndMarkdown(data.question_statement || "No question statement provided.")}
        />
      </div>

      {/* Accordion Approach & Model Answer */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between bg-paper/50 px-5 py-4 text-left font-black text-ink hover:bg-paper transition-all select-none border-b border-line"
        >
          <span className="flex items-center gap-2 text-sm md:text-base">
            <BookOpen className="h-4.5 w-4.5 text-civic" />
            Answer Key & Model Answer Approach
          </span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-civic" />
          ) : (
            <ChevronDown className="h-5 w-5 text-civic" />
          )}
        </button>

        {expanded && (
          <div className="p-5 md:p-6 space-y-6 divide-y divide-line/60 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Approach */}
            {data.answer_approach && (
              <div className="space-y-3 pb-5">
                <h3 className="text-sm font-bold text-ink/50 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4 text-civic" />
                  Structured Answering Approach
                </h3>
                <div 
                  className="text-sm md:text-base text-ink/80 leading-relaxed font-semibold bg-paper/20 rounded-xl p-4 border border-line/30"
                  dangerouslySetInnerHTML={renderMathAndMarkdown(data.answer_approach)}
                />
              </div>
            )}

            {/* Model Answer */}
            {data.model_answer && (
              <div className="space-y-3 pt-5">
                <h3 className="text-sm font-bold text-ink/50 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-civic" />
                  Model Answer Key
                </h3>
                <div 
                  className="text-sm md:text-base text-ink/80 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={renderMathAndMarkdown(data.model_answer)}
                />
              </div>
            )}

            {!data.answer_approach && !data.model_answer && (
              <p className="text-sm text-ink/50 text-center py-4">
                No answer key or approach guidelines are stored for this question.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
