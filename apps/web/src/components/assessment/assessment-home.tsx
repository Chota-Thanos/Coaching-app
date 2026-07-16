"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  Globe,
  Loader2,
  Minus,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  SlidersHorizontal,
  User
} from "lucide-react";
import { authenticatedGet, authenticatedPost, authenticatedDelete, useAuth } from "../auth/auth-context";
import { resolveMediaUrl } from "../../lib/api";
import { useSubscription } from "../../lib/use-subscription";
import { PremiumLockOverlay } from "../billing/premium-lock-overlay";
import { UserQuestionForm } from "./user-question-form";
import { GuidedTourController, type TourStep } from "../app/guided-tour-engine";

type ActiveTab = "gk" | "aptitude" | "mains" | "bookmarks";
type QuestionFamily = "objective" | "mains_subjective";
type TestFormat = "quick_test" | "sectional_test" | "full_length_test";

type Exam = {
  id: number | string;
  name: string;
  slug: string;
};

type TreeNodeType = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  node_type: string;
  parent_id: number | null;
  content_type?: string;
  display_order?: number;
  children: TreeNodeType[];
  isUserNode?: boolean;
  user_question_count?: number;
};

type QuestionCount = {
  node_id: number;
  question_family: QuestionFamily;
  question_count: number;
};

type CompiledItem = {
  node: TreeNodeType;
  count: number;
  question_family: QuestionFamily;
};

const TABS: Array<{ id: ActiveTab; label: string; description: string; icon: ReactNode }> = [
  {
    id: "gk",
    label: "GS",
    description: "General Studies",
    icon: <Globe className="h-4 w-4" aria-hidden="true" />
  },
  {
    id: "aptitude",
    label: "CSAT",
    description: "Aptitude drills",
    icon: <Award className="h-4 w-4" aria-hidden="true" />
  },
  {
    id: "mains",
    label: "Mains",
    description: "Answer writing",
    icon: <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
  },
  {
    id: "bookmarks",
    label: "Revision",
    description: "Bookmarked questions",
    icon: <Bookmark className="h-4 w-4" aria-hidden="true" />
  }
];

const TEST_FORMATS: Array<{ id: TestFormat; label: string; duration: string }> = [
  { id: "quick_test", label: "Quick", duration: "15 min" },
  { id: "sectional_test", label: "Sectional", duration: "45 min" },
  { id: "full_length_test", label: "Full", duration: "120 min" }
];

function sortChildren(node: TreeNodeType) {
  if (node.children.length > 0) {
    node.children.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));
    node.children.forEach(sortChildren);
  }
}

function buildTree(nodes: any[]): TreeNodeType[] {
  const nodeMap = new Map<number, TreeNodeType>();
  const roots: TreeNodeType[] = [];

  nodes.forEach((n) => {
    nodeMap.set(Number(n.id), {
      id: Number(n.id),
      name: n.name,
      slug: n.slug,
      description: n.description ?? null,
      image_url: n.image_url ?? null,
      node_type: n.node_type,
      parent_id: n.parent_id ? Number(n.parent_id) : null,
      content_type: n.content_type,
      display_order: Number(n.display_order ?? 0),
      children: []
    });
  });

  Array.from(nodeMap.values()).forEach((current) => {
    if (current.parent_id) {
      const parent = nodeMap.get(current.parent_id);
      if (parent) {
        parent.children.push(current);
        return;
      }
    }
    roots.push(current);
  });

  roots.forEach(sortChildren);
  return roots.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));
}

function resolveCategory(node: TreeNodeType, nodesList: any[]) {
  const isUserPrivate = node.id < 0;
  const targetId = isUserPrivate ? -node.id : node.id;

  const actualNode = nodesList.find((n) => Number(n.id) === targetId);
  if (!actualNode) {
    return {
      subject_node_id: targetId,
      topic_node_id: null,
      subtopic_node_id: null,
      is_user_private: isUserPrivate
    };
  }

  let subjectNodeId = actualNode.id;
  let topicNodeId: number | null = null;
  let subtopicNodeId: number | null = null;

  if (actualNode.parent_id) {
    const parentNode = nodesList.find((n) => Number(n.id) === actualNode.parent_id);
    if (parentNode && parentNode.parent_id) {
      subtopicNodeId = actualNode.id;
      topicNodeId = Number(parentNode.id);
      subjectNodeId = Number(parentNode.parent_id);
    } else {
      topicNodeId = actualNode.id;
      subjectNodeId = actualNode.parent_id;
    }
  }

  return {
    subject_node_id: Number(subjectNodeId),
    topic_node_id: topicNodeId ? Number(topicNodeId) : null,
    subtopic_node_id: subtopicNodeId ? Number(subtopicNodeId) : null,
    is_user_private: isUserPrivate
  };
}

function clampCount(value: number, available: number): number {
  if (available <= 0) return 0;
  return Math.max(1, Math.min(value, Math.min(50, available)));
}

export function AssessmentHomePage({
  contentTypeFilter,
  rootNodeId,
  revisionContentTypeFilter
}: {
  contentTypeFilter?: string;
  rootNodeId?: number;
  revisionContentTypeFilter?: 'gk' | 'aptitude' | 'mains';
}) {
  const router = useRouter();
  const { token } = useAuth();
  const { hasEntitlement } = useSubscription(token);
  const isAssessmentPremium = hasEntitlement("assessment.premium_tests");

   const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get("tab") : null;

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (contentTypeFilter === "revision" || tabParam === "bookmarks" || tabParam === "revision") return "bookmarks";
    if (contentTypeFilter && ["gk", "aptitude", "mains"].includes(contentTypeFilter)) {
      return contentTypeFilter as ActiveTab;
    }
    return "gk";
  });

  useEffect(() => {
    if (contentTypeFilter === "revision" || tabParam === "bookmarks" || tabParam === "revision") {
      setActiveTab("bookmarks");
    } else if (contentTypeFilter && ["gk", "aptitude", "mains"].includes(contentTypeFilter)) {
      setActiveTab(contentTypeFilter as ActiveTab);
    }
  }, [contentTypeFilter, tabParam]);
  const [filterText, setFilterText] = useState("");
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<number | null>(null);

  const [objNodes, setObjNodes] = useState<any[]>([]);
  const [mainsNodes, setMainsNodes] = useState<any[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({});
  const [userQuestionCounts, setUserQuestionCounts] = useState<Record<number, number>>({});

  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  // Breadcrumb trail for the one-level-at-a-time category browser — replaces
  // the old "Open Category" link that navigated to a whole separate route
  // (and a disconnected copy of this whole builder). Drilling in/out here is
  // just a state change: no refetch, and the cart below is the same
  // compiledItems used everywhere else on this page.
  const [drillPath, setDrillPath] = useState<TreeNodeType[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [compiledItems, setCompiledItems] = useState<CompiledItem[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<TestFormat>("sectional_test");

  // Excluded Categories Custom View States
  const [excludedNodeIds, setExcludedNodeIds] = useState<number[]>([]);
  const [loadingExclusions, setLoadingExclusions] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempExcludedSet, setTempExcludedSet] = useState<Set<number>>(new Set());
  const [savingExclusions, setSavingExclusions] = useState(false);

  const [startingNodeId, setStartingNodeId] = useState<number | null>(null);
  const [promptNode, setPromptNode] = useState<TreeNodeType | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFormNode, setActiveFormNode] = useState<TreeNodeType | null>(null);

  // Custom test query param and inline options
  const testTemplateId = searchParams ? searchParams.get("test_template_id") : null;
  const [addingNode, setAddingNode] = useState<TreeNodeType | null>(null);
  const [addingCount, setAddingCount] = useState(0);
  const [isAddOptionModalOpen, setIsAddOptionModalOpen] = useState(false);
  const [userTests, setUserTests] = useState<any[]>([]);
  const [loadingUserTests, setLoadingUserTests] = useState(false);
  const [addingToTestId, setAddingToTestId] = useState<number | null>(null);
  const [isNewTestModalOpen, setIsNewTestModalOpen] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [targetCustomTest, setTargetCustomTest] = useState<any | null>(null);

  // Bookmarks revision states
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<any[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<number>>(new Set());
  const [selectedRevisionNodeId, setSelectedRevisionNodeId] = useState<number | null>(null);

  const questionFamily: QuestionFamily = activeTab === "mains" ? "mains_subjective" : "objective";

  useEffect(() => {
    let cancelled = false;

    async function loadExams() {
      try {
        const examsData = await authenticatedGet<Exam[]>("/api/v1/assessment/exams", token || "");
        if (cancelled) return;
        setExams(examsData || []);
        const firstExam = examsData?.[0];
        if (firstExam) setExamId(Number(firstExam.id));
      } catch (err) {
        console.error("Failed to load exams list:", err);
        if (!cancelled) setError("Could not load exam profiles.");
      }
    }

    void loadExams();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    async function loadSyllabus() {
      setLoadingTree(true);
      setError(null);
      try {
        const objData = await authenticatedGet<any[]>(`/api/v1/assessment/taxonomy-nodes?exam_id=${examId}&limit=1000`, token || "");
        const mainsData = await authenticatedGet<any[]>(`/api/v1/assessment/mains/taxonomy-nodes?exam_id=${examId}&limit=1000`, token || "");

        if (cancelled) return;
        setObjNodes(objData || []);
        setMainsNodes(mainsData || []);
        setExpandedNodes(new Set());
        setCompiledItems([]);
      } catch (err) {
        console.error("Failed to load syllabus nodes:", err);
        if (!cancelled) setError("Could not load syllabus structure for the selected exam.");
      } finally {
        if (!cancelled) setLoadingTree(false);
      }
    }

    void loadSyllabus();
    return () => {
      cancelled = true;
    };
  }, [activeTab, examId, token]);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    async function loadCounts() {
      setLoadingCounts(true);
      try {
        const records = await authenticatedGet<any[]>(
          `/api/v1/assessment/question-counts?exam_id=${examId}&question_family=${questionFamily}`,
          token || ""
        );
        if (cancelled) return;
        setQuestionCounts(
          Object.fromEntries((records || []).map((record) => [Number(record.node_id), Number(record.question_count)]))
        );
        setUserQuestionCounts(
          Object.fromEntries((records || []).map((record) => [Number(record.node_id), Number(record.user_question_count ?? 0)]))
        );
      } catch (err) {
        console.error("Failed to load question counts:", err);
        if (!cancelled) {
          setQuestionCounts({});
          setUserQuestionCounts({});
        }
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    }

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [examId, questionFamily, token]);

  // Fetch user excluded taxonomy nodes
  useEffect(() => {
    if (!token || !examId) return;
    const fetchExclusions = async () => {
      setLoadingExclusions(true);
      try {
        const data = await authenticatedGet<{ objective: number[]; mains: number[] }>(
          "/api/v1/assessment/taxonomy/excluded",
          token
        );
        const currentTypeExclusions = activeTab === "mains" ? data.mains : data.objective;
        setExcludedNodeIds(currentTypeExclusions || []);
      } catch (err: any) {
        console.error("Failed to load exclusions:", err);
      } finally {
        setLoadingExclusions(false);
      }
    };
    fetchExclusions();
  }, [token, examId, activeTab]);

  // Sync tempExcludedSet when modal opens
  useEffect(() => {
    if (isFilterModalOpen) {
      setTempExcludedSet(new Set(excludedNodeIds));
    }
  }, [isFilterModalOpen, excludedNodeIds]);

  // Filter nodes by user exclusions before building tree
  const filteredObjNodes = useMemo(() => {
    let nodes = objNodes;
    if (excludedNodeIds.length > 0) {
      const excludedSet = new Set<number>(excludedNodeIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of objNodes) {
          if (n.parent_id && excludedSet.has(Number(n.parent_id)) && !excludedSet.has(Number(n.id))) {
            excludedSet.add(Number(n.id));
            changed = true;
          }
        }
      }
      nodes = objNodes.filter((node) => !excludedSet.has(Number(node.id)));
    }
    return nodes;
  }, [objNodes, excludedNodeIds]);

  const filteredMainsNodes = useMemo(() => {
    let nodes = mainsNodes;
    if (excludedNodeIds.length > 0) {
      const excludedSet = new Set<number>(excludedNodeIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of mainsNodes) {
          if (n.parent_id && excludedSet.has(Number(n.parent_id)) && !excludedSet.has(Number(n.id))) {
            excludedSet.add(Number(n.id));
            changed = true;
          }
        }
      }
      nodes = mainsNodes.filter((node) => !excludedSet.has(Number(node.id)));
    }
    return nodes;
  }, [mainsNodes, excludedNodeIds]);

  const injectVirtualNodes = useCallback((tree: TreeNodeType[]): TreeNodeType[] => {
    function inject(node: TreeNodeType): TreeNodeType {
      const children = node.children.map(inject);
      const userCount = userQuestionCounts[node.id] ?? 0;
      if (userCount > 0) {
        children.push({
          id: -node.id, // negative ID as virtual marker
          name: "Your Questions",
          slug: `user-questions-${node.id}`,
          description: "Syllabus questions uploaded or created by you",
          image_url: null,
          node_type: "user_questions",
          parent_id: node.id,
          children: [],
          isUserNode: true,
          user_question_count: userCount
        });
      }
      return { ...node, children };
    }
    return tree.map(inject);
  }, [userQuestionCounts]);

  const gkTreeRaw = useMemo(() => buildTree(filteredObjNodes.filter((n) => n.content_type === "gk")), [filteredObjNodes]);
  const aptitudeTreeRaw = useMemo(() => buildTree(filteredObjNodes.filter((n) => n.content_type === "aptitude")), [filteredObjNodes]);
  const mainsTreeRaw = useMemo(() => buildTree(filteredMainsNodes), [filteredMainsNodes]);

  const gkTree = useMemo(() => injectVirtualNodes(gkTreeRaw), [gkTreeRaw, injectVirtualNodes]);
  const aptitudeTree = useMemo(() => injectVirtualNodes(aptitudeTreeRaw), [aptitudeTreeRaw, injectVirtualNodes]);
  const mainsTree = useMemo(() => injectVirtualNodes(mainsTreeRaw), [mainsTreeRaw, injectVirtualNodes]);

  // ── CUSTOM SYLLABUS CUSTOMIZATION MODAL HANDLERS ──
  interface FilterTreeNode {
    id: number;
    name: string;
    node_type: string;
    parent_id?: number | null;
    children: FilterTreeNode[];
  }

  const fullTree = useMemo(() => {
    const nodeMap: Record<number, FilterTreeNode> = {};
    const roots: FilterTreeNode[] = [];
    const activeNodes = activeTab === "mains"
      ? mainsNodes
      : objNodes.filter(n => n.content_type === activeTab);

    activeNodes.forEach(node => {
      nodeMap[node.id] = {
        id: node.id,
        name: node.name,
        node_type: node.node_type,
        parent_id: node.parent_id,
        children: []
      };
    });

    activeNodes.forEach(node => {
      const treeNode = nodeMap[node.id];
      if (!treeNode) return;
      const parentNode = node.parent_id ? nodeMap[node.parent_id] : null;
      if (parentNode) {
        parentNode.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    });

    const sortNodes = (list: FilterTreeNode[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
      list.forEach(item => sortNodes(item.children));
    };
    sortNodes(roots);
    return roots;
  }, [objNodes, mainsNodes, activeTab]);

  const handleToggleNode = (nodeId: number, isChecked: boolean) => {
    setTempExcludedSet(prev => {
      const next = new Set(prev);
      const activeNodes = activeTab === "mains"
        ? mainsNodes
        : objNodes.filter(n => n.content_type === activeTab);

      const getDescendants = (id: number): number[] => {
        const list: number[] = [];
        activeNodes.forEach(n => {
          if (n.parent_id === id) {
            list.push(n.id, ...getDescendants(n.id));
          }
        });
        return list;
      };

      const descendants = getDescendants(nodeId);
      if (isChecked) {
        next.delete(nodeId);
        descendants.forEach(id => next.delete(id));
      } else {
        next.add(nodeId);
        descendants.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSaveExclusions = async () => {
    if (!token) return;
    setSavingExclusions(true);
    try {
      const excludedArray = Array.from(tempExcludedSet);
      await authenticatedPost(
        "/api/v1/assessment/taxonomy/excluded",
        token,
        {
          taxonomy_type: activeTab === "mains" ? "mains" : "objective",
          excluded_node_ids: excludedArray
        }
      );
      setExcludedNodeIds(excludedArray);
      setIsFilterModalOpen(false);
    } catch (err: any) {
      console.error("Failed to save exclusions:", err);
      alert("Failed to save custom view. Please try again.");
    } finally {
      setSavingExclusions(false);
    }
  };

  const handleResetExclusions = async () => {
    if (!token) return;
    setSavingExclusions(true);
    try {
      await authenticatedPost(
        "/api/v1/assessment/taxonomy/excluded",
        token,
        {
          taxonomy_type: activeTab === "mains" ? "mains" : "objective",
          excluded_node_ids: []
        }
      );
      setExcludedNodeIds([]);
      setTempExcludedSet(new Set());
      setIsFilterModalOpen(false);
    } catch (err: any) {
      console.error("Failed to reset view:", err);
      alert("Failed to reset view. Please try again.");
    } finally {
      setSavingExclusions(false);
    }
  };

  const displayBookmarkedQuestions = useMemo(() => {
    let filtered = bookmarkedQuestions;
    if (revisionContentTypeFilter) {
      filtered = filtered.filter(b => b.taxonomy?.content_type === revisionContentTypeFilter);
    }
    if (rootNodeId) {
      filtered = filtered.filter(b => {
        const tax = b.taxonomy || {};
        return Number(tax.subject_node_id) === rootNodeId ||
               Number(tax.topic_node_id) === rootNodeId ||
               Number(tax.subtopic_node_id) === rootNodeId;
      });
    }
    return filtered;
  }, [bookmarkedQuestions, revisionContentTypeFilter, rootNodeId]);

  const getBookmarkCountForNode = (nodeId: number): number => {
    return displayBookmarkedQuestions.filter(b => {
      const tax = b.taxonomy || {};
      return Number(tax.subject_node_id) === nodeId ||
             Number(tax.topic_node_id) === nodeId ||
             Number(tax.subtopic_node_id) === nodeId;
    }).length;
  };

  const revisionTree = useMemo(() => {
    function findNodeInTree(nodes: TreeNodeType[], id: number): TreeNodeType | null {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
      return null;
    }

    const filterNode = (node: TreeNodeType): TreeNodeType | null => {
      const hasSelfBookmarks = displayBookmarkedQuestions.some(b => {
        const tax = b.taxonomy || {};
        return Number(tax.subject_node_id) === node.id ||
               Number(tax.topic_node_id) === node.id ||
               Number(tax.subtopic_node_id) === node.id;
      });
      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is TreeNodeType => child !== null);
      if (hasSelfBookmarks || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };
    let allRoots = [...gkTree, ...aptitudeTree, ...mainsTree];
    if (revisionContentTypeFilter === "gk") {
      allRoots = gkTree;
    } else if (revisionContentTypeFilter === "aptitude") {
      allRoots = aptitudeTree;
    } else if (revisionContentTypeFilter === "mains") {
      allRoots = mainsTree;
    }

    if (rootNodeId) {
      const match = findNodeInTree(allRoots, Number(rootNodeId));
      if (match) {
        const filtered = filterNode(match);
        return filtered ? [filtered] : [];
      }
      return [];
    }
    return allRoots.map(filterNode).filter((node): node is TreeNodeType => node !== null);
  }, [gkTree, aptitudeTree, mainsTree, displayBookmarkedQuestions, rootNodeId]);

  const filteredBookmarkedQuestions = useMemo(() => {
    if (selectedRevisionNodeId === null) return displayBookmarkedQuestions;
    return displayBookmarkedQuestions.filter(b => {
      const tax = b.taxonomy || {};
      return Number(tax.subject_node_id) === selectedRevisionNodeId ||
             Number(tax.topic_node_id) === selectedRevisionNodeId ||
             Number(tax.subtopic_node_id) === selectedRevisionNodeId;
    });
  }, [displayBookmarkedQuestions, selectedRevisionNodeId]);

  const handleStartRevisionTestForCategory = async () => {
    if (!token || selectedBookmarkIds.size === 0 || !examId) return;
    setCompiling(true);
    setError(null);
    try {
      const activeFilteredIds = filteredBookmarkedQuestions.map(b => Number(b.question_id));
      const qIds = Array.from(selectedBookmarkIds).filter(id => activeFilteredIds.includes(id));
      if (qIds.length === 0) {
        setError("Please select at least one question for revision.");
        return;
      }
      const selectedBookmarks = bookmarkedQuestions.filter(b => qIds.includes(Number(b.question_id)));
      const hasMains = selectedBookmarks.some(b => b.taxonomy?.content_type === "mains");

      const categoryName = selectedRevisionNodeId 
        ? ([...objNodes, ...mainsNodes].find(n => Number(n.id) === selectedRevisionNodeId)?.name || "Category")
        : "All Bookmarks";

      const customTest = await authenticatedPost<any>("/api/v1/assessment/user/custom-tests", token, {
        title: `Revision: ${categoryName} - ${new Date().toLocaleDateString()}`,
        exam_id: examId,
        exam_level_id: 1,
        question_ids: qIds,
        test_type: hasMains ? "mains_test" : "sectional_test"
      });

      const attempt = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${customTest.id}/attempts/start`,
        token,
        {}
      );

      router.push(`/assessment/attempts/${attempt.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create revision test.");
    } finally {
      setCompiling(false);
    }
  };

  const activeTree = useMemo(() => {
    function findNodeInTree(nodes: TreeNodeType[], id: number): TreeNodeType | null {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
      return null;
    }

    let tree: TreeNodeType[];
    if (activeTab === "gk") tree = gkTree;
    else if (activeTab === "aptitude") tree = aptitudeTree;
    else tree = mainsTree;

    if (rootNodeId) {
      const match = findNodeInTree(tree, Number(rootNodeId));
      return match ? match.children : [];
    }
    return tree;
  }, [activeTab, aptitudeTree, gkTree, mainsTree, rootNodeId]);

  const filteredTree = useMemo(() => {
    if (!filterText.trim()) return activeTree;
    const search = filterText.toLowerCase();

    const filterNode = (node: TreeNodeType): TreeNodeType | null => {
      const isMatched = node.name.toLowerCase().includes(search);
      const filteredChildren = node.children.map(filterNode).filter((child): child is TreeNodeType => child !== null);
      return isMatched || filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
    };

    return activeTree.map(filterNode).filter((node): node is TreeNodeType => node !== null);
  }, [activeTree, filterText]);

  // drillPath[0] is always the active subject tab; anything after it is how
  // far the user has drilled in below that tab. Falls back to the first
  // subject once data/search results load, or if the previously active
  // subject no longer matches the current search.
  const effectiveDrillPath = useMemo(() => {
    const activeSubject = drillPath[0];
    if (activeSubject && filteredTree.some((n) => n.id === activeSubject.id)) {
      return drillPath;
    }
    return filteredTree[0] ? [filteredTree[0]] : [];
  }, [drillPath, filteredTree]);

  const currentLevelNodes = effectiveDrillPath[effectiveDrillPath.length - 1]?.children ?? [];

  useEffect(() => {
    if (!filterText.trim()) return;
    const matchedIds = new Set<number>();
    const search = filterText.toLowerCase();

    const findMatches = (nodes: TreeNodeType[]) => {
      nodes.forEach((node) => {
        const hasMatch =
          node.name.toLowerCase().includes(search) ||
          node.children.some((child) => child.name.toLowerCase().includes(search));
        if (hasMatch) matchedIds.add(node.id);
        if (node.children.length > 0) findMatches(node.children);
      });
    };

    findMatches(activeTree);
    setExpandedNodes(matchedIds);
  }, [activeTree, filterText]);

  const aggregatedCounts = useMemo(() => {
    const map: Record<number, number> = {};

    function sumNodeCounts(node: TreeNodeType): number {
      let sum = questionCounts[node.id] ?? 0;
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          sum += sumNodeCounts(child);
        });
      }
      map[node.id] = sum;
      return sum;
    }

    gkTree.forEach(sumNodeCounts);
    aptitudeTree.forEach(sumNodeCounts);
    mainsTree.forEach(sumNodeCounts);

    return map;
  }, [gkTree, aptitudeTree, mainsTree, questionCounts]);

  const parentMap = useMemo(() => {
    const map: Record<number, number | null> = {};
    function buildMap(node: TreeNodeType) {
      node.children.forEach(child => {
        map[child.id] = node.id;
        buildMap(child);
      });
    }
    gkTree.forEach(buildMap);
    aptitudeTree.forEach(buildMap);
    mainsTree.forEach(buildMap);
    return map;
  }, [gkTree, aptitudeTree, mainsTree]);

  const isNodeDescendantOf = useCallback((childId: number, parentId: number): boolean => {
    let current: number | null | undefined = childId;
    while (current) {
      const parent: number | null | undefined = parentMap[current];
      if (parent === parentId) return true;
      current = parent;
    }
    return false;
  }, [parentMap]);

  const getAvailableCount = useCallback((nodeId: number) => {
    if (nodeId < 0) {
      // Virtual node representing user questions
      const actualNodeId = -nodeId;
      const rawUserAvailable = userQuestionCounts[actualNodeId] ?? 0;
      let selectedOverlap = 0;
      compiledItems.forEach(item => {
        if (item.node.id === nodeId) {
          selectedOverlap += item.count;
        }
      });
      return Math.max(0, rawUserAvailable - selectedOverlap);
    }

    const rawAvailable = aggregatedCounts[nodeId] ?? 0;
    let selectedOverlap = 0;
    compiledItems.forEach(item => {
      const isDescendant = isNodeDescendantOf(item.node.id, nodeId);
      const isAncestor = isNodeDescendantOf(nodeId, item.node.id);
      if (isDescendant || isAncestor || item.node.id === nodeId) {
        selectedOverlap += item.count;
      }
    });
    return Math.max(0, rawAvailable - selectedOverlap);
  }, [aggregatedCounts, compiledItems, isNodeDescendantOf, userQuestionCounts]);

  const availableTotal = useMemo(() => {
    return activeTree.reduce((total, node) => total + getAvailableCount(node.id), 0);
  }, [activeTree, getAvailableCount]);

  // First root category worth showcasing in the tour — prefers one with both
  // sub-categories (so "Browse" is meaningful) and available questions (so
  // the Add step has something to point at). Mirrors the mobile app's
  // _findTourAnchorNodeId.
  const tourAnchorId = useMemo(() => {
    const withChildren = filteredTree.find((n) => n.children.length > 0 && getAvailableCount(n.id) > 0);
    return withChildren?.id ?? filteredTree[0]?.id ?? null;
  }, [filteredTree, getAvailableCount]);
  const getSelectedCount = (nodeId: number) => {
    const available = getAvailableCount(nodeId);
    return clampCount(counts[nodeId] ?? Math.min(10, Math.max(available, 1)), available);
  };

  const setNodeCount = (nodeId: number, nextValue: number) => {
    setCounts((prev) => ({
      ...prev,
      [nodeId]: clampCount(nextValue, getAvailableCount(nodeId))
    }));
  };

  const toggleExpand = (id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const ids = new Set<number>();
    const gatherIds = (nodes: TreeNodeType[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          ids.add(node.id);
          gatherIds(node.children);
        }
      });
    };
    gatherIds(activeTree);
    setExpandedNodes(ids);
  };

  const handleCollapseAll = () => setExpandedNodes(new Set());

  const handleExpandToDepth = (depth: number) => {
    const ids = new Set<number>();
    const gatherIds = (nodes: TreeNodeType[], currentDepth: number) => {
      nodes.forEach((node) => {
        if (node.children.length > 0 && currentDepth < depth) {
          ids.add(node.id);
          gatherIds(node.children, currentDepth + 1);
        }
      });
    };
    gatherIds(activeTree, 0);
    setExpandedNodes(ids);
  };

  const handleTabChange = (nextTab: ActiveTab) => {
    setActiveTab(nextTab);
    setFilterText("");
    setExpandedNodes(new Set());
    setCompiledItems([]);
    setDrillPath([]);
  };

  const handleStartPromptedTest = async (node: TreeNodeType, formatId: TestFormat, count: number) => {
    setPromptNode(null);
    setStartingNodeId(node.id);
    setError(null);
    try {
      const isMains = activeTab === "mains";
      const nodesList = isMains ? mainsNodes : objNodes;
      const category = resolveCategory(node, nodesList);

      const attempt = await authenticatedPost<any>("/api/v1/assessment/attempts/dynamic", token!, {
        exam_id: examId,
        ...category,
        question_count: count,
        test_type: formatId,
        question_family: questionFamily
      });
      router.push(`/assessment/attempts/${attempt.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to start this category test.");
    } finally {
      setStartingNodeId(null);
    }
  };

  const handleStartTest = async (node: TreeNodeType) => {
    if (!token) {
      setError("Please sign in to take practice assessments.");
      return;
    }
    if (!examId) {
      setError("Select an exam profile before starting a test.");
      return;
    }

    const available = getAvailableCount(node.id);
    if (available <= 0) {
      setError("This category has no published questions for the selected section.");
      return;
    }

    const isMains = activeTab === "mains";
    const shouldPrompt = (isMains && available > 25) || (!isMains && available > 75);

    if (shouldPrompt) {
      setPromptNode(node);
    } else {
      setStartingNodeId(node.id);
      setError(null);
      try {
        const nodesList = isMains ? mainsNodes : objNodes;
        const category = resolveCategory(node, nodesList);

        const attempt = await authenticatedPost<any>("/api/v1/assessment/attempts/dynamic", token!, {
          exam_id: examId,
          ...category,
          question_count: available,
          test_type: isMains ? "sectional_test" : "quick_test",
          question_family: questionFamily
        });
        router.push(`/assessment/attempts/${attempt.id}`);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to start this category test.");
      } finally {
        setStartingNodeId(null);
      }
    }
  };

  const handleStartRevisionTest = async () => {
    if (!token || selectedBookmarkIds.size === 0 || !examId) return;
    setCompiling(true);
    setError(null);
    try {
      const qIds = Array.from(selectedBookmarkIds);
      const selectedBookmarks = bookmarkedQuestions.filter(b => qIds.includes(Number(b.question_id)));
      const hasMains = selectedBookmarks.some(b => b.taxonomy?.content_type === "mains");

      const customTest = await authenticatedPost<any>("/api/v1/assessment/user/custom-tests", token, {
        title: `Revision Test - ${new Date().toLocaleDateString()}`,
        exam_id: examId,
        exam_level_id: 1,
        question_ids: qIds,
        test_type: hasMains ? "mains_test" : "sectional_test"
      });

      const attempt = await authenticatedPost<any>(
        `/api/v1/assessment/test-templates/${customTest.id}/attempts/start`,
        token,
        {}
      );

      router.push(`/assessment/attempts/${attempt.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create revision test.");
    } finally {
      setCompiling(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "bookmarks" || !token) return;
    let cancelled = false;
    async function loadBookmarks() {
      setLoadingBookmarks(true);
      setError(null);
      try {
        const data = await authenticatedGet<any[]>("/api/v1/assessment/me/bookmarks?limit=100", token!);
        if (cancelled) return;
        setBookmarkedQuestions(data || []);
        
        let filtered = data || [];
        if (revisionContentTypeFilter) {
          filtered = filtered.filter(b => b.taxonomy?.content_type === revisionContentTypeFilter);
        }
        if (rootNodeId) {
          filtered = filtered.filter(b => {
            const tax = b.taxonomy || {};
            return Number(tax.subject_node_id) === rootNodeId ||
                   Number(tax.topic_node_id) === rootNodeId ||
                   Number(tax.subtopic_node_id) === rootNodeId;
          });
        }
        setSelectedBookmarkIds(new Set(filtered.map((b) => Number(b.question_id))));
      } catch (err) {
        console.error("Failed to load bookmarks:", err);
        if (!cancelled) setError("Could not load bookmarked questions.");
      } finally {
        if (!cancelled) setLoadingBookmarks(false);
      }
    }
    void loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, [activeTab, token, rootNodeId, revisionContentTypeFilter]);

  // Load target custom test template details if test_template_id is active
  useEffect(() => {
    if (!token || !testTemplateId) {
      setTargetCustomTest(null);
      return;
    }
    const fetchTargetTest = async () => {
      try {
        const data = await authenticatedGet<any>(`/api/v1/assessment/test-templates/${testTemplateId}`, token!);
        setTargetCustomTest(data);
      } catch (err) {
        console.error("Failed to load target custom test:", err);
      }
    };
    void fetchTargetTest();
  }, [token, testTemplateId]);

  // Load user unattempted tests when options modal is opened
  useEffect(() => {
    if (!token || !isAddOptionModalOpen) return;
    async function loadUserTests() {
      setLoadingUserTests(true);
      try {
        const data = await authenticatedGet<any[]>(
          `/api/v1/assessment/test-templates?access_type=private&content_type=${activeTab}&limit=50`,
          token!
        );
        // Only list templates that have no attempt yet
        setUserTests(data.filter((t: any) => t.latest_attempt_status === null) || []);
      } catch (err) {
        console.error("Failed to load user tests:", err);
      } finally {
        setLoadingUserTests(false);
      }
    }
    void loadUserTests();
  }, [token, isAddOptionModalOpen, activeTab]);

  const handleAddToTest = async (node: TreeNodeType) => {
    const selectedCount = getSelectedCount(node.id);
    if (selectedCount <= 0) {
      setError("This category has no published questions for the selected section.");
      return;
    }

    // 1. If testTemplateId is present in URL, directly add to that specific test
    if (testTemplateId) {
      setCompiling(true);
      setError(null);
      try {
        const isMains = activeTab === "mains";
        const { subject_node_id, topic_node_id, subtopic_node_id } = resolveCategory(
          node,
          isMains ? mainsNodes : objNodes
        );
        
        const url = isMains
          ? `/api/v1/assessment/mains/questions?limit=100&subject_node_id=${subject_node_id}` +
            (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
            (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "")
          : `/api/v1/assessment/questions?limit=100&subject_node_id=${subject_node_id}` +
            (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
            (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "");

        const questions = await authenticatedGet<any[]>(url, token!);
        if (!questions || questions.length === 0) {
          setError("No questions found in this category.");
          return;
        }

        // Shuffle questions and select IDs
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, selectedCount);
        const questionIds = selected.map((q) => q.id || q.question_id);

        await authenticatedPost(`/api/v1/assessment/user/custom-tests/${testTemplateId}/add-questions`, token!, {
          question_ids: questionIds
        });

        alert(`Successfully added ${questionIds.length} questions to "${targetCustomTest?.title || 'custom test'}"!`);
        if (targetCustomTest) {
          setTargetCustomTest({
            ...targetCustomTest,
            question_count: (targetCustomTest.question_count ?? 0) + questionIds.length
          });
        }
      } catch (err: any) {
        setError(err?.message || "Failed to add questions to test.");
      } finally {
        setCompiling(false);
      }
      return;
    }

    // 2. Otherwise, prompt user where they want to add
    setAddingNode(node);
    setAddingCount(selectedCount);
    setIsAddOptionModalOpen(true);
  };

  const handleCompileAndStart = async () => {
    if (!token) {
      setError("Please sign in to take compiled tests.");
      return;
    }
    const totalQuestions = compiledItems.reduce((acc, item) => acc + item.count, 0);
    const isMainsCart = compiledItems.some((item) => item.question_family === "mains_subjective");
    const cap = isAssessmentPremium ? (isMainsCart ? 25 : 100) : (isMainsCart ? 10 : 50);
    if (totalQuestions > cap) {
      setError(
        isAssessmentPremium
          ? `⚡ ${isMainsCart ? "Mains" : "GK/CSAT"} tests are limited to ${cap} questions, even on Assessment Premium. Please reduce the number of questions.`
          : `⚡ ${isMainsCart ? "Mains" : "GK/CSAT"} tests on the free tier are limited to ${cap} questions. Please reduce the number of questions or upgrade to Assessment Premium for a higher limit.`
      );
      return;
    }
    if (!examId || compiledItems.length === 0) return;

    const invalidItem = compiledItems.find((item) => getAvailableCount(item.node.id) <= 0);
    if (invalidItem) {
      setError(`${invalidItem.node.name} has no published questions for the selected section.`);
      return;
    }

    setCompiling(true);
    setError(null);
    try {
      const categories = compiledItems.map((item) => ({
        ...resolveCategory(item.node, item.question_family === "mains_subjective" ? mainsNodes : objNodes),
        question_count: clampCount(item.count, getAvailableCount(item.node.id)),
        question_family: item.question_family
      }));

      const attempt = await authenticatedPost<any>("/api/v1/assessment/attempts/compiled", token, {
        exam_id: examId,
        test_type: selectedFormat,
        categories
      });
      router.push(`/assessment/attempts/${attempt.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to compile the custom test.");
    } finally {
      setCompiling(false);
    }
  };

  const totalCompiledQuestions = compiledItems.reduce((total, item) => total + item.count, 0);
  const canCompile = compiledItems.length > 0 && !compiling && compiledItems.every((item) => getAvailableCount(item.node.id) > 0);
  const activeSection = TABS.find((tab) => tab.id === activeTab);

  const builderTourSteps: TourStep[] = [
    {
      selector: "#tour-browse-btn",
      badge: "Quick Tour",
      title: "Browse Sub-Categories",
      body:
        activeTab === "mains"
          ? "Papers go several levels deep — Subject Area, Theme, Topic, Subtopic. Click here to step into any of them one level at a time, where you can set quantities and add questions."
          : "Click here to step into this subject's sources and topics one level at a time. Once inside, you can set how many questions you want and add them to your test.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {!rootNodeId && activeTab !== "bookmarks" && !loadingTree && tourAnchorId != null && (
        // !loadingTree matters as much as tourAnchorId != null: the actual
        // TreeRow/Browse button JSX only mounts once loadingTree is false
        // (see the loadingTree ? <spinner> : ... branch below), even though
        // activeTree/tourAnchorId can already have data before that. Without
        // this the tour fires while its target isn't in the DOM yet and
        // renders as an unanchored floating tooltip over a dimmed screen.
        //
        // No `token` here on purpose: the completion-check API only knows
        // tours pre-registered in app.onboarding_tours, which this one isn't
        // (it's defined entirely by fallbackSteps below) — passing token
        // would make GuidedTourController check a DB record that can never
        // exist, so it'd report "not completed" and replay every visit.
        // Omitting it keeps completion tracked in localStorage only, same
        // as the mobile app's AppTourService.
        <GuidedTourController
          tourKey={`assessment_builder_tour_${activeTab}_v1`}
          fallbackSteps={builderTourSteps}
        />
      )}
      <main className="mx-auto max-w-7xl space-y-5 px-4 pt-5">
        {targetCustomTest && (
          <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-indigo-900 text-sm">
                Adding questions to: <span className="underline">{targetCustomTest.title}</span>
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Clicking the "+ Add" button on any category will automatically fetch, shuffle and insert questions into this test.
              </p>
            </div>
            <Link
              href={`/assessment/custom-test/${testTemplateId}?content_type=${activeTab}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition shrink-0"
            >
              <span>Back to Test Details</span>
              <ArrowLeft className="h-4 w-4 rotate-180 animate-pulse" />
            </Link>
          </div>
        )}
        {!rootNodeId && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-bold text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {activeTab === "bookmarks" ? "Instructive revision builder" : "Dynamic assessment builder"}
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                  {activeTab === "bookmarks" ? "Revise your bookmarked questions" : "Build a test from syllabus categories"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {activeTab === "bookmarks" 
                    ? "Review the questions you marked for revision. Group them by category and take a custom-tailored test." 
                    : "Choose an exam profile, switch between GS, CSAT, and Mains, then start a focused category test or build one combined paper."}
                </p>
              </div>

              <div className="w-full max-w-sm">
                <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                  Exam profile
                  <select
                    value={examId ?? ""}
                    onChange={(event) => {
                      setExamId(Number(event.target.value));
                      setCompiledItems([]);
                    }}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                  >
                    {exams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {activeTab === "bookmarks" ? (
                <>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Total bookmarked questions</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{loadingBookmarks ? "--" : bookmarkedQuestions.length}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Filtered category</p>
                    <p className="mt-1 truncate text-xl font-black text-indigo-700">
                      {selectedRevisionNodeId 
                        ? ([...objNodes, ...mainsNodes].find(n => Number(n.id) === selectedRevisionNodeId)?.name || "Selected Category")
                        : "All Categories"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Selected for revision</p>
                    <p className="mt-1 text-xl font-black text-slate-950">
                      {selectedBookmarkIds.size} Qs
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Visible category pool</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{loadingCounts ? "--" : availableTotal}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Active section</p>
                    <p className="mt-1 truncate text-xl font-black text-indigo-700">{activeSection?.label ?? "GS"}</p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                    <p className="text-xs font-bold text-slate-500">Compiled paper</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{totalCompiledQuestions} Qs</p>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {!isAssessmentPremium && token && (
        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-650 text-white shadow-sm">
              <Sparkles className="h-5 w-5 text-indigo-200 fill-indigo-200" />
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">Upgrade to Assessment Premium</p>
              <p className="text-xs font-semibold text-slate-600">You get 3 free self-built tests total across GK, CSAT &amp; Mains. Upgrade for unlimited tests plus AI answer evaluation.</p>
            </div>
          </div>
          <Link href="/pricing" className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition">
            View Upgrade Plans
          </Link>
        </div>
      )}

      <div className={activeTab === "bookmarks" ? "w-full" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"}>
        <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 ${activeTab === "bookmarks" ? "w-full" : ""}`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {!contentTypeFilter && (
              <div className="grid gap-2 sm:grid-cols-4 xl:w-[42rem]">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={activeTab === tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      activeTab === tab.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-500/50 hover:text-indigo-600 hover:bg-indigo-50/20"
                    }`}
                  >
                    <span
                      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                        activeTab === tab.id 
                          ? "bg-white/15 border-white/20 text-white" 
                          : "bg-indigo-50 border-indigo-100/50 text-indigo-600"
                      }`}
                    >
                      {tab.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{tab.label}</span>
                      <span className={`mt-0.5 block text-[11px] font-semibold leading-4 ${activeTab === tab.id ? "text-indigo-200" : "text-slate-600"}`}>
                        {tab.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab !== "bookmarks" && (
              <div className="relative w-full xl:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search categories"
                  value={filterText}
                  onChange={(event) => {
                    setFilterText(event.target.value);
                    if (event.target.value.trim()) setDrillPath([]);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10"
                />
              </div>
            )}
          </div>

          {activeTab !== "bookmarks" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Tree view
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "All", onClick: handleExpandAll },
                  { label: "None", onClick: handleCollapseAll },
                  { label: "Level 2", onClick: () => handleExpandToDepth(1) },
                  { label: "Level 3", onClick: () => handleExpandToDepth(2) }
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-indigo-650 hover:text-indigo-650"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "bookmarks" ? (
            loadingBookmarks ? (
              <div className="grid min-h-80 place-items-center">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" />
                  Loading bookmarked questions
                </div>
              </div>
            ) : bookmarkedQuestions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
                <Bookmark className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-slate-750">No bookmarked questions yet</p>
                <p className="mt-1 text-xs text-slate-500">Bookmark questions you got wrong during test reviews to revise them here.</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-[18rem_1fr] md:items-start mt-4">
                {/* Category Selector Column */}
                <div className="rounded-xl border border-slate-200 bg-slate-55 p-3.5">
                  <p className="text-xs font-black uppercase text-slate-500 tracking-wide mb-3">
                    Filter by Category
                  </p>
                  <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRevisionNodeId(null)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-bold transition ${
                        selectedRevisionNodeId === null
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-200/60"
                      }`}
                    >
                      <span>All Categories</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        selectedRevisionNodeId === null ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {bookmarkedQuestions.length}
                      </span>
                    </button>
                    
                    {revisionTree.map((node) => (
                      <RevisionTreeRow
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedRevisionNodeId}
                        onSelect={setSelectedRevisionNodeId}
                        getBookmarkCount={getBookmarkCountForNode}
                      />
                    ))}
                  </div>
                </div>

                {/* Filtered bookmarked questions column */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-slate-55 p-3.5 text-xs font-bold text-slate-750">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-600"
                        checked={
                          filteredBookmarkedQuestions.length > 0 &&
                          filteredBookmarkedQuestions.every(b => selectedBookmarkIds.has(Number(b.question_id)))
                        }
                        onChange={(e) => {
                          setSelectedBookmarkIds((prev) => {
                            const next = new Set(prev);
                            const activeFilteredIds = filteredBookmarkedQuestions.map(b => Number(b.question_id));
                            if (e.target.checked) {
                              activeFilteredIds.forEach(id => next.add(id));
                            } else {
                              activeFilteredIds.forEach(id => next.delete(id));
                            }
                            return next;
                          });
                        }}
                      />
                      Select All ({filteredBookmarkedQuestions.length})
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{
                        Array.from(selectedBookmarkIds).filter(id => 
                          filteredBookmarkedQuestions.some(b => Number(b.question_id) === id)
                        ).length
                      } selected</span>
                      <button
                        type="button"
                        onClick={handleStartRevisionTestForCategory}
                        disabled={
                          Array.from(selectedBookmarkIds).filter(id => 
                            filteredBookmarkedQuestions.some(b => Number(b.question_id) === id)
                          ).length === 0 || compiling
                        }
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 text-[11px] font-bold text-white shadow-sm transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        {compiling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Take Revision Test
                      </button>
                    </div>
                  </div>

                  {filteredBookmarkedQuestions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                      No questions bookmarked under this category.
                    </div>
                  ) : (
                    <div className="max-h-[500px] space-y-2.5 overflow-y-auto pr-1">
                      {filteredBookmarkedQuestions.map((bookmark) => {
                        const q = bookmark.question_version;
                        const qId = Number(bookmark.question_id);
                        const isSelected = selectedBookmarkIds.has(qId);
                        return (
                          <div key={qId} className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all bg-white hover:shadow-sm ${isSelected ? "border-indigo-200" : "border-slate-200"}`}>
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedBookmarkIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(qId)) {
                                    next.delete(qId);
                                  } else {
                                    next.add(qId);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-650">
                                {bookmark.taxonomy?.content_type === "mains" ? "Mains" : "Objective"}
                              </span>
                              <p className="mt-1.5 line-clamp-3 text-sm font-bold leading-relaxed text-slate-900">
                                {q?.question_statement || "No statement"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await authenticatedDelete(`/api/v1/assessment/me/bookmarks/${qId}`, token || "");
                                  setBookmarkedQuestions(prev => prev.filter(b => Number(b.question_id) !== qId));
                                  setSelectedBookmarkIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(qId);
                                    return next;
                                  });
                                } catch (err) {
                                  console.error("Failed to delete bookmark:", err);
                                }
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Remove bookmark"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : loadingTree ? (
            <div className="grid min-h-80 place-items-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" />
                Loading syllabus categories
              </div>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-black text-slate-700">No categories found</p>
              <p className="mt-1 text-xs text-slate-500">Try another section or search term.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/20 p-3.5 shadow-sm gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-650 shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate">
                    {excludedNodeIds.length > 0
                      ? `${excludedNodeIds.length} categories hidden from syllabus view`
                      : "Modify which sources and categories are visible in your view"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-indigo-705 hover:text-indigo-800 bg-white hover:bg-slate-50 rounded-xl transition shadow-sm border border-indigo-150 shrink-0"
                >
                  Customize View
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {filteredTree.map((subject) => {
                  const isActive = subject.id === effectiveDrillPath[0]?.id;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      id={subject.id === tourAnchorId ? "tour-browse-btn" : undefined}
                      onClick={() => setDrillPath([subject])}
                      className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-black transition ${
                        isActive
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
                      }`}
                    >
                      {subject.name}
                    </button>
                  );
                })}
              </div>

              {effectiveDrillPath.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
                  {effectiveDrillPath.map((crumb, i) => (
                    <span key={crumb.id} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />}
                      <button
                        type="button"
                        onClick={() => setDrillPath(effectiveDrillPath.slice(0, i + 1))}
                        disabled={i === effectiveDrillPath.length - 1}
                        className={i === effectiveDrillPath.length - 1 ? "text-slate-900 font-black" : "text-indigo-650 hover:text-indigo-850 transition"}
                      >
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {currentLevelNodes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-xs text-slate-500">
                    No sub-categories here.
                  </div>
                ) : (
                  currentLevelNodes.map((node) => (
                    <TreeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      expandedNodes={expandedNodes}
                      toggleExpand={toggleExpand}
                      getAvailableCount={getAvailableCount}
                      getSelectedCount={getSelectedCount}
                      setNodeCount={setNodeCount}
                      loadingCounts={loadingCounts}
                      startingNodeId={startingNodeId}
                      onAddToTest={handleAddToTest}
                      onStartTest={handleStartTest}
                      activeTab={activeTab}
                      onAddQuestion={setActiveFormNode}
                      userQuestionCounts={userQuestionCounts}
                      onDrillInto={(n) => setDrillPath([...effectiveDrillPath, n])}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        {activeTab !== "bookmarks" && (
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-950">Compiled Test Builder</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Add categories from the syllabus tree.</p>
              </div>
            </div>

            {compiledItems.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <Plus className="mx-auto h-7 w-7 text-indigo-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-slate-800">No categories added</p>
                <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-slate-600">Use the Add button beside any category with available questions.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {compiledItems.map((item) => {
                    const available = getAvailableCount(item.node.id);
                    return (
                      <div key={item.node.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{item.node.name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {item.count} selected / {available} available
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${item.node.name}`}
                            onClick={() => setCompiledItems((prev) => prev.filter((entry) => entry.node.id !== item.node.id))}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Test format selection omitted for compiled custom tests */}

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between text-sm font-black text-slate-950 flex-row">
                    <span>Total selected</span>
                    <span>{totalCompiledQuestions} Qs</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompileAndStart}
                    disabled={!canCompile}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {compiling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                    Compile & Start
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>

    {promptNode && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-base font-black text-slate-900">Select Test Format</h3>
            <button
              type="button"
              onClick={() => setPromptNode(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Choose a format to practice questions from <strong>{promptNode.name}</strong>.
          </p>
          <div className="mt-4 space-y-2">
            {(activeTab === "mains"
              ? [
                  { label: "Sectional", id: "quick_test", count: 5, duration: "30 min" },
                  { label: "Half Length", id: "sectional_test", count: 15, duration: "90 min" },
                  { label: "Full Length", id: "full_length_test", count: 25, duration: "180 min" }
                ]
              : [
                  { label: "Sectional", id: "quick_test", count: 25, duration: "20 min" },
                  { label: "Half Length", id: "sectional_test", count: 50, duration: "45 min" },
                  { label: "Full Length", id: "full_length_test", count: 100, duration: "120 min" }
                ]
            ).map((format) => {
              const available = getAvailableCount(promptNode.id);
              const count = Math.min(format.count, available);
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => handleStartPromptedTest(promptNode, format.id as TestFormat, count)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-indigo-500 hover:bg-indigo-50/20 transition"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{format.label} Test ({count} Qs)</p>
                    <p className="text-xs text-slate-500">Duration: {format.duration}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {isFilterModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
            <div>
              <h3 className="text-base font-black text-slate-900">Customize Syllabus View</h3>
              <p className="text-xs text-slate-500 mt-1">Uncheck categories/sources to hide them and their children from your syllabus tree views.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="text-slate-400 hover:text-slate-650"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4">
            {fullTree.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-bold">
                No categories available to customize.
              </div>
            ) : (
              <div className="space-y-2">
                {fullTree.map(node => {
                  const renderFilterTreeNode = (node: FilterTreeNode, depth: number = 0) => {
                    const isExcluded = tempExcludedSet.has(node.id);
                    const isChecked = !isExcluded;
                    const hasChildren = node.children.length > 0;

                    return (
                      <div key={node.id} className="space-y-1">
                        <div 
                          className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-lg transition"
                          style={{ paddingLeft: `${depth * 20 + 8}px` }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleToggleNode(node.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 transition cursor-pointer"
                          />
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                            node.node_type === "subject" || node.node_type === "paper"
                              ? "bg-slate-100 text-slate-700"
                              : node.node_type === "source_bucket" || node.node_type === "subject_area"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}>
                            {node.node_type.replaceAll("_", " ")}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">{node.name}</span>
                        </div>
                        {hasChildren && (
                          <div className="space-y-1">
                            {node.children.map(child => renderFilterTreeNode(child, depth + 1))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return renderFilterTreeNode(node);
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4 shrink-0 gap-3">
            <button
              type="button"
              disabled={savingExclusions}
              onClick={handleResetExclusions}
              className="px-4 h-10 text-xs font-bold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              Reset to Default
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-4 h-10 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingExclusions}
                onClick={handleSaveExclusions}
                className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-60"
              >
                {savingExclusions && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {activeFormNode && token && (() => {
      const resolved = resolveCategory(activeFormNode, activeTab === "mains" ? mainsNodes : objNodes);
      return (
        <UserQuestionForm
          isOpen={!!activeFormNode}
          onClose={() => setActiveFormNode(null)}
          token={token}
          examId={examId!}
          subjectNodeId={resolved.subject_node_id}
          topicNodeId={resolved.topic_node_id}
          subtopicNodeId={resolved.subtopic_node_id}
          questionFamily={activeTab === "mains" ? "mains_subjective" : "objective"}
          onSuccess={() => {
            // Reload counts
            const tempId = examId;
            setExamId(null);
            setTimeout(() => setExamId(tempId), 50);
          }}
        />
      );
    })()}

    {isAddOptionModalOpen && addingNode && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={() => setIsAddOptionModalOpen(false)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 pr-8">Add Questions to Test</h2>
          <p className="text-xs text-slate-500 mt-1">
            Add {addingCount} questions from <span className="font-semibold text-slate-800">"{addingNode.name}"</span>. Choose where to send them:
          </p>

          <div className="mt-5 space-y-3">
            {/* Option 1: Quick Cart */}
            <button
              onClick={() => {
                setCompiledItems((prev) => {
                  const existing = prev.find((item) => item.node.id === addingNode.id);
                  const available = getAvailableCount(addingNode.id);
                  if (existing) {
                    return prev.map((item) =>
                      item.node.id === addingNode.id
                        ? { ...item, count: clampCount(item.count + addingCount, available) }
                        : item
                    );
                  }
                  return [...prev, { node: addingNode, count: addingCount, question_family: questionFamily }];
                });
                setIsAddOptionModalOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">Add to Dynamic practice cart</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Keep building a session in your sidebar.</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            {/* Option 2: Create New Test */}
            <button
              onClick={() => {
                setIsNewTestModalOpen(true);
                setIsAddOptionModalOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-left"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">Add to New Custom Test</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Create a blank test and insert these questions immediately.</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            {/* Option 3: Existing Custom Tests */}
            <div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-4">
                Or add to existing unattempted test:
              </div>
              {loadingUserTests ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                </div>
              ) : userTests.length === 0 ? (
                <div className="text-center py-3 bg-slate-50 border border-slate-150 rounded-xl text-[10px] text-slate-400 italic">
                  No unattempted custom tests found.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-150 rounded-xl p-2 bg-slate-50/50">
                  {userTests.map((t) => (
                    <button
                      key={t.id}
                      onClick={async () => {
                        setAddingToTestId(t.id);
                        try {
                          const isMains = activeTab === "mains";
                          const { subject_node_id, topic_node_id, subtopic_node_id } = resolveCategory(
                            addingNode,
                            isMains ? mainsNodes : objNodes
                          );
                          
                          const url = isMains
                            ? `/api/v1/assessment/mains/questions?limit=100&subject_node_id=${subject_node_id}` +
                              (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
                              (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "")
                            : `/api/v1/assessment/questions?limit=100&subject_node_id=${subject_node_id}` +
                              (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
                              (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "");

                          const questions = await authenticatedGet<any[]>(url, token!);
                          if (!questions || questions.length === 0) {
                            alert("No questions found in this category.");
                            return;
                          }

                          const shuffled = [...questions].sort(() => Math.random() - 0.5);
                          const selected = shuffled.slice(0, addingCount);
                          const questionIds = selected.map((q) => q.id || q.question_id);

                          await authenticatedPost(`/api/v1/assessment/user/custom-tests/${t.id}/add-questions`, token!, {
                            question_ids: questionIds
                          });

                          alert(`Successfully added ${questionIds.length} questions to "${t.title}"!`);
                          setIsAddOptionModalOpen(false);
                        } catch (err: any) {
                          alert(err?.message || "Failed to add questions.");
                        } finally {
                          setAddingToTestId(null);
                        }
                      }}
                      disabled={addingToTestId !== null}
                      className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/20 transition flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800 truncate pr-2">{t.title}</span>
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">{t.question_count ?? 0} Qs</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {isNewTestModalOpen && addingNode && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={() => setIsNewTestModalOpen(false)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 pr-8">Create Test & Add Questions</h2>
          <p className="text-xs text-slate-500 mt-1">Create a new private custom test containing these {addingCount} questions.</p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTestTitle.trim()) return;
              setCompiling(true);
              try {
                const isMains = activeTab === "mains";
                const { subject_node_id, topic_node_id, subtopic_node_id } = resolveCategory(
                  addingNode,
                  isMains ? mainsNodes : objNodes
                );
                
                const url = isMains
                  ? `/api/v1/assessment/mains/questions?limit=100&subject_node_id=${subject_node_id}` +
                    (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
                    (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "")
                  : `/api/v1/assessment/questions?limit=100&subject_node_id=${subject_node_id}` +
                    (topic_node_id ? `&topic_node_id=${topic_node_id}` : "") +
                    (subtopic_node_id ? `&subtopic_node_id=${subtopic_node_id}` : "");

                const questions = await authenticatedGet<any[]>(url, token!);
                if (!questions || questions.length === 0) {
                  alert("No questions found in this category.");
                  return;
                }

                const shuffled = [...questions].sort(() => Math.random() - 0.5);
                const selected = shuffled.slice(0, addingCount);
                const questionIds = selected.map((q) => q.id || q.question_id);

                let examLevelId = 7;
                let testType = "sectional_test";
                if (activeTab === "aptitude") {
                  examLevelId = 1;
                } else if (activeTab === "mains") {
                  examLevelId = 3;
                  testType = "mains_test";
                }

                const newTest = await authenticatedPost<any>("/api/v1/assessment/user/custom-tests", token!, {
                  title: newTestTitle.trim(),
                  exam_id: examId!,
                  exam_level_id: examLevelId,
                  test_type: testType,
                  question_ids: questionIds
                });

                alert(`Successfully created "${newTestTitle}" with ${questionIds.length} questions!`);
                setNewTestTitle("");
                setIsNewTestModalOpen(false);
              } catch (err: any) {
                alert(err?.message || "Failed to create custom test.");
              } finally {
                setCompiling(false);
              }
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Test Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. History Test 1"
                value={newTestTitle}
                onChange={(e) => setNewTestTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsNewTestModalOpen(false)}
                className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={compiling || !newTestTitle.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:bg-slate-100"
              >
                {compiling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save & Add</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
  );
}

function TreeRow({
  node,
  depth,
  expandedNodes,
  toggleExpand,
  getAvailableCount,
  getSelectedCount,
  setNodeCount,
  loadingCounts,
  startingNodeId,
  onAddToTest,
  onStartTest,
  activeTab,
  onAddQuestion,
  userQuestionCounts,
  onDrillInto
}: {
  node: TreeNodeType;
  depth: number;
  expandedNodes: Set<number>;
  toggleExpand: (id: number) => void;
  getAvailableCount: (id: number) => number;
  getSelectedCount: (id: number) => number;
  setNodeCount: (id: number, nextValue: number) => void;
  loadingCounts: boolean;
  startingNodeId: number | null;
  onAddToTest: (node: TreeNodeType) => void;
  onStartTest: (node: TreeNodeType) => void;
  activeTab: ActiveTab;
  onAddQuestion?: (node: TreeNodeType) => void;
  onDrillInto?: (node: TreeNodeType) => void;
  userQuestionCounts?: Record<number, number>;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const availableCount = getAvailableCount(node.id);
  const selectedCount = getSelectedCount(node.id);
  const disabled = loadingCounts || availableCount <= 0;
  const isStarting = startingNodeId === node.id;

  return (
    <div className="space-y-2">
      {node.isUserNode ? (
        <div className="grid gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/20 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-250 bg-white text-amber-600">
              <User className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-black text-amber-900">{node.name}</p>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-amber-700">Questions submitted by you</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-200 bg-amber-100/50 px-2 py-0.5 text-[11px] font-black text-amber-800">
                  {availableCount} Qs
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_1fr] md:w-[22rem]">
            <div className="inline-flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                aria-label={`Decrease questions for ${node.name}`}
                disabled={disabled || selectedCount <= 1}
                onClick={() => setNodeCount(node.id, selectedCount - 5)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-10 text-center text-sm font-black text-slate-905">{selectedCount || "-"}</span>
              <button
                type="button"
                aria-label={`Increase questions for ${node.name}`}
                disabled={disabled || selectedCount >= Math.min(availableCount, 50)}
                onClick={() => setNodeCount(node.id, selectedCount + 5)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAddToTest(node)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-indigo-600 hover:text-indigo-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </button>
              <button
                type="button"
                disabled={disabled || isStarting}
                onClick={() => onStartTest(node)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                Start
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 transition md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              disabled={!hasChildren}
              aria-label={hasChildren ? `${isExpanded ? "Collapse" : "Expand"} ${node.name}` : undefined}
              onClick={() => hasChildren && toggleExpand(node.id)}
              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                hasChildren
                  ? "border-slate-200 bg-white text-slate-700 hover:border-indigo-500/50 hover:bg-indigo-50/20"
                  : "border-transparent bg-transparent text-transparent"
              }`}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-4 w-4 text-slate-600" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />
              ) : null}
            </button>

            {depth <= 2 && node.image_url && (
              <img alt="" className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover" src={resolveMediaUrl(node.image_url) ?? undefined} />
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-black text-slate-900">{node.name}</p>
                <span className="rounded-full border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  Level {depth + 1}
                </span>
              </div>
              {node.description && (
                <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{node.description}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${
                    availableCount > 0
                      ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                      : "border-rose-100 bg-rose-50 text-rose-700"
                  }`}
                >
                  {loadingCounts ? "Checking..." : `${availableCount} Quiz`}
                </span>
                {userQuestionCounts && (userQuestionCounts[node.id] ?? 0) > 0 && (
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
                    +{userQuestionCounts[node.id]} yours
                  </span>
                )}
                {availableCount > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500 mr-2">
                    Up to {Math.min(availableCount, 50)} can be selected
                  </span>
                )}
                {hasChildren && onDrillInto && (
                  <button
                    type="button"
                    onClick={() => onDrillInto(node)}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-650 hover:text-indigo-850 transition"
                  >
                    Browse sub-categories →
                  </button>
                )}
                {onAddQuestion && (
                  <div className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onAddQuestion(node)}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-650 hover:text-indigo-850 transition"
                    >
                      📝 Add Q
                    </button>
                    <Link
                      href={`/assessment/ai-parser?category_node_id=${node.id}&content_type=${activeTab}`}
                      className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-650 hover:text-indigo-850 transition"
                    >
                      🤖 Parse AI
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_1fr] md:w-[22rem]">
            <div className="inline-flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                aria-label={`Decrease questions for ${node.name}`}
                disabled={disabled || selectedCount <= 1}
                onClick={() => setNodeCount(node.id, selectedCount - 5)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-10 text-center text-sm font-black text-slate-905">{selectedCount || "-"}</span>
              <button
                type="button"
                aria-label={`Increase questions for ${node.name}`}
                disabled={disabled || selectedCount >= Math.min(availableCount, 50)}
                onClick={() => setNodeCount(node.id, selectedCount + 5)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAddToTest(node)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-indigo-600 hover:text-indigo-600 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </button>
              <button
                type="button"
                disabled={disabled || isStarting}
                onClick={() => onStartTest(node)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isStarting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {hasChildren && isExpanded && (
        <div className="ml-4 space-y-2 border-l border-slate-200 pl-3 md:ml-6 md:pl-4">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              getAvailableCount={getAvailableCount}
              getSelectedCount={getSelectedCount}
              setNodeCount={setNodeCount}
              loadingCounts={loadingCounts}
              startingNodeId={startingNodeId}
              onAddToTest={onAddToTest}
              onStartTest={onStartTest}
              activeTab={activeTab}
              onAddQuestion={onAddQuestion}
              userQuestionCounts={userQuestionCounts}
              onDrillInto={onDrillInto}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RevisionTreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  getBookmarkCount
}: {
  node: TreeNodeType;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  getBookmarkCount: (id: number) => number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const count = getBookmarkCount(node.id);

  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
          isSelected ? "bg-slate-900 text-white font-bold" : "text-slate-700 hover:bg-slate-200/50"
        }`}
        style={{ paddingLeft: `${depth * 10 + 10}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 rounded hover:bg-slate-300/30 text-slate-400"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {count > 0 && (
          <span className={`rounded-full px-1.5 py-0.2 text-[9px] ${
            isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
          }`}>
            {count}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <RevisionTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              getBookmarkCount={getBookmarkCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
