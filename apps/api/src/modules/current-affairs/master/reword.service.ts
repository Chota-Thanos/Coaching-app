import { generateText, hasAiCredentials } from "./ai.service.js";
import type { RewordInput } from "../schemas.js";

const MODE_DIRECTIVES: Record<RewordInput["mode"], string> = {
  concise: "Rewrite the passage to be tighter, punchier, and more concise without sacrificing a single detail or nuance. Aim for roughly 30-40% shorter while preserving complete meaning.",
  expand: "Expand the passage with clearer explanation and educational context tailored for UPSC CSE aspirants, without inventing external facts. Elaborate only on what is strictly grounded in the text.",
  simplify: "Rewrite the passage in crystal-clear, accessible language that an aspirant can grasp instantly, keeping all technical precision and factual details intact.",
  exam_tone: "Rewrite the passage in a formal, authoritative, exam-oriented tone suitable for high-scoring UPSC CSE notes. Use active voice and precise academic terminology.",
  grammar: "Fix all grammar, spelling, punctuation, and sentence flow issues. Do not alter tone, structure, or content beyond what is necessary for flawless grammatical correctness."
};

/**
 * Rewrites a selected passage for the rich text editor.
 * Guarantees fully-formatted HTML output while maintaining strict factual and contextual accuracy.
 */
export async function rewordText(input: RewordInput): Promise<string> {
  if (!hasAiCredentials()) {
    throw new Error("AI credentials are not configured on the server.");
  }

  const systemPrompt = `You are a master editor for an Indian UPSC Current Affairs & Civil Services preparation platform.

TASK: ${MODE_DIRECTIVES[input.mode]}

CRITICAL REQUIREMENT - ZERO MEANING DISTORTION:
1. STRICT FACTUAL & CONTEXTUAL FIDELITY: You MUST NOT change, omit, invent, or distort any facts, statistics, numbers, proper nouns, official scheme names, constitutional articles, dates, locations, or legal terms.
2. CONTEXT & MEANING PRESERVATION: The core context, logical argument, cause-and-effect relationship, and exact meaning of every statement MUST remain 100% identical. Rewording must NEVER change the analytical nuance or stance of any sentence.

OUTPUT FORMATTING REQUIREMENTS:
1. FULLY FORMATTED HTML: Output the rewritten content in clean, semantic HTML format (using tags like <p>, <strong>, <em>, <ul>, <ol>, <li>, <h3>, <h4>, <blockquote>, <table>, etc.).
2. DO NOT return plain text or raw markdown symbols (do not use **, #, -, etc.).
3. DO NOT enclose output in markdown codeblocks (do NOT use \`\`\`html or \`\`\`).
4. Output ONLY the raw formatted HTML markup — no intro preamble ("Here is..."), no commentary, no quote wrappers.`;

  const userPrompt = `${input.instructions ? `SPECIFIC CUSTOM INSTRUCTION: ${input.instructions}\n\n` : ""}PASSAGE TO REWORD:\n${input.text}`;

  let result = (await generateText(systemPrompt, userPrompt)).trim();

  // Strip codeblock fence wrappers if the LLM includes them despite instructions
  result = result.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();

  return result || input.text;
}
