"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Tag, X } from "lucide-react";

const ERROR_TAGS = ["Silly Mistake", "Conceptual Error", "Lack of Time", "Tricky Question"] as const;
type ErrorTag = (typeof ERROR_TAGS)[number];

type TagState = {
  tag: ErrorTag | null;
  bookmarked: boolean;
};

const STORAGE_KEY = "ca_question_tags";

function loadAll(): Record<string, TagState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TagState>) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, TagState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function ErrorTagger({ questionId }: { questionId: number }) {
  const key = String(questionId);
  const [state, setState] = useState<TagState>({ tag: null, bookmarked: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const all = loadAll();
    setState(all[key] ?? { tag: null, bookmarked: false });
    setMounted(true);
  }, [key]);

  function update(next: Partial<TagState>) {
    const updated = { ...state, ...next };
    setState(updated);
    const all = loadAll();
    all[key] = updated;
    saveAll(all);
  }

  if (!mounted) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/50 pt-3">
      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted">
        <Tag className="h-3 w-3" aria-hidden="true" />
        Tag error:
      </span>

      {ERROR_TAGS.map((tag) => (
        <button
          key={tag}
          onClick={() => update({ tag: state.tag === tag ? null : tag })}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition-all ${
            state.tag === tag
              ? "bg-amber-600 border-amber-600 text-white"
              : "bg-slate-50 border-slate-200/60 text-slate-650 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-250"
          }`}
        >
          {tag}
          {state.tag === tag && (
            <X className="ml-1 inline h-3 w-3" aria-hidden="true" />
          )}
        </button>
      ))}

      {/* Bookmark */}
      <button
        onClick={() => update({ bookmarked: !state.bookmarked })}
        className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition-all ${
          state.bookmarked
            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
            : "bg-slate-50 border-slate-200/60 text-slate-650 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-250"
        }`}
        title={state.bookmarked ? "Remove bookmark" : "Bookmark for revision"}
      >
        {state.bookmarked ? (
          <BookmarkCheck className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Bookmark className="h-3 w-3" aria-hidden="true" />
        )}
        {state.bookmarked ? "Bookmarked" : "Bookmark"}
      </button>
    </div>
  );
}
