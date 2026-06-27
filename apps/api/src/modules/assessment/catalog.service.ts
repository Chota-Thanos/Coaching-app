import { one, query, transaction } from "../../db.js";
import type { PoolClient } from "pg";
import type {
  CreateExamInput,
  CreateExamLevelInput,
  CreateQuestionFormatInput,
  CreateQuestionNatureInput,
  CreateTaxonomyNodeInput,
  UpdateExamInput,
  UpdateExamLevelInput,
  UpdateQuestionFormatInput,
  UpdateQuestionNatureInput,
  UpdateTaxonomyNodeInput
} from "./schemas.js";
import { addCondition, addUpdate, requireUpdates, type ListOptions } from "../../common/sql.js";

type TaxonomySubtreeRow = {
  id: string;
  depth: number;
};

async function getObjectiveTaxonomySubtree(client: PoolClient, id: number): Promise<TaxonomySubtreeRow[]> {
  const result = await client.query<TaxonomySubtreeRow>(
    `
      with recursive subtree(id, depth, path) as (
        select id, 0, array[id]
        from assessment.assessment_taxonomy_nodes
        where id = $1

        union all

        select child.id, subtree.depth + 1, subtree.path || child.id
        from assessment.assessment_taxonomy_nodes child
        join subtree on child.parent_id = subtree.id
        where not child.id = any(subtree.path)
      )
      select id::text as id, depth
      from subtree
      order by depth desc, id desc
    `,
    [id]
  );
  return result.rows;
}

async function getObjectiveTaxonomyRowsForExam(client: PoolClient, examId: number): Promise<TaxonomySubtreeRow[]> {
  const result = await client.query<TaxonomySubtreeRow>(
    `
      with recursive tree(id, depth, path) as (
        select id, 0, array[id]
        from assessment.assessment_taxonomy_nodes
        where exam_id = $1
          and parent_id is null

        union all

        select child.id, tree.depth + 1, tree.path || child.id
        from assessment.assessment_taxonomy_nodes child
        join tree on child.parent_id = tree.id
        where child.exam_id = $1
          and not child.id = any(tree.path)
      )
      select nodes.id::text as id, coalesce(max(tree.depth), 0) as depth
      from assessment.assessment_taxonomy_nodes nodes
      left join tree on tree.id = nodes.id
      where nodes.exam_id = $1
      group by nodes.id
      order by depth desc, nodes.id desc
    `,
    [examId]
  );
  return result.rows;
}

async function detachObjectiveTaxonomyLinks(client: PoolClient, nodeIds: number[]): Promise<void> {
  if (nodeIds.length === 0) return;

  await client.query(
    `
      delete from assessment.question_taxonomy_links
      where subject_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );

  await client.query(
    `
      update assessment.question_taxonomy_links
      set
        source_node_id = case when source_node_id = any($1::bigint[]) then null else source_node_id end,
        topic_node_id = case when topic_node_id = any($1::bigint[]) then null else topic_node_id end,
        subtopic_node_id = case when subtopic_node_id = any($1::bigint[]) then null else subtopic_node_id end
      where
        source_node_id = any($1::bigint[])
        or topic_node_id = any($1::bigint[])
        or subtopic_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );

  await client.query(
    `
      update assessment.result_topic_breakdowns
      set taxonomy_node_id = null
      where taxonomy_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );

  await client.query(
    `
      update study_plan.plans
      set subject_node_id = null
      where subject_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );

  await client.query(
    `
      update study_plan.test_questions
      set
        subject_node_id = case when subject_node_id = any($1::bigint[]) then null else subject_node_id end,
        topic_node_id = case when topic_node_id = any($1::bigint[]) then null else topic_node_id end,
        subtopic_node_id = case when subtopic_node_id = any($1::bigint[]) then null else subtopic_node_id end
      where
        subject_node_id = any($1::bigint[])
        or topic_node_id = any($1::bigint[])
        or subtopic_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );

  await client.query(
    `
      update study_plan.result_topic_breakdowns
      set taxonomy_node_id = null
      where taxonomy_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );
}

async function deleteObjectiveTaxonomyRows(client: PoolClient, rows: TaxonomySubtreeRow[]): Promise<number> {
  let deletedCount = 0;
  for (const row of rows) {
    const deleted = await client.query(
      `
        delete from assessment.assessment_taxonomy_nodes
        where id = $1
      `,
      [row.id]
    );
    deletedCount += deleted.rowCount ?? 0;
  }
  return deletedCount;
}

async function getMainsTaxonomySubtree(client: PoolClient, id: number): Promise<TaxonomySubtreeRow[]> {
  const result = await client.query<TaxonomySubtreeRow>(
    `
      with recursive subtree(id, depth, path) as (
        select id, 0, array[id]
        from assessment.mains_taxonomy_nodes
        where id = $1

        union all

        select child.id, subtree.depth + 1, subtree.path || child.id
        from assessment.mains_taxonomy_nodes child
        join subtree on child.parent_id = subtree.id
        where not child.id = any(subtree.path)
      )
      select id::text as id, depth
      from subtree
      order by depth desc, id desc
    `,
    [id]
  );
  return result.rows;
}

async function getMainsTaxonomyRowsForExam(client: PoolClient, examId: number): Promise<TaxonomySubtreeRow[]> {
  const result = await client.query<TaxonomySubtreeRow>(
    `
      with recursive tree(id, depth, path) as (
        select id, 0, array[id]
        from assessment.mains_taxonomy_nodes
        where exam_id = $1
          and parent_id is null

        union all

        select child.id, tree.depth + 1, tree.path || child.id
        from assessment.mains_taxonomy_nodes child
        join tree on child.parent_id = tree.id
        where child.exam_id = $1
          and not child.id = any(tree.path)
      )
      select nodes.id::text as id, coalesce(max(tree.depth), 0) as depth
      from assessment.mains_taxonomy_nodes nodes
      left join tree on tree.id = nodes.id
      where nodes.exam_id = $1
      group by nodes.id
      order by depth desc, nodes.id desc
    `,
    [examId]
  );
  return result.rows;
}

async function detachMainsTaxonomyLinks(client: PoolClient, nodeIds: number[]): Promise<void> {
  if (nodeIds.length === 0) return;

  await client.query(
    `
      update assessment.mains_question_taxonomy_links
      set
        paper_node_id = case when paper_node_id = any($1::bigint[]) then null else paper_node_id end,
        subject_area_node_id = case when subject_area_node_id = any($1::bigint[]) then null else subject_area_node_id end,
        theme_node_id = case when theme_node_id = any($1::bigint[]) then null else theme_node_id end,
        topic_node_id = case when topic_node_id = any($1::bigint[]) then null else topic_node_id end,
        subtopic_node_id = case when subtopic_node_id = any($1::bigint[]) then null else subtopic_node_id end
      where
        paper_node_id = any($1::bigint[])
        or subject_area_node_id = any($1::bigint[])
        or theme_node_id = any($1::bigint[])
        or topic_node_id = any($1::bigint[])
        or subtopic_node_id = any($1::bigint[])
    `,
    [nodeIds]
  );
}

async function deleteMainsTaxonomyRows(client: PoolClient, rows: TaxonomySubtreeRow[]): Promise<number> {
  let deletedCount = 0;
  for (const row of rows) {
    const deleted = await client.query(
      `
        delete from assessment.mains_taxonomy_nodes
        where id = $1
      `,
      [row.id]
    );
    deletedCount += deleted.rowCount ?? 0;
  }
  return deletedCount;
}

export async function listExams(options: ListOptions): Promise<unknown[]> {
  return query(
    `
      select *
      from assessment.exams
      order by is_active desc, name asc
      limit $1 offset $2
    `,
    [options.limit, options.offset]
  );
}

export async function createExam(input: CreateExamInput): Promise<unknown> {
  return one(
    `
      insert into assessment.exams (name, slug, description, is_active)
      values ($1, $2, $3, coalesce($4, true))
      returning *
    `,
    [input.name, input.slug, input.description ?? null, input.is_active ?? null]
  );
}

export async function updateExam(id: number, input: UpdateExamInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.exams
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteExam(id: number): Promise<boolean> {
  return transaction(async (client) => {
    const existing = await client.query(
      `
        select id
        from assessment.exams
        where id = $1
        for update
      `,
      [id]
    );
    if ((existing.rowCount ?? 0) === 0) return false;

    const templates = await client.query<{ id: string }>(
      `
        select id::text as id
        from assessment.test_templates
        where exam_id = $1
      `,
      [id]
    );
    const templateIds = templates.rows.map((row) => Number(row.id));

    if (templateIds.length > 0) {
      await client.query(
        `
          delete from assessment.test_series_items
          where test_template_id = any($1::bigint[])
        `,
        [templateIds]
      );
    }

    await client.query("delete from assessment.test_series where exam_id = $1", [id]);

    if (templateIds.length > 0) {
      await client.query(
        `
          delete from assessment.test_attempts
          where test_template_id = any($1::bigint[])
        `,
        [templateIds]
      );

      await client.query(
        `
          delete from assessment.test_question_items
          where test_template_id = any($1::bigint[])
        `,
        [templateIds]
      );

      await client.query(
        `
          delete from assessment.test_sections
          where test_template_id = any($1::bigint[])
        `,
        [templateIds]
      );

      await client.query(
        `
          delete from assessment.test_templates
          where id = any($1::bigint[])
        `,
        [templateIds]
      );
    }

    await client.query("delete from assessment.question_taxonomy_links where exam_id = $1", [id]);
    await client.query("delete from assessment.mains_question_taxonomy_links where exam_id = $1", [id]);

    const studyTests = await client.query<{ id: string }>(
      `
        select id::text as id
        from study_plan.test_templates
        where exam_id = $1
      `,
      [id]
    );
    const studyTestIds = studyTests.rows.map((row) => Number(row.id));

    if (studyTestIds.length > 0) {
      await client.query(
        `
          delete from study_plan.test_attempts
          where test_template_id = any($1::bigint[])
        `,
        [studyTestIds]
      );

      await client.query(
        `
          delete from study_plan.test_questions
          where test_template_id = any($1::bigint[])
        `,
        [studyTestIds]
      );
    }

    await client.query("delete from study_plan.plans where exam_id = $1", [id]);

    if (studyTestIds.length > 0) {
      await client.query(
        `
          delete from study_plan.test_templates
          where id = any($1::bigint[])
        `,
        [studyTestIds]
      );
    }

    await client.query(
      `
        update assessment.result_topic_breakdowns
        set question_nature_id = null
        where question_nature_id in (
          select id
          from assessment.question_natures
          where exam_id = $1
        )
      `,
      [id]
    );

    const objectiveRows = await getObjectiveTaxonomyRowsForExam(client, id);
    await detachObjectiveTaxonomyLinks(client, objectiveRows.map((row) => Number(row.id)));
    await deleteObjectiveTaxonomyRows(client, objectiveRows);

    const mainsRows = await getMainsTaxonomyRowsForExam(client, id);
    await detachMainsTaxonomyLinks(client, mainsRows.map((row) => Number(row.id)));
    await deleteMainsTaxonomyRows(client, mainsRows);

    await client.query("delete from assessment.question_natures where exam_id = $1", [id]);
    await client.query("delete from assessment.exam_levels where exam_id = $1", [id]);

    const deleted = await client.query(
      `
        delete from assessment.exams
        where id = $1
        returning id
      `,
      [id]
    );
    return (deleted.rowCount ?? 0) > 0;
  });
}

export async function listExamLevels(examId: number, options: ListOptions): Promise<unknown[]> {
  return query(
    `
      select *
      from assessment.exam_levels
      where exam_id = $1
      order by display_order asc, name asc
      limit $2 offset $3
    `,
    [examId, options.limit, options.offset]
  );
}

export async function createExamLevel(examId: number, input: CreateExamLevelInput): Promise<unknown> {
  return one(
    `
      insert into assessment.exam_levels (exam_id, name, slug, display_order, is_active)
      values ($1, $2, $3, coalesce($4, 0), coalesce($5, true))
      returning *
    `,
    [examId, input.name, input.slug, input.display_order ?? null, input.is_active ?? null]
  );
}

export async function updateExamLevel(id: number, input: UpdateExamLevelInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.exam_levels
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function listQuestionFormats(
  options: ListOptions & { question_family?: string }
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.question_family) {
    addCondition(conditions, params, "question_family = ?", options.question_family);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from assessment.question_formats
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by question_family asc, display_order asc, name asc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createQuestionFormat(input: CreateQuestionFormatInput): Promise<unknown> {
  return one(
    `
      insert into assessment.question_formats
        (question_family, name, slug, description, display_order, is_active)
      values ($1, $2, $3, $4, coalesce($5, 0), coalesce($6, true))
      returning *
    `,
    [
      input.question_family,
      input.name,
      input.slug,
      input.description ?? null,
      input.display_order ?? null,
      input.is_active ?? null
    ]
  );
}

export async function updateQuestionFormat(id: number, input: UpdateQuestionFormatInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.question_formats
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function listTaxonomyNodes(
  options: ListOptions & {
    exam_id?: number;
    parent_id?: number;
    root_only?: boolean;
    node_type?: string;
    content_type?: string;
  }
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) {
    addCondition(conditions, params, "exam_id = ?", options.exam_id);
  }
  if (options.parent_id) {
    addCondition(conditions, params, "parent_id = ?", options.parent_id);
  }
  if (options.root_only) {
    conditions.push("parent_id is null");
  }
  if (options.node_type) {
    addCondition(conditions, params, "node_type = ?", options.node_type);
  }
  if (options.content_type) {
    addCondition(conditions, params, "content_type = ?", options.content_type);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from assessment.assessment_taxonomy_nodes
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by display_order asc, name asc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createTaxonomyNode(input: CreateTaxonomyNodeInput): Promise<unknown> {
  return one(
    `
      insert into assessment.assessment_taxonomy_nodes
        (exam_id, parent_id, node_type, name, slug, description, image_url, display_order, is_active, content_type)
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 0), coalesce($9, true), coalesce($10, 'gk'))
      returning *
    `,
    [
      input.exam_id,
      input.parent_id ?? null,
      input.node_type,
      input.name,
      input.slug,
      input.description ?? null,
      input.image_url ?? null,
      input.display_order ?? null,
      input.is_active ?? null,
      input.content_type ?? null
    ]
  );
}

export async function updateTaxonomyNode(id: number, input: UpdateTaxonomyNodeInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "parent_id", input.parent_id);
  addUpdate(updates, params, "node_type", input.node_type);
  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "image_url", input.image_url);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  addUpdate(updates, params, "content_type", input.content_type);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.assessment_taxonomy_nodes
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteTaxonomyNode(id: number): Promise<boolean> {
  return transaction(async (client) => {
    const subtree = await getObjectiveTaxonomySubtree(client, id);
    if (subtree.length === 0) return false;

    await detachObjectiveTaxonomyLinks(client, subtree.map((row) => Number(row.id)));
    const deletedCount = await deleteObjectiveTaxonomyRows(client, subtree);
    return deletedCount > 0;
  });
}

export async function listQuestionNatures(
  options: ListOptions & { exam_id?: number }
): Promise<unknown[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.exam_id) {
    addCondition(conditions, params, "exam_id = ?", options.exam_id);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query(
    `
      select *
      from assessment.question_natures
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by display_order asc, name asc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function createQuestionNature(input: CreateQuestionNatureInput): Promise<unknown> {
  return one(
    `
      insert into assessment.question_natures
        (exam_id, name, slug, description, display_order, is_active)
      values ($1, $2, $3, $4, coalesce($5, 0), coalesce($6, true))
      returning *
    `,
    [
      input.exam_id,
      input.name,
      input.slug,
      input.description ?? null,
      input.display_order ?? null,
      input.is_active ?? null
    ]
  );
}

export async function updateQuestionNature(id: number, input: UpdateQuestionNatureInput): Promise<unknown | null> {
  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "name", input.name);
  addUpdate(updates, params, "slug", input.slug);
  addUpdate(updates, params, "description", input.description);
  addUpdate(updates, params, "display_order", input.display_order);
  addUpdate(updates, params, "is_active", input.is_active);
  requireUpdates(updates);

  params.push(id);
  return one(
    `
      update assessment.question_natures
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function deleteExamLevel(id: number): Promise<boolean> {
  return transaction(async (client) => {
    const studyTests = await client.query<{ id: string }>(
      `
        select id::text as id
        from study_plan.test_templates
        where exam_level_id = $1
      `,
      [id]
    );
    const studyTestIds = studyTests.rows.map((row) => Number(row.id));

    if (studyTestIds.length > 0) {
      await client.query(
        `
          delete from study_plan.test_attempts
          where test_template_id = any($1::bigint[])
        `,
        [studyTestIds]
      );

      await client.query(
        `
          delete from study_plan.test_questions
          where test_template_id = any($1::bigint[])
        `,
        [studyTestIds]
      );

      await client.query(
        `
          delete from study_plan.test_templates
          where id = any($1::bigint[])
        `,
        [studyTestIds]
      );
    }

    const deleted = await client.query(
      `
        delete from assessment.exam_levels
        where id = $1
        returning id
      `,
      [id]
    );
    return (deleted.rowCount ?? 0) > 0;
  });
}

export async function deleteQuestionNature(id: number): Promise<boolean> {
  return transaction(async (client) => {
    await client.query(
      `
        update assessment.question_taxonomy_links
        set question_nature_id = null
        where question_nature_id = $1
      `,
      [id]
    );

    await client.query(
      `
        update assessment.result_topic_breakdowns
        set question_nature_id = null
        where question_nature_id = $1
      `,
      [id]
    );

    await client.query(
      `
        update study_plan.test_questions
        set question_nature_id = null
        where question_nature_id = $1
      `,
      [id]
    );

    await client.query(
      `
        update study_plan.result_topic_breakdowns
        set question_nature_id = null
        where question_nature_id = $1
      `,
      [id]
    );

    const deleted = await client.query(
      `
        delete from assessment.question_natures
        where id = $1
        returning id
      `,
      [id]
    );
    return (deleted.rowCount ?? 0) > 0;
  });
}
