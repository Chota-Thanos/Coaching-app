export type ContentKind =
  | "daily_current_affairs"
  | "prelims_pyq"
  | "daily_editorial_summary"
  | "mains_topic_note"
  | "mains_pyq";

export type ContentFamily = "prelims" | "mains";

export type CurrentAffairsHub = {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  contentKind: ContentKind;
  contentFamily: ContentFamily;
  filterMode: "month" | "year";
};

export const CURRENT_AFFAIRS_HUBS: CurrentAffairsHub[] = [
  {
    path: "daily-news",
    label: "Prelims Current Affairs",
    shortLabel: "Daily News",
    description: "Daily current affairs updates for prelims revision, organized by month and category.",
    contentKind: "daily_current_affairs",
    contentFamily: "prelims",
    filterMode: "month"
  },
  {
    path: "editorial-summary",
    label: "Editorial Summary",
    shortLabel: "Editorials",
    description: "Exam-focused editorial summaries for mains answer enrichment and issue tracking.",
    contentKind: "daily_editorial_summary",
    contentFamily: "mains",
    filterMode: "month"
  },
  {
    path: "mains-topic-notes",
    label: "Mains Topic Notes",
    shortLabel: "Mains Notes",
    description: "Structured topic notes for mains themes, arguments, data points, and examples.",
    contentKind: "mains_topic_note",
    contentFamily: "mains",
    filterMode: "month"
  },
  {
    path: "prelims-pyq",
    label: "Prelims PYQ",
    shortLabel: "Prelims PYQ",
    description: "Previous year prelims questions linked with current affairs categories.",
    contentKind: "prelims_pyq",
    contentFamily: "prelims",
    filterMode: "year"
  },
  {
    path: "mains-pyq",
    label: "Mains PYQ",
    shortLabel: "Mains PYQ",
    description: "Previous year mains questions organized by syllabus and current affairs category.",
    contentKind: "mains_pyq",
    contentFamily: "mains",
    filterMode: "year"
  }
];

export function getHub(path: string): CurrentAffairsHub | undefined {
  return CURRENT_AFFAIRS_HUBS.find((hub) => hub.path === path);
}

export function articleHref(slug: string): string {
  return `/current-affairs/articles/${slug}`;
}

export function hubHref(hub: CurrentAffairsHub, params: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return `/current-affairs/${hub.path}${query ? `?${query}` : ""}`;
}

export function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date);
}

export function contentKindLabel(kind: string): string {
  const hub = CURRENT_AFFAIRS_HUBS.find((item) => item.contentKind === kind);
  return hub?.shortLabel ?? kind.replace(/_/g, " ");
}

export function normalizePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
