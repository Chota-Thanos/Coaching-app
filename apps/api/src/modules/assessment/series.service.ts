import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query } from "../../db.js";
import type {
  AddTestSeriesItemInput,
  CreateTestSeriesInput,
  ListTestSeriesQuery,
  UpdateTestSeriesInput,
  UpdateTestSeriesItemInput
} from "./series.schemas.js";

export async function listTestSeries(options: ListTestSeriesQuery): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) addCondition(conditions, params, "ts.exam_id = ?", options.exam_id);
  if (options.status) addCondition(conditions, params, "ts.status = ?", options.status);
  if (options.access_type) addCondition(conditions, params, "ts.access_type = ?", options.access_type);

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select
        ts.*,
        coalesce(count(tsi.id), 0)::integer as item_count
      from assessment.test_series ts
      left join assessment.test_series_items tsi on tsi.test_series_id = ts.id
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      group by ts.id
      order by ts.created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createTestSeries(input: CreateTestSeriesInput, userId: number): Promise<unknown> {
  return one(
    `
      insert into assessment.test_series
        (title, slug, description, exam_id, cover_image_url, access_type, subscription_plan_id, status, created_by_user_id, published_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *
    `,
    [
      input.title,
      input.slug,
      input.description ?? null,
      input.exam_id,
      input.cover_image_url ?? null,
      input.access_type,
      input.subscription_plan_id ?? null,
      input.status,
      userId,
      input.published_at ?? null
    ]
  );
}

export async function updateTestSeries(id: number, input: UpdateTestSeriesInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "title", input.title);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "exam_id", input.exam_id);
  addUpdate(updates, params, "cover_image_url", input.cover_image_url);
  addUpdate(updates, params, "access_type", input.access_type);
  addUpdate(updates, params, "subscription_plan_id", input.subscription_plan_id);
  addUpdate(updates, params, "status", input.status);
  addUpdate(updates, params, "published_at", input.published_at);

  if (input.status === "published" && input.published_at === undefined) {
    addUpdate(updates, params, "published_at", new Date());
  }

  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.test_series
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function getTestSeries(id: number): Promise<unknown | null> {
  return one(
    `
      select
        ts.*,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', tsi.id,
              'test_template_id', tsi.test_template_id,
              'display_order', tsi.display_order,
              'scheduled_at', tsi.scheduled_at,
              'unlock_at', tsi.unlock_at,
              'test_template', to_jsonb(tt.*)
            )
            order by tsi.display_order
          ) filter (where tsi.id is not null),
          '[]'::jsonb
        ) as items
      from assessment.test_series ts
      left join assessment.test_series_items tsi on tsi.test_series_id = ts.id
      left join assessment.test_templates tt on tt.id = tsi.test_template_id
      where ts.id = $1
      group by ts.id
    `,
    [id]
  );
}

export async function addTestSeriesItem(seriesId: number, input: AddTestSeriesItemInput): Promise<unknown> {
  return one(
    `
      insert into assessment.test_series_items
        (test_series_id, test_template_id, display_order, scheduled_at, unlock_at)
      values ($1, $2, coalesce($3, 0), $4, $5)
      returning *
    `,
    [
      seriesId,
      input.test_template_id,
      input.display_order ?? null,
      input.scheduled_at ?? null,
      input.unlock_at ?? null
    ]
  );
}

export async function updateTestSeriesItem(id: number, input: UpdateTestSeriesItemInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "scheduled_at", input.scheduled_at);
  addUpdate(updates, params, "unlock_at", input.unlock_at);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.test_series_items
      set ${updates.join(", ")}
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteTestSeriesItem(id: number): Promise<unknown | null> {
  return one(
    `
      delete from assessment.test_series_items
      where id = $1
      returning *
    `,
    [id]
  );
}
