import type { FastifyInstance } from "fastify";
import { idParamSchema, parse, withValidation } from "../../../common/http.js";
import { requireAdminOrEditor } from "../../auth/guards.js";
import {
  archiveMasterArticle,
  createMasterArticle,
  deleteMasterArticle,
  getMasterArticle,
  listMasterArticles,
  updateMasterArticle,
  saveAIGeneratedArticle
} from "./articles.service.js";
import {
  createMasterArticleSchema,
  listMasterArticlesQuerySchema,
  updateMasterArticleSchema
} from "../schemas.js";
import { one, query } from "../../../db.js";
import { generateContentAffairsAI, generateQuizzesAI, extractStyleAI } from "./ai.service.js";

export async function registerCurrentAffairsArticleRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/v1/current-affairs/articles", async (request, reply) => {
    return withValidation(reply, async () => {
      const query = parse(listMasterArticlesQuerySchema, request.query);
      let includeUnpublished = false;
      if (query.status && query.status !== "published") {
        await requireAdminOrEditor(request);
        includeUnpublished = true;
      }
      return listMasterArticles(query, includeUnpublished);
    });
  });

  server.post("/api/v1/current-affairs/articles", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = parse(createMasterArticleSchema, request.body);
      const record = await createMasterArticle(body, user.id);
      return reply.status(201).send(record);
    });
  });

  server.get("/api/v1/current-affairs/articles/:id", async (request, reply) => {
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getMasterArticle(params.id, false);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });

  server.get("/api/v1/current-affairs/admin/articles/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await getMasterArticle(params.id, true);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });

  server.patch("/api/v1/current-affairs/articles/:id", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const body = parse(updateMasterArticleSchema, request.body);
      const record = await updateMasterArticle(params.id, body, user.id);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/archive", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await archiveMasterArticle(params.id, user.id);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/articles/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await deleteMasterArticle(params.id);
      if (!record) return reply.notFound("Article not found.");
      return record;
    });
  });

  server.post("/api/v1/current-affairs/articles/:id/insert-content", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const { content, section_id } = request.body as { content: string; section_id?: number };
      
      if (!content || typeof content !== "string") {
        return reply.badRequest("content must be a non-empty string.");
      }

      if (section_id) {
        const section = await one<{ body: string }>(
          `select body from current_affairs.master_article_sections where id = $1 and article_id = $2`,
          [section_id, params.id]
        );
        if (!section) return reply.notFound("Section not found under this article.");
        const newBody = section.body ? `${section.body}\n\n${content}` : content;
        const updated = await one(
          `update current_affairs.master_article_sections set body = $1, updated_at = now() where id = $2 returning *`,
          [newBody, section_id]
        );
        return { success: true, updated };
      } else {
        const article = await one<{ body: string }>(
          `select body from current_affairs.master_articles where id = $1`,
          [params.id]
        );
        if (!article) return reply.notFound("Article not found.");
        const newBody = article.body ? `${article.body}\n\n${content}` : content;
        const updated = await one(
          `update current_affairs.master_articles set body = $1, updated_at = now() where id = $2 returning *`,
          [newBody, params.id]
        );
        return { success: true, updated };
      }
    });
  });

  server.post("/api/v1/current-affairs/admin/ai/generate", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        content_type?: "prelims_ca" | "mains_ca" | "prelims_pyq" | "mains_pyq";
        topics: string[];
        ai_provider: string;
        ai_model: string;
        instructions?: string;
        subject_id?: number;
        style_guide_id?: number;
        is_parsing_mode?: boolean;
      };
      
      return generateContentAffairsAI({
        contentType: body.content_type,
        topics: body.topics,
        aiProvider: body.ai_provider,
        aiModel: body.ai_model,
        instructions: body.instructions,
        subjectId: body.subject_id,
        styleGuideId: body.style_guide_id,
        isParsingMode: body.is_parsing_mode
      });
    });
  });

  server.post("/api/v1/current-affairs/admin/ai/extract-style", async (request, reply) => {
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

  server.post("/api/v1/current-affairs/admin/ai/style-guide", async (request, reply) => {
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

  server.get("/api/v1/current-affairs/admin/ai/style-guide", async (request, reply) => {
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

  server.post("/api/v1/current-affairs/admin/ai/instructions", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const { scope, title, content_type, subject_node_id, prompt, is_active } = request.body as {
        scope: "general" | "article" | "premium" | "subject" | "quiz";
        title: string;
        content_type?: string;
        subject_node_id?: number;
        prompt: string;
        is_active?: boolean;
      };

      if (!title || !prompt || !scope) {
        return reply.badRequest("title, prompt and scope are required.");
      }

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
            `update current_affairs.ai_instructions set title = $1, prompt = $2, is_active = $3, updated_at = now() where id = $4 returning *`,
            [title, prompt, is_active !== false, existing.id]
          );
        } else {
          record = await one(
            `insert into current_affairs.ai_instructions (scope, title, subject_node_id, content_type, prompt, is_active, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
            [scope, title, subject_node_id, content_type ?? null, prompt, is_active !== false, user.id]
          );
        }
      } else if (scope === "article" && content_type) {
        const existing = await one<{ id: string }>(
          `select id from current_affairs.ai_instructions where scope = 'article' and content_type = $1`,
          [content_type]
        );
        if (existing) {
          record = await one(
            `update current_affairs.ai_instructions set title = $1, prompt = $2, is_active = $3, updated_at = now() where id = $4 returning *`,
            [title, prompt, is_active !== false, existing.id]
          );
        } else {
          record = await one(
            `insert into current_affairs.ai_instructions (scope, title, content_type, prompt, is_active, created_by) values ($1, $2, $3, $4, $5, $6) returning *`,
            [scope, title, content_type, prompt, is_active !== false, user.id]
          );
        }
      } else if (scope === "quiz" && content_type) {
        const existing = await one<{ id: string }>(
          `select id from current_affairs.ai_instructions where scope = 'quiz' and content_type = $1`,
          [content_type]
        );
        if (existing) {
          record = await one(
            `update current_affairs.ai_instructions set title = $1, prompt = $2, is_active = $3, updated_at = now() where id = $4 returning *`,
            [title, prompt, is_active !== false, existing.id]
          );
        } else {
          record = await one(
            `insert into current_affairs.ai_instructions (scope, title, content_type, prompt, is_active, created_by) values ($1, $2, $3, $4, $5, $6) returning *`,
            [scope, title, content_type, prompt, is_active !== false, user.id]
          );
        }
      } else {
        record = await one(
          `insert into current_affairs.ai_instructions (scope, title, prompt, is_active, created_by) values ($1, $2, $3, $4, $5) returning *`,
          [scope, title, prompt, is_active !== false, user.id]
        );
      }
      return record;
    });
  });

  server.get("/api/v1/current-affairs/admin/ai/instructions", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const records = await query(
        `select * from current_affairs.ai_instructions order by scope, title, updated_at desc`
      );
      return records;
    });
  });

  server.get("/api/v1/current-affairs/admin/ai/instructions/:id", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const params = parse(idParamSchema, request.params);
      const record = await one(
        `select * from current_affairs.ai_instructions where id = $1`,
        [params.id]
      );
      if (!record) return reply.notFound("Instruction override not found.");
      return record;
    });
  });

  server.delete("/api/v1/current-affairs/admin/ai/instructions/:id", async (request, reply) => {
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

  server.post("/api/v1/current-affairs/admin/ai/bulk-generate", async (request, reply) => {
    const user = await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        topics: string[];
        content_kind: string;
        category_node_id?: number;
        ai_provider: string;
        ai_model: string;
        instructions?: string;
      };

      if (!body.topics || !Array.isArray(body.topics) || body.topics.length === 0) {
        return reply.badRequest("topics must be a non-empty array of strings.");
      }
      if (!body.content_kind) {
        return reply.badRequest("content_kind is required.");
      }

      const categoryNodeId = body.category_node_id ? Number(body.category_node_id) : null;
      
      const contentTypeMap: Record<string, string> = {
        prelims_pyq: "prelims_pyq",
        mains_pyq: "mains_pyq",
        daily_current_affairs: "prelims_ca",
        daily_editorial_summary: "mains_ca",
        mains_topic_note: "mains_ca"
      };
      
      const contentType = contentTypeMap[body.content_kind] || (['daily_current_affairs', 'prelims_pyq'].includes(body.content_kind) ? "prelims_ca" : "mains_ca");

      // Background execution
      (async () => {
        for (const topic of body.topics) {
          if (!topic.trim()) continue;
          try {
            console.log(`[Bulk-AI] Generating topic: ${topic}`);
            const result = await generateContentAffairsAI({
              contentType: contentType as any,
              topics: [topic],
              aiProvider: body.ai_provider,
              aiModel: body.ai_model,
              instructions: body.instructions,
              subjectId: categoryNodeId ?? undefined
            });

            const generatedArticle = result?.articles?.[0];
            if (generatedArticle) {
              await saveAIGeneratedArticle(generatedArticle, body.content_kind, categoryNodeId, user.id);
              console.log(`[Bulk-AI] Successfully saved topic: ${topic}`);
            } else {
              console.error(`[Bulk-AI] Generation returned empty articles for topic: ${topic}`);
            }
          } catch (err) {
            console.error(`[Bulk-AI] Error generating topic "${topic}":`, err);
          }
        }
      })().catch(err => console.error("[Bulk-AI] Background process failed:", err));

      return { success: true, message: `Started generating ${body.topics.length} drafts in the background.` };
    });
  });


  server.post("/api/v1/current-affairs/admin/ai/generate-quiz", async (request, reply) => {
    await requireAdminOrEditor(request);
    return withValidation(reply, async () => {
      const body = request.body as {
        quiz_type: "gk" | "maths" | "passage";
        prompt: string;
        ai_provider: string;
        ai_model: string;
        instructions?: string;
        count?: number;
        content_type?: "gk" | "aptitude";
      };

      return generateQuizzesAI({
        quizType: body.quiz_type,
        prompt: body.prompt,
        aiProvider: body.ai_provider,
        aiModel: body.ai_model,
        instructions: body.instructions,
        count: body.count,
        content_type: body.content_type
      });
    });
  });
}
