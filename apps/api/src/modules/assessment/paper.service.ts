import { one, query } from "../../db.js";
import type { UserRole } from "../auth/schemas.js";
import type { AttemptIdentity } from "./attempts.service.js";
import { buildPerformanceTree, type LeafMetricInput, type TaxonomyNodeInput } from "./taxonomy-rollup.js";

type AssessmentUser = { id: number; role: UserRole };

function canInspectAttempts(role: UserRole): boolean {
  return role === "admin" || role === "moderator";
}

function publicPaperStatusSql(includeUnpublished: boolean): string {
  return includeUnpublished ? "" : "and tt.status = 'published'";
}

const paperSectionsSql = `
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', ts.id,
        'title', ts.title,
        'display_order', ts.display_order,
        'duration_minutes', ts.duration_minutes,
        'instructions', ts.instructions
      )
      order by ts.display_order, ts.id
    )
    from assessment.test_sections ts
    where ts.test_template_id = tt.id
  ), '[]'::jsonb) as sections
`;

const sanitizedPaperQuestionsSql = `
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', tqi.id,
        'test_section_id', tqi.test_section_id,
        'question_version_id', tqi.question_version_id,
        'marks', tqi.marks,
        'negative_marks', tqi.negative_marks,
        'display_order', tqi.display_order,
        'question_format', to_jsonb(qf.*),
        'question_version', jsonb_build_object(
          'id', qv.id,
          'question_id', qv.question_id,
          'question_statement', qv.question_statement,
          'supplementary_statement', qv.supplementary_statement,
          'statements_facts', qv.statements_facts,
          'question_prompt', qv.question_prompt,
          'options', qv.options,
          'content_json', qv.content_json,
          'created_by_user_id', q.created_by_user_id,
          'is_ai_generated', q.is_ai_generated
        ),
        'taxonomy', coalesce(tax.taxonomy, '[]'::jsonb),
        'passage', passage.passage
      )
      order by coalesce(ts.display_order, 0), tqi.display_order, tqi.id
    )
    from assessment.test_question_items tqi
    left join assessment.test_sections ts on ts.id = tqi.test_section_id
    join assessment.question_versions qv on qv.id = tqi.question_version_id
    join assessment.questions q on q.id = qv.question_id
    join assessment.question_formats qf on qf.id = q.question_format_id
    left join lateral (
      select row_to_json(p.*)::jsonb as passage
      from assessment.passage_questions pq
      join assessment.passages p on p.id = pq.passage_id
      where pq.question_id = q.id
      order by pq.display_order, pq.id
      limit 1
    ) passage on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'exam_id', qtl.exam_id,
          'exam_level_id', qtl.exam_level_id,
          'subject_node_id', qtl.subject_node_id,
          'subject_name', subject.name,
          'topic_node_id', qtl.topic_node_id,
          'topic_name', topic.name,
          'subtopic_node_id', qtl.subtopic_node_id,
          'subtopic_name', subtopic.name,
          'question_nature_id', qtl.question_nature_id,
          'question_nature_name', qn.name
        )
      ) as taxonomy
      from assessment.question_taxonomy_links qtl
      left join assessment.assessment_taxonomy_nodes subject on subject.id = qtl.subject_node_id
      left join assessment.assessment_taxonomy_nodes topic on topic.id = qtl.topic_node_id
      left join assessment.assessment_taxonomy_nodes subtopic on subtopic.id = qtl.subtopic_node_id
      left join assessment.question_natures qn on qn.id = qtl.question_nature_id
      where qtl.question_id = q.id
    ) tax on true
    where tqi.test_template_id = tt.id
  ), '[]'::jsonb) as questions
`;

export async function getTestPaper(testTemplateId: number, includeUnpublished = false): Promise<unknown | null> {
  return one(
    `
      select
        tt.*,
        row_to_json(e.*) as exam,
        row_to_json(el.*) as exam_level,
        ${paperSectionsSql},
        ${sanitizedPaperQuestionsSql}
      from assessment.test_templates tt
      join assessment.exams e on e.id = tt.exam_id
      join assessment.exam_levels el on el.id = tt.exam_level_id
      where tt.id = $1
        ${publicPaperStatusSql(includeUnpublished)}
    `,
    [testTemplateId]
  );
}

export async function getAttemptPaper(attemptId: number, identity: AttemptIdentity): Promise<unknown | null> {
  const isPrivileged = !!identity.user && canInspectAttempts(identity.user.role);
  let userFilter = "";
  const params: unknown[] = [attemptId];
  if (!isPrivileged) {
    if (identity.user) {
      userFilter = "and ta.user_id = $2";
      params.push(identity.user.id);
    } else if (identity.guestToken) {
      userFilter = "and ta.guest_token = $2";
      params.push(identity.guestToken);
    } else {
      userFilter = "and false";
    }
  }

  return one(
    `
      select
        ta.*,
        row_to_json(tr.*) as result,
        jsonb_build_object(
          'id', tt.id,
          'title', tt.title,
          'slug', tt.slug,
          'description', tt.description,
          'exam_id', tt.exam_id,
          'exam_level_id', tt.exam_level_id,
          'test_type', tt.test_type,
          'duration_minutes', tt.duration_minutes,
          'total_marks', tt.total_marks,
          'access_type', tt.access_type,
          'status', tt.status,
          'exam', to_jsonb(e.*),
          'exam_level', to_jsonb(el.*)
        ) as test_template,
        ${paperSectionsSql},
        coalesce((
          select jsonb_agg(
            question_item.item || jsonb_build_object(
              'response', case when ar.id is null then null else to_jsonb(ar.*) end
            )
            order by question_item.section_order, question_item.display_order, question_item.id
          )
          from (
            select
              tqi.id,
              coalesce(ts.display_order, 0) as section_order,
              tqi.display_order,
              jsonb_build_object(
                'id', tqi.id,
                'test_section_id', tqi.test_section_id,
                'question_version_id', tqi.question_version_id,
                'marks', tqi.marks,
                'negative_marks', tqi.negative_marks,
                'display_order', tqi.display_order,
                'question_format', to_jsonb(qf.*),
                'question_version', jsonb_build_object(
                  'id', qv.id,
                  'question_id', qv.question_id,
                  'question_statement', qv.question_statement,
                  'supplementary_statement', qv.supplementary_statement,
                  'statements_facts', qv.statements_facts,
                  'question_prompt', qv.question_prompt,
                  'options', qv.options,
                  'content_json', qv.content_json,
                  'created_by_user_id', q.created_by_user_id,
                  'is_ai_generated', q.is_ai_generated
                ),
                'passage', passage.passage
              ) as item
            from assessment.test_question_items tqi
            left join assessment.test_sections ts on ts.id = tqi.test_section_id
            join assessment.question_versions qv on qv.id = tqi.question_version_id
            join assessment.questions q on q.id = qv.question_id
            join assessment.question_formats qf on qf.id = q.question_format_id
            left join lateral (
              select row_to_json(p.*)::jsonb as passage
              from assessment.passage_questions pq
              join assessment.passages p on p.id = pq.passage_id
              where pq.question_id = q.id
              order by pq.display_order, pq.id
              limit 1
            ) passage on true
            where tqi.test_template_id = tt.id
          ) question_item
          left join assessment.attempt_responses ar
            on ar.attempt_id = ta.id
           and ar.question_version_id = (question_item.item->>'question_version_id')::bigint
        ), '[]'::jsonb) as questions
      from assessment.test_attempts ta
      join assessment.test_templates tt on tt.id = ta.test_template_id
      join assessment.exams e on e.id = tt.exam_id
      join assessment.exam_levels el on el.id = tt.exam_level_id
      left join assessment.test_results tr on tr.attempt_id = ta.id
      where ta.id = $1
        ${userFilter}
    `,
    params
  );
}

export async function listMyAttempts(
  userId: number,
  options: { limit: number; offset: number; content_type?: string }
): Promise<unknown[]> {
  const params: unknown[] = [userId];
  let conditionSql = "";

  if (options.content_type) {
    params.push(options.content_type);
    conditionSql = `
      and (
        -- If the test template's exam level is explicitly GS or CSAT, filter strictly by that
        exists (
          select 1
          from assessment.exam_levels el
          where el.id = tt.exam_level_id and el.slug in ('prelims-gs', 'prelims-csat') and (
            ($${params.length} = 'gk' and el.slug = 'prelims-gs') or
            ($${params.length} = 'aptitude' and el.slug = 'prelims-csat')
          )
        )
        -- Otherwise, fall back to checking if any question's subject taxonomy node matches
        or (
          not exists (
            select 1
            from assessment.exam_levels el
            where el.id = tt.exam_level_id and el.slug in ('prelims-gs', 'prelims-csat')
          )
          and exists (
            select 1 
            from assessment.test_question_items tqi
            join assessment.question_versions qv on qv.id = tqi.question_version_id
            join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
            join assessment.assessment_taxonomy_nodes atn on atn.id = qtl.subject_node_id
            where tqi.test_template_id = ta.test_template_id and atn.content_type = $${params.length}
          )
        )
      )
    `;
  }

  params.push(options.limit, options.offset);
  const limitPos = params.length - 1;
  const offsetPos = params.length;

  return query(
    `
      select
        ta.*,
        row_to_json(tt.*) as test_template,
        row_to_json(tr.*) as result
      from assessment.test_attempts ta
      join assessment.test_templates tt on tt.id = ta.test_template_id
      left join assessment.test_results tr on tr.attempt_id = ta.id
      where ta.user_id = $1
        ${conditionSql}
      order by ta.started_at desc
      limit $${limitPos} offset $${offsetPos}
    `,
    params
  );
}

export async function getResultReview(resultId: number, user: AssessmentUser): Promise<unknown | null> {
  const userFilter = canInspectAttempts(user.role) ? "" : "and ta.user_id = $2";
  const params: unknown[] = userFilter ? [resultId, user.id] : [resultId];

  const review = await one<{
    test_template: { exam_id: string | number; test_type: string };
    topic_breakdowns: LeafMetricInput[];
    [key: string]: unknown;
  }>(
    `
      select
        tr.*,
        row_to_json(ta.*) as attempt,
        row_to_json(tt.*) as test_template,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', rtb.id,
              'taxonomy_node_id', rtb.taxonomy_node_id,
              'taxonomy_name', atn.name,
              'taxonomy_content_type', atn.content_type,
              'question_nature_id', rtb.question_nature_id,
              'question_nature_name', qn.name,
              'total_questions', rtb.total_questions,
              'correct_count', rtb.correct_count,
              'incorrect_count', rtb.incorrect_count,
              'unattempted_count', rtb.unattempted_count,
              'score', rtb.score,
              'max_score', rtb.max_score,
              'accuracy', rtb.accuracy,
              'avg_time_seconds', rtb.avg_time_seconds
            )
            order by rtb.accuracy asc, rtb.total_questions desc
          )
          from assessment.result_topic_breakdowns rtb
          left join assessment.assessment_taxonomy_nodes atn on atn.id = rtb.taxonomy_node_id
          left join assessment.question_natures qn on qn.id = rtb.question_nature_id
          where rtb.result_id = tr.id
        ), '[]'::jsonb) as topic_breakdowns,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', tqi.id,
              'test_section_id', tqi.test_section_id,
              'question_version_id', tqi.question_version_id,
              'marks', tqi.marks,
              'negative_marks', tqi.negative_marks,
              'display_order', tqi.display_order,
              'question_format', to_jsonb(qf.*),
              'question_version', jsonb_build_object(
                'id', qv.id,
                'question_id', qv.question_id,
                'question_statement', qv.question_statement,
                'supplementary_statement', qv.supplementary_statement,
                'statements_facts', qv.statements_facts,
                'question_prompt', qv.question_prompt,
                'options', qv.options,
                'correct_answer', qv.correct_answer,
                'explanation', qv.explanation,
                'content_json', qv.content_json,
                'created_by_user_id', q.created_by_user_id,
                'is_ai_generated', q.is_ai_generated
              ),
              'response', case
                when qf.question_family = 'mains_subjective' then
                  case when maa.id is null then null else to_jsonb(maa.*) end
                else
                  case when ar.id is null then null else to_jsonb(ar.*) end
              end,
              'score_item', score_item.item,
              'passage', passage.passage
            )
            order by coalesce(ts.display_order, 0), tqi.display_order, tqi.id
          )
          from assessment.test_question_items tqi
          left join assessment.test_sections ts on ts.id = tqi.test_section_id
          join assessment.question_versions qv on qv.id = tqi.question_version_id
          join assessment.questions q on q.id = qv.question_id
          join assessment.question_formats qf on qf.id = q.question_format_id
          left join assessment.attempt_responses ar
            on ar.attempt_id = ta.id
           and ar.question_version_id = tqi.question_version_id
          left join assessment.mains_answer_attempts maa
            on maa.attempt_id = ta.id
           and maa.question_version_id = tqi.question_version_id
          left join lateral (
            select item
            from jsonb_array_elements(coalesce(tr.summary_json->'per_question', '[]'::jsonb)) item
            where (item->>'question_version_id')::bigint = qv.id
            limit 1
          ) score_item on true
          left join lateral (
            select row_to_json(p.*)::jsonb as passage
            from assessment.passage_questions pq
            join assessment.passages p on p.id = pq.passage_id
            where pq.question_id = q.id
            order by pq.display_order, pq.id
            limit 1
          ) passage on true
          where tqi.test_template_id = tt.id
        ), '[]'::jsonb) as questions
      from assessment.test_results tr
      join assessment.test_attempts ta on ta.id = tr.attempt_id
      join assessment.test_templates tt on tt.id = ta.test_template_id
      where tr.id = $1
        ${userFilter}
    `,
    params
  );

  if (!review) return null;

  // Objective tests can have questions tagged only at a subject/book/chapter level with
  // no leaf topic underneath — rolling up here (rather than only storing leaf breakdowns)
  // is what lets the result page show subject/chapter-level accuracy, not just topic-level.
  if (review.test_template?.test_type !== "mains_test") {
    const nodes = await query<{ id: string; parent_id: string | null; name: string; node_type: string }>(
      `
        select id, parent_id, name, node_type
        from assessment.assessment_taxonomy_nodes
        where exam_id = $1 and is_active = true
      `,
      [review.test_template.exam_id]
    );

    const nodeInputs: TaxonomyNodeInput[] = nodes.map((n) => ({
      id: Number(n.id),
      parent_id: n.parent_id === null ? null : Number(n.parent_id),
      name: n.name,
      node_type: n.node_type
    }));

    review.topic_performance_tree = buildPerformanceTree(nodeInputs, review.topic_breakdowns ?? []);
  }

  return review;
}
