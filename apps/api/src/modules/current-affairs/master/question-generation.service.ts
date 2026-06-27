import { one, query, transaction } from "../../../db.js";
import type { GenerateAssessmentQuestionsInput } from "../schemas.js";

function excerpt(value: string, maxLength = 700): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength).trim()}...`;
}

function buildQuestionPayload(
  article: { id: string; title: string; body: string; publication_date: string | null },
  input: GenerateAssessmentQuestionsInput,
  index: number
): Record<string, unknown> {
  const promptPrefix = input.instructions ? `${input.instructions}\n\n` : "";
  return {
    question_family: "objective",
    question_format_id: input.question_format_id,
    status: "draft",
    is_ai_generated: true,
    version: {
      question_statement: `${promptPrefix}Current affairs source: ${article.title}\n\n${excerpt(article.body)}`,
      question_prompt: `Draft question ${index + 1}: Which statement is best supported by the current affairs note above?`,
      options: [
        { key: "A", text: "The statement is directly supported by the source note." },
        { key: "B", text: "The statement contradicts the source note." },
        { key: "C", text: "The statement is unrelated to the source note." },
        { key: "D", text: "The statement cannot be evaluated from the source note." }
      ],
      correct_answer: { key: "A" },
      explanation: `Review this AI-generated draft against the source article "${article.title}" before publishing.`,
      content_json: {
        source: "current_affairs",
        current_affairs_article_id: Number(article.id),
        draft_index: index + 1
      }
    },
    taxonomy: input.taxonomy
  };
}

export async function generateAssessmentQuestionsFromArticle(
  articleId: number,
  input: GenerateAssessmentQuestionsInput,
  userId: number
): Promise<unknown | null> {
  const article = await one<{
    id: string;
    title: string;
    body: string;
    publication_date: string | null;
  }>(
    `
      select id, title, body, publication_date
      from current_affairs.master_articles
      where id = $1
    `,
    [articleId]
  );

  if (!article) return null;

  const payloads = Array.from({ length: input.question_count }, (_, index) =>
    buildQuestionPayload(article, input, index)
  );

  const result = await transaction(async (client) => {
    const batch = await client.query<{ id: number }>(
      `
        insert into assessment.question_import_batches
          (created_by_user_id, source_filename, source_file_url, parser_kind, status)
        values ($1, $2, $3, 'current_affairs_generation', 'parsed')
        returning id
      `,
      [
        userId,
        `current-affairs-article-${article.id}.json`,
        null
      ]
    );

    const batchId = batch.rows[0]?.id;
    if (!batchId) throw new Error("Assessment import batch creation failed.");

    for (const payload of payloads) {
      await client.query(
        `
          insert into assessment.question_import_items
            (batch_id, raw_payload, normalized_payload)
          values ($1, $2, $2)
        `,
        [batchId, JSON.stringify(payload)]
      );
    }

    const job = await client.query<{ id: number }>(
      `
        insert into current_affairs.question_generation_jobs
          (
            article_id,
            requested_by_user_id,
            assessment_import_batch_id,
            status,
            generation_mode,
            question_count,
            request_payload
          )
        values ($1, $2, $3, 'generated', 'draft_from_article', $4, $5)
        returning id
      `,
      [
        articleId,
        userId,
        batchId,
        payloads.length,
        JSON.stringify(input)
      ]
    );

    return { job_id: job.rows[0]?.id, assessment_import_batch_id: batchId };
  });

  const [job, batch] = await Promise.all([
    one(
      `
        select *
        from current_affairs.question_generation_jobs
        where id = $1
      `,
      [result.job_id]
    ),
    one(
      `
        select
          qib.*,
          coalesce(jsonb_agg(to_jsonb(qii.*) order by qii.id) filter (where qii.id is not null), '[]'::jsonb) as items
        from assessment.question_import_batches qib
        left join assessment.question_import_items qii on qii.batch_id = qib.id
        where qib.id = $1
        group by qib.id
      `,
      [result.assessment_import_batch_id]
    )
  ]);

  return { job, assessment_import_batch: batch };
}

export async function listQuestionGenerationJobs(articleId: number): Promise<unknown[]> {
  return query(
    `
      select *
      from current_affairs.question_generation_jobs
      where article_id = $1
      order by created_at desc
    `,
    [articleId]
  );
}
