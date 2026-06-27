import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../common/http.js";
import { requireAdminOrEditor } from "../auth/guards.js";
import { one, query } from "../../db.js";
import { extractStyleAI, generateText, generateQuizzesAI } from "../current-affairs/master/ai.service.js";

// Helper to robustly parse JSON from LLM responses
function parseJsonRobust(text: string): any {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Robust JSON Parse failed for text:", text);
    throw new Error("Invalid structured JSON response from AI model.");
  }
}

const STYLE_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    example_count: { type: "integer" },
    summary: { type: "string" },
    style_instructions: { type: "string" },
    format_rules: { type: "array", items: { type: "string" } },
    difficulty: { type: "string" },
    option_style: { type: "string" },
    explanation_style: { type: "string" },
    topic_emphasis: { type: "array", items: { type: "string" } },
    dos: { type: "array", items: { type: "string" } },
    donts: { type: "array", items: { type: "string" } },
    example_analyses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          example: { type: "string" },
          nature: { type: "string" },
          format: { type: "string" },
          depth: { type: "string" },
          topic_focus: { type: "array", items: { type: "string" } },
          difficulty: { type: "string" },
          reasoning_pattern: { type: "string" },
          option_pattern: { type: "string" },
          explanation_expectations: { type: "string" },
          constraints: { type: "array", items: { type: "string" } }
        },
        required: ["index", "example", "nature", "format", "depth"]
      }
    }
  }
};

function getStyleProfileSystemInstructions(contentType: string, userInstructions?: string): string {
  let label = "multiple-choice questions";
  if (contentType === "premium_gk_quiz") {
    label = "UPSC-style GK multiple-choice questions";
  } else if (contentType === "premium_maths_quiz") {
    label = "Mathematics multiple-choice questions";
  } else if (contentType === "premium_passage_quiz") {
    label = "Passage-based multiple-choice questions";
  } else if (contentType === "mains_question_generation") {
    label = "UPSC Mains subjective questions";
  } else if (contentType === "mains_evaluation") {
    label = "Mains Answer Evaluation Feedback";
  }

  if (contentType === "mains_evaluation") {
    let base = `You are an evaluation style analyst. Your job is to infer the evaluation style, depth, and parameters from example UPSC Mains evaluation feedback. Output a JSON object that strictly follows the provided schema. Keep instructions concise and directly usable for evaluation. Do NOT repeat any topic-specific content; use placeholders like [Topic A]. In example_analyses[].example, provide a short neutral label (not the full example text). Analysis must be moderately detailed and clearly visualize the evaluator's approach.
PRESENTATION FORMAT (MANDATORY): Provide analysis in TWO PARTS for each example.
PART 1 - FULL EVALUATION ANALYSIS (overall):
1. Depth and strictness: lenient vs strict, surface vs detailed.
2. Evaluation parameters emphasized: length, factual accuracy, coverage, diversity, examples/data, structure, directives.
3. Feedback structure: ordering of verdict, intro/body/conclusion checks, and actionability.
4. Missing-points logic: how gaps are identified and how model answers are used.
PART 2 - COMPONENT-WISE ANALYSIS:
1. How introductions, body points, and conclusions are judged.
2. How strengths/weaknesses are framed and justified.
3. How improved answers are constructed (if applicable).
You MUST: (1) mention the total number of examples, (2) provide a separate analysis for each example, and (3) produce a combined instruction set that enforces ALL evaluation patterns found. Ensure style_instructions explicitly list evaluation parameters and the missing-points rule: missing points must be tied to the model answer or explicit question demand.`;
    if (userInstructions) {
      base += `\n\nAdditional constraints from the user: ${userInstructions}`;
    }
    return base;
  }

  let base = `You are a quiz style analyst. Your job is to infer the format, depth, and stylistic patterns from example ${label}. Output a JSON object that strictly follows the provided schema. Keep instructions concise and directly usable for generation. Keep the analysis neutral and topic-agnostic. Describe patterns in a reusable way so they can transfer to other topics (focus on roles of statements, ordering, and intent rather than the specific subject). Do NOT generate new questions and do NOT paraphrase or re-create the example topics; avoid repeating named entities or specific facts from the examples. When you need to reference an example, use neutral placeholders like [Topic A] instead of the original topic. In example_analyses[].example, provide a short neutral label (not the full example text). For each example, analyze nature of the question, format, depth, topic focus, difficulty level, reasoning pattern, option style, and explanation expectations.
PRESENTATION FORMAT (MANDATORY): Provide analysis in TWO PARTS for each example. Analysis should be moderately detailed, and each part should visualize the question type clearly.
PART 1 - FULL QUESTION ANALYSIS (overall):
1. Overall structure: e.g., prompt + N statements (independent vs related), or direct question + options; include the typical prompt phrasing.
2. Focus of the question: application vs features vs impacts vs causes vs factual aspects.
3. Topic scope: single-topic vs multi-topic (statements/options drawn from one topic vs combined topics around a single feature).
4. Difficulty level: solvable from overview (easy) vs in-depth single-topic vs comparative multi-topic knowledge.
5. Relations between components: how question_statement connects to statements_facts or options; is question_statement answerable on its own or a placeholder (e.g., 'Consider the following')?
6. Structural & semantic relation: identify if it asks to define a term from features, verify statements, or combine independent facts into one concept.
7. Topic cohesion (gap): same paragraph/section vs different topics/chapters; single-note vs wide-span vs comparative vs sequential; state whether statements/options are related or independent.
8. Option & topic analysis (overall): topic cohesion, aspect focus, plausibility, contradictions.
9. Incorrect statements/options: identify where wrong options typically come from (common confusions, near-true facts, misapplied definitions, reversed causality, wrong pairings) and the expected wrong-option patterns.
PART 2 - COMPONENT-WISE ANALYSIS:
1. question_statement: purpose, tone, and how it sets up the analytical task; identify the specific aspect it asks about (even if phrased generally).
2. statements_facts: nature and construction of statements in the example (to-the-point vs verbose, factual vs analytical, continuity with the question_statement). Statements must stay within the SAME aspect asked by the question_statement. Incorrect but plausible statements must also stay within that same aspect. Include density/length, gap between statements (same paragraph/section vs different topics/chapters), and whether statements are related or independent.
3. question_prompt: exact phrasing style, placement relative to statements, and whether it references statement numbers.
4. options: structure (statement-number combos vs standalone), option style, internal consistency, gap between options (same section vs different topics/chapters), relation to question_statement, and the expected wrong-option patterns (sources and types of incorrect options).
IMPORTANT: Some examples are direct questions where statements_facts or question_prompt are missing. You MUST handle this explicitly.
Be specific and non-trivial.
You MUST: (1) mention the total number of examples, (2) provide a separate analysis for each example, and (3) produce a combined instruction set that enforces ALL example formats found. If the examples show DIFFERENT types (e.g., one direct, one statement-based), your instructions must explicitly allow ALL of them, not just average them. Ensure the style_instructions include a reusable template that explains how to adapt the format to any subject matter.
GLOBAL INSTRUCTIONS: Answers should vary; minimize 'all correct' patterns.
GLOBAL INCORRECT-OPTION RULE (unchanging): Incorrect options must be plausible and correct-looking, aligned to the nature of the statements/options in the examples, but absolutely incorrect.
Explanations must be logical, justified, and add brief extra knowledge about the topic. For maths questions, explanations must be step-by-step and simple enough for weaker students.`;

  if (userInstructions) {
    base += `\n\nAdditional constraints from the user: ${userInstructions}`;
  }
  return base;
}

export async function registerAssessmentAiSettingsRoutes(server: FastifyInstance): Promise<void> {
  // GET style guide
  server.get("/api/v1/assessment/admin/ai/style-guide", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { content_type } = request.query as { content_type?: string };
      let record;
      if (content_type) {
        record = await one(
          `select * from current_affairs.ai_style_guides where content_type = $1`,
          [content_type]
        );
      }
      if (!record) {
        record = await one(
          `select * from current_affairs.ai_style_guides where content_type is null order by updated_at desc limit 1`
        );
      }
      return record || { style_guide: "" };
    });
  });

  // POST style guide
  server.post("/api/v1/assessment/admin/ai/style-guide", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { style_guide, source_text, content_type } = request.body as { style_guide: string; source_text?: string; content_type?: string };
      if (!style_guide) return reply.badRequest("style_guide is required.");

      let existing;
      if (content_type) {
        existing = await one<{ id: string }>(
          `select id from current_affairs.ai_style_guides where content_type = $1`,
          [content_type]
        );
      } else {
        existing = await one<{ id: string }>(
          `select id from current_affairs.ai_style_guides where content_type is null`
        );
      }

      let record;
      if (existing) {
        record = await one(
          `update current_affairs.ai_style_guides set style_guide = $1, source_text = $2, updated_at = now() where id = $3 returning *`,
          [style_guide, source_text ?? null, existing.id]
        );
      } else {
        record = await one(
          `insert into current_affairs.ai_style_guides (style_guide, source_text, content_type, created_by) values ($1, $2, $3, $4) returning *`,
          [style_guide, source_text ?? null, content_type ?? null, user.id]
        );
      }
      return record;
    });
  });

  // GET instructions (list)
  server.get("/api/v1/assessment/admin/ai/instructions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const records = await query(
        `select * from current_affairs.ai_instructions order by scope, title, updated_at desc`
      );
      return records;
    });
  });

  // POST instruction
  server.post("/api/v1/assessment/admin/ai/instructions", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { scope, title, content_type, subject_node_id, prompt, is_active, input_schema, example_input, output_schema, example_output } = request.body as {
        scope: "general" | "article" | "premium" | "subject" | "quiz";
        title: string;
        content_type?: string;
        subject_node_id?: number;
        prompt: string;
        is_active?: boolean;
        input_schema?: any;
        example_input?: string;
        output_schema?: any;
        example_output?: any;
      };

      if (!title || !prompt || !scope) {
        return reply.badRequest("title, prompt and scope are required.");
      }

      const inputSchemaJson = input_schema ? (typeof input_schema === "string" ? input_schema : JSON.stringify(input_schema)) : "{}";
      const outputSchemaJson = output_schema ? (typeof output_schema === "string" ? output_schema : JSON.stringify(output_schema)) : "{}";
      const exampleOutputJson = example_output ? (typeof example_output === "string" ? example_output : JSON.stringify(example_output)) : "{}";

      let record;
      if (scope === "subject" && subject_node_id) {
        let existing;
        if (content_type) {
          existing = await one<{ id: string }>(
            `select id from current_affairs.ai_instructions where scope = 'subject' and subject_node_id = $1 and content_type = $2`,
            [subject_node_id, content_type]
          );
        } else {
          existing = await one<{ id: string }>(
            `select id from current_affairs.ai_instructions where scope = 'subject' and subject_node_id = $1 and content_type is null`,
            [subject_node_id]
          );
        }

        if (existing) {
          record = await one(
            `update current_affairs.ai_instructions set title = $1, prompt = $2, is_active = $3, input_schema = $4, example_input = $5, output_schema = $6, example_output = $7, updated_at = now() where id = $8 returning *`,
            [title, prompt, is_active !== false, inputSchemaJson, example_input ?? null, outputSchemaJson, exampleOutputJson, existing.id]
          );
        } else {
          record = await one(
            `insert into current_affairs.ai_instructions (scope, title, subject_node_id, content_type, prompt, is_active, input_schema, example_input, output_schema, example_output, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
            [scope, title, subject_node_id, content_type ?? null, prompt, is_active !== false, inputSchemaJson, example_input ?? null, outputSchemaJson, exampleOutputJson, user.id]
          );
        }
      } else if ((scope === "article" || scope === "quiz") && content_type) {
        const existing = await one<{ id: string }>(
          `select id from current_affairs.ai_instructions where scope = $1 and content_type = $2`,
          [scope, content_type]
        );
        if (existing) {
          record = await one(
            `update current_affairs.ai_instructions set title = $1, prompt = $2, is_active = $3, input_schema = $4, example_input = $5, output_schema = $6, example_output = $7, updated_at = now() where id = $8 returning *`,
            [title, prompt, is_active !== false, inputSchemaJson, example_input ?? null, outputSchemaJson, exampleOutputJson, existing.id]
          );
        } else {
          record = await one(
            `insert into current_affairs.ai_instructions (scope, title, content_type, prompt, is_active, input_schema, example_input, output_schema, example_output, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
            [scope, title, content_type, prompt, is_active !== false, inputSchemaJson, example_input ?? null, outputSchemaJson, exampleOutputJson, user.id]
          );
        }
      } else {
        record = await one(
          `insert into current_affairs.ai_instructions (scope, title, prompt, is_active, input_schema, example_input, output_schema, example_output, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
          [scope, title, prompt, is_active !== false, inputSchemaJson, example_input ?? null, outputSchemaJson, exampleOutputJson, user.id]
        );
      }
      return record;
    });
  });

  // DELETE instruction
  server.delete("/api/v1/assessment/admin/ai/instructions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await one(
        `delete from current_affairs.ai_instructions where id = $1 returning *`,
        [params.id]
      );
      if (!record) return reply.notFound("Instruction override not found.");
      return record;
    });
  });

  // POST extract-style
  server.post("/api/v1/assessment/admin/ai/extract-style", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { source_text } = request.body as { source_text: string };
      if (!source_text || typeof source_text !== "string") {
        return reply.badRequest("source_text is required.");
      }
      const styleGuideText = await extractStyleAI(source_text);
      return { style_guide: styleGuideText };
    });
  });

  // ── STYLE PROFILE ENDPOINTS ──

  // GET style-profiles (list)
  server.get("/api/v1/assessment/admin/ai/style-profiles", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { content_type } = request.query as { content_type?: string };
      let records;
      if (content_type) {
        records = await query(
          `select * from assessment.ai_style_profiles where content_type = $1 order by updated_at desc`,
          [content_type]
        );
      } else {
        records = await query(
          `select * from assessment.ai_style_profiles order by updated_at desc`
        );
      }
      return records;
    });
  });

  // GET style-profiles/:id
  server.get("/api/v1/assessment/admin/ai/style-profiles/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await one(
        `select * from assessment.ai_style_profiles where id = $1`,
        [params.id]
      );
      if (!record) return reply.notFound("Style profile not found.");
      return record;
    });
  });

  // POST style-profiles (save)
  server.post("/api/v1/assessment/admin/ai/style-profiles", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { title, description, tag_level1, tag_level2, content_type, style_profile, example_questions, tags, is_active } = request.body as {
        title: string;
        description?: string;
        tag_level1?: string;
        tag_level2?: string;
        content_type: string;
        style_profile: any;
        example_questions?: string[];
        tags?: string[];
        is_active?: boolean;
      };

      if (!title || !content_type || !style_profile) {
        return reply.badRequest("title, content_type, and style_profile are required.");
      }

      const styleProfileJson = typeof style_profile === "string" ? style_profile : JSON.stringify(style_profile);
      const exampleQuestionsJson = example_questions ? (typeof example_questions === "string" ? example_questions : JSON.stringify(example_questions)) : "[]";
      const tagsJson = tags ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : "[]";

      const record = await one(
        `insert into assessment.ai_style_profiles 
         (title, description, tag_level1, tag_level2, content_type, style_profile, example_questions, tags, is_active, created_by)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
         returning *`,
        [title, description ?? null, tag_level1 ?? null, tag_level2 ?? null, content_type, styleProfileJson, exampleQuestionsJson, tagsJson, is_active !== false, user.id]
      );
      return record;
    });
  });

  // PUT style-profiles/:id (update)
  server.put("/api/v1/assessment/admin/ai/style-profiles/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const { title, description, tag_level1, tag_level2, style_profile, example_questions, tags, is_active } = request.body as {
        title: string;
        description?: string;
        tag_level1?: string;
        tag_level2?: string;
        style_profile: any;
        example_questions?: string[];
        tags?: string[];
        is_active?: boolean;
      };

      if (!title || !style_profile) {
        return reply.badRequest("title and style_profile are required.");
      }

      const styleProfileJson = typeof style_profile === "string" ? style_profile : JSON.stringify(style_profile);
      const exampleQuestionsJson = example_questions ? (typeof example_questions === "string" ? example_questions : JSON.stringify(example_questions)) : "[]";
      const tagsJson = tags ? (typeof tags === "string" ? tags : JSON.stringify(tags)) : "[]";

      const record = await one(
        `update assessment.ai_style_profiles 
         set title = $1, description = $2, tag_level1 = $3, tag_level2 = $4, style_profile = $5::jsonb, example_questions = $6::jsonb, tags = $7::jsonb, is_active = $8, updated_at = now()
         where id = $9
         returning *`,
        [title, description ?? null, tag_level1 ?? null, tag_level2 ?? null, styleProfileJson, exampleQuestionsJson, tagsJson, is_active !== false, params.id]
      );
      if (!record) return reply.notFound("Style profile not found.");
      return record;
    });
  });

  // DELETE style-profiles/:id
  server.delete("/api/v1/assessment/admin/ai/style-profiles/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await one(
        `delete from assessment.ai_style_profiles where id = $1 returning *`,
        [params.id]
      );
      if (!record) return reply.notFound("Style profile not found.");
      return record;
    });
  });

  // POST style-profiles/extract
  server.post("/api/v1/assessment/admin/ai/style-profiles/extract", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { content_type, example_questions, user_instructions } = request.body as {
        content_type: string;
        example_questions: string[];
        user_instructions?: string;
      };

      if (!content_type || !example_questions || example_questions.length === 0) {
        return reply.badRequest("content_type and example_questions are required.");
      }

      const systemPrompt = getStyleProfileSystemInstructions(content_type, user_instructions);
      const bullets = "\n- " + example_questions.map(q => q.trim()).filter(Boolean).join("\n- ");
      const userPrompt = `Analyze the example questions (nature, format, depth, topic focus, difficulty, reasoning, options, explanations) and return a JSON object matching this schema: ${JSON.stringify(STYLE_PROFILE_SCHEMA)}. Provide ONLY the JSON object. Include example_count and a separate example_analyses entry for EACH example in order. Examples:${bullets}`;

      const rawResponse = await generateText(systemPrompt, userPrompt);
      const styleProfile = parseJsonRobust(rawResponse);
      return { style_profile: styleProfile };
    });
  });

  // POST style-profiles/refine
  server.post("/api/v1/assessment/admin/ai/style-profiles/refine", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { content_type, style_profile, feedback, user_instructions } = request.body as {
        content_type: string;
        style_profile: any;
        feedback: string;
        user_instructions?: string;
      };

      if (!content_type || !style_profile || !feedback) {
        return reply.badRequest("content_type, style_profile, and feedback are required.");
      }

      const systemPrompt = getStyleProfileSystemInstructions(content_type, user_instructions) + "\n\nRevise the existing style profile using the feedback. Keep it concise and actionable.";
      const currentProfileJson = typeof style_profile === "string" ? style_profile : JSON.stringify(style_profile);
      const userPrompt = `Revise the style profile JSON using the feedback. Current profile:\n${currentProfileJson}\n\nFeedback:\n${feedback}\n\nPreserve or update example_count and include a separate example_analyses entry for EACH example. Return ONLY a JSON object that matches this schema: ${JSON.stringify(STYLE_PROFILE_SCHEMA)}.`;

      const rawResponse = await generateText(systemPrompt, userPrompt);
      const refinedProfile = parseJsonRobust(rawResponse);
      return { style_profile: refinedProfile };
    });
  });

  // POST generate-quiz
  server.post("/api/v1/assessment/admin/ai/generate-quiz", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        quiz_type: string;
        prompt: string;
        ai_provider?: string;
        ai_model?: string;
        instructions?: string;
        count?: number;
        content_type?: "gk" | "aptitude";
        style_profile_id?: number;
      };

      if (!body.prompt || !body.quiz_type) {
        return reply.badRequest("prompt and quiz_type are required.");
      }

      return generateQuizzesAI({
        quizType: body.quiz_type,
        prompt: body.prompt,
        aiProvider: body.ai_provider || "openai",
        aiModel: body.ai_model || "gpt-4o-mini",
        instructions: body.instructions,
        count: body.count,
        content_type: body.content_type,
        styleProfileId: body.style_profile_id
      });
    });
  });
}
