"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import { SignInPanel } from "../../auth/sign-in-panel";

/**
 * Every highlight and margin note the learner has made, across every article.
 *
 * Until now both tables were reachable only through a single fork's detail
 * response, so reviewing a term of highlighting meant reopening each article
 * one at a time — the opposite of what highlighting is for. Reads the new
 * GET /me/annotations.
 *
 * Markup and class names come from the approved design mockup; styles live in
 * app/current-affairs/workspace/notes-design.css, ported mechanically from it.
 */

type Annotation = {
  id: number;
  kind: "highlight" | "note";
  fork_id: number;
  master_article_id: number;
  article_title: string;
  color: string | null;
  quote: string | null;
  note: string | null;
  personal_tags: string[];
  collection_id: number | null;
  collection_name: string | null;
  created_at: string;
};

type Facets = {
  by_color: { color: string; count: number }[];
  totals: { highlights: number; notes: number };
};

type Collection = { id: number; name: string };

/** The annotator's four colours, mapped onto the design's highlight tokens. */
const COLOR_TOKEN: Record<string, { bar: string; chip: string; label: string }> = {
  yellow: { bar: "#e5c53f", chip: "var(--nt-hl-yellow)", label: "Yellow" },
  green: { bar: "#43b98a", chip: "var(--nt-hl-green)", label: "Green" },
  blue: { bar: "#3f86e5", chip: "var(--nt-hl-blue)", label: "Blue" },
  pink: { bar: "#e0619a", chip: "var(--nt-hl-pink)", label: "Pink" }
};

function barFor(color: string | null): string {
  return COLOR_TOKEN[color ?? ""]?.bar ?? "var(--nt-accent)";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HighlightsReview() {
  const { token, isInitialized } = useAuth();
  const [rows, setRows] = useState<Annotation[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Opened from inside a folder, this arrives as ?collection_id= so the view
     starts scoped to that folder rather than to everything the learner has ever
     highlighted.
     Read after mount rather than in the initial state: reading it during render
     gave the server (no URL) and the client (a URL) different first renders,
     which React reports as a hydration mismatch and, in its words, "won't be
     patched up" -- the filter chip kept the server's markup while the state
     said otherwise. `useSearchParams` would be the tidier route but needs a
     Suspense boundary this page does not have, and adding one has broken the
     production build on two other pages in this app. */
  const [collectionId, setCollectionId] = useState<number | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("collection_id");
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) setCollectionId(parsed);
  }, []);
  const [color, setColor] = useState<string | null>(null);
  const [withNote, setWithNote] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (collectionId) params.set("collection_id", String(collectionId));
      if (color) params.set("color", color);
      if (withNote) params.set("with_note", "true");
      if (search.trim()) params.set("search", search.trim());

      const [list, facetData, cols] = await Promise.all([
        authenticatedGet<Annotation[]>(`/api/v1/current-affairs/me/annotations?${params}`, token),
        authenticatedGet<Facets>("/api/v1/current-affairs/me/annotation-facets", token),
        authenticatedGet<Collection[]>("/api/v1/current-affairs/me/collections", token).catch(() => [])
      ]);
      setRows(list ?? []);
      setFacets(facetData ?? null);
      setCollections(cols ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load your highlights.");
    } finally {
      setLoading(false);
    }
  }, [token, collectionId, color, withNote, search]);

  useEffect(() => {
    if (!isInitialized) return;
    void load();
  }, [isInitialized, load]);

  const totals = facets?.totals ?? { highlights: 0, notes: 0 };
  const activeCollection = useMemo(
    () => collections.find((c) => c.id === collectionId) ?? null,
    [collections, collectionId]
  );

  if (isInitialized && !token) {
    return (
      <div className="nt-root" style={{ background: "var(--nt-bg)", minHeight: "100vh" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", fontFamily: "var(--nt-body)" }}>
          <div className="nt-c" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 22, margin: 0 }}>🔖</p>
            <h2 style={{ fontSize: 20, marginTop: 8 }}>Your highlights live here</h2>
            <p style={{ margin: "6px 0 18px", fontSize: 13.5, color: "var(--nt-ink-soft)" }}>
              Sign in to review every highlight and margin note you have made, in one place.
            </p>
            <div style={{ textAlign: "left" }}>
              <SignInPanel />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="nt-root" style={{ background: "var(--nt-bg)", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 20px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontFamily: "var(--nt-body)",
          color: "var(--nt-ink)"
        }}
      >
        <Link
          href="/current-affairs/workspace"
          style={{
            fontFamily: "var(--nt-mono)",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--nt-ink-faint)",
            textDecoration: "none"
          }}
        >
          ← Notes
        </Link>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className="nt-eyebrow" style={{ fontFamily: "var(--nt-mono)", fontSize: 11, letterSpacing: ".13em", textTransform: "uppercase", color: "var(--nt-ink-faint)", margin: 0 }}>
              Review
            </p>
            <h2 style={{ fontSize: 23, marginTop: 3 }}>
              {totals.highlights} highlights, {totals.notes} notes
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--nt-ink-soft)" }}>
              {activeCollection ? `Filtered to ${activeCollection.name}` : "Across every article you have saved"}
            </p>
          </div>
        </div>

        <div className="nt-c">
          <div style={{ display: "flex", gap: 7, padding: "11px 14px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search your highlights and notes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{
                flex: 1,
                minWidth: 200,
                height: 34,
                borderRadius: 8,
                border: "1px solid var(--nt-line)",
                background: "var(--nt-panel-2)",
                padding: "0 11px",
                font: "inherit",
                fontSize: 12.5,
                color: "var(--nt-ink)"
              }}
            />
            <button
              type="button"
              className="nt-pill"
              style={collectionId === null ? { background: "var(--nt-accent-soft)", color: "var(--nt-accent-ink)", borderColor: "var(--nt-accent-line)" } : undefined}
              onClick={() => setCollectionId(null)}
            >
              All repositories
            </button>
            {collections.slice(0, 5).map((collection) => (
              <button
                type="button"
                key={collection.id}
                className="nt-pill"
                style={collectionId === collection.id ? { background: "var(--nt-accent-soft)", color: "var(--nt-accent-ink)", borderColor: "var(--nt-accent-line)" } : undefined}
                onClick={() => setCollectionId(collection.id)}
              >
                {collection.name}
              </button>
            ))}

            <span style={{ width: 8 }} />
            {(facets?.by_color ?? []).map((entry) => {
              const token = COLOR_TOKEN[entry.color] ?? null;
              const on = color === entry.color;
              return (
                <button
                  type="button"
                  key={entry.color}
                  className="nt-pill"
                  style={{
                    background: token?.chip ?? "var(--nt-panel-2)",
                    borderColor: on ? "var(--nt-accent)" : "var(--nt-line)",
                    color: "var(--nt-ink)",
                    boxShadow: on ? "0 0 0 2px var(--nt-accent-soft)" : undefined
                  }}
                  onClick={() => setColor(on ? null : entry.color)}
                >
                  {token?.label ?? entry.color} {entry.count}
                </button>
              );
            })}

            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="nt-pill"
              style={withNote ? { background: "var(--nt-accent-soft)", color: "var(--nt-accent-ink)", borderColor: "var(--nt-accent-line)" } : undefined}
              onClick={() => setWithNote((value) => !value)}
            >
              With my note only
            </button>
          </div>

          {error && (
            <p style={{ margin: 0, padding: "12px 16px", fontSize: 13, color: "var(--nt-bad)", fontWeight: 650 }}>{error}</p>
          )}

          {loading && rows.length === 0 ? (
            <p style={{ margin: 0, padding: "26px 16px", textAlign: "center", fontSize: 13, color: "var(--nt-ink-soft)" }}>
              Loading your highlights…
            </p>
          ) : rows.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--nt-ink-soft)" }}>
                {totals.highlights + totals.notes === 0
                  ? "You have not highlighted anything yet. Open a saved article and select some text to start."
                  : "Nothing matches these filters."}
              </p>
            </div>
          ) : (
            rows.map((row) => (
              <div className="nt-hl" key={`${row.kind}-${row.id}`}>
                <span className="nt-bar" style={{ background: barFor(row.color) }} />
                <div>
                  {row.quote ? (
                    <blockquote>“{row.quote}”</blockquote>
                  ) : (
                    <blockquote style={{ color: "var(--nt-ink-faint)" }}>(no quoted text)</blockquote>
                  )}
                  <p className="nt-src">
                    {row.article_title}
                    {row.collection_name ? ` · ${row.collection_name}` : ""} · {row.kind === "note" ? "note" : "highlighted"}{" "}
                    {formatDate(row.created_at)}
                  </p>
                  {row.note && <div className="nt-mynote">My note: {row.note}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {row.personal_tags.slice(0, 2).map((tag) => (
                    <span className="nt-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                  <Link className="nt-btn nt-btn--sm" href={`/current-affairs/workspace/articles/${row.fork_id}`}>
                    Open article
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
