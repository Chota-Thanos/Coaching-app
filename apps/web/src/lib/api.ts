import type {
  ArticleAssetType,
  IngestionItemStatus,
  IngestionJobStatus,
  IngestionParserKind,
  IngestionSourceKind,
  MasterArticleStatus
} from "./admin-current-affairs";
import type { ContentFamily, ContentKind } from "./current-affairs";

const serverBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
export const browserBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? serverBaseUrl;

export function resolveMediaUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${browserBaseUrl}${value}`;
  return value;
}

type RequestOptions = {
  token?: string;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {
    accept: "application/json"
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers,
    cache: options.cache ?? "no-store",
    next: options.next
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export type CategoryNode = {
  id: number;
  content_family: ContentFamily;
  parent_id: number | null;
  node_type: string;
  name: string;
  slug: string;
  description: string | null;
  article_count?: number;
  display_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ArticleAsset = {
  id: number;
  article_id: number;
  asset_type: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes?: number | string | null;
  alt_text: string | null;
  caption: string | null;
  metadata?: Record<string, unknown>;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ArticleSection = {
  id: number;
  heading: string;
  slug: string;
  body: string;
  seo_title?: string | null;
  seo_description: string | null;
  display_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ArticleRole = "event" | "concept";

export type ArticleUpdateEntry = {
  id: number;
  article_id: number;
  body: string;
  created_by_user_id: number | null;
  created_at: string;
};

export type ArticleSummary = {
  id: number;
  content_family: ContentFamily;
  content_kind: ContentKind;
  article_role: ArticleRole;
  title: string;
  slug: string;
  body: string;
  body_json?: any;
  category: CategoryNode | null;
  source_name: string | null;
  source_url: string | null;
  publication_date: string | null;
  institute_tags: string[];
  primary_asset: ArticleAsset | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  keywords?: string[] | null;
};

export type AdminArticleSummary = Omit<ArticleSummary, "primary_asset"> & {
  status: MasterArticleStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  is_ai_generated: boolean;
};

export type AdminArticleDetail = AdminArticleSummary & {
  assets: ArticleAsset[];
  sections: ArticleSection[];
  outgoing_relations: Array<{
    id: number;
    relation_type: string;
    label: string | null;
    note?: string | null;
    display_order?: number;
    target_article: AdminArticleSummary;
  }>;
  incoming_relations: Array<{
    id: number;
    relation_type: string;
    label: string | null;
    note?: string | null;
    display_order?: number;
    source_article: AdminArticleSummary;
  }>;
  appearance_count: number;
  updates: ArticleUpdateEntry[];
};

export type ArticleDetail = ArticleSummary & {
  assets: ArticleAsset[];
  sections: ArticleSection[];
  outgoing_relations: Array<{
    id: number;
    relation_type: string;
    label: string | null;
    target_article: ArticleSummary;
  }>;
  incoming_relations: Array<{
    id: number;
    relation_type: string;
    label: string | null;
    source_article: ArticleSummary;
  }>;
  appearance_count: number;
  updates: ArticleUpdateEntry[];
};

export type ArticleListResponse = {
  items: ArticleSummary[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type ArticleFiltersResponse = {
  categories: CategoryNode[];
  months: Array<{ month: string }>;
  years: Array<{ year: string }>;
};

export type ArticleListParams = {
  contentKind: ContentKind;
  articleRole?: ArticleRole;
  category?: string;
  month?: string;
  year?: string;
  page: number;
  limit?: number;
};

export function getArticles(params: ArticleListParams): Promise<ArticleListResponse> {
  const search = new URLSearchParams({
    content_kind: params.contentKind,
    page: String(params.page),
    limit: String(params.limit ?? 12)
  });
  if (params.articleRole) search.set("article_role", params.articleRole);
  if (params.category) search.set("category", params.category);
  if (params.month) search.set("month", params.month);
  if (params.year) search.set("year", params.year);
  return apiFetch<ArticleListResponse>(`/api/v1/current-affairs/frontend/articles?${search}`);
}

export function getArticleFilters(contentKind: ContentKind, contentFamily: ContentFamily): Promise<ArticleFiltersResponse> {
  const search = new URLSearchParams({ content_kind: contentKind, content_family: contentFamily });
  return apiFetch<ArticleFiltersResponse>(`/api/v1/current-affairs/frontend/filters?${search}`);
}

export function getArticleBySlug(slug: string): Promise<ArticleDetail> {
  return apiFetch<ArticleDetail>(`/api/v1/current-affairs/articles/slug/${slug}`);
}

export type StudentFork = {
  id: number;
  master_article_id: number;
  personal_tags?: string[];
  personal_summary?: string | null;
  forked_title?: string | null;
  forked_body?: string | null;
  forked_body_json?: Record<string, unknown>;
  custom_folder?: string | null;
  read_status: "unread" | "read" | "needs_revision";
  scheduled_revision_at: string | null;
  collection_ids?: number[];
  collection_names?: string[];
  created_at?: string;
  updated_at?: string;
  master_article?: StudentMasterArticle;
  reading_progress?: {
    progress_percent: number | string;
    completed_at: string | null;
    furthest_progress_percent?: number | string;
    reading_seconds?: number | string;
    last_read_at?: string | null;
  } | null;
};

export type StudentMasterArticle = {
  id: number;
  content_kind: ContentKind;
  title: string;
  slug: string;
  body: string;
  category_node_id?: number | null;
  category?: CategoryNode | null;
  source_name: string | null;
  source_url: string | null;
  publication_date: string | null;
  institute_tags: string[];
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type StudentArticle = {
  id: number;
  title: string;
  slug: string;
  body: string;
  category_node_id: number | null;
  source_url: string | null;
  personal_tags: string[];
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

export type StudentCollection = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  custom_tags?: string[];
  item_count?: number;
  created_at: string;
  updated_at: string;
};

export type StudentCollectionItem = {
  id: number;
  fork_id: number | null;
  student_article_id: number | null;
  display_order: number;
  created_at: string;
  fork: StudentFork | null;
  master_article: StudentMasterArticle | null;
  student_article: StudentArticle | null;
};

export type StudentCollectionDetail = StudentCollection & {
  items: StudentCollectionItem[];
};

export type ReadingDashboard = {
  stats: {
    saved_articles: number;
    completed_articles: number;
    due_revisions: number;
    reading_seconds_7d: number;
  };
  continue_reading: StudentFork[];
  due_revisions: StudentFork[];
  latest_unread: StudentFork[];
  recommended_articles: StudentMasterArticle[];
};

export type IngestionItem = {
  id: number;
  job_id: number;
  status: IngestionItemStatus;
  raw_payload: Record<string, unknown>;
  normalized_article: Partial<AdminArticleSummary> & {
    content_kind?: ContentKind;
    title?: string;
    slug?: string;
    body?: string;
    category_node_id?: number | null;
    source_name?: string | null;
    source_url?: string | null;
    publication_date?: string | null;
    institute_tags?: string[];
    status?: MasterArticleStatus;
  };
  validation_errors: unknown[];
  published_article_id: number | null;
  created_at: string;
  updated_at: string;
};

export type IngestionJob = {
  id: number;
  source_kind: IngestionSourceKind;
  parser_kind: IngestionParserKind;
  source_name: string | null;
  source_url: string | null;
  source_filename: string | null;
  source_file_url: string | null;
  raw_text: string | null;
  raw_payload: Record<string, unknown>;
  status: IngestionJobStatus;
  item_count?: number;
  approved_count?: number;
  published_count?: number;
  created_at: string;
  updated_at: string;
};

export type IngestionJobDetail = IngestionJob & {
  items: IngestionItem[];
};

export type CreateAdminArticlePayload = {
  content_kind: ContentKind;
  article_role?: ArticleRole;
  title: string;
  slug: string;
  body: string;
  category_node_id?: number;
  source_name?: string;
  source_url?: string;
  publication_date?: string;
  institute_tags?: string[];
  status?: MasterArticleStatus;
  is_ai_generated?: boolean;
  seo_title?: string;
  seo_description?: string;
  canonical_url?: string;
  keywords?: string[];
};

export type CreateCategoryPayload = {
  content_family: ContentFamily;
  parent_id?: number | null;
  node_type: string;
  name: string;
  slug: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
};

export type CreateArticleAssetPayload = {
  asset_type: ArticleAssetType;
  file_name: string;
  file_url: string;
  mime_type?: string;
  alt_text?: string;
  caption?: string;
  display_order?: number;
};
