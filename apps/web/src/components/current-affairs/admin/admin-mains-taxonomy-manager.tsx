"use client";

import { FolderPlus, RefreshCw, Trash2, Edit2, X, UploadCloud, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  authenticatedDelete,
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  authenticatedUpload,
  useAuth
} from "../../auth/auth-context";
import { resolveMediaUrl } from "../../../lib/api";

type MainsTaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: "paper" | "subject_area" | "theme" | "topic" | "subtopic";
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
};

type Exam = {
  id: number;
  name: string;
  slug: string;
};

type TaxonomyFormState = {
  examId: string;
  parentId: string;
  nodeType: "paper" | "subject_area" | "theme" | "topic" | "subtopic";
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: string;
  isActive: boolean;
};

const initialState: TaxonomyFormState = {
  examId: "",
  parentId: "",
  nodeType: "paper",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  displayOrder: "0",
  isActive: true
};

const MAINS_NODE_TYPES = ["paper", "subject_area", "theme", "topic", "subtopic"];

export function AdminMainsTaxonomyManager() {
  const { token } = useAuth();
  const [nodes, setNodes] = useState<MainsTaxonomyNode[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [form, setForm] = useState<TaxonomyFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingNode, setEditingNode] = useState<MainsTaxonomyNode | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load exams
  useEffect(() => {
    const loadExams = async () => {
      if (!token) return;
      try {
        const list = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token);
        setExams(list || []);
        if (list && list.length > 0) {
          const firstExam = list[0];
          if (firstExam) {
            setSelectedExamId(String(firstExam.id));
            setForm(prev => ({ ...prev, examId: String(firstExam.id) }));
          }
        }
      } catch (err) {
        console.error("Error loading exams for Mains taxonomy", err);
      }
    };
    void loadExams();
  }, [token]);

  // Load nodes based on selected exam
  const loadNodes = useCallback(async () => {
    if (!token || !selectedExamId) return;
    setLoading(true);
    setMessage(null);
    try {
      const records = await authenticatedGet<MainsTaxonomyNode[]>(
        `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${selectedExamId}&limit=500`,
        token
      );
      setNodes(records || []);
    } catch {
      setMessage("Could not load Mains taxonomy nodes.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedExamId]);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  // Calculate depths to control image availability (levels 1-3 allowed: paper, subject_area, theme)
  const nodeDepthMap = useMemo(() => {
    const byId = new Map<number, MainsTaxonomyNode>();
    nodes.forEach((node) => byId.set(node.id, node));
    const cache = new Map<number, number>();

    const getDepth = (node: MainsTaxonomyNode): number => {
      const cached = cache.get(node.id);
      if (cached !== undefined) return cached;
      if (!node.parent_id) {
        cache.set(node.id, 0);
        return 0;
      }
      const parent = byId.get(Number(node.parent_id));
      const depth = parent ? getDepth(parent) + 1 : 0;
      cache.set(node.id, depth);
      return depth;
    };

    nodes.forEach((node) => getDepth(node));
    return cache;
  }, [nodes]);

  const formDepth = useMemo(() => {
    if (form.parentId) {
      return (nodeDepthMap.get(Number(form.parentId)) ?? 0) + 1;
    }
    return 0;
  }, [form.parentId, nodeDepthMap]);

  const canUseImage = formDepth <= 2;

  const parentOptions = useMemo(() => {
    return nodes.filter(
      (node) => node.is_active !== false && node.node_type !== "subtopic"
    );
  }, [nodes]);

  function update<K extends keyof TaxonomyFormState>(key: K, value: TaxonomyFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Create slug automatically on blur
  const makeSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleCategoryImageUpload = async (file: File | null): Promise<void> => {
    if (!file || !token || !canUseImage) return;

    setUploadingImage(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("usage_scope", "assessment_category");
      formData.append("alt_text", form.name || "Assessment category image");
      formData.append("file", file);

      const asset = await authenticatedUpload<any>("/api/v1/media/upload", token, formData);
      update("imageUrl", asset.file_url);
      setMessage("Image uploaded successfully. Save the category to apply it.");
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEditClick = (node: MainsTaxonomyNode) => {
    setEditingNode(node);
    setForm({
      examId: String(node.exam_id),
      parentId: node.parent_id ? String(node.parent_id) : "",
      nodeType: node.node_type,
      name: node.name,
      slug: node.slug,
      description: node.description || "",
      imageUrl: node.image_url || "",
      displayOrder: String(node.display_order),
      isActive: node.is_active
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingNode(null);
    setForm({
      ...initialState,
      examId: selectedExamId
    });
    setMessage(null);
  };

  async function handleSubmitNode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !selectedExamId) return;

    const payload = {
      exam_id: Number(selectedExamId),
      parent_id: form.parentId ? Number(form.parentId) : null,
      node_type: form.nodeType,
      name: form.name,
      slug: form.slug || makeSlug(form.name),
      description: form.description || undefined,
      image_url: canUseImage && form.imageUrl.trim() ? form.imageUrl.trim() : null,
      display_order: Number(form.displayOrder || 0),
      is_active: form.isActive
    };

    setSaving(true);
    setMessage(null);
    try {
      if (editingNode) {
        await authenticatedPatch<MainsTaxonomyNode>(
          `/api/v1/assessment/mains/taxonomy-nodes/${editingNode.id}`,
          token,
          payload
        );
        setMessage("Mains taxonomy node updated successfully.");
      } else {
        await authenticatedPost<MainsTaxonomyNode>("/api/v1/assessment/mains/taxonomy-nodes", token, payload);
        setMessage("Mains taxonomy node created successfully.");
      }
      setForm({
        ...initialState,
        examId: selectedExamId
      });
      setEditingNode(null);
      await loadNodes();
    } catch (err) {
      console.error(err);
      setMessage("Could not save taxonomy node. Verify uniqueness requirements.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleNode(node: MainsTaxonomyNode): Promise<void> {
    if (!token) return;
    try {
      await authenticatedPatch<MainsTaxonomyNode>(`/api/v1/assessment/mains/taxonomy-nodes/${node.id}`, token, {
        is_active: !node.is_active
      });
      await loadNodes();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle active status.");
    }
  }

  async function deleteNode(id: number): Promise<void> {
    if (!token || !window.confirm("Delete this Mains category and its child categories? Linked questions will be kept and detached.")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/mains/taxonomy-nodes/${id}`, token);
      await loadNodes();
    } catch (err) {
      console.error(err);
      alert("Failed to delete category.");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-ink">Mains Syllabus Hierarchy</h2>
          <div className="flex gap-2">
            <select
              aria-label="Exam selector"
              className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink"
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                update("examId", e.target.value);
              }}
              value={selectedExamId}
            >
              <option value="">Select Exam</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink disabled:opacity-60"
              disabled={loading}
              onClick={loadNodes}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {message && <p className="rounded-lg border border-line bg-surface p-3 text-sm font-semibold text-civic">{message}</p>}

        <div className="grid gap-3">
          {nodes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface p-5 text-sm text-ink/65">
              No taxonomy nodes defined for this exam. Use the side panel to add.
            </p>
          ) : (
            nodes.map((node) => {
              const parent = nodes.find((item) => item.id === node.parent_id);
              const nodeDepth = nodeDepthMap.get(node.id) ?? 0;
              return (
                <article className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={node.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      {nodeDepth <= 2 && node.image_url && (
                        <img
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded-full border border-line object-cover"
                          src={resolveMediaUrl(node.image_url) ?? undefined}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-md bg-civic/10 px-2 py-1 text-xs font-bold text-civic uppercase tracking-wider">
                            {node.node_type.replace(/_/g, " ")}
                          </span>
                          <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                            !node.is_active ? "bg-berry/10 text-berry" : "bg-civic/10 text-civic"
                          }`}>
                            {!node.is_active ? "Inactive" : "Active"}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold leading-snug text-ink">{node.name}</h3>
                        <p className="mt-1 text-xs text-ink/60">
                          Slug: <span className="font-mono">{node.slug}</span>
                          {parent ? ` | Parent: ${parent.name} (${parent.node_type})` : ""}
                        </p>
                        {node.description && (
                          <p className="mt-2 text-xs text-ink/65 italic">{node.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink hover:border-civic"
                        onClick={() => handleEditClick(node)}
                        type="button"
                      >
                        <Edit2 aria-hidden="true" className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink hover:border-civic"
                        onClick={() => void toggleNode(node)}
                        type="button"
                      >
                        {!node.is_active ? "Activate" : "Deactivate"}
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink hover:border-berry hover:text-berry"
                        onClick={() => void deleteNode(node.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <form className="grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-sm" onSubmit={handleSubmitNode}>
          <div className="flex items-center gap-2 border-b border-line/60 pb-2">
            <FolderPlus aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">{editingNode ? "Edit Taxonomy Node" : "Add Taxonomy Node"}</h2>
          </div>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Node type
            <select
              className="h-11 rounded-md border border-line bg-surface px-3 text-base font-normal"
              onChange={(e) => update("nodeType", e.target.value as any)}
              value={form.nodeType}
            >
              {MAINS_NODE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Parent Node
            <select
              className="h-11 rounded-md border border-line bg-surface px-3 text-base font-normal"
              onChange={(e) => update("parentId", e.target.value)}
              value={form.parentId}
            >
              <option value="">No Parent (Root level Paper)</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  [{parent.node_type}] {parent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Name
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onBlur={() => {
                if (!form.slug) update("slug", makeSlug(form.name));
              }}
              onChange={(e) => update("name", e.target.value)}
              required
              value={form.name}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Slug
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(e) => update("slug", makeSlug(e.target.value))}
              required
              value={form.slug}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Description
            <textarea
              className="min-h-20 rounded-md border border-line px-3 py-2 text-base font-normal"
              onChange={(e) => update("description", e.target.value)}
              value={form.description}
            />
          </label>

          {canUseImage ? (
            <div className="grid gap-2 text-sm font-bold text-ink">
              Category Image
              <div className="grid gap-3 sm:grid-cols-[112px,1fr]">
                <div className="h-28 w-28 overflow-hidden rounded-full border border-line bg-surface">
                  {form.imageUrl ? (
                    <img
                      alt={form.name || "Category image preview"}
                      className="h-full w-full object-cover"
                      src={resolveMediaUrl(form.imageUrl) ?? undefined}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-semibold text-ink/45">
                      No image
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-civic bg-civic/5 px-3 text-sm font-bold text-civic transition hover:bg-civic/10">
                    <UploadCloud className="h-4 w-4" />
                    {uploadingImage ? "Uploading..." : "Upload Image"}
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(e) => {
                        void handleCategoryImageUpload(e.currentTarget.files?.[0] ?? null);
                        e.currentTarget.value = "";
                      }}
                      type="file"
                    />
                  </label>
                  <input
                    className="h-11 rounded-md border border-line px-3 text-base font-normal outline-none focus:border-civic"
                    onChange={(e) => update("imageUrl", e.target.value)}
                    type="text"
                    value={form.imageUrl}
                    placeholder="Uploaded URL or external image URL"
                  />
                </div>
              </div>
              <span className="text-[11px] font-normal text-ink/50">
                Image is available for levels 1-3. This category is level {formDepth + 1}.
              </span>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Image option is limited to the first 3 category levels. This category is level {formDepth + 1}.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Display order
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(e) => update("displayOrder", e.target.value)}
                type="number"
                value={form.displayOrder}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink pt-2">
              <input
                checked={form.isActive}
                className="h-4 w-4"
                onChange={(e) => update("isActive", e.target.checked)}
                type="checkbox"
              />
              Active in syllabus
            </label>
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
              disabled={saving || !selectedExamId}
              type="submit"
            >
              <FolderPlus aria-hidden="true" className="h-4 w-4" />
              {saving ? "Saving..." : (editingNode ? "Save Changes" : "Add Node")}
            </button>
            {editingNode && (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-slate-50"
                onClick={cancelEdit}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </form>
      </aside>
    </section>
  );
}
