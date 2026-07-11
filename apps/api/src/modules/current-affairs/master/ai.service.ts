import { one, query } from "../../../db.js";

// Types for AI output
export interface AIArticleSection {
  section_title: string;
  content: string;
  display_order: number;
  heading_level?: string;
}

export interface AIGeneratedArticle {
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  meta_description: string;
  meta_keywords: string;
  news_date?: string;
  source_url?: string;
  featured_image?: string;
  sections: AIArticleSection[];
}

export interface AIQuizOption {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface AIGeneratedQuizQuestion {
  question_statement: string;
  supp_question_statement?: string;
  statements_facts?: string[];
  question_prompt?: string;
  options: AIQuizOption[];
  correct_answer: string;
  explanation: string;
}

export interface AIGeneratedQuiz {
  passage_title?: string;
  passage_text?: string;
  questions: AIGeneratedQuizQuestion[];
}

// Robust JSON extraction from LLM response (fenced, braces, etc.)
export function parseJsonRobust(raw: string): any {
  const text = (raw || "").trim();
  if (!text) throw new Error("Empty response from AI.");

  // Direct parse
  try {
    return JSON.parse(text);
  } catch (e) {
    // Ignore and proceed
  }

  // Fenced JSON code block
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch && fencedMatch[1]) {
    const snippet = fencedMatch[1].trim();
    try {
      return JSON.parse(snippet);
    } catch (e) {
      // Ignore
    }
  }

  // Bracket scan fallback
  const pairs: [string, string][] = [["{", "}"], ["[", "]"]];
  for (const [startChar, endChar] of pairs) {
    const startIdx = text.indexOf(startChar);
    const endIdx = text.lastIndexOf(endChar);
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      try {
        return JSON.parse(text.slice(startIdx, endIdx + 1));
      } catch (e) {
        // Ignore
      }
    }
  }

  throw new Error("Could not parse JSON from AI response.");
}

async function generateTextWithGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  geminiKey: string
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1500;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `System prompt:\n${systemPrompt}\n\nUser prompt:\n${userPrompt}` }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        const status = response.status;
        const isRetryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

        if (isRetryable) {
          attempts++;
          lastError = new Error(`Gemini API error: ${status} - ${errorText}`);
          if (attempts < maxAttempts) {
            console.warn(`[Gemini Retry] Model ${model} returned status ${status} (attempt ${attempts}/${maxAttempts}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
        }
        throw new Error(`Gemini API error: ${status} - ${errorText}`);
      }

      const json = (await response.json()) as any;
      const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!responseText) {
        throw new Error("Gemini returned an empty response candidate.");
      }
      return responseText;
    } catch (err: any) {
      attempts++;
      lastError = err;
      if (attempts < maxAttempts) {
        console.warn(`[Gemini Retry] Network or parsing error for ${model} (attempt ${attempts}/${maxAttempts}): ${err.message || err}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
  throw lastError || new Error(`Gemini API request failed for ${model} after ${maxAttempts} attempts.`);
}

// Call AI API via node-fetch
export async function generateText(systemPrompt: string, userPrompt: string): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (openAiKey) {
    // OpenAI Chat Completions API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cost-effective default
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const json = (await response.json()) as any;
    return json.choices?.[0]?.message?.content?.trim() || "";
  } else if (geminiKey) {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let lastError: any = null;
    for (const model of models) {
      try {
        return await generateTextWithGemini(model, systemPrompt, userPrompt, geminiKey);
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Router] Model ${model} failed: ${err.message || err}. Trying next fallback model...`);
      }
    }
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
  } else {
    // Fall back to Mock Generation if no keys are set
    return runMockGeneration(systemPrompt, userPrompt);
  }
}

// ── Fallback Mock UPSC Content & Quiz Generator ──────────────────────────────
function runMockGeneration(systemPrompt: string, userPrompt: string): string {
  const p = userPrompt.toLowerCase();
  const sys = systemPrompt.toLowerCase();

  if (sys.includes("evaluate") || sys.includes("rubric") || p.includes("student's answer") || p.includes("student_answer")) {
    return JSON.stringify({
      score: 6.5,
      max_score: 10,
      feedback: "<h3>Evaluation Verdict</h3><p>The student has shown a good understanding of the core concept. The introduction is clear but needs more legislative references. The body addresses the main arguments, but the conclusion lacks a forward-looking perspective.</p>",
      strengths: [
        "Clear structure with introduction, body, and conclusion",
        "Addressed the primary directive of the question"
      ],
      weaknesses: [
        "Lack of specific case laws or committee references",
        "Conclusion was slightly abrupt and lacked a path forward"
      ]
    });
  }

  if (sys.includes("prelims_pyq") || p.includes("prelims pyq") || p.includes("prelims_pyq")) {
    return JSON.stringify(generateMockPrelimsPyq(p));
  }
  if (sys.includes("mains_pyq") || p.includes("mains pyq") || p.includes("mains_pyq")) {
    return JSON.stringify(generateMockMainsPyq(p));
  }

  // Determine if generating quizzes or articles
  if (p.includes("quiz") || p.includes("question") || sys.includes("quiz") || sys.includes("question")) {
    const isPassage = p.includes("passage") || sys.includes("passage");
    const isMath = p.includes("math") || p.includes("equation") || sys.includes("math");
    return JSON.stringify(generateMockQuizzes(p, isPassage, isMath));
  }

  // Default: Generate Articles
  return JSON.stringify(generateMockArticles(p, sys));
}

// Dynamic Mock Quiz Generation
function generateMockQuizzes(prompt: string, isPassage: boolean, isMath: boolean): any {
  if (isPassage) {
    return {
      passage_title: "Electoral Bonds and Transparency in Political Funding",
      passage_text: "In February 2024, the Supreme Court of India delivered a landmark verdict striking down the Electoral Bonds Scheme as unconstitutional. The Court ruled that anonymous political donations violate the right to information guaranteed under Article 19(1)(a) of the Constitution. The scheme, introduced in 2018, allowed corporations and individuals to purchase bonds from the State Bank of India and donate them to registered political parties without disclosing their identities. Critics argued that this created a pathway for crony capitalism and asymmetric influence, while the government defended it as a measure to curb black money in elections.",
      questions: [
        {
          question_statement: "Based on the passage, on what constitutional grounds did the Supreme Court strike down the Electoral Bonds Scheme?",
          options: [
            { label: "A", text: "Violation of Article 14 (Right to Equality)", is_correct: false },
            { label: "B", text: "Violation of Article 19(1)(a) (Right to Information)", is_correct: true },
            { label: "C", text: "Violation of Article 21 (Right to Life)", is_correct: false },
            { label: "D", text: "Violation of Article 324 (Independence of Election Commission)", is_correct: false }
          ],
          correct_answer: "B",
          explanation: "The Supreme Court held that anonymous political funding violates the voters' right to information about political donations under Article 19(1)(a)."
        },
        {
          question_statement: "Which nodal public sector bank was authorized to issue Electoral Bonds under the 2018 Scheme?",
          options: [
            { label: "A", text: "Reserve Bank of India (RBI)", is_correct: false },
            { label: "B", text: "Punjab National Bank (PNB)", is_correct: false },
            { label: "C", text: "State Bank of India (SBI)", is_correct: true },
            { label: "D", text: "HDFC Bank", is_correct: false }
          ],
          correct_answer: "C",
          explanation: "The State Bank of India (SBI) was the sole authorized bank to sell and encash Electoral Bonds."
        }
      ]
    };
  }

  if (isMath) {
    return {
      questions: [
        {
          question_statement: "Consider the definite integral representing the probability density curve. Let $I = \\int_{0}^{\\infty} e^{-x^2} dx$. What is the value of $I$?",
          options: [
            { label: "A", text: "$\\sqrt{\\pi}$", is_correct: false },
            { label: "B", text: "$\\frac{\\sqrt{\\pi}}{2}$", is_correct: true },
            { label: "C", text: "$\\pi$", is_correct: false },
            { label: "D", text: "$\\frac{\\pi}{2}$", is_correct: false }
          ],
          correct_answer: "B",
          explanation: "Using the Gaussian integral $\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$, and noting that the integrand is an even function, the integral from $0$ to $\\infty$ is exactly half of the total area, which yields $\\frac{\\sqrt{\\pi}}{2}$."
        },
        {
          question_statement: "Solve the linear equation system for macroeconomics modeling: $Y = C + I$, where $C = 100 + 0.8Y$ and $I = 150$. What is the equilibrium income $Y$?",
          options: [
            { label: "A", text: "$1250$", is_correct: true },
            { label: "B", text: "$1000$", is_correct: false },
            { label: "C", text: "$1500$", is_correct: false },
            { label: "D", text: "$800$", is_correct: false }
          ],
          correct_answer: "A",
          explanation: "Substitute $C$ and $I$ into the equation: $Y = 100 + 0.8Y + 150 \\Rightarrow Y - 0.8Y = 250 \\Rightarrow 0.2Y = 250 \\Rightarrow Y = 1250$."
        }
      ]
    };
  }

  // Standard GK Quiz
  return {
    questions: [
      {
        question_statement: "Consider the following statements regarding the Goods and Services Tax (GST) Council in India:",
        supp_question_statement: "1. It is a constitutional body established under Article 279A.\n2. The Union Finance Minister serves as the Chairperson.\n3. Every decision of the Council requires a majority of not less than three-fourths of the weighted votes of the members present and voting.",
        question_prompt: "Which of the statements given above are correct?",
        options: [
          { label: "A", text: "1 and 2 only", is_correct: false },
          { label: "B", text: "2 and 3 only", is_correct: false },
          { label: "C", text: "1 and 3 only", is_correct: false },
          { label: "D", text: "1, 2 and 3", is_correct: true }
        ],
        correct_answer: "D",
        explanation: "All three statements are correct. The GST Council is constituted under Article 279A, headed by the Union Finance Minister, and voting decisions require a 3/4th (75%) majority."
      },
      {
        question_statement: "The term 'Methane Alert and Response System (MARS)' is often mentioned in the news. It is an initiative of which of the following organizations?",
        options: [
          { label: "A", text: "United Nations Environment Programme (UNEP)", is_correct: true },
          { label: "B", text: "World Meteorological Organization (WMO)", is_correct: false },
          { label: "C", text: "Intergovernmental Panel on Climate Change (IPCC)", is_correct: false },
          { label: "D", text: "International Energy Agency (IEA)", is_correct: false }
        ],
        correct_answer: "A",
        explanation: "MARS is a satellite-based system developed by the United Nations Environment Programme (UNEP) under the International Methane Emissions Observatory (IMEO) to detect and scale global methane leaks."
      }
    ]
  };
}

// Dynamic Mock Article Generation
function generateMockArticles(promptText: string, systemPrompt: string): any {
  // Extract key terms
  const words = promptText.toLowerCase().split(/[^a-zA-Z]+/);
  const stopwords = new Set(["a", "an", "the", "on", "in", "of", "and", "or", "to", "for", "with", "by", "issue", "generate", "write", "about", "discuss"]);
  const keywordsList: string[] = [];
  for (const w of words) {
    if (w.length > 3 && !stopwords.has(w) && keywordsList.indexOf(w) === -1) {
      keywordsList.push(w);
    }
  }
  const mainSubject = keywordsList.map(w => w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 2).join(" ") || "Administrative Reforms";

  // Check if subject override is referenced in system prompt
  let subjectInstructions = "";
  if (systemPrompt.includes("subject-override")) {
    subjectInstructions = "\n\nNote: This generation incorporated customized subject instructions.";
  }

  // Choose content kind
  let contentKind = "daily_current_affairs";
  if (promptText.includes("mains") || promptText.includes("editorial") || promptText.includes("summary")) {
    contentKind = "mains_article";
  }

  return {
    articles: [
      {
        title: `Comprehensive Framework on ${mainSubject} and Nodal Governance`,
        slug: mainSubject.toLowerCase().replace(/\s+/g, "-"),
        excerpt: `A comprehensive analysis of policy guidelines and strategic updates regarding ${mainSubject} in the national context.`,
        meta_description: `Analyze structural reforms, challenges, and implementation mechanisms for ${mainSubject} relevant to UPSC preparation.`,
        meta_keywords: `${mainSubject.toLowerCase()}, upsc preparation, public governance, constitutional policy`,
        news_date: new Date().toISOString().split("T")[0],
        source_url: "https://pib.gov.in",
        sections: [
          {
            section_title: "Why in News",
            content: `<p>The Ministry has recently issued updated directives to streamline operations surrounding <strong>${mainSubject}</strong>. This comes as a response to legislative recommendations aimed at increasing operational efficiency and institutional transparency.${subjectInstructions}</p>`,
            display_order: 1,
            heading_level: "h2"
          },
          {
            section_title: "Core Objectives & Legal Mandates",
            content: `<ul>
              <li><strong>Regulatory Integration</strong>: Consolidating multiple monitoring channels into a centralized dashboard to minimize overhead.</li>
              <li><strong>Local Governance Capacity</strong>: Expanding structural funds for block-level administrative bodies to enforce guidelines on the ground.</li>
              <li><strong>Data Privacy Standards</strong>: Implementing encryption baselines to protect citizen information gathered under official surveys.</li>
            </ul>`,
            display_order: 2,
            heading_level: "h2"
          },
          {
            section_title: "Key Challenges and Way Forward",
            content: `<p>Despite statutory protections, key constraints include overlapping regulatory jurisdictions and resource limitations at regional desks. To achieve optimal delivery, establishing a unified federal regulatory commission alongside regular capacity-building workshops for regional officers is crucial.</p>`,
            display_order: 3,
            heading_level: "h2"
          }
        ]
      }
    ]
  };
}

export async function searchWeb(queryText: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryText)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) throw new Error(`DuckDuckGo responded with status ${res.status}`);
    const html = await res.text();
    
    const matches = html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);
    const snippets: string[] = [];
    for (const match of matches) {
      if (match[1]) {
        const snippet = match[1]
          .replace(/<[^>]*>/g, "") // strip tags
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#x27;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        snippets.push(snippet);
      }
    }
    
    if (snippets.length === 0) {
      const titles = html.matchAll(/<a class="result__url"[^>]*>([\s\S]*?)<\/a>/g);
      for (const match of titles) {
        if (match[1]) {
          snippets.push(match[1].replace(/<[^>]*>/g, "").trim());
        }
      }
    }
    
    return snippets.slice(0, 5).join("\n\n");
  } catch (err) {
    console.error("Web search error:", err);
    return "";
  }
}

export async function fetchTopicContext(topic: string): Promise<string> {
  const trimmed = topic.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const res = await fetch(trimmed, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const html = await res.text();
      const cleanHtml = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return cleanHtml.slice(0, 8000); // limit to 8k characters
    } catch (err) {
      console.error(`Failed to scrape URL ${trimmed}:`, err);
      return "";
    }
  } else {
    if (trimmed.length > 200) {
      return "";
    }
    return searchWeb(trimmed);
  }
}

function getAlternativeContentTypes(contentType: string): string[] {
  const mapping: Record<string, string[]> = {
    "prelims_ca": ["daily_current_affairs"],
    "daily_current_affairs": ["prelims_ca"],
    "mains_ca": ["daily_editorial_summary", "mains_topic_note", "mains_summary", "mains_article"],
    "daily_editorial_summary": ["mains_ca", "mains_topic_note", "mains_summary", "mains_article"],
    "mains_topic_note": ["mains_ca", "daily_editorial_summary", "mains_summary", "mains_article"],
    "mains_summary": ["mains_ca", "daily_editorial_summary", "mains_topic_note", "mains_article"],
    "mains_article": ["mains_ca", "daily_editorial_summary", "mains_topic_note", "mains_summary"],
    "prelims_pyq": ["prelims_pyq"],
    "mains_pyq": ["mains_pyq"]
  };
  return mapping[contentType] || [];
}

// Main generation entry point
export async function generateContentAffairsAI(
  options: {
    contentType?: "prelims_ca" | "mains_ca" | "prelims_pyq" | "mains_pyq";
    topics: string[];
    aiProvider: string;
    aiModel: string;
    instructions?: string;
    subjectId?: number;
    styleGuideId?: number;
    isParsingMode?: boolean;
  }
): Promise<any> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Fetch active categories for taxonomy mapping
  const categories = await query<{ id: string; name: string; slug: string; content_family: string }>(
    `select id, name, slug, content_family from current_affairs.category_nodes where is_active = true`
  );

  // ── STEP 1: ROUTER AGENT ──
  // Auto-detect style guides and subject nodes if not explicitly pinned
  let routedCategorySlug = "";
  let routedContentType: string = options.contentType || "";

  if (openAiKey || geminiKey) {
    try {
      const taxonomyContext = categories.map(c => ({ slug: c.slug, name: c.name, family: c.content_family }));
      const routerSystemPrompt = `You are a UPSC classification agent. Analyze the user's topics and determine:
1. The most appropriate category slug from this taxonomy: ${JSON.stringify(taxonomyContext)}
2. The best-fitting content type: "prelims_ca" (factual daily news), "mains_ca" (editorial/topics/notes), "prelims_pyq", or "mains_pyq".

Return ONLY a valid JSON object matching:
{
  "suggested_category_slug": "string",
  "content_type": "prelims_ca" | "mains_ca" | "prelims_pyq" | "mains_pyq"
}`;
      const routerUserPrompt = `TOPICS / STORIES TO CLASSIFY:\n${options.topics.join("\n\n")}`;
      const routerResponse = await generateText(routerSystemPrompt, routerUserPrompt);
      const classification = parseJsonRobust(routerResponse);

      routedCategorySlug = classification.suggested_category_slug || "";
      if (!options.contentType) {
        routedContentType = classification.content_type || "prelims_ca";
      }
    } catch (err) {
      console.error("[AI Router Agent] Classification failed, falling back:", err);
    }
  }

  // Fetch global/scoped instructions
  let systemPrompt = "";
  let exampleOutput: any = {};
  let outputSchema: any = {};

  const alts = [routedContentType, ...getAlternativeContentTypes(routedContentType)];
  let instructionRow = await one<{ prompt: string; output_schema: any; example_output: any }>(
    `
      select prompt, output_schema, example_output
      from current_affairs.ai_instructions
      where scope = 'article' and content_type = any($1) and is_active = true
      order by case when content_type = $2 then 1 else 2 end, updated_at desc limit 1
    `,
    [alts, routedContentType]
  );

  if (!instructionRow) {
    instructionRow = await one<{ prompt: string; output_schema: any; example_output: any }>(
      `
        select prompt, output_schema, example_output
        from current_affairs.ai_instructions
        where scope = 'article' and is_active = true
        order by updated_at desc limit 1
      `
    );
  }

  if (instructionRow) {
    systemPrompt = instructionRow.prompt;
    outputSchema = instructionRow.output_schema;
    exampleOutput = instructionRow.example_output;
  } else {
    if (routedContentType === "prelims_pyq") {
      systemPrompt = `You are a UPSC prelims question creator. Generate a highly relevant multiple-choice question (MCQ) for the topic.
Rules:
- Generate valid JSON matching the output schema.
- Include 4 options labeled A, B, C, and D. Specify which option is correct and provide a detailed explanation.`;
      outputSchema = {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                year: { type: "string" },
                question_statement: { type: "string" },
                supp_question_statement: { type: "string" },
                question_prompt: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      text: { type: "string" }
                    }
                  }
                },
                correct_answer: { type: "string" },
                explanation: { type: "string" },
                meta_keywords: { type: "string" },
                meta_description: { type: "string" }
              }
            }
          }
        }
      };
    } else if (routedContentType === "mains_pyq") {
      systemPrompt = `You are a UPSC mains subjective question creator. Generate a written exam question with word limits, marks, model answer approach, and guidelines.
Rules:
- Generate valid JSON matching the output schema.`;
      outputSchema = {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                year: { type: "string" },
                question_statement: { type: "string" },
                word_limit: { type: "integer" },
                max_marks: { type: "integer" },
                answer_approach: { type: "string" },
                model_answer: { type: "string" },
                meta_keywords: { type: "string" },
                meta_description: { type: "string" }
              }
            }
          }
        }
      };
    } else {
      systemPrompt = `You are a UPSC current affairs content creator. Generate structured articles for each topic.
Rules:
- Generate valid JSON matching the output schema.
- Exclude introductory comments or prose. Use HTML for section contents.`;
      outputSchema = {
        type: "object",
        properties: {
          articles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                slug: { type: "string" },
                excerpt: { type: "string" },
                meta_description: { type: "string" },
                meta_keywords: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      section_title: { type: "string" },
                      content: { type: "string" },
                      display_order: { type: "integer" }
                    }
                  }
                }
              }
            }
          }
        }
      };
    }
  }

  // 2. Fetch subject override instructions
  let targetSubjectId = options.subjectId;
  if (!targetSubjectId && routedCategorySlug) {
    const matchedSubject = categories.find(c => c.slug === routedCategorySlug);
    if (matchedSubject) targetSubjectId = Number(matchedSubject.id);
  }

  if (targetSubjectId) {
    const alts = [routedContentType, ...getAlternativeContentTypes(routedContentType)];
    const subjectRow = await one<{ prompt: string }>(
      `
        select prompt
        from current_affairs.ai_instructions
        where scope = 'subject' and subject_node_id = $1 and is_active = true
        order by 
          case 
            when content_type = $2 then 1 -- exact content type match
            when content_type = any($3) then 2 -- alternative content type match
            when content_type is null then 3 -- general subject override (fallback)
            else 4 -- other content types for this subject (close instruction)
          end,
          updated_at desc 
        limit 1
      `,
      [targetSubjectId, routedContentType, alts]
    );
    if (subjectRow) {
      systemPrompt = `${systemPrompt}\n\n[SUBJECT-OVERRIDE] Per-Subject Level Constraints:\n${subjectRow.prompt}`;
    }
  }

  // 3. Fetch style guide instructions
  let styleGuideRow;
  if (options.styleGuideId) {
    styleGuideRow = await one<{ style_guide: string }>(
      `select style_guide from current_affairs.ai_style_guides where id = $1 limit 1`,
      [options.styleGuideId]
    );
  } else {
    const alts = [routedContentType, ...getAlternativeContentTypes(routedContentType)];
    styleGuideRow = await one<{ style_guide: string }>(
      `
        select style_guide 
        from current_affairs.ai_style_guides 
        where content_type = any($1) 
        order by case when content_type = $2 then 1 else 2 end, updated_at desc 
        limit 1
      `,
      [alts, routedContentType]
    );
    if (!styleGuideRow) {
      styleGuideRow = await one<{ style_guide: string }>(
        `select style_guide from current_affairs.ai_style_guides where content_type is null order by updated_at desc limit 1`
      );
    }
  }
  if (styleGuideRow) {
    systemPrompt = `${systemPrompt}\n\n[STYLE-GUIDE] Apply this global writing style/format instructions:\n${styleGuideRow.style_guide}`;
  }

  if (options.instructions) {
    systemPrompt = `${systemPrompt}\n\nAdditional instructions from User:\n${options.instructions}`;
  }

  systemPrompt = `${systemPrompt}\n\nOUTPUT SCHEMA (STRICT JSON):\n${JSON.stringify(outputSchema, null, 2)}`;
  if (exampleOutput && Object.keys(exampleOutput).length > 0) {
    systemPrompt = `${systemPrompt}\n\nEXAMPLE OUTPUT:\n${JSON.stringify(exampleOutput, null, 2)}`;
  }

  // Fetch web search context
  const topicsWithContext = [];
  for (const topic of options.topics) {
    const context = await fetchTopicContext(topic);
    if (context) {
      topicsWithContext.push(`Topic/URL: ${topic}\nWeb/Scraped Context:\n${context}`);
    } else {
      topicsWithContext.push(`Topic/URL: ${topic}`);
    }
  }
  const userPrompt = topicsWithContext.join("\n\n---\n\n");

  // ── STEP 2: GENERATION AGENT ──
  const rawResponse = await generateText(systemPrompt, userPrompt);
  let parsedDraft = parseJsonRobust(rawResponse);

  // ── STEP 3: AUDITOR AGENT (LaTeX & Metadata verification) ──
  if (openAiKey || geminiKey) {
    try {
      const auditorSystemPrompt = `You are a UPSC editorial validation auditor agent.
Your task is to audit and correct the generated draft content:
1. Ensure every article record contains "suggested_category_slug". Set it to "${routedCategorySlug || "uncategorized"}" if missing.
2. Verify all math, statistics, and algebraic expressions are wrapped in LaTeX inline equations using single $ symbols (e.g., $10^5$, $\\sqrt{\\pi}$).
3. Verify that tags and SEO metadata is present.
4. Clean up any raw markdown code blocks or invalid structures.

Return ONLY the corrected draft matching the input structure. Do not change text except formatting, categories, or LaTeX formulas.`;
      const auditorResponse = await generateText(auditorSystemPrompt, JSON.stringify(parsedDraft));
      parsedDraft = parseJsonRobust(auditorResponse);
    } catch (err) {
      console.error("[AI Auditor Agent] Validation failed, using draft:", err);
    }
  }

  // Ensure category id is injected for caller convenience
  if (parsedDraft.articles && Array.isArray(parsedDraft.articles)) {
    for (const art of parsedDraft.articles) {
      const slug = art.suggested_category_slug || routedCategorySlug;
      const matched = categories.find(c => c.slug === slug);
      if (matched) {
        art.category_node_id = Number(matched.id);
      }
    }
  }

  return parsedDraft;
}

// Generate Quizzes endpoint
export async function generateQuizzesAI(
  options: {
    quizType: string;
    prompt: string;
    aiProvider: string;
    aiModel: string;
    instructions?: string;
    count?: number;
    content_type?: "gk" | "aptitude";
    styleProfileId?: number;
  }
): Promise<any> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const count = options.count || 2;
  const isPassage = options.quizType === "passage";

  // 1. Fetch active assessment subjects for classification
  const taxonomyNodes = await query<{ id: string; name: string; slug: string }>(
    `select id, name, slug from assessment.assessment_taxonomy_nodes where node_type = 'subject' and content_type = $1`,
    [options.content_type || 'gk']
  );

  // ── STEP 1: ROUTER AGENT ──
  let routedSubjectSlug = "";
  if (openAiKey || geminiKey) {
    try {
      const routerPrompt = `Analyze the quiz topic prompt and classify it to the closest subject from this taxonomy:
${JSON.stringify(taxonomyNodes.map(t => ({ slug: t.slug, name: t.name })))}

Return ONLY JSON:
{
  "suggested_subject_slug": "string"
}`;
      const routerResponse = await generateText(routerPrompt, options.prompt);
      const res = parseJsonRobust(routerResponse);
      routedSubjectSlug = res.suggested_subject_slug || "";
    } catch (err) {
      console.error("[AI Quiz Router] Subject classification failed:", err);
    }
  }

  // 2. Fetch system instructions from database
  const alts = [options.quizType, ...getAlternativeContentTypes(options.quizType)];
  const instructionRow = await one<{ prompt: string }>(
    `
      select prompt
      from current_affairs.ai_instructions
      where scope = 'quiz' and content_type = any($1) and is_active = true
      order by case when content_type = $2 then 1 else 2 end, updated_at desc limit 1
    `,
    [alts, options.quizType]
  );

  let systemPrompt = instructionRow
    ? instructionRow.prompt
    : `You are a UPSC assessment expert. Write ${count} questions about the user's prompt/text.
${isPassage ? "For passage mode, provide a passage_title, a passage_text, and a list of questions based on it." : ""}
Ensure math expressions are in LaTeX using single $ signs.
Return only valid JSON.`;

  // 3. Fetch style guide
  let styleGuideRow;
  if (options.styleProfileId) {
    const profile = await one<{ style_profile: any }>(
      `select style_profile from assessment.ai_style_profiles where id = $1`,
      [options.styleProfileId]
    );
    if (profile && profile.style_profile) {
      const sp = profile.style_profile;
      styleGuideRow = {
        style_guide: `
[STYLE PROFILE INSTRUCTIONS]
You must generate the questions strictly following this style profile:
- Summary of style: ${sp.summary || ""}
- Style guidelines: ${sp.style_instructions || ""}
- Difficulty: ${sp.difficulty || ""}
- Option style: ${sp.option_style || ""}
- Explanation style: ${sp.explanation_style || ""}
${sp.format_rules ? `- Format rules: ${Array.isArray(sp.format_rules) ? sp.format_rules.join("; ") : sp.format_rules}` : ""}
${sp.dos ? `- Dos: ${Array.isArray(sp.dos) ? sp.dos.join("; ") : sp.dos}` : ""}
${sp.donts ? `- Donts: ${Array.isArray(sp.donts) ? sp.donts.join("; ") : sp.donts}` : ""}
`
      };
    }
  }

  if (!styleGuideRow) {
    styleGuideRow = await one<{ style_guide: string }>(
      `
        select style_guide 
        from current_affairs.ai_style_guides 
        where content_type = any($1) 
        order by case when content_type = $2 then 1 else 2 end, updated_at desc 
        limit 1
      `,
      [alts, options.quizType]
    );
    if (!styleGuideRow) {
      styleGuideRow = await one<{ style_guide: string }>(
        `select style_guide from current_affairs.ai_style_guides where content_type is null order by updated_at desc limit 1`
      );
    }
  }

  if (styleGuideRow) {
    systemPrompt = `${systemPrompt}\n\n[STYLE-GUIDE] Apply this global writing style/format instructions:\n${styleGuideRow.style_guide}`;
  }

  // Hardcoded rule for mathematical formulas and LaTeX preservation
  systemPrompt = `${systemPrompt}\n\n[MATHEMATICAL FORMULAS & LATEX RULES]:
- Keep all mathematical equations, variables, and expressions exactly the same. Do NOT convert them to plain text.
- Wrap all mathematical expressions, variables, formulas, fractions, equations, and mathematical notations inside LaTeX inline code using single dollar signs (e.g. $x^2 + y^2 = z^2$ or $\\frac{a}{b}$ or $5x - 3 = 12$).
- Make sure that options (A, B, C, D) and explanations also strictly preserve this LaTeX wrapping for any variables, numbers, or expressions.`;

  if (options.instructions) {
    systemPrompt = `${systemPrompt}\n\nAdditional instructions from User:\n${options.instructions}`;
  }

  const outputSchema = isPassage
    ? {
        type: "object",
        properties: {
          passage_title: { type: "string" },
          passage_text: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_statement: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      text: { type: "string" },
                      is_correct: { type: "boolean" }
                    }
                  }
                },
                correct_answer: { type: "string" },
                explanation: { type: "string" }
              }
            }
          }
        }
      }
    : {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_statement: { type: "string" },
                supp_question_statement: { type: "string" },
                question_prompt: { type: "string" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      text: { type: "string" },
                      is_correct: { type: "boolean" }
                    }
                  }
                },
                correct_answer: { type: "string" },
                explanation: { type: "string" }
              }
            }
          }
        }
      };

  systemPrompt = `${systemPrompt}\n\nOUTPUT SCHEMA:\n${JSON.stringify(outputSchema, null, 2)}`;

  // ── STEP 2: GENERATION AGENT ──
  const rawResponse = await generateText(systemPrompt, options.prompt);
  let parsedQuiz = parseJsonRobust(rawResponse);

  // ── STEP 3: AUDITOR AGENT (LaTeX equations validation) ──
  if (openAiKey || geminiKey) {
    try {
      const auditorSystemPrompt = `You are a UPSC assessment validation auditor agent.
Ensure all mathematical formulas, CSAT variables, and probability stats are written in LaTeX format using single $ delimiters (e.g., $x^2 = 9$, $\\frac{a}{b}$).
Remove any raw markdown wrappers outside of JSON block.

Return ONLY the corrected JSON data.`;
      const auditorResponse = await generateText(auditorSystemPrompt, JSON.stringify(parsedQuiz));
      parsedQuiz = parseJsonRobust(auditorResponse);
    } catch (err) {
      console.error("[AI Quiz Auditor Agent] Audit failed:", err);
    }
  }

  // Inject subject ID into output for catalog link convenience
  const matchedSubject = taxonomyNodes.find(t => t.slug === routedSubjectSlug);
  if (matchedSubject) {
    parsedQuiz.subject_node_id = Number(matchedSubject.id);
  }

  return parsedQuiz;
}


// ── Fallback Mock PYQ Generators ─────────────────────────────────────────────
function generateMockPrelimsPyq(prompt: string): any {
  const p = prompt.toLowerCase();
  let subject = "Polity and Governance";
  let qText = "Consider the following statements regarding the basic structure doctrine in India:";
  let supp = "1. It was first explicitly formulated by the Supreme Court in the Kesavananda Bharati case (1973).\n2. The Constitution of India explicitly defines the components of the basic structure.\n3. The power of judicial review is considered a part of the basic structure.";
  let promptText = "Which of the statements given above are correct?";
  let explanation = "The basic structure doctrine was propounded in the Kesavananda Bharati case (1973). The Constitution does not define or mention 'basic structure'; it is a judicial innovation. Judicial review is part of the basic structure of the Constitution.";
  let options = [
    { label: "A", text: "1 and 2 only" },
    { label: "B", text: "2 and 3 only" },
    { label: "C", text: "1 and 3 only" },
    { label: "D", text: "1, 2 and 3" }
  ];
  let answer = "C";

  if (p.includes("economy") || p.includes("rbi") || p.includes("banking")) {
    subject = "Indian Economy";
    qText = "With reference to the 'Marginal Standing Facility (MSF)' of the RBI, consider the following statements:";
    supp = "1. It is a penal rate at which banks can borrow money from the RBI on an overnight basis.\n2. Banks can use their Statutory Liquidity Ratio (SLR) securities as collateral for borrowing under MSF.";
    promptText = "Which of the statements given above is/are correct?";
    explanation = "MSF is a penal rate for overnight borrowing. Banks are allowed to dip into their SLR quota up to a specified percentage to borrow funds.";
    options = [
      { label: "A", text: "1 only" },
      { label: "B", text: "2 only" },
      { label: "C", text: "Both 1 and 2" },
      { label: "D", text: "Neither 1 nor 2" }
    ];
    answer = "C";
  }

  return {
    articles: [
      {
        title: `Prelims PYQ: ${subject} Question`,
        year: "2024",
        question_statement: qText,
        supp_question_statement: supp,
        question_prompt: promptText,
        options: options,
        correct_answer: answer,
        explanation: explanation,
        meta_keywords: "prelims-pyq, upsc-pyq, " + subject.toLowerCase().replace(/\s+/g, "-"),
        meta_description: qText
      }
    ]
  };
}

function generateMockMainsPyq(prompt: string): any {
  const p = prompt.toLowerCase();
  let subject = "Polity and Governance";
  let qText = "Discuss the role of the Governor in the Indian federal system, especially in the context of friction between state governments and the gubernatorial office in recent years. (250 words)";
  let approach = "1. Introduce the constitutional position of Governor (Articles 153-163).\n2. Highlight key friction areas: discretionary powers, bill assent delay, summoning of house.\n3. Discuss recommendations of Sarkaria and Punchhi commissions.\n4. Conclude with a balanced path forward.";
  let modelAnswer = "Article 153 mandates a Governor for each state. While intended as a bridge between Centre and State, friction has arisen due to discretionary reserve powers, indefinite delays in bill assent, and recommendations on President's Rule. Federal stability requires guidelines on decision timelines as suggested by Punchhi Commission.";

  if (p.includes("economy") || p.includes("agriculture") || p.includes("growth")) {
    subject = "Indian Economy";
    qText = "Explain the potential and challenges of the green hydrogen economy in India. How can it help achieve India's net-zero emission commitments? (150 words)";
    approach = "1. Define green hydrogen and mention National Green Hydrogen Mission.\n2. Discuss potential: decarbonization of heavy industry, energy security.\n3. Discuss challenges: high electrolyser costs, storage/grid infrastructure.\n4. Conclude with strategy policy interventions.";
    modelAnswer = "Green hydrogen, produced by water electrolysis using renewable power, is key to decarbonizing fertilizer, steel, and transport. The National Green Hydrogen Mission targets 5 MMT production by 2030, but high costs and storage infrastructure remain hurdles. Policy incentives are crucial for commercial scaling.";
  }

  return {
    articles: [
      {
        title: `Mains PYQ: ${subject} Question`,
        year: "2023",
        question_statement: qText,
        word_limit: qText.includes("150") ? 150 : 250,
        max_marks: qText.includes("150") ? 10 : 15,
        answer_approach: approach,
        model_answer: modelAnswer,
        meta_keywords: "mains-pyq, upsc-mains, " + subject.toLowerCase().replace(/\s+/g, "-"),
        meta_description: qText
      }
    ]
  };
}

export async function parseQuizAI(
  options: {
    rawText: string;
    aiProvider: string;
    aiModel: string;
    instructions?: string;
    content_type?: "gk" | "aptitude" | "mains";
  }
): Promise<any> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const isMains = options.content_type === "mains";

  // 1. Fetch active assessment subjects for classification
  const taxonomyNodes = await query<{ id: string; name: string; slug: string }>(
    isMains
      ? `select id, name, slug from assessment.mains_taxonomy_nodes where node_type = 'paper' and is_active = true`
      : `select id, name, slug from assessment.assessment_taxonomy_nodes where node_type = 'subject' and content_type = $1 and is_active = true`,
    isMains ? [] : [options.content_type || 'gk']
  );

  // ── STEP 1: ROUTER AGENT ──
  let routedSubjectSlug = "";
  if (openAiKey || geminiKey) {
    try {
      const routerPrompt = `Analyze the raw questions text to be parsed and classify it to the closest subject from this taxonomy:
${JSON.stringify(taxonomyNodes.map(t => ({ slug: t.slug, name: t.name })))}

Return ONLY JSON:
{
  "suggested_subject_slug": "string"
}`;
      const routerResponse = await generateText(routerPrompt, options.rawText);
      const res = parseJsonRobust(routerResponse);
      routedSubjectSlug = res.suggested_subject_slug || "";
    } catch (err) {
      console.error("[AI Quiz Parser Router] Subject classification failed:", err);
    }
  }

  // ── STEP 2: GENERATION AGENT (Parser) ──
  const systemPrompt = isMains
    ? `You are a state-of-the-art UPSC assessment parser and structured information extractor. Your goal is to parse raw subjective Mains answer writing questions that might be copied from test series, books, or PDF documents, and format them into structured JSON.
Crucially, raw inputs are often scrambled, out of order, or contain interleaved metadata. You must analyze the entire text logically to identify the components of each question, regardless of where they appear in the input:

1. **Question Statement (question_statement)**:
   - The primary theme or question context introduction. Even if the actual question text is in the middle or bottom of the text, identify it.
   - For standard subjective questions, the question_statement is the full question text.

2. **Supplementary Statement (supp_question_statement)**:
   - Contains any lists of facts, conditions, context, quotes, or background information associated with the question.

3. **Word Limit (word_limit)**:
   - Extract any word limit mentioned anywhere in the input (e.g., "150 words", "250 Words", "in 150 words"). Look at the beginning, end, or inside headers/parentheses. If not mentioned, default to 250.

4. **Marks (marks)**:
   - Extract marks mentioned anywhere in the input (e.g., "10 Marks", "15 marks", "12.5 marks", "Marks: 15"). If not mentioned, default to 15.

5. **Directive (directive)**:
   - The command word instructing how to answer (e.g., "Discuss", "Analyze", "Examine", "Critically Evaluate", "Elucidate", "Comment"). Identify it even if it is embedded deep inside the question text.

6. **Explanation (explanation)**:
   - Extract the model answer, structural framework, key points, or pedagogical explanation. It might be labeled as "Model Answer", "Approach", "Suggested Answer", "Explanation", or just a block of paragraphs. If not provided, generate a brief structured answer framework.`
    : `You are a state-of-the-art UPSC assessment parser and structured information extractor. Your goal is to parse raw multiple-choice questions (MCQs) that might be copied from books, worksheets, or OCR dumps, and format them into structured JSON.
Crucially, raw inputs are often scrambled, abruptly formatted, or out of order. For example, the options may come before the question, or the correct answer/explanation might be placed at the very top or in the middle. You must analyze the text logically to identify the components of each question, regardless of their order:

1. **Question Statement (question_statement)**: 
   - The primary theme or question context introduction (e.g. "With reference to the advent of Europeans in India, the Treaty of Tordesillas...").
   - If the question contains supplementary statements (facts/conditions to evaluate) followed by a final question prompt (like "Which of the statements given above are correct?"), the lead-in (e.g. "Consider the following statements:") or the context is the question_statement.
   - For standard single-sentence MCQs, the question_statement is the full question text.

2. **Supplementary Statement (supp_question_statement)**:
   - Contains any lists of facts, conditions, statements, or reasons that the student needs to evaluate (e.g., "1. The northern part of India was divided... 2. The Bahmani Kingdom...").
   - Extract these statements even if they are poorly formatted, lumped into a single line, separated by semicolons (e.g., "• statement 1; 2. statement 2"), or prefix-bulleted (e.g., "• 1) To end the...").
   - Format them clearly as a clean, newline-separated numbered list: "1. [First statement]\\n2. [Second statement]" etc. Remove any original scrambled bullets.

3. **Question Prompt (question_prompt)**:
   - The specific question or call-to-action that instructs the student what to find (e.g., "Which of the statements given above are correct?", "How many of the above reasons were correct?", "Select the correct answer using the code given below").
   - This prompt might be pasted at the very top, in the middle, or at the bottom. Find it and map it to question_prompt.

4. **Options (options)**:
   - Must contain exactly 4 options representing choices A, B, C, and D.
   - Locate these options wherever they are placed. Clean and remove any choice labels (such as "a. ", "• b. ", "C) ", "d. ", etc.) from the option text itself.
   - Set the correct "is_correct" boolean flag for each option based on the "correct_answer".

5. **Correct Answer (correct_answer)**:
   - Must be a single uppercase character: "A", "B", "C", or "D".
   - Locate this key information wherever it appears (e.g., "Correct Answer: b", "Answer: C", "Key: A", or even at the very top of the text). Always capitalize it.

6. **Explanation (explanation)**:
   - Locate the pedagogical explanation explaining why the correct option is right and others are wrong.
   - If no explanation is provided in the raw text, you MUST generate a high-quality, comprehensive educational explanation explaining the concepts, correct statements, and why incorrect ones are wrong.
   - **Formatting & Structure Rules**:
     * You MUST automatically format the explanation using Markdown to make it highly readable and structured.
     * Use **bold text** for key terms, core concepts, article numbers, historical dates, and specific correct/incorrect statement references (e.g. "**Statement 1 is correct** because...", "**Statement 2 is incorrect** because...").
     * Break large blocks of text into smaller, digestible paragraphs (maximum 2-3 sentences per paragraph) organized logically.
     * Structure the explanation with clear sections/paragraphs separated by newlines, such as a general concept introduction, a statement-by-statement breakdown, and a concluding summary.

 7. **Passage**:
   - If a group of questions are preceded by a shared reading passage or logical puzzle/case, extract the title under "passage_title" and body under "passage_text". Keep individual questions in the "questions" array.

8. **Mathematical Formulas and LaTeX Support**:
   - Do NOT convert mathematical equations, variables, or expressions to plain text. Keep them exactly as they are.
   - You MUST preserve all mathematical formulas, equations, fractions, square roots, and variables exactly, wrapping them in LaTeX inline code syntax using single dollar signs (e.g. $x^2 + y^2 = z^2$ or $\\frac{a}{b}$).
   - This rule applies strictly to all fields: question_statement, supp_question_statement, question_prompt, options, and explanation.

STRICT RULE: The output must strictly conform to the JSON schema. Do not output any introductory or concluding text, only the raw JSON.`;

  const outputSchema = isMains
    ? {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_statement: { type: "string", description: "Main question statement" },
                supp_question_statement: { type: "string", description: "Optional supplementary facts or context" },
                word_limit: { type: "integer", description: "Word limit of the answer, default 250" },
                marks: { type: "number", description: "Marks for the question, default 15" },
                directive: { type: "string", description: "Directive word like Discuss, Examine, Elucidate" },
                explanation: { type: "string", description: "Detailed model answer or guide" }
              },
              required: ["question_statement"]
            }
          }
        },
        required: ["questions"]
      }
    : {
        type: "object",
        properties: {
          passage_title: { type: "string", description: "Optional title for a shared passage" },
          passage_text: { type: "string", description: "Optional text of a shared passage if questions are linked to it" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_statement: { type: "string", description: "Main question statement" },
                supp_question_statement: { type: "string", description: "Optional list of statements/facts" },
                question_prompt: { type: "string", description: "Optional question prompt (e.g. 'Which of the statements given above is/are correct?')" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string", description: "A, B, C, or D" },
                      text: { type: "string", description: "Text content of option" },
                      is_correct: { type: "boolean" }
                    }
                  }
                },
                correct_answer: { type: "string", description: "A, B, C, or D" },
                explanation: { type: "string", description: "Detailed pedagogical explanation" }
              },
              required: ["question_statement", "options", "correct_answer"]
            }
          }
        },
        required: ["questions"]
      };

  const finalSystemPrompt = `${systemPrompt}\n\nOUTPUT SCHEMA:\n${JSON.stringify(outputSchema, null, 2)}`;
  const userPrompt = `RAW TEXT TO PARSE:\n${options.rawText}${options.instructions ? `\n\nAdditional Instructions:\n${options.instructions}` : ""}`;
  
  const rawResponse = await generateText(finalSystemPrompt, userPrompt);
  let parsedQuiz = parseJsonRobust(rawResponse);

  // ── STEP 3: AUDITOR AGENT (LaTeX equations validation) ──
  if (openAiKey || geminiKey) {
    try {
      const auditorSystemPrompt = `You are a UPSC assessment validation auditor agent.
Ensure all mathematical formulas, CSAT variables, and probability stats are written in LaTeX format using single $ delimiters (e.g., $x^2 = 9$, $\\frac{a}{b}$).
Remove any raw markdown wrappers outside of JSON block.

Return ONLY the corrected JSON data.`;
      const auditorResponse = await generateText(auditorSystemPrompt, JSON.stringify(parsedQuiz));
      parsedQuiz = parseJsonRobust(auditorResponse);
    } catch (err) {
      console.error("[AI Quiz Parser Auditor Agent] Audit failed:", err);
    }
  }

  // Inject subject ID into output for catalog link convenience
  const matchedSubject = taxonomyNodes.find(t => t.slug === routedSubjectSlug);
  
  // Normalize parsedQuiz to ensure it is always an object with success: true and a questions array
  let normalizedQuiz: any = { success: true, questions: [] };

  if (parsedQuiz && typeof parsedQuiz === "object") {
    if (Array.isArray(parsedQuiz)) {
      normalizedQuiz.questions = parsedQuiz;
    } else if (Array.isArray(parsedQuiz.questions)) {
      normalizedQuiz = {
        success: true,
        ...parsedQuiz
      };
    } else if (parsedQuiz.question_statement) {
      // Single question object
      normalizedQuiz = {
        success: true,
        questions: [parsedQuiz]
      };
    } else {
      normalizedQuiz = {
        success: true,
        ...parsedQuiz,
        questions: []
      };
    }
  }

  if (matchedSubject) {
    normalizedQuiz.subject_node_id = Number(matchedSubject.id);
  }

  return normalizedQuiz;
}

export async function extractStyleAI(sourceText: string): Promise<string> {
  const systemPrompt = `You are a professional writing style analyzer and UPSC content specialist.
Analyze the writing style, structure, tone, layout conventions, heading hierarchy, formatting, and formatting rules of the provided reference text.
Extract a highly detailed set of clear, actionable style guidelines in Markdown format.
Include details on:
1. Tone and Voice (e.g. academic, objective, descriptive, analytical)
2. Structural Layout (e.g. sections like Background Context, Key Issues, Way Forward, sub-headings structure)
3. Formatting Rules (e.g. use of bolding, bullet points, LaTeX formulas for math, HTML elements)
4. Data Presentation (e.g. usage of tables, comparison grids, checklists, lists)

Return ONLY the Markdown style instructions. Do not wrap the output in markdown code blocks.`;

  return generateText(systemPrompt, sourceText);
}

export async function draftMainsQuestionAI(
  options: {
    topic: string;
    instructions?: string;
    aiProvider?: string;
    aiModel?: string;
    styleProfileId?: number;
  }
): Promise<any> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let systemPrompt = `You are a UPSC Mains subjective question designer and structured parser. 
Analyze the user's input:
- If the input is a raw, pre-existing Mains question (e.g. from past papers or books) or a list of them, extract the question statements, word limits, marks, and directives. For each, if it contains a model answer, extract it. If it doesn't contain a model answer, write a detailed, high-quality model answer (with introduction, body points, and conclusion) and key points for evaluation.
- If the input is a short topic/issue or instructions for generation, generate one or more high-quality UPSC Mains questions, including directive, marks, word limit, detailed model answer, and key evaluation points.

Return ONLY valid JSON in this format containing an array of questions:
{
  "questions": [
    {
      "question_statement": "The core question statement",
      "directive": "Discuss" | "Analyze" | "Evaluate" | "Critically Examine" | "Elucidate" | "Explain",
      "word_limit": 150 or 250,
      "marks": 10 or 15,
      "model_answer": "A detailed model answer/approach containing introduction, body points, and conclusion",
      "key_points": ["Key grading point 1", "Key grading point 2", "Key grading point 3"]
    }
  ]
}`;

  if (options.styleProfileId) {
    const profile = await one<{ style_profile: any }>(
      `select style_profile from assessment.ai_style_profiles where id = $1`,
      [options.styleProfileId]
    );
    if (profile && profile.style_profile) {
      const sp = profile.style_profile;
      systemPrompt = `${systemPrompt}\n\n[STYLE PROFILE INSTRUCTIONS]\nYou must generate the mains questions strictly following this style profile:
- Summary of style: ${sp.summary || ""}
- Style guidelines: ${sp.style_instructions || ""}
- Difficulty: ${sp.difficulty || ""}
${sp.format_rules ? `- Format rules: ${Array.isArray(sp.format_rules) ? sp.format_rules.join("; ") : sp.format_rules}` : ""}
${sp.dos ? `- Dos: ${Array.isArray(sp.dos) ? sp.dos.join("; ") : sp.dos}` : ""}
${sp.donts ? `- Donts: ${Array.isArray(sp.donts) ? sp.donts.join("; ") : sp.donts}` : ""}
`;
    }
  }

  const userPrompt = `Input Text (Topic or Raw Question):\n${options.topic}\n\n${options.instructions ? `Additional Guidelines: ${options.instructions}` : ""}`;

  if (openAiKey || geminiKey) {
    try {
      const response = await generateText(systemPrompt, userPrompt);
      return parseJsonRobust(response);
    } catch (err) {
      console.error("[AI Mains Drafter] LLM generation failed, falling back to mock:", err);
    }
  }

  // Fallback mock
  return {
    questions: [
      {
        question_statement: options.topic.length > 50 ? options.topic : `Examine the constitutional and political challenges associated with the governance of Union Territories in India, with specific reference to ${options.topic}.`,
        directive: "Critically Examine",
        word_limit: 250,
        marks: 15,
        model_answer: `### Introduction\nDiscuss the constitutional status of UTs under Article 239 of the Constitution.\n\n### Body\n1. Administrative conflicts between elected executives and Lieutenant Governors.\n2. Legislative autonomy limitations.\n3. Financial dependency on the Union Government.\n\n### Conclusion\nSuggest a balanced framework to protect both local democracy and national security/unity.`,
        key_points: [
          "Must mention Article 239 and relevant amendments.",
          "Must detail friction between LG and State/UT Executive.",
          "Must outline financial dependency on the Center."
        ]
      }
    ]
  };
}

export async function performOcrGemini(imagesBase64: string[]): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }

  const results: string[] = [];
  const model = "gemini-2.5-flash"; // default vision-capable model

  for (const imgB64 of imagesBase64) {
    let mimeType = "image/jpeg";
    let base64Data = imgB64;

    if (imgB64.includes(",")) {
      const parts = imgB64.split(",", 2);
      const header = parts[0] || "";
      base64Data = parts[1] || "";

      // Extract mime type from header like "data:image/png;base64"
      if (header.startsWith("data:") && header.includes(";base64")) {
        const mimePart = header.split(";")[0];
        if (mimePart) {
          mimeType = mimePart.replace("data:", "");
        }
      }
    }

    // Call Gemini API via global fetch
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Extract all handwritten and printed text from this image as a clear, formatted string." },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini OCR API error: ${response.status} - ${errorText}`);
    }

    const json = (await response.json()) as any;
    const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!responseText) {
      throw new Error("Gemini returned an empty response candidate for OCR.");
    }
    results.push(responseText);
  }

  return results.join("\n\n");
}



