import { one, query } from "../../db.js";
import { generateText, parseJsonRobust } from "../current-affairs/master/ai.service.js";
import { createErrorLog, getStudentPerformanceTree } from "./review.service.js";

/**
 * The performance coach: an agent that reads a student's own answer history
 * and tells them what they keep getting wrong.
 *
 * The value is not the chat box, it is the evidence behind it. A student
 * already sees accuracy percentages on the performance page; what they cannot
 * see is that they lose most of their Polity marks on statement-based
 * questions, or that the questions they spend longest on are the ones they get
 * wrong. That lives in `attempt_responses` alongside the option they actually
 * picked, and nothing in the app joined it before this.
 *
 * The loop is deliberately provider-agnostic JSON rather than vendor function
 * calling: `generateText` already fronts OpenAI, Vertex and Gemini for this
 * codebase, and a tool protocol expressed as JSON behaves the same on all
 * three. The model asks for a tool, we run it, we hand back the rows, it asks
 * again or answers. Four rounds is the ceiling — enough to read the metrics,
 * then the mistakes behind them, then answer.
 *
 * Reads run automatically. Writes are split by what they cost a student if
 * unwanted: an error-log note is their own data and reversible, so the agent
 * files it itself; starting a practice test puts a live timer in front of
 * them, so that comes back as a proposal they confirm with one click. Agentic
 * should not mean a clock starts because a sentence was ambiguous.
 */

const MAX_ROUNDS = 4;

export type CoachContentType = "gk" | "aptitude" | "mains";

export type CoachTurn = { role: "user" | "assistant"; content: string };

export type CoachProposedAction = {
  kind: "start_practice_test";
  label: string;
  reason: string;
  taxonomy_node_id: number | null;
  question_count: number;
};

export type CoachResult = {
  reply: string;
  actions: CoachProposedAction[];
  /** What the agent actually looked at, so an answer can be audited. */
  used_tools: string[];
};

// ── Read tools ──────────────────────────────────────────────────────────────

async function overview(userId: number, contentType: CoachContentType): Promise<unknown> {
  if (contentType === "mains") {
    return one(
      `
        select count(*)::int as answers_evaluated, round(avg(maa.score)::numeric, 2) as average_score
        from assessment.mains_answer_attempts maa
        where maa.user_id = $1
      `,
      [userId]
    );
  }
  const tree = await getStudentPerformanceTree(userId, contentType);
  // Only the top of the tree: the agent wants the shape of the subject, not
  // every leaf, and a whole taxonomy would crowd out the mistakes below.
  return (tree as Array<Record<string, unknown>>)
    .filter((node) => !node.parent_id)
    .map((node) => ({
      taxonomy_node_id: node.id,
      name: node.name,
      accuracy: node.accuracy,
      attempted: node.attempted,
      correct: node.correct
    }));
}

async function weakTopics(userId: number, contentType: CoachContentType, limit = 8): Promise<unknown[]> {
  return query(
    `
      select
        stm.taxonomy_node_id,
        atn.name as topic,
        atn.node_type,
        qn.name as question_nature,
        stm.attempted,
        stm.correct,
        round((stm.correct::numeric / nullif(stm.attempted, 0)) * 100, 1) as accuracy_pct
      from assessment.student_topic_metrics stm
      join assessment.assessment_taxonomy_nodes atn on atn.id = stm.taxonomy_node_id
      left join assessment.question_natures qn on qn.id = stm.question_nature_id
      where stm.user_id = $1
        and atn.content_type = $2
        and stm.attempted >= 3
      order by (stm.correct::numeric / nullif(stm.attempted, 0)) asc nulls last, stm.attempted desc
      limit $3
    `,
    [userId, contentType, limit]
  );
}

/**
 * The questions actually got wrong, with the option the student chose.
 *
 * This is the join nothing else in the app makes: comparing the stored
 * `selected_answer` against `correct_answer` is what turns "62% in Polity"
 * into "you pick 'both statements correct' when only one holds".
 */
async function recentMistakes(
  userId: number,
  contentType: CoachContentType,
  limit = 12,
  taxonomyNodeId?: number | null
): Promise<unknown[]> {
  return query(
    `
      select
        qv.question_statement,
        qv.options,
        qv.correct_answer,
        ar.selected_answer,
        qv.explanation,
        ar.time_spent_seconds,
        ar.status,
        coalesce(subtopic.name, topic.name, subject.name) as topic,
        qn.name as question_nature,
        ta.submitted_at
      from assessment.attempt_responses ar
      join assessment.test_attempts ta on ta.id = ar.attempt_id
      join assessment.question_versions qv on qv.id = ar.question_version_id
      join assessment.questions q on q.id = qv.question_id
      join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
      join assessment.assessment_taxonomy_nodes subject on subject.id = qtl.subject_node_id
      left join assessment.assessment_taxonomy_nodes topic on topic.id = qtl.topic_node_id
      left join assessment.assessment_taxonomy_nodes subtopic on subtopic.id = qtl.subtopic_node_id
      left join assessment.question_natures qn on qn.id = qtl.question_nature_id
      where ta.user_id = $1
        and ta.submitted_at is not null
        and subject.content_type = $2
        and ar.selected_answer is not null
        and ar.selected_answer <> qv.correct_answer
        and ($3::bigint is null or $3 in (qtl.subject_node_id, qtl.topic_node_id, qtl.subtopic_node_id))
      order by ta.submitted_at desc
      limit $4
    `,
    [userId, contentType, taxonomyNodeId ?? null, limit]
  );
}

/**
 * Whether speed is the problem. Rushing and freezing look identical in an
 * accuracy percentage and completely different in the timings.
 */
async function timingSignals(userId: number, contentType: CoachContentType): Promise<unknown> {
  return one(
    `
      select
        round(avg(ar.time_spent_seconds) filter (where ar.selected_answer = qv.correct_answer)::numeric, 1) as avg_seconds_when_right,
        round(avg(ar.time_spent_seconds) filter (where ar.selected_answer <> qv.correct_answer)::numeric, 1) as avg_seconds_when_wrong,
        count(*) filter (where ar.status = 'skipped')::int as skipped,
        count(*) filter (where ar.is_marked_for_review)::int as marked_for_review,
        count(*)::int as total_responses
      from assessment.attempt_responses ar
      join assessment.test_attempts ta on ta.id = ar.attempt_id
      join assessment.question_versions qv on qv.id = ar.question_version_id
      join assessment.questions q on q.id = qv.question_id
      join assessment.question_taxonomy_links qtl on qtl.question_id = q.id
      join assessment.assessment_taxonomy_nodes subject on subject.id = qtl.subject_node_id
      where ta.user_id = $1
        and ta.submitted_at is not null
        and subject.content_type = $2
    `,
    [userId, contentType]
  );
}

// ── Write tools ─────────────────────────────────────────────────────────────

/**
 * Files a note against the student's own error log. Reversible and theirs, so
 * the agent does it rather than proposing it.
 */
async function logMistake(userId: number, note: string): Promise<unknown> {
  const errorType = await one<{ id: number }>(
    `select id from assessment.error_types order by id asc limit 1`
  );
  if (!errorType) throw new Error("No error types are configured on this server.");

  const target = await one<{ question_version_id: number; attempt_id: number }>(
    `
      select ar.question_version_id, ar.attempt_id
      from assessment.attempt_responses ar
      join assessment.test_attempts ta on ta.id = ar.attempt_id
      join assessment.question_versions qv on qv.id = ar.question_version_id
      where ta.user_id = $1
        and ta.submitted_at is not null
        and ar.selected_answer is not null
        and ar.selected_answer <> qv.correct_answer
      order by ta.submitted_at desc
      limit 1
    `,
    [userId]
  );
  if (!target) throw new Error("No wrong answers found to attach this note to.");

  return createErrorLog(userId, {
    question_version_id: target.question_version_id,
    attempt_id: target.attempt_id,
    error_type_id: errorType.id,
    note
  } as never);
}

// ── The agent loop ──────────────────────────────────────────────────────────

const TOOL_BRIEF = `TOOLS you may call, one per turn:
- {"tool":"overview"} — accuracy per top-level subject in this content type.
- {"tool":"weak_topics","limit":8} — worst-accuracy topics (only where they have attempted at least 3).
- {"tool":"recent_mistakes","limit":12,"taxonomy_node_id":null} — the actual questions they got wrong: the statement, the options, the option THEY chose, the correct one, the explanation, and the seconds spent. This is your best evidence; read it before diagnosing anything.
- {"tool":"timing"} — average seconds when right vs wrong, plus how much they skip and mark for review.
- {"tool":"log_mistake","note":"..."} — file a short note against their most recent wrong answer. Only when they ask you to record something.

When you have enough, answer with:
{"tool":"answer","reply":"...","actions":[{"kind":"start_practice_test","label":"...","reason":"...","taxonomy_node_id":123,"question_count":10}]}

"actions" is optional and only for practice you are recommending. The student confirms it themselves, so never say you have already started a test.`;

function systemPrompt(contentType: CoachContentType): string {
  return `You are a UPSC performance coach talking to one aspirant about their own test history (${contentType}).

You answer with evidence from their attempts, never generic advice. "Revise Polity more" is worthless. "In your last 12 wrong answers, 7 were statement-based questions where you chose 'both correct' but only one statement held" is what they are paying for.

Rules:
- Look before you diagnose. Call a tool first, and never assert a pattern you have not seen in the data.
- If the data is thin, say so plainly and tell them what to attempt so you can say more. Never build a pattern out of two questions.
- Be specific and short. Name topics, counts and question types. No motivational filler, no headings, at most five sentences unless they ask for more.
- Never reveal the answer to a question they have not attempted yet.
- Write plainly enough to be read aloud — this may be spoken back to them.

${TOOL_BRIEF}

Return ONLY raw JSON. No prose, no code fences.`;
}

export async function runPerformanceCoach(input: {
  userId: number;
  contentType: CoachContentType;
  message: string;
  history?: CoachTurn[];
  taxonomyNodeId?: number | null;
}): Promise<CoachResult> {
  const usedTools: string[] = [];
  const transcript: string[] = [];

  // Only the recent past: a long chat would otherwise crowd out the tool
  // results, which are the part that makes the answer specific.
  for (const turn of (input.history ?? []).slice(-6)) {
    transcript.push(`${turn.role === "user" ? "STUDENT" : "YOU"}: ${turn.content}`);
  }
  transcript.push(`STUDENT: ${input.message}`);
  if (input.taxonomyNodeId) {
    transcript.push(`(They are looking at taxonomy node ${input.taxonomyNodeId} on their performance page.)`);
  }

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const response = await generateText(systemPrompt(input.contentType), transcript.join("\n\n"));
    const parsed = parseJsonRobust(response);
    const tool = String(parsed?.tool ?? "answer");

    // The last round is always an answer, whatever the model asked for —
    // otherwise a model that keeps calling tools would return nothing at all.
    if (tool === "answer" || round === MAX_ROUNDS - 1) {
      const reply = String(parsed?.reply ?? "").trim();
      const actions: CoachProposedAction[] = Array.isArray(parsed?.actions)
        ? (parsed.actions as unknown[])
            .filter((action): action is Record<string, unknown> =>
              Boolean(action) && (action as Record<string, unknown>).kind === "start_practice_test"
            )
            .slice(0, 3)
            .map((action) => ({
              kind: "start_practice_test" as const,
              label: String(action.label ?? "Practise this"),
              reason: String(action.reason ?? ""),
              taxonomy_node_id: Number.isFinite(Number(action.taxonomy_node_id))
                ? Number(action.taxonomy_node_id)
                : null,
              question_count: Math.min(50, Math.max(5, Number(action.question_count) || 10))
            }))
        : [];
      return {
        reply: reply || "I could not read enough of your attempts to say anything useful yet.",
        actions,
        used_tools: usedTools
      };
    }

    let result: unknown;
    try {
      if (tool === "overview") {
        result = await overview(input.userId, input.contentType);
      } else if (tool === "weak_topics") {
        result = await weakTopics(input.userId, input.contentType, Number(parsed.limit) || 8);
      } else if (tool === "recent_mistakes") {
        result = await recentMistakes(
          input.userId,
          input.contentType,
          Number(parsed.limit) || 12,
          parsed.taxonomy_node_id ?? input.taxonomyNodeId ?? null
        );
      } else if (tool === "timing") {
        result = await timingSignals(input.userId, input.contentType);
      } else if (tool === "log_mistake") {
        result = await logMistake(input.userId, String(parsed.note ?? ""));
      } else {
        result = { error: `Unknown tool "${tool}".` };
      }
    } catch (error) {
      // A failed lookup is information for the model, not the end of the turn:
      // it can say what it could not read instead of throwing at the student.
      result = { error: error instanceof Error ? error.message : "That lookup failed." };
    }

    usedTools.push(tool);
    transcript.push(`YOU CALLED: ${tool}`);
    // Capped so one broad query cannot eat the whole context window.
    transcript.push(`RESULT: ${JSON.stringify(result).slice(0, 12000)}`);
  }

  return { reply: "I could not work that out from your attempts.", actions: [], used_tools: usedTools };
}
