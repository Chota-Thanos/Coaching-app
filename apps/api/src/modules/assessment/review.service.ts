import { one, query } from "../../db.js";
import type { ListOptions } from "../../common/sql.js";
import { addUpdate, requireUpdates } from "../../common/sql.js";
import type {
  CreateBookmarkInput,
  CreateErrorLogInput,
  CreateErrorTypeInput,
  UpdateErrorTypeInput
} from "./review.schemas.js";

export async function listErrorTypes(): Promise<unknown[]> {
  return query(
    `
      select *
      from assessment.error_types
      where is_active = true
      order by display_order asc, name asc
    `
  );
}

export async function createErrorType(input: CreateErrorTypeInput): Promise<unknown> {
  return one(
    `
      insert into assessment.error_types (name, slug, display_order, is_active)
      values ($1, $2, coalesce($3, 0), coalesce($4, true))
      returning *
    `,
    [input.name, input.slug, input.display_order ?? null, input.is_active ?? null]
  );
}

export async function updateErrorType(id: number, input: UpdateErrorTypeInput): Promise<unknown | null> {
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
      update assessment.error_types
      set ${updates.join(", ")}
      where id = $${params.length}
      returning *
    `,
    params
  );
}

export async function createBookmark(userId: number, input: CreateBookmarkInput): Promise<unknown> {
  return one(
    `
      insert into assessment.student_bookmarks (user_id, question_id, question_version_id, note)
      values ($1, $2, $3, $4)
      on conflict (user_id, question_id)
      do update set
        question_version_id = excluded.question_version_id,
        note = excluded.note
      returning *
    `,
    [userId, input.question_id, input.question_version_id ?? null, input.note ?? null]
  );
}

export async function listBookmarks(userId: number, options: ListOptions): Promise<unknown[]> {
  return query(
    `
      select sb.*, 
             row_to_json(q.*) as question, 
             row_to_json(qv.*) as question_version,
             (
               select json_build_object(
                 'subject_node_id', coalesce(qtl.subject_node_id, mqtl.paper_node_id),
                 'topic_node_id', coalesce(qtl.topic_node_id, mqtl.topic_node_id),
                 'subtopic_node_id', coalesce(qtl.subtopic_node_id, mqtl.subtopic_node_id)
               )
               from assessment.questions q2
               left join assessment.question_taxonomy_links qtl on qtl.question_id = q2.id
               left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = q2.id
               where q2.id = sb.question_id
               limit 1
             ) as taxonomy
      from assessment.student_bookmarks sb
      join assessment.questions q on q.id = sb.question_id
      left join assessment.question_versions qv on qv.id = sb.question_version_id
      where sb.user_id = $1
      order by sb.created_at desc
      limit $2 offset $3
    `,
    [userId, options.limit, options.offset]
  );
}

export async function deleteBookmark(userId: number, questionId: number): Promise<void> {
  await query(
    `
      delete from assessment.student_bookmarks
      where user_id = $1 and question_id = $2
    `,
    [userId, questionId]
  );
}

export async function createErrorLog(userId: number, input: CreateErrorLogInput): Promise<unknown> {
  return one(
    `
      insert into assessment.student_error_logs
        (user_id, question_version_id, attempt_id, taxonomy_node_id, error_type_id, note)
      values ($1, $2, $3, $4, $5, $6)
      returning *
    `,
    [
      userId,
      input.question_version_id,
      input.attempt_id ?? null,
      input.taxonomy_node_id ?? null,
      input.error_type_id,
      input.note ?? null
    ]
  );
}

export async function listErrorLogs(userId: number, options: ListOptions): Promise<unknown[]> {
  return query(
    `
      select sel.*, row_to_json(et.*) as error_type, row_to_json(qv.*) as question_version
      from assessment.student_error_logs sel
      join assessment.error_types et on et.id = sel.error_type_id
      join assessment.question_versions qv on qv.id = sel.question_version_id
      where sel.user_id = $1
      order by sel.created_at desc
      limit $2 offset $3
    `,
    [userId, options.limit, options.offset]
  );
}

type ObjectiveContentType = "gk" | "aptitude";

function examLevelSlugForContentType(contentType: ObjectiveContentType): "prelims-gs" | "prelims-csat" {
  return contentType === "gk" ? "prelims-gs" : "prelims-csat";
}

function assessmentObjectiveContentFilter(contentType: ObjectiveContentType): string {
  const levelSlug = examLevelSlugForContentType(contentType);
  return `
    (
      exists (
        select 1
        from assessment.exam_levels el
        where el.id = tt.exam_level_id
          and el.slug in ('prelims-gs', 'prelims-csat')
          and el.slug = '${levelSlug}'
      )
      or (
        not exists (
          select 1
          from assessment.exam_levels el
          where el.id = tt.exam_level_id
            and el.slug in ('prelims-gs', 'prelims-csat')
        )
        and exists (
          select 1
          from assessment.test_question_items tqi
          join assessment.question_versions qv on qv.id = tqi.question_version_id
          join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
          join assessment.assessment_taxonomy_nodes atn on atn.id = qtl.subject_node_id
          where tqi.test_template_id = ta.test_template_id
            and atn.content_type = '${contentType}'
        )
      )
    )
  `;
}

function studyPlanObjectiveContentFilter(contentType: ObjectiveContentType): string {
  const levelSlug = examLevelSlugForContentType(contentType);
  return `
    (
      exists (
        select 1
        from assessment.exam_levels el
        where el.id = tt.exam_level_id
          and el.slug in ('prelims-gs', 'prelims-csat')
          and el.slug = '${levelSlug}'
      )
      or (
        not exists (
          select 1
          from assessment.exam_levels el
          where el.id = tt.exam_level_id
            and el.slug in ('prelims-gs', 'prelims-csat')
        )
        and exists (
          select 1
          from study_plan.test_questions tq
          join assessment.assessment_taxonomy_nodes atn on atn.id = tq.subject_node_id
          where tq.test_template_id = sta.test_template_id
            and atn.content_type = '${contentType}'
        )
      )
    )
  `;
}

export async function getDashboardAnalytics(userId: number): Promise<unknown> {
  // GK Sub-analytics
  const gkSummary = await one(
    `
      select
        count(*)::integer as attempts,
        coalesce(avg(score), 0)::numeric(10,2) as avg_score,
        coalesce(avg(accuracy), 0)::numeric(7,4) as avg_accuracy,
        coalesce(sum(correct_count), 0)::integer as correct_count,
        coalesce(sum(incorrect_count), 0)::integer as incorrect_count,
        coalesce(sum(unattempted_count), 0)::integer as unattempted_count
      from (
        select tr.score, tr.accuracy, tr.correct_count, tr.incorrect_count, tr.unattempted_count
        from assessment.test_attempts ta
        join assessment.test_results tr on tr.attempt_id = ta.id
        join assessment.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1
          and ${assessmentObjectiveContentFilter("gk")}

        union all

        select spr.score, spr.accuracy, spr.correct_count, spr.incorrect_count, spr.unattempted_count
        from study_plan.test_attempts sta
        join study_plan.test_results spr on spr.attempt_id = sta.id
        join study_plan.test_templates tt on tt.id = sta.test_template_id
        where sta.user_id = $1
          and spr.result_status = 'scored'
          and ${studyPlanObjectiveContentFilter("gk")}
      ) results
    `,
    [userId]
  );

  const gkWeakTopics = await query(
    `
      select stm.*, atn.name as taxonomy_name, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1 and atn.content_type = 'gk' and stm.avg_accuracy < 0.5
      order by stm.avg_accuracy asc, stm.question_count desc
      limit 10
    `,
    [userId]
  );

    const gkStrongTopics = await query(
    `
      select stm.*, atn.name as taxonomy_name, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1 and atn.content_type = 'gk' and stm.avg_accuracy >= 0.6
      order by stm.avg_accuracy desc, stm.question_count desc
      limit 10
    `,
    [userId]
  );

  const gkTrend = await query(
    `
      select
        result_date,
        avg(score)::numeric(10,2) as avg_score,
        avg(accuracy)::numeric(7,4) as avg_accuracy,
        count(*)::integer as attempts
      from (
        select tr.created_at::date as result_date, tr.score, tr.accuracy
        from assessment.test_attempts ta
        join assessment.test_results tr on tr.attempt_id = ta.id
        join assessment.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1
          and ${assessmentObjectiveContentFilter("gk")}

        union all

        select spr.created_at::date as result_date, spr.score, spr.accuracy
        from study_plan.test_attempts sta
        join study_plan.test_results spr on spr.attempt_id = sta.id
        join study_plan.test_templates tt on tt.id = sta.test_template_id
        where sta.user_id = $1
          and spr.result_status = 'scored'
          and ${studyPlanObjectiveContentFilter("gk")}
      ) results
      group by result_date
      order by result_date asc
      limit 30
    `,
    [userId]
  );

  // Aptitude Sub-analytics
  const aptitudeSummary = await one(
    `
      select
        count(*)::integer as attempts,
        coalesce(avg(score), 0)::numeric(10,2) as avg_score,
        coalesce(avg(accuracy), 0)::numeric(7,4) as avg_accuracy,
        coalesce(sum(correct_count), 0)::integer as correct_count,
        coalesce(sum(incorrect_count), 0)::integer as incorrect_count,
        coalesce(sum(unattempted_count), 0)::integer as unattempted_count
      from (
        select tr.score, tr.accuracy, tr.correct_count, tr.incorrect_count, tr.unattempted_count
        from assessment.test_attempts ta
        join assessment.test_results tr on tr.attempt_id = ta.id
        join assessment.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1
          and ${assessmentObjectiveContentFilter("aptitude")}

        union all

        select spr.score, spr.accuracy, spr.correct_count, spr.incorrect_count, spr.unattempted_count
        from study_plan.test_attempts sta
        join study_plan.test_results spr on spr.attempt_id = sta.id
        join study_plan.test_templates tt on tt.id = sta.test_template_id
        where sta.user_id = $1
          and spr.result_status = 'scored'
          and ${studyPlanObjectiveContentFilter("aptitude")}
      ) results
    `,
    [userId]
  );

  const aptitudeWeakTopics = await query(
    `
      select stm.*, atn.name as taxonomy_name, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1 and atn.content_type = 'aptitude' and stm.avg_accuracy < 0.5
      order by stm.avg_accuracy asc, stm.question_count desc
      limit 10
    `,
    [userId]
  );

    const aptitudeStrongTopics = await query(
    `
      select stm.*, atn.name as taxonomy_name, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1 and atn.content_type = 'aptitude' and stm.avg_accuracy >= 0.6
      order by stm.avg_accuracy desc, stm.question_count desc
      limit 10
    `,
    [userId]
  );

  const aptitudeTrend = await query(
    `
      select
        result_date,
        avg(score)::numeric(10,2) as avg_score,
        avg(accuracy)::numeric(7,4) as avg_accuracy,
        count(*)::integer as attempts
      from (
        select tr.created_at::date as result_date, tr.score, tr.accuracy
        from assessment.test_attempts ta
        join assessment.test_results tr on tr.attempt_id = ta.id
        join assessment.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1
          and ${assessmentObjectiveContentFilter("aptitude")}

        union all

        select spr.created_at::date as result_date, spr.score, spr.accuracy
        from study_plan.test_attempts sta
        join study_plan.test_results spr on spr.attempt_id = sta.id
        join study_plan.test_templates tt on tt.id = sta.test_template_id
        where sta.user_id = $1
          and spr.result_status = 'scored'
          and ${studyPlanObjectiveContentFilter("aptitude")}
      ) results
      group by result_date
      order by result_date asc
      limit 30
    `,
    [userId]
  );

  // Mains Sub-analytics
  const mainsSummary = await one(
    `
      select
        count(*)::integer as attempts,
        coalesce(avg(score) filter (where status = 'evaluated'), 0)::numeric(10,2) as avg_score,
        coalesce(max(score) filter (where status = 'evaluated'), 0)::numeric(10,2) as max_score,
        count(*) filter (where status = 'evaluated')::integer as evaluated_count,
        count(*) filter (where status = 'pending')::integer as pending_count
      from (
        select score, case when evaluation_status = 'evaluated' then 'evaluated' else 'pending' end as status
        from assessment.mains_answer_attempts
        where user_id = $1

        union all

        select tr.score, case when tr.result_status = 'scored' then 'evaluated' else 'pending' end as status
        from study_plan.test_attempts ta
        join study_plan.test_results tr on tr.attempt_id = ta.id
        join study_plan.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1 and tt.test_type = 'mains_test'
      ) results
    `,
    [userId]
  );

  const mainsWeakTopics = await query(
    `
      select 
        sum(attempt_count)::integer as attempt_count,
        coalesce(sum(avg_score * attempt_count) / nullif(sum(attempt_count), 0), 0)::numeric(10,2) as avg_score,
        taxonomy_name
      from (
        select 
          count(maa.id)::integer as attempt_count,
          coalesce(avg(maa.score), 0)::numeric(10,2) as avg_score,
          mtn.name as taxonomy_name
        from assessment.mains_answer_attempts maa
        join assessment.question_versions qv on qv.id = maa.question_version_id
        join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
        join assessment.mains_taxonomy_nodes mtn on mtn.id = mqtl.paper_node_id
        where maa.user_id = $1
        group by mtn.id, mtn.name

        union all

        select 
          count(rtb.id)::integer as attempt_count,
          coalesce(avg(rtb.score), 0)::numeric(10,2) as avg_score,
          mtn.name as taxonomy_name
        from study_plan.result_topic_breakdowns rtb
        join study_plan.test_results tr on tr.id = rtb.result_id
        join study_plan.test_attempts ta on ta.id = tr.attempt_id
        join assessment.mains_taxonomy_nodes mtn on mtn.id = rtb.mains_taxonomy_node_id
        where ta.user_id = $1 and tr.result_status = 'scored'
        group by mtn.id, mtn.name
      ) combined_mains
      group by taxonomy_name
      order by avg_score asc
      limit 10
    `,
    [userId]
  );

    const mainsStrongTopics = await query(
    `
      select stm.*, atn.name as taxonomy_name, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1 and atn.content_type = 'mains'
      order by stm.avg_score desc, stm.question_count desc
      limit 10
    `,
    [userId]
  );

  const mainsTrend = await query(
    `
      select
        result_date,
        avg(score)::numeric(10,2) as avg_score,
        count(*)::integer as attempts
      from (
        select submitted_at::date as result_date, score
        from assessment.mains_answer_attempts
        where user_id = $1 and evaluation_status = 'evaluated'

        union all

        select ta.submitted_at::date as result_date, tr.score
        from study_plan.test_attempts ta
        join study_plan.test_results tr on tr.attempt_id = ta.id
        join study_plan.test_templates tt on tt.id = ta.test_template_id
        where ta.user_id = $1 and tt.test_type = 'mains_test' and tr.result_status = 'scored'
      ) results
      group by result_date
      order by result_date asc
      limit 30
    `,
    [userId]
  );

  const mainsCategoryTrends = await query(
    `
      with evaluated_answers as (
        select
          maa.id as answer_attempt_id,
          maa.submitted_at,
          (maa.submitted_at::date)::text as result_date,
          maa.score,
          coalesce(maa.max_score, mqd.marks, 15)::numeric as max_score,
          mqtl.paper_node_id,
          paper.name as paper_name,
          mqtl.subject_area_node_id,
          subject_area.name as subject_area_name,
          mqtl.theme_node_id,
          theme.name as theme_name,
          mqtl.topic_node_id,
          topic.name as topic_name,
          mqtl.subtopic_node_id,
          subtopic.name as subtopic_name
        from assessment.mains_answer_attempts maa
        join assessment.question_versions qv on qv.id = maa.question_version_id
        join assessment.mains_question_details mqd on mqd.question_id = qv.question_id
        left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
        left join assessment.mains_taxonomy_nodes paper on paper.id = mqtl.paper_node_id
        left join assessment.mains_taxonomy_nodes subject_area on subject_area.id = mqtl.subject_area_node_id
        left join assessment.mains_taxonomy_nodes theme on theme.id = mqtl.theme_node_id
        left join assessment.mains_taxonomy_nodes topic on topic.id = mqtl.topic_node_id
        left join assessment.mains_taxonomy_nodes subtopic on subtopic.id = mqtl.subtopic_node_id
        where maa.user_id = $1
          and maa.evaluation_status = 'evaluated'
          and maa.score is not null
      ),
      category_answers as (
        select
          answer_attempt_id,
          submitted_at,
          result_date,
          score,
          max_score,
          category_id,
          category_name,
          node_type,
          display_order
        from evaluated_answers
        cross join lateral (
          values
            (paper_node_id, paper_name, 'paper', 1),
            (subject_area_node_id, subject_area_name, 'subject_area', 2),
            (theme_node_id, theme_name, 'theme', 3),
            (topic_node_id, topic_name, 'topic', 4),
            (subtopic_node_id, subtopic_name, 'subtopic', 5)
        ) as categories(category_id, category_name, node_type, display_order)
        where category_id is not null
      ),
      category_summary as (
        select
          category_id,
          category_name,
          node_type,
          display_order,
          count(distinct answer_attempt_id)::integer as attempts,
          avg(score)::numeric(10,2) as avg_score,
          avg(max_score)::numeric(10,2) as avg_max_score,
          avg((score / nullif(max_score, 0))::numeric)::numeric(7,4) as avg_score_ratio,
          (array_agg(score order by submitted_at desc, answer_attempt_id desc))[1] as latest_score,
          (array_agg(max_score order by submitted_at desc, answer_attempt_id desc))[1] as latest_max_score,
          max(submitted_at) as last_evaluated_at
        from category_answers
        group by category_id, category_name, node_type, display_order
      ),
      daily_trend as (
        select
          category_id,
          result_date,
          count(*)::integer as attempts,
          avg(score)::numeric(10,2) as avg_score,
          avg(max_score)::numeric(10,2) as avg_max_score,
          avg((score / nullif(max_score, 0))::numeric)::numeric(7,4) as avg_score_ratio
        from category_answers
        group by category_id, result_date
      )
      select
        cs.category_id::integer,
        cs.category_name,
        cs.node_type,
        cs.attempts,
        cs.avg_score,
        cs.avg_max_score,
        cs.avg_score_ratio,
        cs.latest_score,
        cs.latest_max_score,
        cs.last_evaluated_at,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'result_date', dt.result_date,
              'attempts', dt.attempts,
              'avg_score', dt.avg_score,
              'avg_max_score', dt.avg_max_score,
              'avg_score_ratio', dt.avg_score_ratio
            )
            order by dt.result_date asc
          )
          from daily_trend dt
          where dt.category_id = cs.category_id
        ), '[]'::jsonb) as trend
      from category_summary cs
      order by cs.display_order asc, cs.avg_score_ratio asc nulls last, cs.attempts desc, cs.category_name asc
      limit 20
    `,
    [userId]
  );

  const mainsConsistentMistakes = await query(
    `
      with evaluated_answers as (
        select
          maa.id as answer_attempt_id,
          maa.submitted_at,
          maa.score,
          coalesce(maa.max_score, mqd.marks, 15)::numeric as max_score,
          coalesce(maa.weaknesses, '[]'::jsonb) as weaknesses,
          coalesce(subtopic.name, topic.name, theme.name, subject_area.name, paper.name) as category_name
        from assessment.mains_answer_attempts maa
        join assessment.question_versions qv on qv.id = maa.question_version_id
        join assessment.mains_question_details mqd on mqd.question_id = qv.question_id
        left join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
        left join assessment.mains_taxonomy_nodes paper on paper.id = mqtl.paper_node_id
        left join assessment.mains_taxonomy_nodes subject_area on subject_area.id = mqtl.subject_area_node_id
        left join assessment.mains_taxonomy_nodes theme on theme.id = mqtl.theme_node_id
        left join assessment.mains_taxonomy_nodes topic on topic.id = mqtl.topic_node_id
        left join assessment.mains_taxonomy_nodes subtopic on subtopic.id = mqtl.subtopic_node_id
        where maa.user_id = $1
          and maa.evaluation_status = 'evaluated'
      ),
      expanded_weaknesses as (
        select
          answer_attempt_id,
          submitted_at,
          score,
          max_score,
          category_name,
          trim(weakness.value) as mistake,
          lower(regexp_replace(trim(weakness.value), '[^[:alnum:]]+', ' ', 'g')) as normalized_mistake
        from evaluated_answers
        cross join lateral jsonb_array_elements_text(weaknesses) as weakness(value)
        where trim(weakness.value) <> ''
      )
      select
        min(mistake) as mistake,
        normalized_mistake,
        count(*)::integer as occurrence_count,
        count(distinct answer_attempt_id)::integer as answer_count,
        avg(score)::numeric(10,2) as avg_score,
        avg(max_score)::numeric(10,2) as avg_max_score,
        avg((score / nullif(max_score, 0))::numeric)::numeric(7,4) as avg_score_ratio,
        max(submitted_at) as last_seen_at,
        coalesce(array_agg(distinct category_name) filter (where category_name is not null), array[]::text[]) as categories
      from expanded_weaknesses
      where normalized_mistake <> ''
      group by normalized_mistake
      having count(distinct answer_attempt_id) >= 2
      order by occurrence_count desc, answer_count desc, avg_score_ratio asc nulls last, last_seen_at desc
      limit 12
    `,
    [userId]
  );

  return {
    gk: {
      summary: gkSummary,
      weak_topics: gkWeakTopics,
      strong_topics: gkStrongTopics,
      trend: gkTrend
    },
    aptitude: {
      summary: aptitudeSummary,
      weak_topics: aptitudeWeakTopics,
      strong_topics: aptitudeStrongTopics,
      trend: aptitudeTrend
    },
    mains: {
      summary: mainsSummary,
      weak_topics: mainsWeakTopics,
      strong_topics: mainsStrongTopics,
      trend: mainsTrend,
      category_trends: mainsCategoryTrends,
      consistent_mistakes: mainsConsistentMistakes
    }
  };
}

export async function getStudentTopicMetrics(userId: number): Promise<unknown[]> {
  return query(
    `
      select stm.*, atn.name as taxonomy_name, atn.parent_id, atn.node_type, atn.content_type, qn.name as question_nature
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1
    `,
    [userId]
  );
}

export async function getStudentCategoryPerformance(
  userId: number,
  taxonomyNodeId: number,
  contentType?: string
): Promise<unknown | null> {
  const isMains = contentType === "mains";

  const category = isMains
    ? await one<{
        id: string;
        name: string;
        node_type: string;
        parent_id: string | null;
        content_type: string;
      }>(
        `
          select id, name, node_type, parent_id, 'mains'::text as content_type
          from assessment.mains_taxonomy_nodes
          where id = $1
        `,
        [taxonomyNodeId]
      )
    : await one<{
        id: string;
        name: string;
        node_type: string;
        parent_id: string | null;
        content_type: string;
      }>(
        `
          select id, name, node_type, parent_id, content_type
          from assessment.assessment_taxonomy_nodes
          where id = $1
        `,
        [taxonomyNodeId]
      );

  if (!category) return null;

  const children = isMains
    ? await query<{
        id: number;
        name: string;
        node_type: string;
        parent_id: number | null;
      }>(
        `
          select id, name, node_type, parent_id
          from assessment.mains_taxonomy_nodes
          where parent_id = $1
          order by display_order asc, name asc
        `,
        [taxonomyNodeId]
      )
    : await query<{
        id: number;
        name: string;
        node_type: string;
        parent_id: number | null;
      }>(
        `
          select id, name, node_type, parent_id
          from assessment.assessment_taxonomy_nodes
          where parent_id = $1
          order by display_order asc, name asc
        `,
        [taxonomyNodeId]
      );

  const rows = isMains
    ? await query<{
        result_id: string;
        attempt_id: string;
        test_template_id: string;
        test_title: string;
        test_type: string;
        started_at: string;
        submitted_at: string | null;
        result_date: string;
        question_version_id: string;
        question_statement: string;
        explanation: string | null;
        selected_answer: unknown;
        correct_answer: unknown;
        outcome: string;
        score: string;
        marks: string;
        negative_marks: string;
        time_spent_seconds: string;
        subject_node_id: string;
        subject_name: string | null;
        source_node_id: string | null;
        source_name: string | null;
        theme_node_id: string | null;
        theme_name: string | null;
        topic_node_id: string | null;
        topic_name: string | null;
        subtopic_node_id: string | null;
        subtopic_name: string | null;
        question_nature_name: string | null;
      }>(
        `
          with recursive category_nodes as (
            select id
            from assessment.mains_taxonomy_nodes
            where id = $2
            union all
            select child.id
            from assessment.mains_taxonomy_nodes child
            join category_nodes parent on parent.id = child.parent_id
          ),
          scored_questions as (
            select
              tr.id as result_id,
              ta.id as attempt_id,
              tt.id as test_template_id,
              tt.title as test_title,
              tt.test_type,
              ta.started_at,
              ta.submitted_at,
              (tr.created_at::date)::text as result_date,
              qv.id as question_version_id,
              qv.question_statement,
              qv.explanation,
              qv.correct_answer,
              tqi.marks,
              tqi.negative_marks,
              mqtl.paper_node_id as subject_node_id,
              paper_node.name as subject_name,
              mqtl.subject_area_node_id as source_node_id,
              subject_area_node.name as source_name,
              mqtl.theme_node_id,
              theme_node.name as theme_name,
              mqtl.topic_node_id,
              topic_node.name as topic_name,
              mqtl.subtopic_node_id,
              subtopic_node.name as subtopic_name,
              qn.name as question_nature_name,
              score_item.item
            from assessment.test_attempts ta
            join assessment.test_results tr on tr.attempt_id = ta.id
            join assessment.test_templates tt on tt.id = ta.test_template_id
            join assessment.test_question_items tqi on tqi.test_template_id = tt.id
            join assessment.question_versions qv on qv.id = tqi.question_version_id
            join assessment.mains_question_taxonomy_links mqtl on mqtl.question_id = qv.question_id
            left join assessment.mains_taxonomy_nodes paper_node on paper_node.id = mqtl.paper_node_id
            left join assessment.mains_taxonomy_nodes subject_area_node on subject_area_node.id = mqtl.subject_area_node_id
            left join assessment.mains_taxonomy_nodes theme_node on theme_node.id = mqtl.theme_node_id
            left join assessment.mains_taxonomy_nodes topic_node on topic_node.id = mqtl.topic_node_id
            left join assessment.mains_taxonomy_nodes subtopic_node on subtopic_node.id = mqtl.subtopic_node_id
            left join assessment.question_natures qn on qn.id = mqtl.question_nature_id
            left join lateral (
              select item
              from jsonb_array_elements(coalesce(tr.summary_json->'per_question', '[]'::jsonb)) item
              where (item->>'question_version_id')::bigint = qv.id
              limit 1
            ) score_item on true
            where ta.user_id = $1
              and (
                mqtl.paper_node_id in (select id from category_nodes)
                or mqtl.subject_area_node_id in (select id from category_nodes)
                or mqtl.theme_node_id in (select id from category_nodes)
                or mqtl.topic_node_id in (select id from category_nodes)
                or mqtl.subtopic_node_id in (select id from category_nodes)
              )
          )
          select
            result_id,
            attempt_id,
            test_template_id,
            test_title,
            test_type,
            started_at,
            submitted_at,
            result_date,
            question_version_id,
            question_statement,
            explanation,
            item->'selected_answer' as selected_answer,
            correct_answer,
            coalesce(item->>'outcome', 'unattempted') as outcome,
            coalesce(item->>'score', '0') as score,
            marks,
            negative_marks,
            coalesce(item->>'time_spent_seconds', '0') as time_spent_seconds,
            subject_node_id,
            subject_name,
            source_node_id,
            source_name,
            theme_node_id,
            theme_name,
            topic_node_id,
            topic_name,
            subtopic_node_id,
            subtopic_name,
            question_nature_name
          from scored_questions
          order by result_date desc, attempt_id desc, question_version_id asc
        `,
        [userId, taxonomyNodeId]
      )
    : await query<{
        result_id: string;
        attempt_id: string;
        test_template_id: string;
        test_title: string;
        test_type: string;
        started_at: string;
        submitted_at: string | null;
        result_date: string;
        question_version_id: string;
        question_statement: string;
        explanation: string | null;
        selected_answer: unknown;
        correct_answer: unknown;
        outcome: string;
        score: string;
        marks: string;
        negative_marks: string;
        time_spent_seconds: string;
        subject_node_id: string;
        subject_name: string | null;
        source_node_id: string | null;
        source_name: string | null;
        theme_node_id: string | null;
        theme_name: string | null;
        topic_node_id: string | null;
        topic_name: string | null;
        subtopic_node_id: string | null;
        subtopic_name: string | null;
        question_nature_name: string | null;
      }>(
        `
          with recursive category_nodes as (
            select id
            from assessment.assessment_taxonomy_nodes
            where id = $2
            union all
            select child.id
            from assessment.assessment_taxonomy_nodes child
            join category_nodes parent on parent.id = child.parent_id
          ),
          scored_questions as (
            select
              tr.id as result_id,
              ta.id as attempt_id,
              tt.id as test_template_id,
              tt.title as test_title,
              tt.test_type,
              ta.started_at,
              ta.submitted_at,
              (tr.created_at::date)::text as result_date,
              qv.id as question_version_id,
              qv.question_statement,
              qv.explanation,
              qv.correct_answer,
              tqi.marks,
              tqi.negative_marks,
              qtl.subject_node_id,
              subject_node.name as subject_name,
              qtl.source_node_id,
              source_node.name as source_name,
              null::text as theme_node_id,
              null::text as theme_name,
              qtl.topic_node_id,
              topic_node.name as topic_name,
              qtl.subtopic_node_id,
              subtopic_node.name as subtopic_name,
              qn.name as question_nature_name,
              score_item.item
            from assessment.test_attempts ta
            join assessment.test_results tr on tr.attempt_id = ta.id
            join assessment.test_templates tt on tt.id = ta.test_template_id
            join assessment.test_question_items tqi on tqi.test_template_id = tt.id
            join assessment.question_versions qv on qv.id = tqi.question_version_id
            join assessment.question_taxonomy_links qtl on qtl.question_id = qv.question_id
            left join assessment.assessment_taxonomy_nodes subject_node on subject_node.id = qtl.subject_node_id
            left join assessment.assessment_taxonomy_nodes source_node on source_node.id = qtl.source_node_id
            left join assessment.assessment_taxonomy_nodes topic_node on topic_node.id = qtl.topic_node_id
            left join assessment.assessment_taxonomy_nodes subtopic_node on subtopic_node.id = qtl.subtopic_node_id
            left join assessment.question_natures qn on qn.id = qtl.question_nature_id
            left join lateral (
              select item
              from jsonb_array_elements(coalesce(tr.summary_json->'per_question', '[]'::jsonb)) item
              where (item->>'question_version_id')::bigint = qv.id
              limit 1
            ) score_item on true
            where ta.user_id = $1
              and (
                qtl.subject_node_id in (select id from category_nodes)
                or qtl.source_node_id in (select id from category_nodes)
                or qtl.topic_node_id in (select id from category_nodes)
                or qtl.subtopic_node_id in (select id from category_nodes)
              )
          )
          select
            result_id,
            attempt_id,
            test_template_id,
            test_title,
            test_type,
            started_at,
            submitted_at,
            result_date,
            question_version_id,
            question_statement,
            explanation,
            item->'selected_answer' as selected_answer,
            correct_answer,
            coalesce(item->>'outcome', 'unattempted') as outcome,
            coalesce(item->>'score', '0') as score,
            marks,
            negative_marks,
            coalesce(item->>'time_spent_seconds', '0') as time_spent_seconds,
            subject_node_id,
            subject_name,
            source_node_id,
            source_name,
            theme_node_id,
            theme_name,
            topic_node_id,
            topic_name,
            subtopic_node_id,
            subtopic_name,
            question_nature_name
          from scored_questions
          order by result_date desc, attempt_id desc, question_version_id asc
        `,
        [userId, taxonomyNodeId]
      );

  const summary = rows.reduce(
    (acc, row) => {
      const outcome = row.outcome ?? "unattempted";
      const score = Number(row.score ?? 0);
      const time = Number(row.time_spent_seconds ?? 0);
      acc.total_questions += 1;
      acc.score += Number.isFinite(score) ? score : 0;
      acc.time_spent_seconds += Number.isFinite(time) ? time : 0;
      if (outcome === "correct") acc.correct_count += 1;
      else if (outcome === "incorrect") acc.incorrect_count += 1;
      else acc.unattempted_count += 1;
      acc.attempt_ids.add(Number(row.attempt_id));
      return acc;
    },
    {
      total_questions: 0,
      correct_count: 0,
      incorrect_count: 0,
      unattempted_count: 0,
      score: 0,
      time_spent_seconds: 0,
      attempt_ids: new Set<number>()
    }
  );

  const answered = summary.correct_count + summary.incorrect_count;
  const attempts = Array.from(
    rows.reduce((map, row) => {
      const attemptId = Number(row.attempt_id);
      const existing = map.get(attemptId) ?? {
        attempt_id: attemptId,
        result_id: Number(row.result_id),
        test_template_id: Number(row.test_template_id),
        test_title: row.test_title,
        test_type: row.test_type,
        started_at: row.started_at,
        submitted_at: row.submitted_at,
        total_questions: 0,
        correct_count: 0,
        incorrect_count: 0,
        unattempted_count: 0,
        score: 0,
        time_spent_seconds: 0
      };

      existing.total_questions += 1;
      existing.score += Number(row.score ?? 0);
      existing.time_spent_seconds += Number(row.time_spent_seconds ?? 0);
      if (row.outcome === "correct") existing.correct_count += 1;
      else if (row.outcome === "incorrect") existing.incorrect_count += 1;
      else existing.unattempted_count += 1;
      map.set(attemptId, existing);
      return map;
    }, new Map<number, Record<string, any>>()).values()
  ).map((attempt) => {
    const correct = Number(attempt.correct_count ?? 0);
    const incorrect = Number(attempt.incorrect_count ?? 0);
    const attemptAnswered = correct + incorrect;
    return {
      ...attempt,
      accuracy: attemptAnswered > 0 ? correct / attemptAnswered : 0
    };
  });

  const trend = Array.from(
    rows.reduce((map, row) => {
      const date = row.result_date;
      const existing = map.get(date) ?? {
        result_date: date,
        total_questions: 0,
        correct_count: 0,
        incorrect_count: 0,
        unattempted_count: 0
      };
      existing.total_questions += 1;
      if (row.outcome === "correct") existing.correct_count += 1;
      else if (row.outcome === "incorrect") existing.incorrect_count += 1;
      else existing.unattempted_count += 1;
      map.set(date, existing);
      return map;
    }, new Map<string, { result_date: string; total_questions: number; correct_count: number; incorrect_count: number; unattempted_count: number }>())
      .values()
  )
    .map((point) => {
      const pointAnswered = point.correct_count + point.incorrect_count;
      return {
        ...point,
        accuracy: pointAnswered > 0 ? point.correct_count / pointAnswered : 0
      };
    })
    .sort((a, b) => a.result_date.localeCompare(b.result_date));

  const childrenPerformance = children.map((child) => {
    const childRows = rows.filter((row) =>
      Number(row.subject_node_id) === child.id ||
      (row.source_node_id && Number(row.source_node_id) === child.id) ||
      ((row as any).theme_node_id && Number((row as any).theme_node_id) === child.id) ||
      (row.topic_node_id && Number(row.topic_node_id) === child.id) ||
      (row.subtopic_node_id && Number(row.subtopic_node_id) === child.id)
    );

    const childSummary = childRows.reduce(
      (acc, r) => {
        const outcome = r.outcome ?? "unattempted";
        acc.total_questions += 1;
        if (outcome === "correct") acc.correct_count += 1;
        else if (outcome === "incorrect") acc.incorrect_count += 1;
        else acc.unattempted_count += 1;
        return acc;
      },
      {
        total_questions: 0,
        correct_count: 0,
        incorrect_count: 0,
        unattempted_count: 0
      }
    );

    const childAnswered = childSummary.correct_count + childSummary.incorrect_count;
    const accuracy = childAnswered > 0 ? childSummary.correct_count / childAnswered : 0;

    return {
      id: Number(child.id),
      name: child.name,
      node_type: child.node_type,
      parent_id: child.parent_id ? Number(child.parent_id) : null,
      summary: {
        total_questions: childSummary.total_questions,
        correct_count: childSummary.correct_count,
        incorrect_count: childSummary.incorrect_count,
        unattempted_count: childSummary.unattempted_count,
        accuracy
      }
    };
  });

  return {
    category: {
      ...category,
      id: Number(category.id),
      parent_id: category.parent_id ? Number(category.parent_id) : null
    },
    summary: {
      attempts: summary.attempt_ids.size,
      total_questions: summary.total_questions,
      correct_count: summary.correct_count,
      incorrect_count: summary.incorrect_count,
      unattempted_count: summary.unattempted_count,
      score: summary.score,
      accuracy: answered > 0 ? summary.correct_count / answered : 0,
      avg_time_seconds: summary.total_questions > 0 ? summary.time_spent_seconds / summary.total_questions : 0
    },
    attempts,
    trend,
    children: childrenPerformance,
    questions: rows.map((row) => ({
      result_id: Number(row.result_id),
      attempt_id: Number(row.attempt_id),
      test_template_id: Number(row.test_template_id),
      test_title: row.test_title,
      test_type: row.test_type,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      result_date: row.result_date,
      question_version_id: Number(row.question_version_id),
      question_statement: row.question_statement,
      explanation: row.explanation,
      selected_answer: row.selected_answer,
      correct_answer: row.correct_answer,
      outcome: row.outcome,
      score: Number(row.score ?? 0),
      marks: Number(row.marks ?? 0),
      negative_marks: Number(row.negative_marks ?? 0),
      time_spent_seconds: Number(row.time_spent_seconds ?? 0),
      subject_node_id: Number(row.subject_node_id),
      subject_name: row.subject_name,
      source_node_id: row.source_node_id ? Number(row.source_node_id) : null,
      source_name: row.source_name,
      topic_node_id: row.topic_node_id ? Number(row.topic_node_id) : null,
      topic_name: row.topic_name,
      subtopic_node_id: row.subtopic_node_id ? Number(row.subtopic_node_id) : null,
      subtopic_name: row.subtopic_name,
      question_nature_name: row.question_nature_name
    }))
  };
}


