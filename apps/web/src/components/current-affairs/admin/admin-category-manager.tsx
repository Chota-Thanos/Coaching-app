"use client";

import {
  CheckSquare,
  Edit3,
  FolderPlus,
  FolderTree,
  Layers3,
  MoveRight,
  RefreshCw,
  Save,
  Square,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CategoryNode, CreateCategoryPayload } from "../../../lib/api";
import type { ContentFamily } from "../../../lib/current-affairs";
import { CATEGORY_NODE_TYPES, adminSlug, type CategoryNodeType } from "../../../lib/admin-current-affairs";
import {
  authenticatedDelete,
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  useAuth
} from "../../auth/auth-context";

type CategoryFormState = {
  contentFamily: ContentFamily;
  parentId: string;
  nodeType: CategoryNodeType;
  name: string;
  slug: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
};

type BulkCreateState = {
  contentFamily: ContentFamily;
  parentId: string;
  nodeType: CategoryNodeType;
  lines: string;
  displayOrder: string;
  isActive: boolean;
};

type BulkReassignState = {
  parentId: string;
  nodeType: CategoryNodeType;
};

type CategoryTreeNode = CategoryNode & {
  children: CategoryTreeNode[];
  depth: number;
};

type ParentOption = {
  category: CategoryNode;
  depth: number;
  label: string;
};

const initialState: CategoryFormState = {
  contentFamily: "prelims",
  parentId: "",
  nodeType: "subject",
  name: "",
  slug: "",
  description: "",
  displayOrder: "0",
  isActive: true
};

const initialBulkCreateState: BulkCreateState = {
  contentFamily: "prelims",
  parentId: "",
  nodeType: "subject",
  lines: "",
  displayOrder: "0",
  isActive: true
};

const initialBulkReassignState: BulkReassignState = {
  parentId: "",
  nodeType: "subject"
};

function formatFamily(value: ContentFamily): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatNodeType(value: string): string {
  return value.replace(/_/g, " ");
}

function rootParentLabel(contentFamily: ContentFamily | null): string {
  return contentFamily === "mains" ? "No parent: root GS Paper" : "No parent: root subject";
}

function sortCategories<T extends CategoryNode>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderDelta = Number(a.display_order ?? 0) - Number(b.display_order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return a.name.localeCompare(b.name);
  });
}

function buildCategoryTree(categories: CategoryNode[]): CategoryTreeNode[] {
  const nodes = new Map<number, CategoryTreeNode>();
  sortCategories(categories).forEach((category) => {
    nodes.set(category.id, { ...category, children: [], depth: 0 });
  });

  const roots: CategoryTreeNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parent_id ? nodes.get(node.parent_id) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  function assignDepth(items: CategoryTreeNode[], depth: number): void {
    items.forEach((item) => {
      item.depth = depth;
      item.children = sortCategories(item.children);
      assignDepth(item.children, depth + 1);
    });
  }

  const sortedRoots = sortCategories(roots);
  assignDepth(sortedRoots, 0);
  return sortedRoots;
}

function flattenTree(nodes: CategoryTreeNode[]): ParentOption[] {
  const options: ParentOption[] = [];
  function walk(items: CategoryTreeNode[]): void {
    items.forEach((item) => {
      options.push({
        category: item,
        depth: item.depth,
        label: `${"  ".repeat(item.depth)}${item.name} (${formatNodeType(item.node_type)})`
      });
      walk(item.children);
    });
  }
  walk(nodes);
  return options;
}

function nodeTypeForParent(parent: CategoryNode | null | undefined, contentFamily: ContentFamily): CategoryNodeType {
  if (!parent) return contentFamily === "mains" ? "gs_paper" : "subject";
  if (parent.node_type === "gs_paper") return "subject";
  if (parent.node_type === "subject") return "topic";
  return "subtopic";
}

function parseBulkLine(line: string): { description?: string; name: string; slug?: string } | null {
  const parts = line.split("|").map((part) => part.trim());
  const name = parts[0] ?? "";
  if (!name) return null;
  return {
    name,
    slug: parts[1] ? adminSlug(parts[1], "category") : undefined,
    description: parts[2] || undefined
  };
}

function descendantIds(categories: CategoryNode[], ids: Set<number>): Set<number> {
  const childrenByParent = new Map<number, CategoryNode[]>();
  categories.forEach((category) => {
    if (!category.parent_id) return;
    const children = childrenByParent.get(category.parent_id) ?? [];
    children.push(category);
    childrenByParent.set(category.parent_id, children);
  });

  const result = new Set<number>();
  function walk(id: number): void {
    (childrenByParent.get(id) ?? []).forEach((child) => {
      if (result.has(child.id)) return;
      result.add(child.id);
      walk(child.id);
    });
  }
  ids.forEach(walk);
  return result;
}

function categoryTypeBadgeClass(category: CategoryNode): string {
  if (category.node_type === "gs_paper") return "bg-berry text-white";
  if (category.node_type === "subject") return "bg-civic text-white";
  if (category.node_type === "topic") return "bg-civic/10 text-civic";
  return "bg-paper text-ink/70";
}

function categoryTitleClass(category: CategoryNode): string {
  if (category.node_type === "gs_paper") return "text-xl";
  if (category.node_type === "subject") return "text-lg";
  if (category.node_type === "topic") return "text-sm";
  return "text-xs";
}

function categoryMetaClass(category: CategoryNode): string {
  return category.node_type === "gs_paper" || category.node_type === "subject" ? "text-sm" : "text-xs";
}

type CategoryTreeItemProps = {
  category: CategoryTreeNode;
  selectedIds: Set<number>;
  onDelete: (id: number) => void;
  onEdit: (category: CategoryNode) => void;
  onToggleActive: (category: CategoryNode) => void;
  onToggleSelected: (id: number) => void;
};

function CategoryTreeItem({
  category,
  selectedIds,
  onDelete,
  onEdit,
  onToggleActive,
  onToggleSelected
}: CategoryTreeItemProps) {
  const isSelected = selectedIds.has(category.id);

  return (
    <div className={category.depth === 0 ? "space-y-2" : "space-y-2 border-l border-line pl-4"}>
      <article
        className={`rounded-lg border bg-white shadow-sm ${
          category.node_type === "gs_paper" || category.node_type === "subject" ? "p-3" : "p-2.5"
        } ${
          category.node_type === "gs_paper" ? "border-berry/30" : category.node_type === "subject" ? "border-civic/25" : "border-line"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <button
              aria-label={isSelected ? "Unselect category" : "Select category"}
              className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md border ${
                isSelected ? "border-civic bg-civic text-white" : "border-line bg-white text-ink/55"
              }`}
              onClick={() => onToggleSelected(category.id)}
              type="button"
            >
              {isSelected ? <CheckSquare aria-hidden="true" className="h-4 w-4" /> : <Square aria-hidden="true" className="h-4 w-4" />}
            </button>
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap gap-2">
                <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${categoryTypeBadgeClass(category)}`}>
                  {formatNodeType(category.node_type)}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                    category.is_active === false ? "bg-berry/10 text-berry" : "bg-civic/10 text-civic"
                  }`}
                >
                  {category.is_active === false ? "Inactive" : "Active"}
                </span>
                {category.children.length > 0 && (
                  <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-bold text-ink/60">
                    {category.children.length} child {category.children.length === 1 ? "category" : "categories"}
                  </span>
                )}
              </div>
              <h3 className={`${categoryTitleClass(category)} font-extrabold leading-snug text-ink`}>
                {category.name}
              </h3>
              <p className={`mt-1 ${categoryMetaClass(category)} text-ink/60`}>{category.slug}</p>
              {category.description && (
                <p className={`mt-1.5 ${categoryMetaClass(category)} leading-5 text-ink/65`}>
                  {category.description}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-civic/90"
              onClick={() => onEdit(category)}
              type="button"
            >
              <Edit3 aria-hidden="true" className="h-4 w-4" />
              Edit
            </button>
            <button
              className={`h-10 rounded-md border px-3 text-sm font-bold shadow-sm transition-colors ${
                category.is_active === false
                  ? "border-civic/30 bg-civic text-white hover:bg-civic/90"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
              onClick={() => onToggleActive(category)}
              type="button"
            >
              {category.is_active === false ? "Activate" : "Deactivate"}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-berry/30 bg-berry/10 px-3 text-sm font-bold text-berry shadow-sm transition-colors hover:bg-berry hover:text-white"
              onClick={() => onDelete(category.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </article>

      {category.children.length > 0 && (
        <div className="space-y-2">
          {category.children.map((child) => (
            <CategoryTreeItem
              category={child}
              key={child.id}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onToggleSelected={onToggleSelected}
              selectedIds={selectedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminCategoryManager() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [form, setForm] = useState<CategoryFormState>(initialState);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormState>(initialState);
  const [bulkCreateForm, setBulkCreateForm] = useState<BulkCreateState>(initialBulkCreateState);
  const [bulkReassignForm, setBulkReassignForm] = useState<BulkReassignState>(initialBulkReassignState);
  const [familyFilter, setFamilyFilter] = useState<ContentFamily | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const parentOptions = useMemo(() => {
    const familyCategories = categories.filter((category) => category.content_family === form.contentFamily);
    return flattenTree(buildCategoryTree(familyCategories));
  }, [categories, form.contentFamily]);

  const editParentOptions = useMemo(() => {
    if (!editingCategory) return [];
    const selected = new Set([editingCategory.id]);
    const excludedIds = descendantIds(categories, selected);
    excludedIds.add(editingCategory.id);
    const familyCategories = categories.filter(
      (category) => category.content_family === editingCategory.content_family && !excludedIds.has(category.id)
    );
    return flattenTree(buildCategoryTree(familyCategories));
  }, [categories, editingCategory]);

  const bulkCreateParentOptions = useMemo(() => {
    const familyCategories = categories.filter((category) => category.content_family === bulkCreateForm.contentFamily);
    return flattenTree(buildCategoryTree(familyCategories));
  }, [bulkCreateForm.contentFamily, categories]);

  const selectedCategories = useMemo(
    () => Array.from(selectedIds).map((id) => categoriesById.get(id)).filter(Boolean) as CategoryNode[],
    [categoriesById, selectedIds]
  );

  const selectedFamily = useMemo<ContentFamily | null>(() => {
    const families = new Set(selectedCategories.map((category) => category.content_family));
    if (families.size !== 1) return null;
    return selectedCategories[0]?.content_family ?? null;
  }, [selectedCategories]);

  const excludedReassignIds = useMemo(() => {
    const selected = new Set(selectedIds);
    const descendants = descendantIds(categories, selected);
    descendants.forEach((id) => selected.add(id));
    return selected;
  }, [categories, selectedIds]);

  const bulkReassignParentOptions = useMemo(() => {
    if (!selectedFamily) return [];
    const familyCategories = categories.filter(
      (category) => category.content_family === selectedFamily && !excludedReassignIds.has(category.id)
    );
    return flattenTree(buildCategoryTree(familyCategories));
  }, [categories, excludedReassignIds, selectedFamily]);

  const familyGroups = useMemo(() => {
    const families: ContentFamily[] = familyFilter === "all" ? ["prelims", "mains"] : [familyFilter];
    return families.map((family) => ({
      family,
      roots: buildCategoryTree(categories.filter((category) => category.content_family === family))
    }));
  }, [categories, familyFilter]);

  const visibleCategoryIds = useMemo(() => {
    const ids = new Set<number>();
    familyGroups.forEach((group) => {
      function walk(nodes: CategoryTreeNode[]): void {
        nodes.forEach((node) => {
          ids.add(node.id);
          walk(node.children);
        });
      }
      walk(group.roots);
    });
    return ids;
  }, [familyGroups]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const records = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=1000", token);
      setCategories(records);
    } catch {
      setMessage("Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function update<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateEdit<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]): void {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function updateBulkCreate<K extends keyof BulkCreateState>(key: K, value: BulkCreateState[K]): void {
    setBulkCreateForm((current) => ({ ...current, [key]: value }));
  }

  function handleFamilyChange(value: ContentFamily): void {
    setForm((current) => ({ ...current, contentFamily: value, parentId: "", nodeType: nodeTypeForParent(null, value) }));
  }

  function handleParentChange(value: string): void {
    const parent = value ? categoriesById.get(Number(value)) : null;
    setForm((current) => ({
      ...current,
      parentId: value,
      nodeType: nodeTypeForParent(parent, current.contentFamily)
    }));
  }

  function handleEditParentChange(value: string): void {
    const parent = value ? categoriesById.get(Number(value)) : null;
    setEditForm((current) => ({
      ...current,
      parentId: value,
      nodeType: nodeTypeForParent(parent, current.contentFamily)
    }));
  }

  function openEditCategory(category: CategoryNode): void {
    setEditingCategory(category);
    setEditForm({
      contentFamily: category.content_family,
      parentId: category.parent_id ? String(category.parent_id) : "",
      nodeType: category.node_type as CategoryNodeType,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      displayOrder: String(category.display_order ?? 0),
      isActive: category.is_active !== false
    });
    setMessage(null);
  }

  function closeEditCategory(): void {
    setEditingCategory(null);
    setEditForm(initialState);
  }

  function handleBulkCreateFamilyChange(value: ContentFamily): void {
    setBulkCreateForm((current) => ({ ...current, contentFamily: value, parentId: "", nodeType: nodeTypeForParent(null, value) }));
  }

  function handleBulkCreateParentChange(value: string): void {
    const parent = value ? categoriesById.get(Number(value)) : null;
    setBulkCreateForm((current) => ({
      ...current,
      parentId: value,
      nodeType: nodeTypeForParent(parent, current.contentFamily)
    }));
  }

  function handleBulkReassignParentChange(value: string): void {
    const parent = value ? categoriesById.get(Number(value)) : null;
    setBulkReassignForm({
      parentId: value,
      nodeType: nodeTypeForParent(parent, selectedFamily ?? "prelims")
    });
  }

  function toggleSelected(id: number): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  function selectVisibleCategories(): void {
    setSelectedIds(new Set(visibleCategoryIds));
  }

  async function createCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    const payload: CreateCategoryPayload = {
      content_family: form.contentFamily,
      parent_id: form.parentId ? Number(form.parentId) : null,
      node_type: form.nodeType,
      name: form.name,
      slug: form.slug || adminSlug(form.name, "category"),
      description: form.description || undefined,
      display_order: Number(form.displayOrder || 0),
      is_active: form.isActive
    };

    setSaving(true);
    setMessage(null);
    try {
      await authenticatedPost<CategoryNode>("/api/v1/current-affairs/categories", token, payload);
      setForm(initialState);
      await loadCategories();
      setMessage("Category created.");
    } catch {
      setMessage("Could not create category. Check slug uniqueness within the selected parent.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !editingCategory) return;

    setEditSaving(true);
    setMessage(null);
    try {
      await authenticatedPatch<CategoryNode>(`/api/v1/current-affairs/categories/${editingCategory.id}`, token, {
        parent_id: editForm.parentId ? Number(editForm.parentId) : null,
        node_type: editForm.nodeType,
        name: editForm.name,
        slug: editForm.slug || adminSlug(editForm.name, "category"),
        description: editForm.description || null,
        display_order: Number(editForm.displayOrder || 0),
        is_active: editForm.isActive
      });
      closeEditCategory();
      await loadCategories();
      setMessage("Category updated.");
    } catch {
      setMessage("Could not update category. Check slug uniqueness and parent assignment.");
    } finally {
      setEditSaving(false);
    }
  }

  async function bulkCreateCategories(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    const parsedLines = bulkCreateForm.lines
      .split(/\r?\n/)
      .map(parseBulkLine)
      .filter(Boolean) as Array<{ description?: string; name: string; slug?: string }>;

    if (parsedLines.length === 0) {
      setMessage("Add at least one category name for bulk create.");
      return;
    }

    const startOrder = Number(bulkCreateForm.displayOrder || 0);
    const payload = {
      categories: parsedLines.map((line, index): CreateCategoryPayload => ({
        content_family: bulkCreateForm.contentFamily,
        parent_id: bulkCreateForm.parentId ? Number(bulkCreateForm.parentId) : null,
        node_type: bulkCreateForm.nodeType,
        name: line.name,
        slug: line.slug ?? adminSlug(line.name, "category"),
        description: line.description,
        display_order: startOrder + index,
        is_active: bulkCreateForm.isActive
      }))
    };

    setBulkSaving(true);
    setMessage(null);
    try {
      await authenticatedPost<CategoryNode[]>("/api/v1/current-affairs/categories/bulk", token, payload);
      setBulkCreateForm((current) => ({ ...current, lines: "" }));
      await loadCategories();
      setMessage(`${payload.categories.length} categories created.`);
    } catch {
      setMessage("Bulk create failed. Check duplicate slugs under the same parent.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function bulkReassignCategories(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    if (selectedIds.size === 0) {
      setMessage("Select categories before bulk reassign.");
      return;
    }
    if (!selectedFamily) {
      setMessage("Select categories from one family only.");
      return;
    }

    setBulkSaving(true);
    setMessage(null);
    try {
      await authenticatedPatch<CategoryNode[]>("/api/v1/current-affairs/categories/bulk-reassign", token, {
        category_ids: Array.from(selectedIds),
        parent_id: bulkReassignForm.parentId ? Number(bulkReassignForm.parentId) : null,
        node_type: bulkReassignForm.nodeType
      });
      clearSelection();
      setBulkReassignForm(initialBulkReassignState);
      await loadCategories();
      setMessage("Selected categories reassigned.");
    } catch {
      setMessage("Bulk reassign failed. Check that the target parent is valid.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function toggleCategory(category: CategoryNode): Promise<void> {
    if (!token) return;
    await authenticatedPatch<CategoryNode>(`/api/v1/current-affairs/categories/${category.id}`, token, {
      is_active: category.is_active === false
    });
    await loadCategories();
  }

  async function deleteCategory(categoryId: number): Promise<void> {
    if (!token || !window.confirm("Delete this category and its child categories? Linked articles will be kept with undefined category.")) return;
    setMessage(null);
    try {
      await authenticatedDelete<CategoryNode>(`/api/v1/current-affairs/categories/${categoryId}`, token);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });
      await loadCategories();
      setMessage("Category branch deleted. Linked articles now have undefined category.");
    } catch {
      setMessage("Could not delete category.");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_27rem]">
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-civic">
                <FolderTree aria-hidden="true" className="h-4 w-4" />
                Current affairs taxonomy
              </p>
              <h2 className="mt-1 text-xl font-black text-ink">Subjects with topics nested underneath</h2>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Topics and subtopics now stay visually under their assigned parent. Unassigned nodes appear as roots until reassigned.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Family filter"
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink"
                onChange={(event) => setFamilyFilter(event.target.value as ContentFamily | "all")}
                value={familyFilter}
              >
                <option value="all">All families</option>
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-civic/30 bg-civic px-3 text-sm font-bold text-white shadow-sm hover:bg-civic/90 disabled:opacity-60"
                disabled={loading}
                onClick={loadCategories}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-civic px-3 text-xs font-bold text-white disabled:opacity-60"
              disabled={visibleCategoryIds.size === 0}
              onClick={selectVisibleCategories}
              type="button"
            >
              <CheckSquare aria-hidden="true" className="h-4 w-4" />
              Select visible
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-xs font-bold text-ink hover:bg-paper disabled:opacity-60"
              disabled={selectedIds.size === 0}
              onClick={clearSelection}
              type="button"
            >
              Clear selection
            </button>
            <span className="text-xs font-bold text-ink/60">{selectedIds.size} selected</span>
          </div>
        </div>

        {message && <p className="rounded-lg border border-line bg-white p-3 text-sm font-semibold text-civic">{message}</p>}

        <div className="grid gap-4">
          {familyGroups.every((group) => group.roots.length === 0) ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">No categories found.</p>
          ) : (
            familyGroups.map((group) => (
              <section className="rounded-lg border border-line bg-paper/40 p-3" key={group.family}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-ink">{formatFamily(group.family)}</h3>
                  <span className="rounded-full bg-civic/10 px-3 py-1 text-xs font-bold text-civic">
                    {group.roots.length} root {group.roots.length === 1 ? "node" : "nodes"}
                  </span>
                </div>
                {group.roots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-ink/60">
                    No {formatFamily(group.family)} categories yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {group.roots.map((category) => (
                      <CategoryTreeItem
                        category={category}
                        key={category.id}
                        onDelete={(categoryId) => void deleteCategory(categoryId)}
                        onEdit={openEditCategory}
                        onToggleActive={(node) => void toggleCategory(node)}
                        onToggleSelected={toggleSelected}
                        selectedIds={selectedIds}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
        <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm" onSubmit={createCategory}>
          <div className="flex items-center gap-2">
            <FolderPlus aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">Create category</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Family
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => handleFamilyChange(event.target.value as ContentFamily)}
                value={form.contentFamily}
              >
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-bold text-ink">
              Node type
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => update("nodeType", event.target.value as CategoryNodeType)}
                value={form.nodeType}
              >
                {CATEGORY_NODE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatNodeType(type)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Parent
            <select
              className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
              onChange={(event) => handleParentChange(event.target.value)}
              value={form.parentId}
            >
              <option value="">{rootParentLabel(form.contentFamily)}</option>
              {parentOptions.map((option) => (
                <option key={option.category.id} value={option.category.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Name
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onBlur={() => {
                if (!form.slug) update("slug", adminSlug(form.name, "category"));
              }}
              onChange={(event) => update("name", event.target.value)}
              required
              value={form.name}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Slug
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => update("slug", adminSlug(event.target.value, "category"))}
              required
              value={form.slug}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Description
            <textarea
              className="min-h-24 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
              onChange={(event) => update("description", event.target.value)}
              value={form.description}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Display order
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => update("displayOrder", event.target.value)}
                type="number"
                value={form.displayOrder}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                checked={form.isActive}
                className="h-4 w-4"
                onChange={(event) => update("isActive", event.target.checked)}
                type="checkbox"
              />
              Active
            </label>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            <FolderPlus aria-hidden="true" className="h-4 w-4" />
            {saving ? "Creating..." : "Create category"}
          </button>
        </form>

        <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm" onSubmit={bulkCreateCategories}>
          <div className="flex items-center gap-2">
            <Layers3 aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">Bulk create</h2>
          </div>
          <p className="text-sm leading-6 text-ink/65">
            Create many sibling categories under one parent. Use one line per category. Optional format: Name | slug | description.
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Family
              <select
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
                onChange={(event) => handleBulkCreateFamilyChange(event.target.value as ContentFamily)}
                value={bulkCreateForm.contentFamily}
              >
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Node type
              <select
                className="h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
                onChange={(event) => updateBulkCreate("nodeType", event.target.value as CategoryNodeType)}
                value={bulkCreateForm.nodeType}
              >
                {CATEGORY_NODE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatNodeType(type)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Parent
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
              onChange={(event) => handleBulkCreateParentChange(event.target.value)}
              value={bulkCreateForm.parentId}
            >
              <option value="">{rootParentLabel(bulkCreateForm.contentFamily)}</option>
              {bulkCreateParentOptions.map((option) => (
                <option key={option.category.id} value={option.category.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Category lines
            <textarea
              className="min-h-32 rounded-md border border-line px-3 py-2 text-sm font-normal leading-6"
              onChange={(event) => updateBulkCreate("lines", event.target.value)}
              placeholder={`Banking & Monetary Policy\nElectoral Systems & Reforms\nAgriculture | agriculture | Farm sector issues`}
              value={bulkCreateForm.lines}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Starting order
              <input
                className="h-10 rounded-md border border-line px-3 text-sm font-normal"
                onChange={(event) => updateBulkCreate("displayOrder", event.target.value)}
                type="number"
                value={bulkCreateForm.displayOrder}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                checked={bulkCreateForm.isActive}
                className="h-4 w-4"
                onChange={(event) => updateBulkCreate("isActive", event.target.checked)}
                type="checkbox"
              />
              Active
            </label>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={bulkSaving}
            type="submit"
          >
            <Layers3 aria-hidden="true" className="h-4 w-4" />
            {bulkSaving ? "Creating..." : "Bulk create"}
          </button>
        </form>

        <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm" onSubmit={bulkReassignCategories}>
          <div className="flex items-center gap-2">
            <MoveRight aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">Bulk reassign</h2>
          </div>
          <p className="text-sm leading-6 text-ink/65">
            Move selected categories under a new parent and set their level together.
          </p>

          <p className="rounded-md border border-line bg-paper/40 px-3 py-2 text-sm font-bold text-ink/70">
            {selectedIds.size} selected
            {selectedFamily ? ` - ${formatFamily(selectedFamily)}` : selectedIds.size > 0 ? " - mixed families" : ""}
          </p>

          <label className="grid gap-1 text-sm font-bold text-ink">
            New parent
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
              disabled={!selectedFamily}
              onChange={(event) => handleBulkReassignParentChange(event.target.value)}
              value={bulkReassignForm.parentId}
            >
              <option value="">{rootParentLabel(selectedFamily)}</option>
              {bulkReassignParentOptions.map((option) => (
                <option key={option.category.id} value={option.category.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            New node type
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm font-normal"
              disabled={!selectedFamily}
              onChange={(event) => setBulkReassignForm((current) => ({ ...current, nodeType: event.target.value as CategoryNodeType }))}
              value={bulkReassignForm.nodeType}
            >
              {CATEGORY_NODE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatNodeType(type)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={bulkSaving || selectedIds.size === 0 || !selectedFamily}
            type="submit"
          >
            <MoveRight aria-hidden="true" className="h-4 w-4" />
            {bulkSaving ? "Reassigning..." : "Reassign selected"}
          </button>
        </form>
      </aside>

      {editingCategory && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4 py-8">
          <form
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-2xl"
            onSubmit={saveEditedCategory}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
                  <Edit3 aria-hidden="true" className="h-4 w-4" />
                  Edit category
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-ink">{editingCategory.name}</h2>
              </div>
              <button
                aria-label="Close edit category"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-white text-ink hover:bg-paper"
                onClick={closeEditCategory}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Family
                  <input
                    className="h-11 rounded-md border border-line bg-paper px-3 text-base font-bold text-ink/65"
                    disabled
                    value={formatFamily(editForm.contentFamily)}
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-ink">
                  Node type
                  <select
                    className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                    onChange={(event) => updateEdit("nodeType", event.target.value as CategoryNodeType)}
                    value={editForm.nodeType}
                  >
                    {CATEGORY_NODE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatNodeType(type)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Parent
                <select
                  className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                  onChange={(event) => handleEditParentChange(event.target.value)}
                  value={editForm.parentId}
                >
                  <option value="">{rootParentLabel(editForm.contentFamily)}</option>
                  {editParentOptions.map((option) => (
                    <option key={option.category.id} value={option.category.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Name
                <input
                  className="h-11 rounded-md border border-line px-3 text-base font-normal"
                  onChange={(event) => updateEdit("name", event.target.value)}
                  required
                  value={editForm.name}
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Slug
                <input
                  className="h-11 rounded-md border border-line px-3 text-base font-normal"
                  onChange={(event) => updateEdit("slug", adminSlug(event.target.value, "category"))}
                  required
                  value={editForm.slug}
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Description
                <textarea
                  className="min-h-24 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
                  onChange={(event) => updateEdit("description", event.target.value)}
                  value={editForm.description}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Display order
                  <input
                    className="h-11 rounded-md border border-line px-3 text-base font-normal"
                    onChange={(event) => updateEdit("displayOrder", event.target.value)}
                    type="number"
                    value={editForm.displayOrder}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink">
                  <input
                    checked={editForm.isActive}
                    className="h-4 w-4"
                    onChange={(event) => updateEdit("isActive", event.target.checked)}
                    type="checkbox"
                  />
                  Active
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-paper"
                  onClick={closeEditCategory}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white hover:bg-civic/90 disabled:opacity-60"
                  disabled={editSaving}
                  type="submit"
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
