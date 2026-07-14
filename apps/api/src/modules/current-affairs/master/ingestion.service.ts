import { addCondition } from "../../../common/sql.js";
import { one, query, transaction } from "../../../db.js";
import type {
  CreateIngestionJobInput,
  CreateMasterArticleInput,
  ListIngestionJobsQuery,
  UpdateIngestionItemInput
} from "../schemas.js";
import { createMasterArticleSchema } from "../schemas.js";
import { createMasterArticle } from "./articles.service.js";
import { generateContentAffairsAI } from "./ai.service.js";

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || `current-affairs-${Date.now()}`;
}

function parseRawText(input: CreateIngestionJobInput): CreateMasterArticleInput[] {
  if (!input.raw_text) return [];

  return input.raw_text
    .split(/\n-{3,}\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const title = lines[0] ?? `Current Affairs Item ${index + 1}`;
      const publicationDate = input.default_publication_date ?? new Date().toISOString().slice(0, 10);
      return {
        content_kind: input.default_content_kind,
        title,
        slug: `${slugify(title)}-${publicationDate}`,
        body: chunk,
        category_node_id: input.default_category_node_id,
        source_name: input.source_name,
        source_url: input.source_url,
        publication_date: publicationDate,
        institute_tags: input.default_tags ?? [],
        status: input.default_status,
        is_ai_generated: input.parser_kind === "external_ai"
      };
    });
}

function buildCandidates(input: CreateIngestionJobInput): CreateMasterArticleInput[] {
  if (input.articles?.length) return input.articles;
  return parseRawText(input);
}

async function refreshIngestionJobStatus(jobId: number): Promise<void> {
  const counts = await one<{
    total_count: string;
    pending_count: string;
    approved_count: string;
    published_count: string;
    rejected_count: string;
  }>(
    `
      select
        count(*)::text as total_count,
        count(*) filter (where status = 'pending_review')::text as pending_count,
        count(*) filter (where status = 'approved')::text as approved_count,
        count(*) filter (where status = 'published')::text as published_count,
        count(*) filter (where status = 'rejected')::text as rejected_count
      from current_affairs.ingestion_items
      where job_id = $1
    `,
    [jobId]
  );

  const total = Number(counts?.total_count ?? 0);
  const pending = Number(counts?.pending_count ?? 0);
  const approved = Number(counts?.approved_count ?? 0);
  const published = Number(counts?.published_count ?? 0);
  const nextStatus =
    total > 0 && published === total
      ? "published"
      : pending === 0 && approved === 0
        ? "reviewed"
        : "parsed";

  await query(
    `
      update current_affairs.ingestion_jobs
      set status = $2, updated_at = now()
      where id = $1
    `,
    [jobId, nextStatus]
  );
}

export async function createIngestionJob(input: CreateIngestionJobInput, userId: number): Promise<unknown | null> {
  const candidates = buildCandidates(input);

  const jobId = await transaction(async (client) => {
    const job = await client.query<{ id: number }>(
      `
        insert into current_affairs.ingestion_jobs
          (
            source_kind,
            parser_kind,
            source_name,
            source_url,
            source_filename,
            source_file_url,
            raw_text,
            raw_payload,
            status,
            created_by_user_id
          )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      [
        input.source_kind,
        input.parser_kind,
        input.source_name ?? null,
        input.source_url ?? null,
        input.source_filename ?? null,
        input.source_file_url ?? null,
        input.raw_text ?? null,
        JSON.stringify(input.raw_payload ?? {}),
        candidates.length > 0 ? "parsed" : "failed",
        userId
      ]
    );

    const id = job.rows[0]?.id;
    if (!id) throw new Error("Current affairs ingestion job creation failed.");

    for (const candidate of candidates) {
      await client.query(
        `
          insert into current_affairs.ingestion_items
            (job_id, raw_payload, normalized_article)
          values ($1, $2, $2)
        `,
        [id, JSON.stringify(candidate)]
      );
    }

    return id;
  });

  if (input.parser_kind === "external_ai") {
    processIngestionJobAI(jobId, userId).catch((err) =>
      console.error(`[Ingestion-AI-Worker] Background worker failed for job ${jobId}:`, err)
    );
  }

  return getIngestionJob(jobId);
}

export async function listIngestionJobs(options: ListIngestionJobsQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (options.status) addCondition(conditions, params, "caj.status = ?", options.status);
  if (options.parser_kind) addCondition(conditions, params, "caj.parser_kind = ?", options.parser_kind);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        caj.*,
        count(cai.id)::integer as item_count,
        count(cai.id) filter (where cai.status = 'approved')::integer as approved_count,
        count(cai.id) filter (where cai.status = 'published')::integer as published_count
      from current_affairs.ingestion_jobs caj
      left join current_affairs.ingestion_items cai on cai.job_id = caj.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by caj.id
      order by caj.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function getIngestionJob(jobId: number): Promise<unknown | null> {
  return one(
    `
      select
        caj.*,
        coalesce(jsonb_agg(to_jsonb(cai.*) order by cai.id) filter (where cai.id is not null), '[]'::jsonb) as items
      from current_affairs.ingestion_jobs caj
      left join current_affairs.ingestion_items cai on cai.job_id = caj.id
      where caj.id = $1
      group by caj.id
    `,
    [jobId]
  );
}

export async function updateIngestionItem(
  itemId: number,
  input: UpdateIngestionItemInput
): Promise<unknown | null> {
  const record = await one(
    `
      update current_affairs.ingestion_items
      set
        normalized_article = coalesce($2, normalized_article),
        status = coalesce($3, status),
        validation_errors = coalesce($4, validation_errors),
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      itemId,
      input.normalized_article ? JSON.stringify(input.normalized_article) : null,
      input.status ?? null,
      input.validation_errors ? JSON.stringify(input.validation_errors) : null
    ]
  );

  const jobId = Number((record as { job_id?: unknown } | null)?.job_id);
  if (jobId) await refreshIngestionJobStatus(jobId);
  return record;
}

export async function publishIngestionItem(itemId: number, userId: number): Promise<unknown | null> {
  const item = await one<{
    id: string;
    job_id: string;
    normalized_article: Record<string, unknown>;
    status: string;
    published_article_id: string | null;
  }>(
    `
      select id, job_id, normalized_article, status, published_article_id
      from current_affairs.ingestion_items
      where id = $1
    `,
    [itemId]
  );

  if (!item) return null;
  if (item.status === "published" && item.published_article_id) return item;
  if (item.status !== "approved") {
    const error = new Error("Ingestion item must be approved before publishing.") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  const parsed = createMasterArticleSchema.safeParse(item.normalized_article);
  if (!parsed.success) {
    const record = await updateIngestionItem(itemId, {
      validation_errors: parsed.error.issues
    });
    const error = new Error("Normalized article is not valid for publishing.") as Error & { statusCode?: number };
    error.statusCode = 400;
    if (!record) throw error;
    throw error;
  }

  const article = await createMasterArticle(parsed.data, userId);
  const articleId = Number((article as { id?: unknown } | null)?.id);
  if (!articleId) throw new Error("Current affairs article publishing failed.");

  const published = await one(
    `
      update current_affairs.ingestion_items
      set
        status = 'published',
        published_article_id = $2,
        updated_at = now()
      where id = $1
      returning *
    `,
    [itemId, articleId]
  );

  await refreshIngestionJobStatus(Number(item.job_id));
  return published;
}

export async function processIngestionJobAI(jobId: number, userId: number): Promise<void> {
  try {
    const items = await query<{ id: string; raw_payload: any }>(
      `select id, raw_payload from current_affairs.ingestion_items where job_id = $1`,
      [jobId]
    );

    const job = await one<{ default_content_kind: string; default_category_node_id?: number }>(
      `select default_content_kind, default_category_node_id from current_affairs.ingestion_jobs where id = $1`,
      [jobId]
    );

    const defaultContentKind = job?.default_content_kind || "daily_current_affairs";
    const defaultCategoryNodeId = job?.default_category_node_id ? Number(job.default_category_node_id) : undefined;

    const contentTypeMap: Record<string, string> = {
      prelims_pyq: "prelims_pyq",
      mains_pyq: "mains_pyq",
      daily_current_affairs: "prelims_ca",
      daily_editorial_summary: "mains_ca",
      mains_topic_note: "mains_ca"
    };

    const contentType = contentTypeMap[defaultContentKind] || "prelims_ca";
    const isVertexAi = !!(
      process.env.GOOGLE_CLOUD_KEY_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.VERTEX_AI_PROJECT_ID
    );
    const aiProvider = isVertexAi ? "vertex" : (process.env.GEMINI_API_KEY ? "gemini" : "openai");
    const aiModel = isVertexAi ? "gemini-2.5-flash" : (process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "gpt-4o-mini");

    for (const item of items) {
      const payload = item.raw_payload;
      const topicText = payload.body || payload.title || "";
      if (!topicText.trim()) continue;

      try {
        console.log(`[Ingestion-AI] Parsing item ID ${item.id} with topic length ${topicText.length}`);
        
        const result = await generateContentAffairsAI({
          contentType: contentType as any,
          topics: [topicText],
          aiProvider,
          aiModel,
          subjectId: payload.category_node_id ? Number(payload.category_node_id) : defaultCategoryNodeId
        });

        const generated = result?.articles?.[0];
        if (generated) {
          const publicationDate = generated.news_date || payload.publication_date || new Date().toISOString().slice(0, 10);
          
          let body = generated.content || "";
          if (generated.sections && Array.isArray(generated.sections)) {
            body = generated.sections
              .map((sec: any) => `<h2>${sec.section_title}</h2>\n${sec.content}`)
              .join("\n\n");
          }

          const normalized: CreateMasterArticleInput = {
            content_family: ['daily_current_affairs', 'prelims_pyq'].includes(defaultContentKind) ? "prelims" : "mains",
            content_kind: defaultContentKind as any,
            title: generated.title || payload.title || "Untitled AI Ingested Article",
            slug: generated.slug || `${slugify(generated.title || payload.title || "article")}-${publicationDate}`,
            body: body || payload.body || "",
            category_node_id: generated.category_node_id || defaultCategoryNodeId || null,
            source_name: payload.source_name || "AI Ingestion",
            source_url: payload.source_url || undefined,
            publication_date: publicationDate,
            institute_tags: generated.meta_keywords ? generated.meta_keywords.split(",").map((k: string) => k.trim()) : (payload.institute_tags || []),
            status: "draft",
            is_ai_generated: true,
            seo_title: generated.title,
            seo_description: generated.meta_description || generated.excerpt || "",
            canonical_url: payload.source_url || undefined,
            keywords: generated.meta_keywords ? generated.meta_keywords.split(",").map((k: string) => k.trim()) : []
          };

          await one(
            `
              update current_affairs.ingestion_items
              set
                normalized_article = $2,
                status = 'approved',
                validation_errors = '[]'::jsonb,
                updated_at = now()
              where id = $1
              returning *
            `,
            [item.id, JSON.stringify(normalized)]
          );
          
          console.log(`[Ingestion-AI] Successfully parsed and approved item ID ${item.id}`);
        } else {
          throw new Error("No article returned from generation.");
        }
      } catch (err: any) {
        console.error(`[Ingestion-AI] Failed to parse item ID ${item.id}:`, err);
        await one(
          `
            update current_affairs.ingestion_items
            set
              validation_errors = $2,
              status = 'pending_review',
              updated_at = now()
            where id = $1
          `,
          [item.id, JSON.stringify([{ message: err.message || String(err) }])]
        );
      }
    }

    await refreshIngestionJobStatus(jobId);
    console.log(`[Ingestion-AI] Finished parsing ingestion job ID ${jobId}`);
  } catch (err) {
    console.error(`[Ingestion-AI] Job processing failed for job ID ${jobId}:`, err);
  }
}
