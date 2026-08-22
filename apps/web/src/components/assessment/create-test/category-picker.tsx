"use client";

// Shared taxonomy category picker used by every step of the create-test
// wizard that needs to select subjects/sources/topics/subtopics: Manual
// Create-New, Manual Add-to-Existing, and the AI-Assisted config step. Both
// Manual and AI-Assisted only ever pick from the existing published question
// bank — AI-Assisted just offers a more guided single-screen flow around the
// same selection, it never generates new content.
//
// Unlike the older custom-test/create wizard and assessment-home.tsx's cart
// builder, this picker never reconstructs "is this node a subject, a source,
// a topic, or a subtopic" from its depth in the tree — it renders every
// level (including the previously-skipped "Source" level) using the node's
// real node_type, and always keeps the raw node id around.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, BookOpen, ChevronRight, Hash, Layers, Loader2, Minus, Plus, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import { resolveMediaUrl } from "../../../lib/api";
import { SyllabusExclusionsModal } from "./syllabus-exclusions-modal";

export type ContentType = "gk" | "aptitude" | "mains";

export type PickerTreeNode = {
  id: number;
  name: string;
  node_type: string;
  parent_id: number | null;
  image_url?: string | null;
  children: PickerTreeNode[];
};

export type CategoryBasketItem = {
  node: PickerTreeNode;
  count: number;
};

export type CategorySelectionSpec = {
  subject_node_id?: number | null;
  topic_node_id?: number | null;
  subtopic_node_id?: number | null;
  question_count: number;
  question_family?: "objective" | "mains_subjective";
  is_user_private?: boolean | null;
};

const PER_CATEGORY_MAX = 50; // matches the server's compiledCategorySchema question_count cap

const NODE_TYPE_LABELS: Record<string, string> = {
  subject: "Subject",
  source_bucket: "Source",
  topic: "Topic",
  subtopic: "Subtopic",
  paper: "Paper",
  subject_area: "Subject Area",
  theme: "Theme"
};

function levelLabel(nodeType: string): string {
  return NODE_TYPE_LABELS[nodeType] ?? nodeType.replace(/_/g, " ");
}

function buildTree(nodes: any[]): PickerTreeNode[] {
  const nodeMap = new Map<number, PickerTreeNode>();
  const roots: PickerTreeNode[] = [];

  nodes.forEach((n) => {
    nodeMap.set(Number(n.id), {
      id: Number(n.id),
      name: n.name,
      node_type: n.node_type,
      parent_id: n.parent_id ? Number(n.parent_id) : null,
      image_url: n.image_url ?? null,
      children: []
    });
  });

  Array.from(nodeMap.values()).forEach((current) => {
    if (current.parent_id && nodeMap.has(current.parent_id)) {
      nodeMap.get(current.parent_id)!.children.push(current);
    } else {
      roots.push(current);
    }
  });

  const sortNodes = (list: PickerTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function countDescendants(node: PickerTreeNode, counts: Record<number, number>): number {
  if (node.children.length === 0) return counts[node.id] ?? 0;
  return node.children.reduce((sum, child) => sum + countDescendants(child, counts), counts[node.id] ?? 0);
}

/** The server resolves any node id placed in subject_node_id down through
 * its full descendant tree, so the picked node's raw id always goes there
 * regardless of its real node_type — the picker never needs to classify
 * subject/source/topic/subtopic itself. */
export function toCategorySelectionSpecs(
  basket: CategoryBasketItem[],
  questionFamily: "objective" | "mains_subjective"
): CategorySelectionSpec[] {
  return basket
    .filter((item) => item.count > 0)
    .map((item) => ({
      subject_node_id: item.node.id,
      question_count: item.count,
      question_family: questionFamily
    }));
}

function flattenIndex(tree: PickerTreeNode[]): Map<number, PickerTreeNode> {
  const map = new Map<number, PickerTreeNode>();
  const walk = (nodes: PickerTreeNode[]) => {
    nodes.forEach((n) => {
      map.set(n.id, n);
      walk(n.children);
    });
  };
  walk(tree);
  return map;
}

/** node.id (or any excluded ancestor's id) hides the whole subtree. */
function filterExcluded(nodes: any[], excludedIds: Set<number>): any[] {
  if (excludedIds.size === 0) return nodes;
  const excluded = new Set(excludedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      const parentId = n.parent_id ? Number(n.parent_id) : null;
      if (parentId != null && excluded.has(parentId) && !excluded.has(Number(n.id))) {
        excluded.add(Number(n.id));
        changed = true;
      }
    }
  }
  return nodes.filter((n) => !excluded.has(Number(n.id)));
}

// Icon + gradient fallback art per level, used whenever a node has no
// admin-uploaded image_url — keeps every level of the tree visually
// scannable and gives the picker a designed look even before art exists,
// instead of a flat gray box or a plain-text row.
const NODE_TYPE_ICONS: Record<string, LucideIcon> = {
  subject: Layers,
  paper: Layers,
  source_bucket: BookOpen,
  subject_area: BookOpen,
  topic: Hash,
  theme: Hash,
  subtopic: Bookmark
};

const NODE_TYPE_GRADIENTS: Record<string, string> = {
  subject: "from-indigo-500 to-indigo-700",
  paper: "from-indigo-500 to-indigo-700",
  source_bucket: "from-amber-400 to-orange-600",
  subject_area: "from-amber-400 to-orange-600",
  topic: "from-emerald-400 to-emerald-600",
  theme: "from-emerald-400 to-emerald-600",
  subtopic: "from-rose-400 to-pink-600"
};

function nodeGradient(nodeType: string): string {
  return NODE_TYPE_GRADIENTS[nodeType] ?? "from-slate-400 to-slate-600";
}

function NodeArt({ node, className, iconClassName }: { node: PickerTreeNode; className?: string; iconClassName?: string }) {
  const Icon = NODE_TYPE_ICONS[node.node_type] ?? Layers;
  const resolvedImage = node.image_url ? resolveMediaUrl(node.image_url) : null;
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${nodeGradient(node.node_type)}`}>
        <Icon className={iconClassName ?? "h-5 w-5 text-white/90"} aria-hidden="true" />
      </div>
      {resolvedImage && (
        <img
          src={resolvedImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

export function CategoryPicker({
  contentType,
  examId,
  questionFamily,
  remainingCapacity,
  basket,
  onBasketChange,
  tourIds
}: {
  contentType: ContentType;
  examId: number | null;
  questionFamily: "objective" | "mains_subjective";
  /** How many more questions can still be added across the whole basket
   * (tier cap minus whatever's already committed elsewhere). Caps every
   * per-node stepper so the basket total can never exceed it. */
  remainingCapacity: number;
  basket: CategoryBasketItem[];
  onBasketChange: (items: CategoryBasketItem[]) => void;
  /** Tags the first row's "Browse sub-categories"/"Add" buttons with
   * #tour-subject-expand/#tour-add-topic-btn for the guided product tour. */
  tourIds?: boolean;
}) {
  const { token } = useAuth();
  const [rawNodes, setRawNodes] = useState<any[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillPath, setDrillPath] = useState<PickerTreeNode[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({});
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const path = contentType === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${examId}&limit=1000`
          : `/api/v1/assessment/taxonomy-nodes?exam_id=${examId}&limit=1000`;
        const data = await authenticatedGet<any[]>(path, token || "");
        if (cancelled) return;
        setRawNodes(contentType === "mains" ? data || [] : (data || []).filter((n) => n.content_type === contentType));
        setDrillPath([]);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load the syllabus for this section.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentType, examId, token]);

  // Which categories the student has hidden via "Customize Syllabus View" —
  // signed-in only, since there's nothing to persist for a guest.
  useEffect(() => {
    if (!token) {
      setExcludedIds(new Set());
      return;
    }
    let cancelled = false;
    authenticatedGet<{ objective: number[]; mains: number[] }>("/api/v1/assessment/taxonomy/excluded", token)
      .then((data) => {
        if (cancelled) return;
        setExcludedIds(new Set(contentType === "mains" ? data.mains : data.objective));
      })
      .catch(() => {
        if (!cancelled) setExcludedIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [token, contentType]);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    setLoadingCounts(true);
    (async () => {
      try {
        const records = await authenticatedGet<any[]>(
          `/api/v1/assessment/question-counts?exam_id=${examId}&question_family=${questionFamily}`,
          token || ""
        );
        if (cancelled) return;
        setCounts(Object.fromEntries((records || []).map((r) => [Number(r.node_id), Number(r.question_count)])));
      } catch {
        if (!cancelled) setCounts({});
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, questionFamily, token]);

  const nodes = useMemo(() => filterExcluded(rawNodes, excludedIds), [rawNodes, excludedIds]);
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const nodeById = useMemo(() => flattenIndex(tree), [tree]);

  // Unlike assessment-home.tsx's drill browser (which always keeps a subject
  // pre-selected because a separate row of subject tabs sits above it), this
  // picker has no such row — an empty drillPath means "show the top-level
  // subject list", not "auto-drill into the first subject".
  const effectiveDrillPath = useMemo(() => {
    const validPath: PickerTreeNode[] = [];
    let level = tree;
    for (const step of drillPath) {
      const match = level.find((n) => n.id === step.id);
      if (!match) break;
      validPath.push(match);
      level = match.children;
    }
    return validPath;
  }, [drillPath, tree]);

  const currentLevelNodes = effectiveDrillPath.length > 0
    ? effectiveDrillPath[effectiveDrillPath.length - 1]!.children
    : tree;

  const basketTotal = basket.reduce((sum, item) => sum + item.count, 0);
  const remaining = Math.max(0, remainingCapacity - basketTotal);

  const basketByNodeId = useMemo(() => new Map(basket.map((item) => [item.node.id, item.count])), [basket]);

  const availableFor = useCallback(
    (nodeId: number) => {
      const node = nodeById.get(nodeId);
      if (!node) return 0;
      return countDescendants(node, counts);
    },
    [nodeById, counts]
  );

  const maxAddableFor = useCallback(
    (nodeId: number) => {
      const alreadyInBasket = basketByNodeId.get(nodeId) ?? 0;
      const capByTier = remaining + alreadyInBasket;
      return Math.max(0, Math.min(capByTier, PER_CATEGORY_MAX, availableFor(nodeId)));
    },
    [availableFor, basketByNodeId, remaining]
  );

  const getPendingCount = (nodeId: number) => {
    const max = maxAddableFor(nodeId);
    if (max <= 0) return 0;
    const fallback = Math.min(10, max);
    return Math.max(1, Math.min(pendingCounts[nodeId] ?? fallback, max));
  };

  const setPendingCount = (nodeId: number, value: number) => {
    const max = maxAddableFor(nodeId);
    setPendingCounts((prev) => ({ ...prev, [nodeId]: Math.max(1, Math.min(value, Math.max(1, max))) }));
  };

  const addToBasket = (node: PickerTreeNode) => {
    const count = getPendingCount(node.id);
    if (count <= 0) return;
    const existingIndex = basket.findIndex((item) => item.node.id === node.id);
    if (existingIndex >= 0) {
      const next = [...basket];
      const existing = next[existingIndex]!;
      next[existingIndex] = { ...existing, count: Math.min(existing.count + count, existing.count + maxAddableFor(node.id)) };
      onBasketChange(next);
    } else {
      onBasketChange([...basket, { node, count }]);
    }
    setPendingCounts((prev) => ({ ...prev, [node.id]: 1 }));
  };

  const removeFromBasket = (nodeId: number) => {
    onBasketChange(basket.filter((item) => item.node.id !== nodeId));
  };

  if (!examId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-surface p-8 text-sm font-semibold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading syllabus…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
    );
  }

  const activeTopLevelId = effectiveDrillPath[0]?.id ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        {/* Horizontal top-level subject strip — quick-jump to any subject
            without drilling in one level at a time; "All" resets to the
            flat top-level list. */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setDrillPath([])}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 transition ${
                activeTopLevelId === null
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-surface text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40"
              }`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 text-base">🗂️</span>
              <span className="text-[11px] font-black">All</span>
            </button>
            {tree.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setDrillPath([node])}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 transition ${
                  activeTopLevelId === node.id
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-surface text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40"
                }`}
              >
                <NodeArt node={node} className="h-9 w-9 rounded-lg" iconClassName="h-4 w-4 text-white/90" />
                <span className="max-w-[5.5rem] truncate text-[11px] font-black">{node.name}</span>
              </button>
            ))}
          </div>
          {token && (
            <button
              type="button"
              onClick={() => setShowCustomize(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-bold text-indigo-650 transition hover:bg-indigo-100"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Customize
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-slate-500">
          <button
            type="button"
            onClick={() => setDrillPath([])}
            className="rounded-md px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-900"
          >
            All
          </button>
          {effectiveDrillPath.map((node, idx) => (
            <span key={node.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setDrillPath(effectiveDrillPath.slice(0, idx + 1))}
                className={`rounded-md px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-900 ${
                  idx === effectiveDrillPath.length - 1 ? "text-indigo-700" : ""
                }`}
              >
                {node.name}
              </button>
            </span>
          ))}
        </div>

        {currentLevelNodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-6 text-center text-sm font-semibold text-slate-500">
            No sub-categories here.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {currentLevelNodes.map((node, nodeIdx) => {
              const hasChildren = node.children.length > 0;
              const available = availableFor(node.id);
              const maxAddable = maxAddableFor(node.id);
              const pending = getPendingCount(node.id);
              const inBasket = basketByNodeId.get(node.id) ?? 0;
              const isFirstExpandable = tourIds && hasChildren && currentLevelNodes.slice(0, nodeIdx).every((n) => n.children.length === 0);

              return (
                <div
                  key={node.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <NodeArt node={node} className="aspect-square w-full" iconClassName="h-10 w-10 text-white/90" />

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 text-[9px] font-[800] uppercase tracking-wider text-indigo-700">
                        {levelLabel(node.node_type)}
                      </span>
                      {inBasket > 0 && (
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-[800] text-emerald-700">
                          {inBasket} added
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-black leading-snug text-slate-900">{node.name}</p>
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-[800] ${
                        available > 0 ? "border-indigo-100 bg-indigo-50 text-indigo-700" : "border-rose-100 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {loadingCounts ? "Checking…" : `${available} available`}
                    </span>

                    {hasChildren ? (
                      <button
                        id={isFirstExpandable ? "tour-subject-expand" : undefined}
                        type="button"
                        onClick={() => setDrillPath([...effectiveDrillPath, node])}
                        className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-[800] text-indigo-700 transition hover:bg-indigo-100"
                      >
                        Browse
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <div className="mt-auto flex items-center gap-1.5">
                        <div className="inline-flex h-9 flex-1 items-center justify-between rounded-[9px] border border-slate-200 bg-surface p-1">
                          <button
                            type="button"
                            aria-label={`Decrease questions for ${node.name}`}
                            disabled={maxAddable <= 0 || pending <= 1}
                            onClick={() => setPendingCount(node.id, pending - 1)}
                            className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-slate-900">{maxAddable <= 0 ? "-" : pending}</span>
                          <button
                            type="button"
                            aria-label={`Increase questions for ${node.name}`}
                            disabled={maxAddable <= 0 || pending >= maxAddable}
                            onClick={() => setPendingCount(node.id, pending + 1)}
                            className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          id={tourIds && nodeIdx === 0 ? "tour-add-topic-btn" : undefined}
                          type="button"
                          disabled={maxAddable <= 0}
                          onClick={() => addToBasket(node)}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[9px] bg-slate-900 px-2.5 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Basket */}
      <div className="h-fit rounded-2xl border border-slate-200 bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Selected</h3>
          <span className="text-xs font-bold text-slate-500">
            {basketTotal} / {remainingCapacity === Infinity ? "∞" : remainingCapacity}
          </span>
        </div>
        {basket.length === 0 ? (
          <p className="mt-3 text-xs font-semibold text-slate-400">
            Pick categories on the left and tap Add — they'll show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {basket.map((item) => (
              <li key={item.node.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800">{item.node.name}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {levelLabel(item.node.node_type)} · {item.count} question{item.count === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.node.name}`}
                  onClick={() => removeFromBasket(item.node.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCustomize && examId && (
        <SyllabusExclusionsModal
          contentType={contentType}
          examId={examId}
          onClose={() => setShowCustomize(false)}
          onSaved={(ids) => setExcludedIds(new Set(ids))}
        />
      )}
    </div>
  );
}
