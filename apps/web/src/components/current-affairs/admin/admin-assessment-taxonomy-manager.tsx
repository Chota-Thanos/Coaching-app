"use client";

import { RefreshCw, Trash2, Edit2, X, Plus, ChevronRight, UploadCloud } from "lucide-react";
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

type QuestionNature = {
  id: number;
  exam_id: number;
  name: string;
  slug: string;
  description?: string | null;
  display_order: number;
  is_active: boolean;
};

type TaxonomyNode = {
  id: number;
  exam_id: number;
  parent_id?: number | null;
  node_type: "subject" | "source_bucket" | "topic" | "subtopic" | "paper" | "subject_area" | "theme";
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
  content_type?: "gk" | "aptitude";
};

type Exam = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
};

type FormState = {
  parentId: string;
  nodeType: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: string;
  isActive: boolean;
};

type MediaUploadResponse = {
  id: number;
  file_url: string;
  original_file_name: string;
  mime_type: string;
  size_bytes: number;
};

const initialFormState: FormState = {
  parentId: "",
  nodeType: "subject",
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  displayOrder: "0",
  isActive: true
};

type ExamFormState = {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
};

const initialExamFormState: ExamFormState = {
  name: "",
  slug: "",
  description: "",
  isActive: true
};

const OBJECTIVE_NODE_TYPES = ["subject", "source_bucket", "topic", "subtopic"];
const MAINS_NODE_TYPES = ["paper", "subject_area", "theme", "topic", "subtopic"];

export function AdminAssessmentTaxonomyManager() {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"gk" | "aptitude" | "mains" | "natures">("gk");
  
  const [objectiveNodes, setObjectiveNodes] = useState<TaxonomyNode[]>([]);
  const [questionNatures, setQuestionNatures] = useState<QuestionNature[]>([]);
  const [natureModalOpen, setNatureModalOpen] = useState(false);
  const [editingNature, setEditingNature] = useState<QuestionNature | null>(null);

  type NatureFormState = {
    name: string;
    slug: string;
    description: string;
    displayOrder: string;
    isActive: boolean;
  };

  const initialNatureFormState: NatureFormState = {
    name: "",
    slug: "",
    description: "",
    displayOrder: "0",
    isActive: true
  };

  const [natureForm, setNatureForm] = useState<NatureFormState>(initialNatureFormState);
  const [mainsNodes, setMainsNodes] = useState<TaxonomyNode[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);

  // Editing state for nodes
  const [editingNode, setEditingNode] = useState<TaxonomyNode | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examForm, setExamForm] = useState<ExamFormState>(initialExamFormState);

  // Bulk import state
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const loadExams = useCallback(async (preferredExamId?: string) => {
    if (!token) return;
    try {
      const list = await authenticatedGet<Exam[]>("/api/v1/assessment/exams?limit=100", token);
      const records = list || [];
      setExams(records);
      setSelectedExamId((current) => {
        if (preferredExamId && records.some((exam) => String(exam.id) === preferredExamId)) {
          return preferredExamId;
        }
        if (current && records.some((exam) => String(exam.id) === current)) {
          return current;
        }
        return records[0] ? String(records[0].id) : "";
      });
    } catch (err) {
      console.error("Error loading exams for assessment taxonomy manager", err);
    }
  }, [token]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const selectedExam = useMemo(() => {
    return exams.find((exam) => String(exam.id) === selectedExamId) ?? null;
  }, [exams, selectedExamId]);

  // Load nodes based on selected exam and active tab
  const loadNodes = useCallback(async () => {
    if (!token || !selectedExamId) return;
    setLoading(true);
    setMessage(null);
    try {
      if (activeTab === "mains") {
        const records = await authenticatedGet<TaxonomyNode[]>(
          `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`,
          token
        );
        setMainsNodes(records || []);
      } else {
        const records = await authenticatedGet<TaxonomyNode[]>(
          `/api/v1/assessment/taxonomy-nodes?exam_id=${selectedExamId}&content_type=${activeTab}&limit=1000`,
          token
        );
        setObjectiveNodes(records || []);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "Could not load taxonomy nodes.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [token, selectedExamId, activeTab]);

  const loadQuestionNatures = useCallback(async () => {
    if (!token || !selectedExamId) return;
    setLoading(true);
    setMessage(null);
    try {
      const list = await authenticatedGet<QuestionNature[]>(
        `/api/v1/assessment/question-natures?exam_id=${selectedExamId}&limit=1000`,
        token
      );
      setQuestionNatures(list || []);
    } catch (err) {
      console.error(err);
      setMessage({ text: "Could not load question natures.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [token, selectedExamId]);

  useEffect(() => {
    if (activeTab === "natures") {
      void loadQuestionNatures();
    } else {
      void loadNodes();
    }
  }, [activeTab, loadNodes, loadQuestionNatures]);

  const updateNatureForm = <K extends keyof NatureFormState>(key: K, value: NatureFormState[K]): void => {
    setNatureForm(current => ({ ...current, [key]: value }));
  };

  const handleEditNatureClick = (nature: QuestionNature) => {
    setEditingNature(nature);
    setNatureForm({
      name: nature.name,
      slug: nature.slug,
      description: nature.description || "",
      displayOrder: String(nature.display_order),
      isActive: nature.is_active
    });
    setMessage(null);
    setNatureModalOpen(true);
  };

  const handleCreateNatureClick = () => {
    setEditingNature(null);
    setNatureForm(initialNatureFormState);
    setMessage(null);
    setNatureModalOpen(true);
  };

  const handleNatureSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!token || !selectedExamId) return;

    const payload: Record<string, any> = {
      exam_id: Number(selectedExamId),
      name: natureForm.name,
      slug: natureForm.slug || makeSlug(natureForm.name),
      description: natureForm.description || null,
      display_order: Number(natureForm.displayOrder || 0),
      is_active: natureForm.isActive
    };

    setSaving(true);
    setMessage(null);
    try {
      if (editingNature) {
        await authenticatedPatch<QuestionNature>(
          `/api/v1/assessment/question-natures/${editingNature.id}`,
          token,
          payload
        );
        setMessage({ text: "Question nature updated successfully.", type: "success" });
        setEditingNature(null);
      } else {
        await authenticatedPost<QuestionNature>(
          "/api/v1/assessment/question-natures",
          token,
          payload
        );
        setMessage({ text: "Question nature created successfully.", type: "success" });
      }

      setNatureForm(initialNatureFormState);
      setNatureModalOpen(false);
      await loadQuestionNatures();
    } catch (err) {
      console.error(err);
      setMessage({ text: "Failed to save question nature. Verify validation and unique slugs.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleNatureActive = async (nature: QuestionNature): Promise<void> => {
    if (!token) return;
    try {
      await authenticatedPatch<QuestionNature>(
        `/api/v1/assessment/question-natures/${nature.id}`,
        token,
        {
          is_active: !nature.is_active
        }
      );
      await loadQuestionNatures();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle active status.");
    }
  };

  const handleDeleteNature = async (id: number): Promise<void> => {
    if (!token || !window.confirm("Delete this question nature? Linked questions will be kept and detached from this nature.")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/question-natures/${id}`, token);
      setMessage({ text: "Question nature deleted successfully.", type: "success" });
      await loadQuestionNatures();
    } catch (err) {
      console.error(err);
      alert("Failed to delete question nature.");
    }
  };

  // Current list of nodes displayed
  const currentNodes = useMemo(() => {
    return activeTab === "mains" ? mainsNodes : objectiveNodes;
  }, [activeTab, mainsNodes, objectiveNodes]);

  // Nodes hierarchical computation
  const roots = useMemo(() => {
    return currentNodes.filter(n => !n.parent_id);
  }, [currentNodes]);

  // Helper to build tree map
  const childrenMap = useMemo(() => {
    const map = new Map<number, TaxonomyNode[]>();
    currentNodes.forEach(node => {
      if (node.parent_id) {
        const list = map.get(node.parent_id) || [];
        list.push(node);
        // Sort children by display_order then name
        list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
        map.set(node.parent_id, list);
      }
    });
    return map;
  }, [currentNodes]);

  const nodeDepthMap = useMemo(() => {
    const byId = new Map<number, TaxonomyNode>();
    currentNodes.forEach((node) => byId.set(node.id, node));
    const cache = new Map<number, number>();

    const getDepth = (node: TaxonomyNode): number => {
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

    currentNodes.forEach((node) => getDepth(node));
    return cache;
  }, [currentNodes]);

  const formDepth = useMemo(() => {
    if (form.parentId) {
      return (nodeDepthMap.get(Number(form.parentId)) ?? 0) + 1;
    }
    return 0;
  }, [form.parentId, nodeDepthMap]);

  const canUseImage = formDepth <= 2;

  // Flat list but ordered hierarchically
  const orderedNodes = useMemo(() => {
    const list: { node: TaxonomyNode; depth: number }[] = [];
    const visit = (node: TaxonomyNode, depth: number) => {
      list.push({ node, depth });
      const children = childrenMap.get(node.id);
      if (children) {
        children.forEach(child => visit(child, depth + 1));
      }
    };
    // Sort roots by display_order then name
    const sortedRoots = [...roots].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    sortedRoots.forEach(r => visit(r, 0));
    return list;
  }, [roots, childrenMap]);

  // Parents list for parent selection (exclude subtopics, and current editing node itself to avoid cycles)
  const parentOptions = useMemo(() => {
    return currentNodes.filter(node => {
      const isSubtopic = node.node_type === "subtopic";
      const isSelf = editingNode ? node.id === editingNode.id : false;
      return !isSubtopic && !isSelf && node.is_active;
    });
  }, [currentNodes, editingNode]);

  // Auto set default node type on tab changes
  useEffect(() => {
    setEditingNode(null);
    setForm({
      ...initialFormState,
      nodeType: activeTab === "mains" ? "paper" : "subject"
    });
  }, [activeTab]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm(current => ({ ...current, [key]: value }));
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

      const asset = await authenticatedUpload<MediaUploadResponse>("/api/v1/media/upload", token, formData);
      updateForm("imageUrl", asset.file_url);
      setMessage({ text: "Image uploaded successfully. Save the category to apply it.", type: "success" });
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err?.message || "Failed to upload image.", type: "error" });
    } finally {
      setUploadingImage(false);
    }
  };

  const makeSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  // Node editing actions
  const handleEditClick = (node: TaxonomyNode) => {
    setEditingNode(node);
    setForm({
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
    setModalOpen(true);
  };

  const handleCreateNodeClick = () => {
    setEditingNode(null);
    setForm({
      ...initialFormState,
      nodeType: activeTab === "mains" ? "paper" : "subject"
    });
    setMessage(null);
    setModalOpen(true);
  };

  const handleCreateExamClick = () => {
    setEditingExam(null);
    setExamForm(initialExamFormState);
    setMessage(null);
    setExamModalOpen(true);
  };

  const handleEditExamClick = () => {
    if (!selectedExam) return;
    setEditingExam(selectedExam);
    setExamForm({
      name: selectedExam.name,
      slug: selectedExam.slug,
      description: selectedExam.description || "",
      isActive: selectedExam.is_active
    });
    setMessage(null);
    setExamModalOpen(true);
  };

  // Single Node Submission
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!token || !selectedExamId) return;

    const payload: Record<string, any> = {
      exam_id: Number(selectedExamId),
      parent_id: form.parentId ? Number(form.parentId) : null,
      node_type: form.nodeType,
      name: form.name,
      slug: form.slug || makeSlug(form.name),
      description: form.description || null,
      image_url: canUseImage && form.imageUrl.trim() ? form.imageUrl.trim() : null,
      display_order: Number(form.displayOrder || 0),
      is_active: form.isActive
    };

    if (activeTab !== "mains") {
      payload.content_type = activeTab;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingNode) {
        // Update existing node
        const url = activeTab === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes/${editingNode.id}`
          : `/api/v1/assessment/taxonomy-nodes/${editingNode.id}`;
        
        await authenticatedPatch<TaxonomyNode>(url, token, payload);
        setMessage({ text: "Taxonomy node updated successfully.", type: "success" });
        setEditingNode(null);
      } else {
        // Create new node
        const url = activeTab === "mains"
          ? "/api/v1/assessment/mains/taxonomy-nodes"
          : "/api/v1/assessment/taxonomy-nodes";
        
        await authenticatedPost<TaxonomyNode>(url, token, payload);
        setMessage({ text: "Taxonomy node created successfully.", type: "success" });
      }

      setForm({
        ...initialFormState,
        nodeType: activeTab === "mains" ? "paper" : "subject"
      });
      setModalOpen(false);
      await loadNodes();
    } catch (err) {
      console.error(err);
      setMessage({ text: "Failed to save taxonomy node. Verify validation and unique slugs.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleExamSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!token) return;

    const payload = {
      name: examForm.name,
      slug: examForm.slug || makeSlug(examForm.name),
      description: examForm.description || null,
      is_active: examForm.isActive
    };

    setSaving(true);
    setMessage(null);
    try {
      let savedExam: Exam;
      if (editingExam) {
        savedExam = await authenticatedPatch<Exam>(
          `/api/v1/assessment/exams/${editingExam.id}`,
          token,
          payload
        );
        setMessage({ text: "Exam updated successfully.", type: "success" });
        setEditingExam(null);
      } else {
        savedExam = await authenticatedPost<Exam>(
          "/api/v1/assessment/exams",
          token,
          payload
        );
        setMessage({ text: "Exam created successfully.", type: "success" });
      }
      setExamModalOpen(false);
      await loadExams(String(savedExam.id));
    } catch (err) {
      console.error(err);
      setMessage({ text: "Failed to save exam. Verify validation and unique slugs.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Active status deactivators
  const toggleNodeActive = async (node: TaxonomyNode): Promise<void> => {
    if (!token) return;
    try {
      const url = activeTab === "mains"
        ? `/api/v1/assessment/mains/taxonomy-nodes/${node.id}`
        : `/api/v1/assessment/taxonomy-nodes/${node.id}`;
      
      await authenticatedPatch<TaxonomyNode>(url, token, {
        is_active: !node.is_active
      });
      await loadNodes();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle active status.");
    }
  };

  // Deletion logic
  const handleDeleteNode = async (id: number): Promise<void> => {
    if (!token || !window.confirm("Delete this category and its child categories? Linked questions will be kept and detached from this category branch.")) return;
    try {
      const url = activeTab === "mains"
        ? `/api/v1/assessment/mains/taxonomy-nodes/${id}`
        : `/api/v1/assessment/taxonomy-nodes/${id}`;

      await authenticatedDelete(url, token);
      setMessage({ text: "Category branch deleted. Linked questions were kept and detached.", type: "success" });
      await loadNodes();
    } catch (err) {
      console.error(err);
      alert("Failed to delete category.");
    }
  };

  const handleDeleteExam = async (): Promise<void> => {
    if (!token || !selectedExam) return;
    if (!window.confirm(`Delete "${selectedExam.name}" completely? Its taxonomy categories, tests, series, and attempts will also be removed.`)) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/exams/${selectedExam.id}`, token);
      setMessage({ text: "Exam and its linked assessment categories were deleted.", type: "success" });
      setObjectiveNodes([]);
      setMainsNodes([]);
      await loadExams();
    } catch (err) {
      console.error(err);
      alert("Failed to delete exam.");
    }
  };

  const handleBulkImport = async () => {
    if (!token || !selectedExamId || !bulkText.trim()) return;
    setBulkImporting(true);
    setMessage(null);
    setBulkProgress("Starting bulk import outlines...");
    
    try {
      const lines = bulkText.split("\n");
      const parsedNodes: { name: string; depth: number }[] = [];
      const indentStack: string[] = [""];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Extract leading whitespace
        const match = line.match(/^(\s*)/);
        const indentStr = match ? match[0] : "";
        
        // Pop from stack while top of stack is longer than current indentStr
        while (
          indentStack.length > 1 &&
          (indentStack[indentStack.length - 1]?.length ?? 0) > indentStr.length
        ) {
          indentStack.pop();
        }
        
        let depth = 0;
        const currentTop = indentStack[indentStack.length - 1] ?? "";
        if (indentStr === currentTop) {
          depth = indentStack.length - 1;
        } else if (indentStr.length > currentTop.length) {
          indentStack.push(indentStr);
          depth = indentStack.length - 1;
        } else {
          depth = indentStack.length - 1;
        }
        
        parsedNodes.push({ name: trimmed, depth });
      }
      
      if (parsedNodes.length === 0) {
        throw new Error("No outline items detected.");
      }
      
      const parentStack: (number | null)[] = new Array(10).fill(null);
      let createdCount = 0;
      let reusedCount = 0;

      // Load all current nodes under selected exam/type to check local duplicates
      let currentDbNodes: TaxonomyNode[] = [];
      if (activeTab === "mains") {
        currentDbNodes = await authenticatedGet<TaxonomyNode[]>(
          `/api/v1/assessment/mains/taxonomy-nodes?exam_id=${selectedExamId}&limit=1000`,
          token
        );
      } else {
        currentDbNodes = await authenticatedGet<TaxonomyNode[]>(
          `/api/v1/assessment/taxonomy-nodes?exam_id=${selectedExamId}&content_type=${activeTab}&limit=1000`,
          token
        );
      }

      for (let i = 0; i < parsedNodes.length; i++) {
        const item = parsedNodes[i];
        if (!item) continue;
        const { name, depth } = item;
        setBulkProgress(`Importing node ${i + 1}/${parsedNodes.length}: "${name}"...`);

        const parentId = depth > 0 ? parentStack[depth - 1] : null;

        // Determine node type based on outline depth
        let nodeType: TaxonomyNode["node_type"] = "subject";
        if (activeTab === "mains") {
          const types: TaxonomyNode["node_type"][] = ["paper", "subject_area", "theme", "topic", "subtopic"];
          nodeType = types[Math.min(depth, 4)] || "subtopic";
        } else {
          const types: TaxonomyNode["node_type"][] = ["subject", "topic", "subtopic"];
          nodeType = types[Math.min(depth, 2)] || "subtopic";
        }

        // Idempotent duplication verification
        const existing = currentDbNodes.find(n => 
          n.name.toLowerCase() === name.toLowerCase() &&
          n.node_type === nodeType &&
          (n.parent_id === parentId || (!n.parent_id && !parentId))
        );

        if (existing) {
          parentStack[depth] = existing.id;
          reusedCount++;
        } else {
          const payload: Record<string, any> = {
            exam_id: Number(selectedExamId),
            parent_id: parentId,
            node_type: nodeType,
            name: name,
            slug: makeSlug(name),
            description: undefined,
            display_order: i * 10,
            is_active: true
          };

          if (activeTab !== "mains") {
            payload.content_type = activeTab;
          }

          const url = activeTab === "mains"
            ? "/api/v1/assessment/mains/taxonomy-nodes"
            : "/api/v1/assessment/taxonomy-nodes";

          const created = await authenticatedPost<TaxonomyNode>(url, token, payload);
          if (created && created.id) {
            parentStack[depth] = created.id;
            createdCount++;
            currentDbNodes.push(created);
          } else {
            throw new Error(`Failed to create node "${name}" during hierarchy import.`);
          }
        }
      }

      setMessage({
        text: `Successfully completed bulk import outline tree! Created ${createdCount} new nodes and verified ${reusedCount} existing ones.`,
        type: "success"
      });
      setBulkText("");
      setBulkModalOpen(false);
      await loadNodes();
    } catch (err: any) {
      console.error("Bulk Import outline error", err);
      setMessage({ text: err.message || "Failed to process outline bulk import. Check nesting layout.", type: "error" });
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="taxonomy-manager-root space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        .taxonomy-manager-root,
        .taxonomy-manager-root input,
        .taxonomy-manager-root select,
        .taxonomy-manager-root textarea,
        .taxonomy-manager-root button {
          font-family: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif !important;
        }
      `}} />

      {/* Sticky Header (Exam selector + Tabs) */}
      <div className="sticky top-[-24px] lg:top-[-32px] z-30 bg-white/95 backdrop-blur-md pb-4 pt-4 lg:pt-5 border-b border-line -mx-6 px-6 lg:-mx-8 lg:px-8 space-y-4 shadow-sm transition-all duration-200">
        {/* Top Bar with Exam selection */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-ink">Assessment Taxonomies</h1>
            <p className="text-sm text-ink/60">Configure dedicated syllabus trees for GK, Aptitude, and Mains.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select Exam"
              className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink outline-none"
              onChange={(e) => setSelectedExamId(e.target.value)}
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-civic px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-civic/90"
              onClick={handleCreateExamClick}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add Exam
            </button>
            <button
              aria-label="Edit selected exam"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-civic/30 bg-civic/10 text-civic shadow-sm transition-colors hover:bg-civic hover:text-white disabled:opacity-50"
              disabled={!selectedExam}
              onClick={handleEditExamClick}
              title="Edit selected exam"
              type="button"
            >
              <Edit2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              aria-label="Delete selected exam"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-berry/30 bg-berry/10 text-berry shadow-sm transition-colors hover:bg-berry hover:text-white disabled:opacity-50"
              disabled={!selectedExam}
              onClick={() => void handleDeleteExam()}
              title="Delete selected exam"
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-60"
              disabled={loading}
              onClick={activeTab === "natures" ? loadQuestionNatures : loadNodes}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Content-Type Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 max-w-xl">
          {(["gk", "aptitude", "mains", "natures"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = 
              tab === "gk" 
                ? "GK Section" 
                : tab === "aptitude" 
                ? "CSAT & Aptitude" 
                : tab === "mains"
                ? "Mains Syllabus"
                : "Question Natures";

            return (
              <button
                key={tab}
                className={`flex-1 rounded-lg py-2 px-3 text-center text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-white text-civic shadow-sm border border-slate-200/40"
                    : "text-ink/60 hover:text-civic hover:bg-white/40"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Core Full-Width list panel */}
      <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden">
        {activeTab === "natures" ? (
          <>
            <div className="bg-slate-50 border-b border-line px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Question Natures Configuration
                </span>
                <span className="text-sm font-extrabold text-ink">
                  {`${questionNatures.length} question natures defined`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNatureClick}
                  disabled={!selectedExamId}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-civic hover:bg-civic/90 text-white text-xs font-bold px-4 disabled:opacity-50 transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Question Nature
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm font-semibold text-ink/50 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 text-civic animate-spin" />
                Loading question natures...
              </div>
            ) : questionNatures.length === 0 ? (
              <div className="p-12 text-center text-sm text-ink/65 border-dashed border-2 border-line m-5 rounded-2xl">
                No question natures defined for this exam. Configure question natures using the action button above.
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {questionNatures.map((nature) => {
                  const bgCol = !nature.is_active
                    ? "bg-rose-50/40 border-l-4 border-l-rose-400"
                    : editingNature?.id === nature.id
                    ? "bg-amber-50/60 border-l-4 border-l-amber-500"
                    : "bg-white border-l-4 border-l-transparent hover:bg-slate-50/50";

                  return (
                    <div
                      key={nature.id}
                      className={`flex items-center justify-between p-3.5 gap-4 group transition-colors px-6 ${bgCol}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-ink">{nature.name}</span>
                          <span className="font-mono text-[10px] text-ink/40 bg-slate-100 px-1 py-0.5 rounded">
                            {nature.slug}
                          </span>
                          <span className="text-[10px] text-ink/40 bg-slate-100 px-1 py-0.5 rounded">
                            Order: {nature.display_order}
                          </span>
                          {!nature.is_active && (
                            <span className="text-[10px] font-bold text-berry bg-berry/10 px-1 py-0.5 rounded flex-shrink-0">
                              Inactive
                            </span>
                          )}
                        </div>
                        {nature.description && (
                          <p className="text-xs text-ink/55 mt-1 italic max-w-xl">{nature.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditNatureClick(nature)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-civic/25 bg-civic/10 text-civic transition-colors hover:bg-civic hover:text-white"
                          title="Edit nature details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleNatureActive(nature)}
                          className={`h-8 rounded-lg border px-2 text-xs font-bold shadow-sm transition-colors ${
                            nature.is_active
                              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                              : "border-civic/30 bg-civic text-white hover:bg-civic/90"
                          }`}
                        >
                          {nature.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNature(nature.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-berry/25 bg-berry/10 text-berry transition-colors hover:bg-berry hover:text-white"
                          title="Delete Nature"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-slate-50 border-b border-line px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  {`Syllabus Tree Outline (${activeTab.toUpperCase()})`}
                </span>
                <span className="text-sm font-extrabold text-ink">
                  {`${orderedNodes.length} outline categories defined`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNodeClick}
                  disabled={!selectedExamId}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-civic hover:bg-civic/90 text-white text-xs font-bold px-4 disabled:opacity-50 transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Single Node
                </button>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  disabled={!selectedExamId}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold px-4 disabled:opacity-50 transition-all shadow-sm"
                >
                  <UploadCloud className="h-4 w-4 text-amber-700" />
                  Bulk Outline
                </button>
              </div>
            </div>

            {/* Tree Rendering */}
            {loading ? (
              <div className="p-12 text-center text-sm font-semibold text-ink/50 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 text-civic animate-spin" />
                Loading hierarchy configuration...
              </div>
            ) : orderedNodes.length === 0 ? (
              <div className="p-12 text-center text-sm text-ink/65 border-dashed border-2 border-line m-5 rounded-2xl">
                No taxonomy syllabus categories defined for this section. Configure outline using the action buttons above.
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {orderedNodes.map(({ node, depth }) => {
                  const nodeBgColor = !node.is_active
                    ? "bg-rose-50/40 border-l-4 border-l-rose-400"
                    : editingNode?.id === node.id
                    ? "bg-amber-50/60 border-l-4 border-l-amber-500"
                    : "bg-white border-l-4 border-l-transparent hover:bg-slate-50/50";

                  return (
                    <div
                      key={node.id}
                      className={`relative flex items-center justify-between p-3 gap-2 group transition-colors ${nodeBgColor}`}
                      style={{ paddingLeft: `${Math.max(16, depth * 28 + 16)}px` }}
                    >
                      {/* Indentation Guidelines */}
                      {Array.from({ length: depth }).map((_, idx) => (
                        <div
                          key={idx}
                          className="absolute top-0 bottom-0 border-l border-dashed border-slate-200"
                          style={{ left: `${idx * 28 + 24}px` }}
                        />
                      ))}
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight className={`h-4 w-4 text-ink/40 flex-shrink-0 ${depth > 0 ? "scale-90" : ""}`} />
                        {depth <= 2 && node.image_url && (
                          <img
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded-full border border-line object-cover"
                            src={resolveMediaUrl(node.image_url) ?? undefined}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-ink">{node.name}</span>
                            <span className="font-mono text-[10px] text-ink/40 bg-slate-100 px-1 py-0.5 rounded">
                              {node.slug}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-civic bg-civic/5 px-1 py-0.5 rounded tracking-wider flex-shrink-0">
                              Level {depth + 1}
                            </span>
                            {!node.is_active && (
                              <span className="text-[10px] font-bold text-berry bg-berry/10 px-1 py-0.5 rounded flex-shrink-0">
                                Inactive
                              </span>
                            )}
                          </div>
                          {node.description && (
                            <p className="text-xs text-ink/55 truncate mt-0.5 max-w-md italic">{node.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditClick(node)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-civic/25 bg-civic/10 text-civic transition-colors hover:bg-civic hover:text-white"
                          title="Edit node details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleNodeActive(node)}
                          className={`h-8 rounded-lg border px-2 text-xs font-bold shadow-sm transition-colors ${
                            node.is_active
                              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                              : "border-civic/30 bg-civic text-white hover:bg-civic/90"
                          }`}
                        >
                          {node.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNode(node.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-berry/25 bg-berry/10 text-berry transition-colors hover:bg-berry hover:text-white"
                          title="Delete Node"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal 1: Single Node Creation/Editing */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-line shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="text-lg font-black text-ink">
                {editingNode ? "Edit Taxonomy Node" : "Add Taxonomy Node"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-ink/40 hover:text-ink/75 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="grid gap-1 text-sm font-bold text-ink">
                Internal Level Type
                <select
                  className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic"
                  onChange={(e) => updateForm("nodeType", e.target.value)}
                  value={form.nodeType}
                >
                  {activeTab === "mains"
                    ? MAINS_NODE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ").toUpperCase()}
                        </option>
                      ))
                    : OBJECTIVE_NODE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ").toUpperCase()}
                        </option>
                      ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Parent Node (Reassign Taxonomy Link)
                <select
                  className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-normal outline-none focus:border-civic"
                  onChange={(e) => updateForm("parentId", e.target.value)}
                  value={form.parentId}
                >
                  <option value="">No Parent (Root level)</option>
                  {parentOptions.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      [Level {(nodeDepthMap.get(parent.id) ?? 0) + 1}] {parent.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Category Title
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onBlur={() => {
                    if (!form.slug) updateForm("slug", makeSlug(form.name));
                  }}
                  onChange={(e) => updateForm("name", e.target.value)}
                  required
                  value={form.name}
                  placeholder="Enter category title"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Slug
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onChange={(e) => updateForm("slug", makeSlug(e.target.value))}
                  required
                  value={form.slug}
                  placeholder="slug-value"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Description
                <textarea
                  className="min-h-20 rounded-xl border border-line px-3 py-2 text-sm font-normal outline-none focus:border-civic resize-y"
                  onChange={(e) => updateForm("description", e.target.value)}
                  value={form.description}
                  placeholder="Brief description shown with this category..."
                />
              </label>

              {canUseImage ? (
                <div className="grid gap-2 text-sm font-bold text-ink">
                  Category Image
                  <div className="grid gap-3 sm:grid-cols-[112px,1fr]">
                    <div className="h-28 w-28 overflow-hidden rounded-full border border-line bg-white">
                      {form.imageUrl ? (
                        <img
                          alt={form.name || "Category image preview"}
                          className="h-full w-full object-cover"
                          src={resolveMediaUrl(form.imageUrl) ?? undefined}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-semibold text-ink/45">
                          No image selected
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
                        className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                        onChange={(e) => updateForm("imageUrl", e.target.value)}
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
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Image option is limited to the first 3 category levels. This category is level {formDepth + 1}.
                </div>
              )}

              <div className="grid gap-3 grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Display Order
                  <input
                    className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                    onChange={(e) => updateForm("displayOrder", e.target.value)}
                    type="number"
                    value={form.displayOrder}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink pt-6 select-none cursor-pointer">
                  <input
                    checked={form.isActive}
                    className="h-4 w-4 rounded text-civic"
                    onChange={(e) => updateForm("isActive", e.target.checked)}
                    type="checkbox"
                  />
                  Active Node
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-line">
                <button
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-civic hover:bg-civic/90 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-sm"
                  disabled={saving || uploadingImage}
                  type="submit"
                >
                  {saving ? "Saving..." : editingNode ? "Update Node" : "Create Node"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm px-4 transition-colors"
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk Outline Import */}
      {bulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-line shadow-xl w-full max-w-xl p-6 max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-civic" />
                Bulk Import Syllabus Outline
              </h3>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="p-1.5 text-ink/40 hover:text-ink/75 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-line rounded-2xl p-4 text-xs space-y-2 text-slate-600">
                <span className="font-bold text-slate-700 block">Indentation Rules:</span>
                <p>Use spaces (e.g. 2 spaces per level) or tabs to define nesting. The importer verifies existing nodes to prevent duplication.</p>
                <div className="font-mono bg-white border border-line/60 p-2.5 rounded-lg text-slate-500 whitespace-pre">
                  {activeTab === "mains" ? (
                    `GS Paper I\n  History\n    Modern History\n      Socio-Religious Movements\nGS Paper II\n  Polity`
                  ) : (
                    `Indian Polity\n  Executive\n    President of India\n    Prime Minister\n  Judiciary\n    Supreme Court`
                  )}
                </div>
              </div>

              <textarea
                className="w-full min-h-[300px] font-mono text-sm rounded-xl border border-line px-3 py-2 outline-none focus:border-civic resize-y"
                placeholder={
                  activeTab === "mains"
                    ? "Paste subjective mains syllabus outline..."
                    : "Paste GK or CSAT subjects outline..."
                }
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                disabled={bulkImporting}
              />

              {bulkImporting && (
                <div className="text-xs font-semibold text-civic flex items-center gap-2 bg-civic/5 border border-civic/20 p-3 rounded-xl">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>{bulkProgress}</span>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-line">
                <button
                  onClick={handleBulkImport}
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-civic hover:bg-civic/90 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-sm"
                  disabled={bulkImporting || !bulkText.trim()}
                >
                  {bulkImporting ? "Importing..." : "Start Bulk Import"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm px-4 transition-colors"
                  onClick={() => setBulkModalOpen(false)}
                  type="button"
                  disabled={bulkImporting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Exam Creation/Editing */}
      {examModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-line shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="text-lg font-black text-ink">
                {editingExam ? "Edit Exam" : "Add Exam"}
              </h3>
              <button
                type="button"
                onClick={() => setExamModalOpen(false)}
                className="p-1.5 text-ink/40 hover:text-ink/75 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleExamSubmit}>
              <label className="grid gap-1 text-sm font-bold text-ink">
                Exam Name
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onBlur={() => {
                    if (!examForm.slug) setExamForm(prev => ({ ...prev, slug: makeSlug(prev.name) }));
                  }}
                  onChange={(e) => setExamForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  value={examForm.name}
                  placeholder="e.g. UPSC CSE"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Slug
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onChange={(e) => setExamForm(prev => ({ ...prev, slug: makeSlug(e.target.value) }))}
                  required
                  value={examForm.slug}
                  placeholder="slug-value"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Description
                <textarea
                  className="min-h-20 rounded-xl border border-line px-3 py-2 text-sm font-normal outline-none focus:border-civic resize-y"
                  onChange={(e) => setExamForm(prev => ({ ...prev, description: e.target.value }))}
                  value={examForm.description}
                  placeholder="Brief exam description..."
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-bold text-ink select-none cursor-pointer">
                <input
                  checked={examForm.isActive}
                  className="h-4 w-4 rounded text-civic"
                  onChange={(e) => setExamForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  type="checkbox"
                />
                Active Exam
              </label>

              <div className="flex gap-2 pt-4 border-t border-line">
                <button
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-civic hover:bg-civic/90 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-sm"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving..." : editingExam ? "Update Exam" : "Create Exam"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm px-4 transition-colors"
                  onClick={() => setExamModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Question Nature Creation/Editing */}
      {natureModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-line shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <h3 className="text-lg font-black text-ink">
                {editingNature ? "Edit Question Nature" : "Add Question Nature"}
              </h3>
              <button
                type="button"
                onClick={() => setNatureModalOpen(false)}
                className="p-1.5 text-ink/40 hover:text-ink/75 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleNatureSubmit}>
              <label className="grid gap-1 text-sm font-bold text-ink">
                Name
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onBlur={() => {
                    if (!natureForm.slug) updateNatureForm("slug", makeSlug(natureForm.name));
                  }}
                  onChange={(e) => updateNatureForm("name", e.target.value)}
                  required
                  value={natureForm.name}
                  placeholder="e.g. Conceptual"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Slug
                <input
                  className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                  onChange={(e) => updateNatureForm("slug", makeSlug(e.target.value))}
                  required
                  value={natureForm.slug}
                  placeholder="e.g. conceptual"
                />
              </label>

              <label className="grid gap-1 text-sm font-bold text-ink">
                Description
                <textarea
                  className="min-h-20 rounded-xl border border-line px-3 py-2 text-sm font-normal outline-none focus:border-civic resize-y"
                  onChange={(e) => updateNatureForm("description", e.target.value)}
                  value={natureForm.description}
                  placeholder="Brief description of this question nature..."
                />
              </label>

              <div className="grid gap-3 grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-ink">
                  Display Order
                  <input
                    className="h-11 rounded-xl border border-line px-3 text-sm font-normal outline-none focus:border-civic"
                    onChange={(e) => updateNatureForm("displayOrder", e.target.value)}
                    type="number"
                    value={natureForm.displayOrder}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink pt-6 select-none cursor-pointer">
                  <input
                    checked={natureForm.isActive}
                    className="h-4 w-4 rounded text-civic"
                    onChange={(e) => updateNatureForm("isActive", e.target.checked)}
                    type="checkbox"
                  />
                  Active Nature
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-line">
                <button
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-civic hover:bg-civic/90 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-sm"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving..." : editingNature ? "Update Nature" : "Create Nature"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm px-4 transition-colors"
                  onClick={() => setNatureModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
