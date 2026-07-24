"use client";

import { Brain, FileText, Loader2 } from "lucide-react";

type AIWorkspaceProps = {
  workspaceInput: string;
  setWorkspaceInput: (val: string) => void;
  quizType: string;
  setQuizType: (val: string) => void;
  count: number;
  setCount: (val: number) => void;
  instructions: string;
  setInstructions: (val: string) => void;
  generating: boolean;
  handleGenerate: () => Promise<void>;
  handleParse: () => Promise<void>;
  styleProfiles: any[];
  selectedStyleProfileId: string;
  setSelectedStyleProfileId: (val: string) => void;
};

export function QuizCreatorAIWorkspace({
  workspaceInput,
  setWorkspaceInput,
  quizType,
  setQuizType,
  count,
  setCount,
  instructions,
  setInstructions,
  generating,
  handleGenerate,
  handleParse,
  styleProfiles,
  selectedStyleProfileId,
  setSelectedStyleProfileId
}: AIWorkspaceProps) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 sm:p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-ink flex items-center gap-2">
          <Brain className="h-5 w-5 text-civic" />
          AI Assessment Ingestion Workspace
        </h2>
        <p className="text-xs text-ink/65 mt-1">
          Generate mock quizzes, maths papers, or reading analysis passages directly from topic prompts OR paste raw question lists/worksheets to reconstruct them.
        </p>
      </div>

      <div className="space-y-4">
        <label className="grid gap-1.5 text-xs font-black text-ink">
          Workspace Input (Topic prompt, reference text, or raw worksheet questions)
          <textarea
            value={workspaceInput}
            onChange={(e) => setWorkspaceInput(e.target.value)}
            placeholder="e.g.&#10;- Generate a quiz of 3 questions on RBI Monetary Policy and inflation control.&#10;- Or paste a raw worksheet list to parse:&#10;Q1. Find value of $x$ if $2x + 5 = 15$.&#10;(a) 5 (b) 10..."
            disabled={generating}
            className="w-full min-h-[160px] rounded-xl border border-line p-3 sm:p-4 text-sm outline-none focus:border-civic text-ink focus:ring-2 focus:ring-civic/10 transition-all font-sans touch-manipulation"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Style Target (for Generation)
            <select
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              disabled={generating}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none focus:border-civic"
            >
              <option value="gk">General Knowledge (GK)</option>
              <option value="maths">Mathematical / LaTeX formulas</option>
              <option value="passage">Reading Passage Analysis</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Questions Count (for Generation)
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={generating}
              className="h-11 rounded-xl border border-line px-3 text-sm outline-none focus:border-civic"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Enforced Style Profile
            <select
              value={selectedStyleProfileId}
              onChange={(e) => setSelectedStyleProfileId(e.target.value)}
              disabled={generating}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold outline-none focus:border-civic"
            >
              <option value="">None (Global Fallback)</option>
              {styleProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.tag_level1 ? `(${p.tag_level1})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-black text-ink font-bold">
            Extra instructions (optional)
            <input
              type="text"
              placeholder="e.g. Focus on statement facts, or parser guidelines"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={generating}
              className="h-11 rounded-xl border border-line px-3 text-sm outline-none focus:border-civic"
            />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !workspaceInput.trim()}
            className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-civic text-white font-bold text-sm shadow-md hover:bg-civic/90 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            AI Generate Quiz
          </button>
          
          <button
            type="button"
            onClick={handleParse}
            disabled={generating || !workspaceInput.trim()}
            className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-civic text-civic font-bold text-sm shadow-sm hover:bg-civic/5 active:scale-[0.98] transition-all disabled:opacity-50 touch-manipulation"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            AI Parse Worksheet
          </button>

          <button
            type="button"
            onClick={() => {
              setWorkspaceInput("");
              setInstructions("");
            }}
            disabled={generating || !workspaceInput}
            className="h-12 px-4 rounded-xl border border-line font-bold text-xs text-ink/70 hover:bg-paper transition-all"
          >
            Reset Input
          </button>
        </div>
      </div>

      {generating && (
        <div className="p-6 border-t border-line mt-4 flex flex-col items-center justify-center gap-3 animate-pulse">
          <Loader2 className="h-6 w-6 text-civic animate-spin" />
          <div className="text-center">
            <p className="text-xs font-black text-ink">AI Agent Pipeline is executing...</p>
            <p className="text-[10px] text-ink/60">Router classifying topic | Generator drafting items | Auditor verifying LaTeX delimiters</p>
          </div>
        </div>
      )}
    </div>
  );
}
