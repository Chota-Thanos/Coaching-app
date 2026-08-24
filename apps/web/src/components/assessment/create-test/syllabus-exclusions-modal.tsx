"use client";

// Lets a student hide syllabus categories they aren't preparing for, so the
// category picker (and everywhere else that reads this exclusion list) only
// ever shows what's actually relevant to them. Ported from the old
// custom-test/create page's "Customize Syllabus View" modal when the picker
// was rebuilt — same backend (/api/v1/assessment/taxonomy/excluded), same
// recursive-cascade toggle behavior.

import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { authenticatedGet, authenticatedPost, useAuth } from "../../auth/auth-context";
import type { ContentType } from "./category-picker";

type FlatNode = {
  id: number;
  name: string;
  node_type: string;
  parent_id: number | null;
};

type FilterTreeNode = FlatNode & { children: FilterTreeNode[] };

function buildFilterTree(nodes: FlatNode[]): FilterTreeNode[] {
  const map = new Map<number, FilterTreeNode>();
  const roots: FilterTreeNode[] = [];
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (list: FilterTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

export function SyllabusExclusionsModal({
  contentType,
  examId,
  onClose,
  onSaved
}: {
  contentType: ContentType;
  examId: number;
  onClose: () => void;
  onSaved: (excludedIds: number[]) => void;
}) {
  const { token } = useAuth();
  const taxonomyType: "objective" | "mains" = contentType === "mains" ? "mains" : "objective";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<FlatNode[]>([]);
  const [excludedSet, setExcludedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const path = contentType === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${examId}&limit=1000`
          : `/api/v1/assessment/taxonomy-nodes?exam_id=${examId}&limit=1000`;
        const [nodesRes, excludedRes] = await Promise.all([
          authenticatedGet<any[]>(path, token),
          authenticatedGet<{ objective: number[]; mains: number[] }>("/api/v1/assessment/taxonomy/excluded", token)
        ]);
        if (cancelled) return;
        const scoped = contentType === "mains"
          ? nodesRes || []
          : (nodesRes || []).filter((n) => n.content_type === contentType);
        setNodes(scoped);
        setExcludedSet(new Set(taxonomyType === "mains" ? excludedRes.mains : excludedRes.objective));
      } catch {
        if (!cancelled) setNodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentType, examId, token, taxonomyType]);

  const tree = useMemo(() => buildFilterTree(nodes), [nodes]);

  const getDescendantIds = (nodeId: number): number[] => {
    const ids: number[] = [];
    nodes.forEach((n) => {
      if (n.parent_id === nodeId) {
        ids.push(n.id, ...getDescendantIds(n.id));
      }
    });
    return ids;
  };

  const toggleNode = (nodeId: number, isCurrentlyIncluded: boolean) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      const descendants = getDescendantIds(nodeId);
      if (isCurrentlyIncluded) {
        next.add(nodeId);
        descendants.forEach((id) => next.add(id));
      } else {
        next.delete(nodeId);
        descendants.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const excludedIds = Array.from(excludedSet);
      await authenticatedPost(
        "/api/v1/assessment/taxonomy/excluded",
        token,
        { taxonomy_type: taxonomyType, excluded_node_ids: excludedIds }
      );
      onSaved(excludedIds);
      onClose();
    } catch {
      // Leave the modal open with the error implicit — the Save button
      // re-enabling is feedback enough for a low-stakes settings action.
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await authenticatedPost(
        "/api/v1/assessment/taxonomy/excluded",
        token,
        { taxonomy_type: taxonomyType, excluded_node_ids: [] }
      );
      setExcludedSet(new Set());
      onSaved([]);
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: FilterTreeNode, depth: number) => {
    const isIncluded = !excludedSet.has(node.id);
    return (
      <div key={node.id}>
        <label
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={() => toggleNode(node.id, isIncluded)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className={`text-sm font-semibold ${isIncluded ? "text-slate-800" : "text-slate-400 line-through"}`}>
            {node.name}
          </span>
        </label>
        {node.children.length > 0 && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
              <SlidersHorizontal className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              Customize Syllabus View
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Hide categories you're not preparing for. Hidden categories (and everything under them) stay hidden until you bring them back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading syllabus…
            </div>
          ) : tree.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-slate-400">No categories loaded.</p>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
          <button
            type="button"
            disabled={saving}
            onClick={handleReset}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
          >
            Reset to Default
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-surface px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-md shadow-indigo-600/10 transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              Save Custom View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
