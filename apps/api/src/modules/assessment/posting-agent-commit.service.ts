import { one } from "../../db.js";
import { saveQuestionsDraft } from "./questions.service.js";
import { loadAssessmentTaxonomyTree, loadQuestionNatures } from "./posting-agent.service.js";
import type { CommitAssessmentAgentInput, AssessmentAgentQuestion } from "./posting-agent.schemas.js";

const EXAM_LEVEL_SLUG_CANDIDATES: Record<"gk" | "aptitude" | "mains", string[]> = {
  gk: ["prelims-gs", "prelims"],
  aptitude: ["prelims-csat", "csat"],
  mains: ["mains-written", "mains"]
};

// Maps a node_type to the saveQuestionsDraft slot it should populate. The mains
// tree reuses the objective slot names (saveQuestionsDraft remaps them to
// paper/subject_area/theme/topic internally).
const OBJECTIVE_SLOT_BY_TYPE: Record<string, string> = {
  subject: "subject_node_id",
  source_bucket: "source_node_id",
  topic: "topic_node_id",
  subtopic: "subtopic_node_id"
};
const MAINS_SLOT_BY_TYPE: Record<string, string> = {
  paper: "subject_node_id",
  subject_area: "source_node_id",
  theme: "topic_node_id",
  topic: "subtopic_node_id"
};

export interface AssessmentCommitResult {
  mode: "auto" | "review";
  content_type: string;
  exam_id: number;
  created: { question_id: number; version_id: number; statement: string }[];
  failed: { statement: string; error: string }[];
}

async function resolveExamLevelId(examId: number, contentType: "gk" | "aptitude" | "mains"): Promise<number> {
  const candidates = EXAM_LEVEL_SLUG_CANDIDATES[contentType];
  const row = await one<{ id: number }>(
    `select id from assessment.exam_levels
      where exam_id = $1 and slug = any($2::text[])
      order by array_position($2::text[], slug) limit 1`,
    [examId, candidates]
  );
  if (!row) {
    throw new Error(`No exam level configured for content type "${contentType}" on exam ${examId}.`);
  }
  return row.id;
}

/**
 * Posts agent-parsed questions into the official question bank via the existing
 * saveQuestionsDraft engine. Auto mode publishes; review mode saves as drafts for
 * one-click approval in the questions manager. Taxonomy node ids are mapped to the
 * correct save slots by node_type (works for both objective and mains trees).
 */
export async function commitAssessmentAgent(
  input: CommitAssessmentAgentInput,
  userId: number
): Promise<AssessmentCommitResult> {
  const isMains = input.content_type === "mains";
  const questionFamily = isMains ? "mains_subjective" : "objective";
  const status = input.publish_mode === "auto" ? input.default_status ?? "published" : input.default_status ?? "draft";
  const slotByType = isMains ? MAINS_SLOT_BY_TYPE : OBJECTIVE_SLOT_BY_TYPE;

  const examLevelId = await resolveExamLevelId(input.exam_id, input.content_type);
  const { byId } = await loadAssessmentTaxonomyTree(input.exam_id, input.content_type);
  // Question nature is checked the same way taxonomy is — required only when
  // the exam actually has natures configured to choose from, so an exam with
  // none set up yet is never blocked (mirrors how a bare/undefined taxonomy
  // tree would never block a commit either — there'd be nothing to assign).
  // Deliberately NOT enforced for CSAT/aptitude: a natural, well-fitting
  // nature classification doesn't exist for most CSAT questions the way it
  // does for GK/Mains, so requiring one there would block real questions
  // rather than catch a genuine gap.
  const availableNatures = input.content_type === "aptitude" ? [] : await loadQuestionNatures(input.exam_id);

  const prepared: Record<string, unknown>[] = [];
  const failed: AssessmentCommitResult["failed"] = [];

  for (const q of input.questions as AssessmentAgentQuestion[]) {
    const slots: Record<string, number> = {};
    for (const id of q.taxonomy_node_ids ?? []) {
      const node = byId.get(id);
      if (!node) continue;
      const slot = slotByType[node.node_type];
      if (slot) slots[slot] = id;
    }
    if (!slots.subject_node_id) {
      // saveQuestionsDraft needs at least a root (subject/paper) node to link.
      failed.push({
        statement: q.question_statement,
        error: `No ${isMains ? "paper" : "subject"} node assigned — set the taxonomy before publishing.`
      });
      continue;
    }
    if (availableNatures.length > 0 && !q.question_nature_id) {
      failed.push({
        statement: q.question_statement,
        error: `No question_nature_id assigned — this exam has ${availableNatures.length} configured (see list_question_natures); assign one before publishing.`
      });
      continue;
    }
    prepared.push({
      question_statement: q.question_statement,
      supp_question_statement: q.supp_question_statement ?? null,
      question_prompt: q.question_prompt ?? null,
      options: q.options ?? [],
      correct_answer: q.correct_answer ?? "",
      explanation: q.explanation ?? "",
      word_limit: q.word_limit,
      marks: q.marks,
      directive: q.directive,
      question_nature_id: q.question_nature_id ?? null,
      ...slots
    });
  }

  const created: AssessmentCommitResult["created"] = [];
  if (prepared.length > 0) {
    const firstSubject = Number(prepared[0]?.subject_node_id);
    const items = await saveQuestionsDraft(
      {
        exam_id: input.exam_id,
        exam_level_id: examLevelId,
        subject_node_id: firstSubject, // default; every question carries its own override
        passage_title: input.passage_title,
        passage_text: input.passage_text,
        status,
        question_family: questionFamily,
        questions: prepared
      },
      userId
    );
    items.forEach((it, i) => {
      created.push({
        question_id: it.question_id,
        version_id: it.version_id,
        statement: String(prepared[i]?.question_statement ?? "")
      });
    });
  }

  return { mode: input.publish_mode, content_type: input.content_type, exam_id: input.exam_id, created, failed };
}
