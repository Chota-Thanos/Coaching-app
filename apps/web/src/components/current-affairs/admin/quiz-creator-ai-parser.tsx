"use client";

import { FileText, Loader2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useKaTeX, renderMathAndMarkdown } from "./katex-renderer";

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type AIParserProps = {
  parseInput: string;
  setParseInput: (val: string) => void;
  parseGenerating: boolean;
  uploadingFile: boolean;
  exams: Exam[];
  selectedExamId: string;
  handleExamChange: (val: string) => void;
  creatorContentType: "gk" | "aptitude";
  setCreatorContentType: (val: "gk" | "aptitude") => void;
  onParseSubmit: () => Promise<void>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

export function QuizCreatorAIParser({
  parseInput,
  setParseInput,
  parseGenerating,
  uploadingFile,
  exams,
  selectedExamId,
  handleExamChange,
  creatorContentType,
  setCreatorContentType,
  onParseSubmit,
  onFileUpload
}: AIParserProps) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  useKaTeX();

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-ink flex items-center gap-2">
          <FileText className="h-5 w-5 text-civic" />
          AI Parse / Worksheet Importer
        </h2>
        <p className="text-xs text-ink/65 mt-1">
          Upload a document or paste raw question text — a book worksheet, OCR dump, or copied PYQ set. AI will extract, clean, and convert each question into the question bank format.
        </p>
      </div>

      {/* File Upload Zone */}
      <div className="border border-dashed border-line rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-civic/10 text-civic">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <span className="text-sm font-bold text-ink block">Upload document to extract & parse</span>
          <span className="text-[11px] text-ink/50 mt-1 block">Supports PDF, DOCX, TXT, or markdown files</span>
        </div>
        <label className="inline-flex h-9 items-center justify-center rounded-xl bg-civic hover:bg-civic/90 text-white text-xs font-bold px-4 cursor-pointer transition-all shadow-sm">
          {uploadingFile ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing...
            </span>
          ) : (
            "Choose File"
          )}
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={onFileUpload}
            disabled={uploadingFile || parseGenerating}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex items-center gap-4 my-2">
        <div className="h-px bg-line flex-1"></div>
        <span className="text-[10px] uppercase font-bold text-slate-400">Or Paste Text Directly</span>
        <div className="h-px bg-line flex-1"></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-ink uppercase tracking-wide">
            Paste Raw Question Worksheet
          </span>
          
          <div className="flex rounded-lg border border-line bg-paper/30 p-0.5 text-xs select-none">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-bold transition-all ${
                tab === "write" ? "bg-surface text-civic shadow-xs" : "text-ink/65 hover:text-ink"
              }`}
            >
              Write/Paste
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-bold transition-all ${
                tab === "preview" ? "bg-surface text-civic shadow-xs" : "text-ink/65 hover:text-ink"
              }`}
            >
              Preview formulas
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-line overflow-hidden bg-surface shadow-xs focus-within:border-civic focus-within:ring-2 focus-within:ring-civic/10 transition-all">
          {tab === "write" ? (
            <textarea
              value={parseInput}
              onChange={(e) => setParseInput(e.target.value)}
              disabled={parseGenerating || uploadingFile}
              placeholder={`Paste raw question text here. For example:\n\nQ1. Find the locus of the point of intersection of perpendicular tangents to the parabola $y^2 = 4ax$.\n\n$$y = mx + \\frac{a}{m}$$`}
              className="w-full min-h-[280px] p-4 text-sm outline-none text-ink font-mono leading-relaxed resize-y border-0"
            />
          ) : (
            <div 
              className="w-full min-h-[280px] p-4 bg-paper/25 text-sm leading-relaxed prose prose-civic select-text whitespace-pre-wrap font-serif"
              dangerouslySetInnerHTML={renderMathAndMarkdown(parseInput || "Nothing to preview yet. Paste or write some text containing formulas like $y^2 = 4ax$...")}
            />
          )}
        </div>
      </div>

      <div className="w-full">
        <label className="grid gap-1.5 text-xs font-bold text-ink max-w-md">
          Target Examination
          <select
            value={selectedExamId}
            onChange={(e) => handleExamChange(e.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
            disabled={parseGenerating || uploadingFile}
          >
            <option value="">-- Choose Exam --</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={parseGenerating || uploadingFile || !parseInput.trim()}
        onClick={onParseSubmit}
        className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {parseGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {parseGenerating ? "Parsing Questions..." : "Parse & Import Questions"}
      </button>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 font-semibold">
        <strong>How it works:</strong> Paste any format — numbered lists, labeled options (a/b/c/d), mixed MCQ or passage-linked formats. After parsing, questions will appear in the <strong>Manual Entry</strong> tab for review and editing before saving.
      </div>
    </div>
  );
}
