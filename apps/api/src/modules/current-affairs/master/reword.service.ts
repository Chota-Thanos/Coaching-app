import { generateText, hasAiCredentials } from "./ai.service.js";
import type { RewordInput } from "../schemas.js";

const MODE_DIRECTIVES: Record<RewordInput["mode"], string> = {
  concise: "Rewrite the passage to be tighter and more concise without losing any facts. Aim for roughly 30-40% shorter.",
  expand: "Expand the passage with more explanation and context suitable for a UPSC aspirant, without inventing new facts. Elaborate only on what is implied by the text.",
  simplify: "Rewrite the passage in simpler, clearer language that an average aspirant can grasp quickly. Keep every fact intact.",
  exam_tone: "Rewrite the passage in a crisp, formal, exam-oriented tone appropriate for UPSC current-affairs notes. Prefer active voice and precise terminology.",
  grammar: "Fix grammar, spelling, and punctuation only. Do not change meaning, facts, tone, or structure beyond what is needed for correctness."
};

/**
 * Rewrites a selected passage for the editor. Purely a copy-editing aid — it
 * never adds new facts. Returns Markdown-compatible plain text so it can drop
 * straight back into the TipTap editor selection.
 */
export async function rewordText(input: RewordInput): Promise<string> {
  if (!hasAiCredentials()) {
    throw new Error("AI credentials are not configured on the server.");
  }

  const systemPrompt = `You are an expert editor for an Indian UPSC current-affairs platform. ${MODE_DIRECTIVES[input.mode]}

STRICT RULES:
- Never invent facts, figures, names, or dates that are not in the passage.
- Preserve all factual content and any Markdown formatting.
- Return ONLY the rewritten passage as plain text/Markdown — no preamble, no quotes, no commentary.`;

  const userPrompt = `${input.instructions ? `ADDITIONAL INSTRUCTION: ${input.instructions}\n\n` : ""}PASSAGE:\n${input.text}`;

  const result = (await generateText(systemPrompt, userPrompt)).trim();
  return result || input.text;
}
