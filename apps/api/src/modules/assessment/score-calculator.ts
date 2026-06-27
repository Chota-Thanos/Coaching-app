import { answersMatch, numeric } from "./answer-matching.js";
import type { ObjectiveScore, ScoreItem, TopicBreakdown } from "./scoring.types.js";

export function calculateObjectiveScore(items: ScoreItem[]): ObjectiveScore {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let negativeMarks = 0;
  const perQuestion: Array<Record<string, unknown>> = [];
  const breakdowns = new Map<string, TopicBreakdown>();

  for (const item of items) {
    const marks = numeric(item.marks);
    const penalty = numeric(item.negative_marks);
    maxScore += marks;

    const hasAnswer = item.selected_answer !== null && item.selected_answer !== undefined;
    const isCorrect = hasAnswer && answersMatch(item.selected_answer, item.correct_answer);
    const taxonomyNodeId = item.subtopic_node_id ?? item.topic_node_id ?? item.subject_node_id;
    const natureId = item.question_nature_id;
    const key = `${taxonomyNodeId ?? "none"}:${natureId ?? "none"}`;

    if (!breakdowns.has(key)) {
      breakdowns.set(key, {
        taxonomyNodeId,
        questionNatureId: natureId,
        total: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        score: 0,
        time: 0
      });
    }

    const breakdown = breakdowns.get(key);
    if (!breakdown) throw new Error("Breakdown aggregation failed.");

    breakdown.total += 1;
    breakdown.time += Number(item.response_time_seconds ?? 0);

    let questionScore = 0;
    let outcome: "correct" | "incorrect" | "unattempted" = "unattempted";

    if (!hasAnswer) {
      unattemptedCount += 1;
      breakdown.unattempted += 1;
    } else if (isCorrect) {
      score += marks;
      questionScore = marks;
      correctCount += 1;
      breakdown.correct += 1;
      outcome = "correct";
    } else {
      score -= penalty;
      questionScore = -penalty;
      incorrectCount += 1;
      negativeMarks += penalty;
      breakdown.incorrect += 1;
      outcome = "incorrect";
    }

    breakdown.score += questionScore;

    perQuestion.push({
      question_version_id: item.question_version_id,
      outcome,
      selected_answer: item.selected_answer,
      correct_answer: item.correct_answer,
      score: questionScore,
      time_spent_seconds: item.response_time_seconds ?? 0
    });
  }

  const attemptedCount = correctCount + incorrectCount;

  return {
    score,
    maxScore,
    correctCount,
    incorrectCount,
    unattemptedCount,
    negativeMarks,
    totalQuestions: items.length,
    accuracy: attemptedCount > 0 ? correctCount / attemptedCount : 0,
    perQuestion,
    breakdowns: Array.from(breakdowns.values())
  };
}

