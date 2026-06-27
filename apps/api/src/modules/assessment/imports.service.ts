import { addCondition } from "../../common/sql.js";
import { one, query, transaction } from "../../db.js";
import type {
  CreateImportBatchInput,
  ListImportBatchesQuery,
  PublishImportItemInput,
  UpdateImportItemInput
} from "./imports.schemas.js";
import { createQuestionSchema } from "./schemas.js";
import { createQuestion } from "./questions.service.js";

export async function createImportBatch(input: CreateImportBatchInput, userId: number): Promise<unknown | null> {
  const batchId = await transaction(async (client) => {
    const batch = await client.query<{ id: number }>(
      `
        insert into assessment.question_import_batches
          (created_by_user_id, source_filename, source_file_url, parser_kind, status)
        values ($1, $2, $3, $4, 'parsed')
        returning id
      `,
      [
        userId,
        input.source_filename ?? null,
        input.source_file_url ?? null,
        input.parser_kind
      ]
    );

    const id = batch.rows[0]?.id;
    if (!id) throw new Error("Import batch creation failed.");

    for (const item of input.items) {
      await client.query(
        `
          insert into assessment.question_import_items
            (batch_id, raw_payload, normalized_payload)
          values ($1, $2, $2)
        `,
        [id, JSON.stringify(item)]
      );
    }

    return id;
  });

  return getImportBatch(batchId);
}

export async function listImportBatches(options: ListImportBatchesQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (options.status) addCondition(conditions, params, "qib.status = ?", options.status);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        qib.*,
        count(qii.id)::integer as item_count,
        count(qii.id) filter (where qii.status = 'approved')::integer as approved_count,
        count(qii.id) filter (where qii.status = 'published')::integer as published_count
      from assessment.question_import_batches qib
      left join assessment.question_import_items qii on qii.batch_id = qib.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by qib.id
      order by qib.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function getImportBatch(batchId: number): Promise<unknown | null> {
  return one(
    `
      select
        qib.*,
        coalesce(jsonb_agg(to_jsonb(qii.*) order by qii.id) filter (where qii.id is not null), '[]'::jsonb) as items
      from assessment.question_import_batches qib
      left join assessment.question_import_items qii on qii.batch_id = qib.id
      where qib.id = $1
      group by qib.id
    `,
    [batchId]
  );
}

export async function updateImportItem(itemId: number, input: UpdateImportItemInput): Promise<unknown> {
  return one(
    `
      update assessment.question_import_items
      set
        normalized_payload = coalesce($2, normalized_payload),
        status = coalesce($3, status),
        validation_errors = coalesce($4, validation_errors),
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      itemId,
      input.normalized_payload ? JSON.stringify(input.normalized_payload) : null,
      input.status ?? null,
      input.validation_errors ? JSON.stringify(input.validation_errors) : null
    ]
  );
}

function mergeCreator(payload: Record<string, unknown>, userId: number): Record<string, unknown> {
  const version = payload.version;
  const versionPayload =
    version && typeof version === "object" && !Array.isArray(version)
      ? { ...(version as Record<string, unknown>), created_by_user_id: (version as Record<string, unknown>).created_by_user_id ?? userId }
      : version;

  return {
    ...payload,
    created_by_user_id: payload.created_by_user_id ?? userId,
    version: versionPayload
  };
}

async function refreshImportBatchStatus(batchId: number): Promise<void> {
  const counts = await one<{
    total_count: string;
    pending_count: string;
    published_count: string;
    rejected_count: string;
  }>(
    `
      select
        count(*)::text as total_count,
        count(*) filter (where status in ('pending_review', 'approved'))::text as pending_count,
        count(*) filter (where status = 'published')::text as published_count,
        count(*) filter (where status = 'rejected')::text as rejected_count
      from assessment.question_import_items
      where batch_id = $1
    `,
    [batchId]
  );

  const total = Number(counts?.total_count ?? 0);
  const pending = Number(counts?.pending_count ?? 0);
  const published = Number(counts?.published_count ?? 0);
  const nextStatus = total > 0 && published === total
    ? "published"
    : pending === 0
      ? "reviewed"
      : "parsed";

  await query(
    `
      update assessment.question_import_batches
      set status = $2, updated_at = now()
      where id = $1
    `,
    [batchId, nextStatus]
  );
}

export async function publishImportItem(
  itemId: number,
  input: PublishImportItemInput,
  userId: number
): Promise<unknown | null> {
  const item = await one<{
    id: string;
    batch_id: string;
    normalized_payload: Record<string, unknown>;
    status: string;
    published_question_id: string | null;
  }>(
    `
      select id, batch_id, normalized_payload, status, published_question_id
      from assessment.question_import_items
      where id = $1
    `,
    [itemId]
  );

  if (!item) return null;

  if (item.status === "published" && item.published_question_id) {
    return updateImportItem(itemId, { status: "published" });
  }

  if (item.status !== "approved") {
    const error = new Error("Import item must be approved before publishing.") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  let questionId = input.question_id;
  if (!questionId) {
    const parsed = createQuestionSchema.safeParse(mergeCreator(item.normalized_payload, userId));
    if (!parsed.success) {
      const error = new Error("Normalized payload is not a valid question payload.") as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const question = await createQuestion(parsed.data);
    questionId = Number((question as { id?: unknown } | null)?.id);
    if (!questionId) {
      throw new Error("Question publishing failed.");
    }
  }

  const published = await one(
    `
      update assessment.question_import_items
      set
        status = 'published',
        published_question_id = $2,
        updated_at = now()
      where id = $1
      returning *
    `,
    [itemId, questionId]
  );

  await refreshImportBatchStatus(Number(item.batch_id));
  return published;
}
