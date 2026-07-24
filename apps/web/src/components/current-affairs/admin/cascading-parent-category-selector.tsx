"use client";

import { FolderTree, ListFilter } from "lucide-react";
import { useMemo, useState } from "react";
import type { CategoryNode } from "../../../lib/api";
import type { ContentFamily } from "../../../lib/current-affairs";

function formatNodeType(value: string): string {
  return value.replace(/_/g, " ");
}

type ParentCategoryOption = {
  category: CategoryNode;
  depth: number;
  label: string;
};

type CascadingParentCategorySelectorProps = {
  categories: CategoryNode[];
  contentFamily: ContentFamily;
  value: string;
  onChange: (parentId: string) => void;
  excludedIds?: Set<number>;
  disabled?: boolean;
  label?: string;
};

function buildTreeNodes(categories: CategoryNode[], excludedIds?: Set<number>) {
  const nodeMap = new Map<number, CategoryNode & { children: CategoryNode[] }>();
  
  categories.forEach((cat) => {
    if (excludedIds?.has(cat.id)) return;
    nodeMap.set(cat.id, { ...cat, children: [] });
  });

  const roots: (CategoryNode & { children: CategoryNode[] })[] = [];

  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: typeof roots) => {
    return items.sort((a, b) => {
      const orderDelta = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDelta !== 0) return orderDelta;
      return a.name.localeCompare(b.name);
    });
  };

  const sortRecursive = (items: typeof roots) => {
    sortNodes(items);
    items.forEach((item) => sortRecursive(item.children as typeof roots));
  };

  sortRecursive(roots);
  return { nodeMap, roots };
}

function flattenTreeOptions(
  categories: CategoryNode[],
  excludedIds?: Set<number>
): ParentCategoryOption[] {
  const { roots } = buildTreeNodes(categories, excludedIds);
  const options: ParentCategoryOption[] = [];

  function walk(nodes: (CategoryNode & { children: CategoryNode[] })[], depth: number) {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const prefix = depth === 0 ? "" : isLast ? "\u00A0\u00A0└─ " : "\u00A0\u00A0├─ ";
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(Math.max(0, depth - 1));
      const depthBadge = `[L${depth + 1}:${formatNodeType(node.node_type)}]`;
      
      options.push({
        category: node,
        depth,
        label: `${indent}${prefix}${node.name} ${depthBadge}`
      });

      if (node.children.length > 0) {
        walk(node.children as typeof nodes, depth + 1);
      }
    });
  }

  walk(roots, 0);
  return options;
}

export function CascadingParentCategorySelector({
  categories,
  contentFamily,
  value,
  onChange,
  excludedIds,
  disabled = false,
  label = "Parent category"
}: CascadingParentCategorySelectorProps) {
  const [mode, setMode] = useState<"cascading" | "tree">("cascading");

  // Filter relevant categories for this family
  const familyCategories = useMemo(() => {
    return categories.filter(
      (cat) => cat.content_family === contentFamily && (!excludedIds || !excludedIds.has(cat.id))
    );
  }, [categories, contentFamily, excludedIds]);

  const categoriesById = useMemo(() => {
    return new Map(familyCategories.map((cat) => [cat.id, cat]));
  }, [familyCategories]);

  // Compute breadcrumb path for current value
  const breadcrumbPath = useMemo(() => {
    if (!value) return [];
    const path: CategoryNode[] = [];
    let currentId: number | null = Number(value);
    const visited = new Set<number>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const cat = categoriesById.get(currentId);
      if (!cat) break;
      path.unshift(cat);
      currentId = cat.parent_id;
    }
    return path;
  }, [value, categoriesById]);

  // Hierarchical parent steps calculation
  const level1Categories = useMemo(() => {
    return familyCategories.filter((c) => !c.parent_id || !categoriesById.has(c.parent_id));
  }, [familyCategories, categoriesById]);

  // Selected level IDs derived from current value's lineage or selection state
  const level1SelectedId = useMemo(() => {
    return breadcrumbPath[0]?.id ? String(breadcrumbPath[0].id) : "";
  }, [breadcrumbPath]);

  const level2Categories = useMemo(() => {
    if (!level1SelectedId) return [];
    return familyCategories.filter((c) => String(c.parent_id) === level1SelectedId);
  }, [familyCategories, level1SelectedId]);

  const level2SelectedId = useMemo(() => {
    return breadcrumbPath[1]?.id ? String(breadcrumbPath[1].id) : "";
  }, [breadcrumbPath]);

  const level3Categories = useMemo(() => {
    if (!level2SelectedId) return [];
    return familyCategories.filter((c) => String(c.parent_id) === level2SelectedId);
  }, [familyCategories, level2SelectedId]);

  const level3SelectedId = useMemo(() => {
    return breadcrumbPath[2]?.id ? String(breadcrumbPath[2].id) : "";
  }, [breadcrumbPath]);

  // Flat tree options for tree mode
  const treeOptions = useMemo(() => {
    return flattenTreeOptions(familyCategories, excludedIds);
  }, [familyCategories, excludedIds]);

  const rootParentTitle = contentFamily === "mains" ? "No parent (Root GS Paper)" : "No parent (Root Subject)";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-bold text-ink">{label}</label>
        <button
          className="inline-flex items-center gap-1 text-xs font-semibold text-civic hover:underline"
          onClick={() => setMode((m) => (m === "cascading" ? "tree" : "cascading"))}
          type="button"
        >
          {mode === "cascading" ? (
            <>
              <ListFilter className="h-3.5 w-3.5" /> Single tree view
            </>
          ) : (
            <>
              <FolderTree className="h-3.5 w-3.5" /> Step-by-Step view
            </>
          )}
        </button>
      </div>

      {mode === "cascading" ? (
        <div className="grid gap-2.5 rounded-lg border border-line bg-paper/30 p-3">
          {/* Level 1: Root Subject / GS Paper */}
          <div className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Step 1: Select 1st Level (Subject / GS Paper)
            </span>
            <select
              className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink focus:border-civic disabled:opacity-60"
              disabled={disabled}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val);
              }}
              value={level1SelectedId}
            >
              <option value="">{rootParentTitle}</option>
              {level1Categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({formatNodeType(cat.node_type)})
                </option>
              ))}
            </select>
          </div>

          {/* Level 2: Topic under Level 1 */}
          {level1SelectedId && (
            <div className="grid gap-1 pl-2 border-l-2 border-civic/40">
              <span className="text-xs font-bold uppercase tracking-wider text-civic">
                Step 2: Select 2nd Level Topic (Optional)
              </span>
              <select
                className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink focus:border-civic disabled:opacity-60"
                disabled={disabled}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(val || level1SelectedId);
                }}
                value={level2SelectedId}
              >
                <option value="">
                  [Direct child of {categoriesById.get(Number(level1SelectedId))?.name ?? "Step 1"}]
                </option>
                {level2Categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({formatNodeType(cat.node_type)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Level 3: Subtopic under Level 2 */}
          {level2SelectedId && (
            <div className="grid gap-1 pl-4 border-l-2 border-berry/40">
              <span className="text-xs font-bold uppercase tracking-wider text-berry">
                Step 3: Select 3rd Level Subtopic (Optional)
              </span>
              <select
                className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink focus:border-civic disabled:opacity-60"
                disabled={disabled}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(val || level2SelectedId);
                }}
                value={level3SelectedId}
              >
                <option value="">
                  [Direct child of {categoriesById.get(Number(level2SelectedId))?.name ?? "Step 2"}]
                </option>
                {level3Categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({formatNodeType(cat.node_type)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        /* Single Tree View Dropdown */
        <select
          className="h-11 rounded-md border border-line bg-surface px-3 text-sm font-normal text-ink focus:border-civic disabled:opacity-60"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          value={value}
        >
          <option value="">{rootParentTitle}</option>
          {treeOptions.map((option) => (
            <option key={option.category.id} value={option.category.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Target Path Breadcrumb Summary */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line/60 bg-paper/60 px-2.5 py-1.5 text-xs text-ink/75">
        <span className="font-bold text-ink">Assigned Location:</span>
        <span className="rounded bg-civic/10 px-1.5 py-0.5 font-bold text-civic">
          {contentFamily.toUpperCase()}
        </span>
        {breadcrumbPath.length === 0 ? (
          <span className="font-medium text-ink/60">→ Root Subject Level (Level 1)</span>
        ) : (
          breadcrumbPath.map((item, idx) => (
            <span className="flex items-center gap-1 font-semibold" key={item.id}>
              <span>→</span>
              <span className="rounded bg-surface px-1.5 py-0.5 border border-line shadow-2xs">
                {item.name} <span className="text-[10px] text-ink/50">({formatNodeType(item.node_type)})</span>
              </span>
              {idx === breadcrumbPath.length - 1 && (
                <span className="text-[11px] text-civic font-bold ml-1">
                  (New item will nest here as Level {breadcrumbPath.length + 1})
                </span>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
