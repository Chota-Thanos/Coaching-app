"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, Search, X, Layers, GripVertical, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { authenticatedGet, authenticatedPost, authenticatedPatch, authenticatedDelete, authenticatedPut } from "../auth/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaxonomyType = "objective" | "mains";

type HomeCollection = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  display_order: number;
  is_active: boolean;
  item_count?: number;
};

type ResolvedItem = {
  id: number;
  taxonomy_type: TaxonomyType;
  node_id: number;
  display_order: number;
  cover_image_url: string | null;
  name: string;
  node_type: string;
  exam_id: number;
  available_questions: number;
};

type PendingItem = {
  key: string;
  taxonomy_type: TaxonomyType;
  node_id: number;
  name: string;
  node_type: string;
  cover_image_url: string | null;
};

type TaxonomyNode = { id: number; exam_id: number; parent_id?: number | null; node_type: string; name: string };

const NODE_TYPES: Record<TaxonomyType, string[]> = {
  objective: ["subject", "source_bucket", "topic", "subtopic"],
  mains: ["paper", "subject_area", "theme", "topic", "subtopic"],
};

const TAXONOMY_LABELS: Record<TaxonomyType, string> = { objective: "GK / CSAT", mains: "Mains" };

function itemKey(taxonomy_type: TaxonomyType, node_id: number) {
  return `${taxonomy_type}:${node_id}`;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Item Manager (two-pane node picker) ───────────────────────────────────────

function ItemManager({ collection, token, onBack }: { collection: HomeCollection; token: string; onBack: () => void }) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxonomyTab, setTaxonomyTab] = useState<TaxonomyType>("objective");
  const [nodeType, setNodeType] = useState("");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<TaxonomyNode[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const data = await authenticatedGet<ResolvedItem[]>(
        `/api/v1/assessment/admin/home-collections/${collection.id}/items`, token
      );
      setItems((data ?? []).map((it) => ({
        key: itemKey(it.taxonomy_type, it.node_id),
        taxonomy_type: it.taxonomy_type,
        node_id: it.node_id,
        name: it.name,
        node_type: it.node_type,
        cover_image_url: it.cover_image_url,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      setLoadingItems(false);
    }
  }, [collection.id, token]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  // Debounced candidate search
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!search.trim() && !nodeType) { setCandidates([]); return; }
      setLoadingCandidates(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (search.trim()) params.set("search", search.trim());
        if (nodeType) params.set("node_type", nodeType);
        const path = taxonomyTab === "mains"
          ? `/api/v1/assessment/mains/taxonomy-nodes?${params}`
          : `/api/v1/assessment/taxonomy-nodes?${params}`;
        const data = await authenticatedGet<TaxonomyNode[]>(path, token);
        setCandidates(data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to search categories");
      } finally {
        setLoadingCandidates(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, nodeType, taxonomyTab, token]);

  // Reset filters when switching taxonomy tab
  useEffect(() => {
    setNodeType("");
    setSearch("");
    setCandidates([]);
  }, [taxonomyTab]);

  const selectedKeys = useMemo(() => new Set(items.map((it) => it.key)), [items]);

  function addNode(node: TaxonomyNode) {
    const key = itemKey(taxonomyTab, node.id);
    if (selectedKeys.has(key)) return;
    setItems((prev) => [...prev, {
      key, taxonomy_type: taxonomyTab, node_id: node.id, name: node.name, node_type: node.node_type, cover_image_url: null,
    }]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target] as PendingItem, next[index] as PendingItem];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await authenticatedPut(`/api/v1/assessment/admin/home-collections/${collection.id}/items`, token, {
        items: items.map((it) => ({
          taxonomy_type: it.taxonomy_type,
          node_id: it.node_id,
          cover_image_url: it.cover_image_url ?? undefined,
        })),
      });
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save items");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-paper transition shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All Collections
        </button>
        <h2 className="text-base font-bold text-ink truncate">{collection.title}</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 text-muted/50" /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        {/* ── Left: items in this collection, ordered ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              In this collection · {items.length}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || loadingItems}
              className="rounded-lg border border-midnight bg-midnight px-3 py-1.5 text-xs font-semibold text-white hover:bg-midnight/90 disabled:opacity-40 transition"
            >
              {saving ? "Saving…" : "Save Order"}
            </button>
          </div>

          {loadingItems ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted animate-pulse">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-8 text-center">
              <p className="text-xs text-muted">No items yet — add categories from the right →</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
              {items.map((it, i) => (
                <div key={it.key} className="group flex items-center gap-2 rounded-lg border border-line/50 bg-surface px-3 py-2.5">
                  <GripVertical className="h-3.5 w-3.5 text-muted/30 shrink-0" />
                  <span className="shrink-0 text-[10px] font-bold text-muted/40 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{it.name}</p>
                    <p className="text-[10px] text-muted/60">{TAXONOMY_LABELS[it.taxonomy_type]} · {it.node_type}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                      className="p-1 text-muted/40 hover:text-ink disabled:opacity-20 transition">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                      className="p-1 text-muted/40 hover:text-ink disabled:opacity-20 transition">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button onClick={() => removeItem(it.key)}
                      className="p-1 text-muted/40 hover:text-berry transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: taxonomy search ── */}
        <div className="space-y-3">
          <div className="flex gap-px rounded-lg border border-line bg-paper p-0.5">
            {(["objective", "mains"] as TaxonomyType[]).map((tab) => (
              <button key={tab} onClick={() => setTaxonomyTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                  taxonomyTab === tab ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {TAXONOMY_LABELS[tab]}
              </button>
            ))}
          </div>

          <select
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-muted focus:outline-none"
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
          >
            <option value="">Any level</option>
            {NODE_TYPES[taxonomyTab].map((nt) => (
              <option key={nt} value={nt}>{nt.replace(/_/g, " ")}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted/40 pointer-events-none" />
            <input
              className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-8 text-xs text-ink placeholder:text-muted/40 focus:border-muted focus:outline-none"
              placeholder="Search categories by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-muted/40 hover:text-muted" />
              </button>
            )}
          </div>

          {loadingCandidates ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted animate-pulse">Searching…</div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-line/50 bg-paper p-6 text-center text-xs text-muted">
              {search.trim() || nodeType ? "No matches" : "Search by name or filter by level to find categories"}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {candidates.map((node) => {
                const added = selectedKeys.has(itemKey(taxonomyTab, node.id));
                return (
                  <div key={node.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition ${added ? "border-line/50 bg-paper" : "border-line/50 bg-surface"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${added ? "text-muted/60" : "text-ink"}`}>{node.name}</p>
                      <p className="text-[10px] text-muted/60">{node.node_type.replace(/_/g, " ")}</p>
                    </div>
                    <button
                      onClick={() => !added && addNode(node)}
                      disabled={added}
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                        added ? "text-muted/50 cursor-default" : "border border-line bg-surface text-muted hover:border-muted hover:text-ink"
                      }`}
                    >
                      {added ? "Added" : <Plus className="h-3 w-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Manager ──────────────────────────────────────────────────────────────

export function AdminHomeCollectionsManager() {
  const { token } = useAuth();
  const [collections, setCollections] = useState<HomeCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [managingCollection, setManagingCollection] = useState<HomeCollection | null>(null);
  const [form, setForm] = useState({ title: "", subtitle: "", cover_image_url: "" });

  const loadCollections = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authenticatedGet<HomeCollection[]>("/api/v1/assessment/admin/home-collections", token);
      setCollections(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadCollections(); }, [loadCollections]);

  async function handleCreate() {
    if (!token || !form.title.trim()) return;
    setSaving(true);
    try {
      const slug = `${slugify(form.title)}-${Date.now()}`;
      const created = await authenticatedPost<HomeCollection>("/api/v1/assessment/admin/home-collections", token, {
        slug,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        cover_image_url: form.cover_image_url.trim() || undefined,
        display_order: collections.length,
        is_active: true,
      });
      setShowCreate(false);
      setForm({ title: "", subtitle: "", cover_image_url: "" });
      await loadCollections();
      if (created) setManagingCollection(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: HomeCollection) {
    if (!token) return;
    try {
      await authenticatedPatch(`/api/v1/assessment/admin/home-collections/${c.id}`, token, { is_active: !c.is_active });
      await loadCollections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Delete this collection permanently? Its items will also be removed.")) return;
    try {
      await authenticatedDelete(`/api/v1/assessment/admin/home-collections/${id}`, token);
      await loadCollections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  if (managingCollection && token) {
    return (
      <ItemManager
        collection={managingCollection}
        token={token}
        onBack={async () => { await loadCollections(); setManagingCollection(null); }}
      />
    );
  }

  if (loading) return <div className="p-12 text-center text-xs text-muted">Loading…</div>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-muted">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-muted/50 hover:text-muted"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">Home Collections</h2>
          <p className="text-xs text-muted mt-0.5">
            Curated category lists shown on the student Home screen, e.g. &ldquo;PYQs across all subjects&rdquo;.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-midnight bg-midnight px-3 py-2 text-xs font-semibold text-white hover:bg-midnight/90 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> New Collection
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wide">New Collection</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Title *</label>
              <input
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/40 focus:bg-surface focus:border-muted focus:outline-none"
                placeholder="e.g. Previous Year Questions"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Subtitle</label>
              <input
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/40 focus:bg-surface focus:border-muted focus:outline-none"
                placeholder="Short description (optional)"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Cover image URL</label>
              <input
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted/40 focus:bg-surface focus:border-muted focus:outline-none"
                placeholder="Optional — falls back to per-item covers"
                value={form.cover_image_url}
                onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
              className="rounded-lg border border-midnight bg-midnight px-4 py-2 text-xs font-semibold text-white hover:bg-midnight/90 disabled:opacity-40 transition"
            >
              {saving ? "Creating…" : "Create & Add Items →"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:bg-paper transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-14 text-center">
          <ImageIcon className="h-8 w-8 text-line mb-3" />
          <p className="text-xs font-semibold text-muted">No collections yet</p>
          <p className="text-[11px] text-muted/60 mt-1">Create one above to feature curated categories on the Home screen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-surface px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-line"}`} />
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[11px] text-muted/40">#{c.id}</span>
                    <span className="text-[11px] text-muted">{c.item_count ?? 0} items</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-ink">{c.title}</h3>
                  {c.subtitle && <p className="text-[11px] text-muted mt-0.5">{c.subtitle}</p>}
                  {(c.item_count ?? 0) === 0 && (
                    <p className="mt-1.5 text-[11px] text-saffron">No items added yet — click Manage before activating.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => setManagingCollection(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-muted hover:text-ink transition"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Manage
                    <ChevronRight className="h-3 w-3 text-muted/40" />
                  </button>
                  <button onClick={() => void toggleActive(c)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      c.is_active ? "border-line bg-surface text-muted hover:bg-paper" : "border-midnight bg-midnight text-white hover:bg-midnight/90"
                    }`}
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => void handleDelete(c.id)}
                    className="rounded-lg border border-line/50 bg-surface p-1.5 text-muted/40 hover:text-berry hover:border-berry/30 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
