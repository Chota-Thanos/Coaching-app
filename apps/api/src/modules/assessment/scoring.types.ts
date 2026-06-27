export type ScoreItem = {
  question_version_id: string;
  marks: string;
  negative_marks: string;
  correct_answer: unknown;
  selected_answer: unknown | null;
  response_status: string | null;
  response_time_seconds: number | null;
  subject_node_id: string | null;
  topic_node_id: string | null;
  subtopic_node_id: string | null;
  question_nature_id: string | null;
};

export type TopicBreakdown = {
  taxonomyNodeId: string | null;
  questionNatureId: string | null;
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  time: number;
};

export type ObjectiveScore = {
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  negativeMarks: number;
  totalQuestions: number;
  accuracy: number;
  perQuestion: Array<Record<string, unknown>>;
  breakdowns: TopicBreakdown[];
};

