"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

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
  accuracy: number;
  avg_time_seconds: number;
  children: PerformanceTreeNode[];
};

function attemptedQuestions(node: PerformanceTreeNode): number {
  return node.correct_count + node.incorrect_count;
}

function accuracyColor(accuracy: number, hasData: boolean): { text: string; bar: string; badge: string } {
  if (!hasData) return { text: "text-slate-400", bar: "bg-slate-300", badge: "bg-slate-50 text-slate-400 border-slate-200" };
  if (accuracy >= 0.7) return { text: "text-emerald-700", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (accuracy >= 0.4) return { text: "text-amber-700", bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" };
  return { text: "text-rose-700", bar: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200" };
}

function nodeTypeLabel(nodeType: string): string {
  if (nodeType === "source_bucket") return "Book";
  if (!nodeType) return "Topic";
  return nodeType.replaceAll("_", " ");
}

/** Flattens a performance tree into a single list — useful for a top-N weak/strong summary that still reflects rolled-up ancestor accuracy, not just leaf tags. */
export function flattenPerformanceTree(roots: PerformanceTreeNode[]): PerformanceTreeNode[] {
  const out: PerformanceTreeNode[] = [];
  function visit(node: PerformanceTreeNode) {
    out.push(node);
    for (const child of node.children) visit(child);
  }
  for (const root of roots) visit(root);
  return out;
}

function TreeRow({
  node,
  depth,
  categoryHref
}: {
  node: PerformanceTreeNode;
  depth: number;
  categoryHref?: (nodeId: number) => string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const attempted = attemptedQuestions(node);
  const hasData = attempted > 0;
  const colors = accuracyColor(node.accuracy, hasData);
  const pct = hasData ? Math.round(node.accuracy * 100) : null;

  return (
    <div className={depth > 0 ? "ml-3.5 border-l border-slate-150 pl-3" : ""}>
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
          depth === 0 ? "border-slate-200 bg-surface shadow-sm" : "border-slate-150 bg-slate-50/60"
        }`}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className={`shrink-0 rounded-md p-0.5 ${hasChildren ? "text-slate-400 hover:bg-slate-100" : "text-transparent"}`}
          aria-label={hasChildren ? (expanded ? "Collapse" : "Expand") : undefined}
          tabIndex={hasChildren ? 0 : -1}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm ${depth === 0 ? "font-black text-slate-950" : "font-bold text-slate-800"}`}>
              {node.name}
            </p>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              {nodeTypeLabel(node.node_type)}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">
            {hasData
              ? `${node.correct_count}/${node.total_questions} correct-ready · ${node.unattempted_count} skipped`
              : "No attempts yet"}
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: hasData ? `${Math.max(4, pct ?? 0)}%` : "0%" }} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-sm font-black ${colors.text}`}>{pct !== null ? `${pct}%` : "--"}</span>
          {categoryHref && node.total_questions > 0 && (
            <Link
              href={categoryHref(node.id)}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
            >
              Open <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1.5 space-y-1.5">
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} categoryHref={categoryHref} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PerformanceTree({
  roots,
  categoryHref,
  emptyMessage = "No performance data available yet."
}: {
  roots: PerformanceTreeNode[];
  categoryHref?: (nodeId: number) => string;
  emptyMessage?: string;
}) {
  if (roots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {roots.map((root) => (
        <TreeRow key={root.id} node={root} depth={0} categoryHref={categoryHref} />
      ))}
    </div>
  );
}
