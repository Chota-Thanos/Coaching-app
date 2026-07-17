/**
 * Shared rollup logic for turning flat taxonomy nodes + leaf-level performance metrics
 * into a hierarchical tree where every ancestor (subject/book/chapter) shows the
 * cumulative performance of everything tagged anywhere in its subtree, not just
 * questions tagged directly on that node.
 *
 * Mirrors the client-side tree used by the mobile Result Review "Topics" tab
 * (_TopicPerformanceTreeNode.calculateCumulativeMetrics in result_review_screen.dart)
 * so the same rollup semantics apply wherever performance is aggregated.
 */

export type TaxonomyNodeInput = {
  id: number;
  parent_id: number | null;
  name: string;
  node_type: string;
};

export type LeafMetricInput = {
  taxonomy_node_id: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  score: number;
  /** Sum of marks for every question in this leaf, regardless of outcome. */
  max_score: number;
  avg_time_seconds?: number;
};

export type PerformanceTreeNode = {
  id: number;
  name: string;
  node_type: string;
  parent_id: number | null;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  score: number;
  max_score: number;
  /** score / max_score * 100 — the primary ranking/display metric. Unlike
   * accuracy (a 0..1 correct-vs-incorrect ratio), this reflects negative
   * marking and so can go below 0 once wrong answers outweigh right ones. */
  score_percent: number;
  accuracy: number;
  avg_time_seconds: number;
  children: PerformanceTreeNode[];
};

type MutableNode = Omit<PerformanceTreeNode, "children"> & {
  children: MutableNode[];
  ownTotalQuestions: number;
  ownCorrectCount: number;
  ownIncorrectCount: number;
  ownUnattemptedCount: number;
  ownScore: number;
  ownMaxScore: number;
  ownTimeWeightedSeconds: number;
};

function attemptedAccuracy(correct: number, incorrect: number): number {
  const attempted = correct + incorrect;
  return attempted > 0 ? correct / attempted : 0;
}

function scorePercent(score: number, maxScore: number): number {
  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

/**
 * Builds a pruned, rolled-up performance tree from flat taxonomy nodes and leaf-level
 * metrics. Only branches that have at least one attempted/tagged question anywhere in
 * their subtree are kept, so categories nobody was ever tested on stay out of the tree
 * — a parent with no directly-tagged questions still shows up once a descendant has data,
 * but a leaf with no data of its own and no data'd descendants is dropped entirely.
 */
export function buildPerformanceTree(
  nodes: TaxonomyNodeInput[],
  leafMetrics: LeafMetricInput[]
): PerformanceTreeNode[] {
  const nodeMap = new Map<number, MutableNode>();

  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      name: node.name,
      node_type: node.node_type,
      parent_id: node.parent_id,
      total_questions: 0,
      correct_count: 0,
      incorrect_count: 0,
      unattempted_count: 0,
      score: 0,
      max_score: 0,
      score_percent: 0,
      accuracy: 0,
      avg_time_seconds: 0,
      children: [],
      ownTotalQuestions: 0,
      ownCorrectCount: 0,
      ownIncorrectCount: 0,
      ownUnattemptedCount: 0,
      ownScore: 0,
      ownMaxScore: 0,
      ownTimeWeightedSeconds: 0
    });
  }

  for (const metric of leafMetrics) {
    const node = nodeMap.get(metric.taxonomy_node_id);
    if (!node) continue;
    node.ownTotalQuestions += metric.total_questions;
    node.ownCorrectCount += metric.correct_count;
    node.ownIncorrectCount += metric.incorrect_count;
    node.ownUnattemptedCount += metric.unattempted_count;
    node.ownScore += metric.score;
    node.ownMaxScore += metric.max_score;
    node.ownTimeWeightedSeconds += (metric.avg_time_seconds ?? 0) * metric.total_questions;
  }

  const roots: MutableNode[] = [];
  for (const node of nodeMap.values()) {
    const parent = node.parent_id !== null ? nodeMap.get(node.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollUp(node: MutableNode): void {
    let totalQuestions = node.ownTotalQuestions;
    let correctCount = node.ownCorrectCount;
    let incorrectCount = node.ownIncorrectCount;
    let unattemptedCount = node.ownUnattemptedCount;
    let score = node.ownScore;
    let maxScore = node.ownMaxScore;
    let timeWeightedSeconds = node.ownTimeWeightedSeconds;

    for (const child of node.children) {
      rollUp(child);
      totalQuestions += child.total_questions;
      correctCount += child.correct_count;
      incorrectCount += child.incorrect_count;
      unattemptedCount += child.unattempted_count;
      score += child.score;
      maxScore += child.max_score;
      timeWeightedSeconds += child.avg_time_seconds * child.total_questions;
    }

    node.total_questions = totalQuestions;
    node.correct_count = correctCount;
    node.incorrect_count = incorrectCount;
    node.unattempted_count = unattemptedCount;
    node.score = score;
    node.max_score = maxScore;
    node.score_percent = scorePercent(score, maxScore);
    node.accuracy = attemptedAccuracy(correctCount, incorrectCount);
    node.avg_time_seconds = totalQuestions > 0 ? timeWeightedSeconds / totalQuestions : 0;
  }

  for (const root of roots) {
    rollUp(root);
  }

  function prune(node: MutableNode): MutableNode | null {
    const prunedChildren = node.children
      .map((child) => prune(child))
      .filter((child): child is MutableNode => child !== null);
    node.children = prunedChildren;
    if (node.total_questions <= 0) return null;
    return node;
  }

  const prunedRoots = roots
    .map((root) => prune(root))
    .filter((root): root is MutableNode => root !== null);

  function sortTree(node: MutableNode): void {
    node.children.sort((a, b) => a.score_percent - b.score_percent);
    for (const child of node.children) {
      sortTree(child);
    }
  }

  prunedRoots.sort((a, b) => a.score_percent - b.score_percent);
  for (const root of prunedRoots) {
    sortTree(root);
  }

  return prunedRoots;
}

/** Flattens a performance tree into a list annotated with depth, for consumers that want a flat table instead of nesting. */
export function flattenPerformanceTree(
  roots: PerformanceTreeNode[]
): Array<PerformanceTreeNode & { depth: number }> {
  const out: Array<PerformanceTreeNode & { depth: number }> = [];
  function visit(node: PerformanceTreeNode, depth: number): void {
    out.push({ ...node, depth });
    for (const child of node.children) visit(child, depth + 1);
  }
  for (const root of roots) visit(root, 0);
  return out;
}
