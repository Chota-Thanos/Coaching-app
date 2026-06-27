"use client";

import { CheckCircle2, FileStack, RefreshCw, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CategoryNode, IngestionItem, IngestionJob, IngestionJobDetail } from "../../../lib/api";
import type { ContentKind } from "../../../lib/current-affairs";
import {
  ADMIN_ARTICLE_STATUSES,
  ADMIN_CONTENT_KINDS,
  INGESTION_PARSER_KINDS,
  contentFamilyForKind,
  splitAdminTags,
  statusLabel,
  type IngestionItemStatus,
  type IngestionParserKind,
  type MasterArticleStatus
} from "../../../lib/admin-current-affairs";
import {
  authenticatedGet,
  authenticatedPatch,
  authenticatedPost,
  useAuth
} from "../../auth/auth-context";

type IngestionFormState = {
  parserKind: IngestionParserKind;
  sourceName: string;
  sourceUrl: string;
  contentKind: ContentKind;
  categoryNodeId: string;
  publicationDate: string;
  status: MasterArticleStatus;
  tags: string;
  rawText: string;
};

const initialForm: IngestionFormState = {
  parserKind: "structured_current_affairs",
  sourceName: "",
  sourceUrl: "",
  contentKind: "daily_current_affairs",
  categoryNodeId: "",
  publicationDate: new Date().toISOString().slice(0, 10),
  status: "draft",
  tags: "",
  rawText: ""
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function itemTitle(item: IngestionItem): string {
  return item.normalized_article?.title ?? `Ingestion item #${item.id}`;
}

export function AdminIngestionManager() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedJob, setSelectedJob] = useState<IngestionJobDetail | null>(null);
  const [form, setForm] = useState<IngestionFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const family = contentFamilyForKind(form.contentKind);
    return categories.filter((category) => category.content_family === family && category.is_active !== false);
  }, [categories, form.contentKind]);

  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const records = await authenticatedGet<IngestionJob[]>("/api/v1/current-affairs/admin/ingestion-jobs?limit=50", token);
      setJobs(records);
    } catch {
      setMessage("Could not load ingestion jobs.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    const records = await authenticatedGet<CategoryNode[]>("/api/v1/current-affairs/categories?limit=200", token);
    setCategories(records);
  }, [token]);

  const loadJobDetail = useCallback(async (jobId: number) => {
    if (!token) return;
    const detail = await authenticatedGet<IngestionJobDetail>(`/api/v1/current-affairs/admin/ingestion-jobs/${jobId}`, token);
    setSelectedJob(detail);
  }, [token]);

  useEffect(() => {
    void loadJobs();
    void loadCategories();
  }, [loadCategories, loadJobs]);

  function update<K extends keyof IngestionFormState>(key: K, value: IngestionFormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createJob(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setMessage(null);
    try {
      const job = await authenticatedPost<IngestionJobDetail>("/api/v1/current-affairs/admin/ingestion-jobs", token, {
        source_kind: "manual_text",
        parser_kind: form.parserKind,
        source_name: form.sourceName || undefined,
        source_url: form.sourceUrl || undefined,
        raw_text: form.rawText,
        default_content_kind: form.contentKind,
        default_category_node_id: form.categoryNodeId ? Number(form.categoryNodeId) : undefined,
        default_publication_date: form.publicationDate || undefined,
        default_status: form.status,
        default_tags: splitAdminTags(form.tags)
      });
      setSelectedJob(job);
      setForm(initialForm);
      await loadJobs();
      setMessage("Ingestion job created.");
    } catch {
      setMessage("Could not create ingestion job. Check source URL and required text.");
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(itemId: number, status: IngestionItemStatus): Promise<void> {
    if (!token || !selectedJob) return;
    await authenticatedPatch<IngestionItem>(`/api/v1/current-affairs/admin/ingestion-items/${itemId}`, token, { status });
    await loadJobDetail(selectedJob.id);
    await loadJobs();
  }

  async function publishItem(itemId: number): Promise<void> {
    if (!token || !selectedJob) return;
    try {
      await authenticatedPost<IngestionItem>(`/api/v1/current-affairs/admin/ingestion-items/${itemId}/publish`, token, {});
      await loadJobDetail(selectedJob.id);
      await loadJobs();
      setMessage("Ingestion item published.");
    } catch {
      setMessage("Could not publish item. Approve it first and confirm normalized article fields are valid.");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-ink">Ingestion jobs</h2>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink disabled:opacity-60"
              disabled={loading}
              onClick={loadJobs}
              type="button"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {message && <p className="rounded-lg border border-line bg-white p-3 text-sm font-semibold text-civic">{message}</p>}

          <div className="grid gap-3">
            {jobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">No ingestion jobs found.</p>
            ) : (
              jobs.map((job) => (
                <article
                  className={`rounded-lg border bg-white p-4 shadow-sm ${selectedJob?.id === job.id ? "border-civic" : "border-line"}`}
                  key={job.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-civic/10 px-2 py-1 text-xs font-bold text-civic">{job.status}</span>
                        <span className="rounded-md bg-paper px-2 py-1 text-xs font-bold text-ink/65">{job.parser_kind.replace(/_/g, " ")}</span>
                      </div>
                      <h3 className="text-base font-extrabold leading-snug text-ink">{job.source_name ?? `Job #${job.id}`}</h3>
                      <p className="mt-2 text-sm text-ink/65">
                        {job.item_count ?? 0} items - Created {formatDate(job.created_at)}
                      </p>
                    </div>
                    <button
                      className="h-10 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-civic"
                      onClick={() => void loadJobDetail(job.id)}
                      type="button"
                    >
                      Review
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileStack aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">Review items</h2>
          </div>

          {!selectedJob ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">Select a job to review items.</p>
          ) : selectedJob.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-white p-5 text-sm text-ink/65">No items in this job.</p>
          ) : (
            <div className="grid gap-3">
              {selectedJob.items.map((item) => (
                <article className="rounded-lg border border-line bg-white p-4 shadow-sm" key={item.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-civic/10 px-2 py-1 text-xs font-bold text-civic">{item.status}</span>
                        {item.normalized_article?.content_kind && (
                          <span className="rounded-md bg-paper px-2 py-1 text-xs font-bold text-ink/65">
                            {item.normalized_article.content_kind.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold leading-snug text-ink">{itemTitle(item)}</h3>
                      <p className="mt-2 text-sm text-ink/65">
                        {item.normalized_article?.publication_date ?? "Undated"} - {item.normalized_article?.slug ?? "No slug"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-civic"
                        onClick={() => void patchItem(item.id, "approved")}
                        type="button"
                      >
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink hover:border-berry hover:text-berry"
                        onClick={() => void patchItem(item.id, "rejected")}
                        type="button"
                      >
                        <XCircle aria-hidden="true" className="h-4 w-4" />
                        Reject
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"
                        disabled={item.status !== "approved"}
                        onClick={() => void publishItem(item.id)}
                        type="button"
                      >
                        <Send aria-hidden="true" className="h-4 w-4" />
                        Publish
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <form className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-sm" onSubmit={createJob}>
          <div className="flex items-center gap-2">
            <FileStack aria-hidden="true" className="h-5 w-5 text-civic" />
            <h2 className="text-lg font-black text-ink">Create ingestion job</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Parser
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => update("parserKind", event.target.value as IngestionParserKind)}
                value={form.parserKind}
              >
                {INGESTION_PARSER_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-bold text-ink">
              Default kind
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => update("contentKind", event.target.value as ContentKind)}
                value={form.contentKind}
              >
                {ADMIN_CONTENT_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Default category
            <select
              className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
              onChange={(event) => update("categoryNodeId", event.target.value)}
              value={form.categoryNodeId}
            >
              <option value="">Undefined category</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Default date
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal"
                onChange={(event) => update("publicationDate", event.target.value)}
                type="date"
                value={form.publicationDate}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-ink">
              Default status
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-base font-normal"
                onChange={(event) => update("status", event.target.value as MasterArticleStatus)}
                value={form.status}
              >
                {ADMIN_ARTICLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Source name
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => update("sourceName", event.target.value)}
              value={form.sourceName}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Source URL
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => update("sourceUrl", event.target.value)}
              type="url"
              value={form.sourceUrl}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Default tags
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => update("tags", event.target.value)}
              value={form.tags}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold text-ink">
            Raw text
            <textarea
              className="min-h-52 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
              onChange={(event) => update("rawText", event.target.value)}
              required
              value={form.rawText}
            />
          </label>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            <FileStack aria-hidden="true" className="h-4 w-4" />
            {saving ? "Creating..." : "Create job"}
          </button>
        </form>
      </aside>
    </section>
  );
}
