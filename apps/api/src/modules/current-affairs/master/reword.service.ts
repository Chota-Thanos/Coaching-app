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
 * Guarantees clean, unescaped semantic text/HTML output without code fences or raw HTML entities.
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

OUTPUT FORMATTING REQUIREMENTS (EXTREMELY IMPORTANT):
1. NO RAW CODE / NO ESCAPED HTML TAGS IN TEXT: You MUST NOT wrap the output in <code> tags, markdown code blocks (\`\`\`html or \`\`\`), or insert escaped HTML entities (like &lt;p&gt;).
2. CLEAN PARAGRAPH OR INLINE TEXT:
   - If the input is a single sentence or phrase, return ONLY the rewritten text directly, without adding <p> wrapper tags.
   - If the input contains multiple paragraphs or structured lists, return clean semantic HTML (<p>, <ul>, <li>, <strong>, <em>).
3. Output ONLY the clean rewritten content — no preamble ("Here is..."), no commentary, no code fences.`;

  const userPrompt = `${input.instructions ? `SPECIFIC CUSTOM INSTRUCTION: ${input.instructions}\n\n` : ""}PASSAGE TO REWORD:\n${input.text}`;

  let result = (await generateText(systemPrompt, userPrompt)).trim();

  // Strip codeblock fence wrappers and code tags if the LLM includes them despite instructions
  result = result
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^<code>/i, "")
    .replace(/<\/code>$/i, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  return result || input.text;
}
