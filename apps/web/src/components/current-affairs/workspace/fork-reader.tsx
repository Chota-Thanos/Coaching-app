"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { StudentFork } from "../../../lib/api";
import { articleHref, contentKindLabel } from "../../../lib/current-affairs";
import { downloadScannedPdf } from "../../../lib/export-pdf";
import { authenticatedGet, useAuth } from "../../auth/auth-context";
import { ArticleAnnotator } from "./article-annotator";
import { SourceArticleConnections } from "./source-article-connections";
import { WorkspaceSignIn } from "./workspace-sign-in";

type ForkReaderProps = {
  forkId: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function ForkReader({ forkId }: ForkReaderProps) {
  const { token, user } = useAuth();
  const [fork, setFork] = useState<StudentFork | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const record = await authenticatedGet<StudentFork>(`/api/v1/current-affairs/me/forks/${forkId}`, token);
      setFork(record);
    } catch {
      setError("Could not load this saved article.");
    } finally {
      setLoading(false);
    }
  }, [forkId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) {
    return (
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <WorkspaceSignIn />
      </main>
    );
  }

  const article = fork?.master_article;
  const title = fork?.forked_title ?? article?.title ?? "Saved article";
  const body = fork?.forked_body ?? article?.body ?? "";

  async function downloadPdf(): Promise<void> {
    if (!fork) return;
    setDownloadingPdf(true);
    setDownloadError(null);
    try {
      const metaParts = [
        article?.content_kind ? contentKindLabel(article.content_kind) : null,
        article?.publication_date ? formatDate(article.publication_date) : null,
        article?.source_name ?? null
      ].filter(Boolean);
      await downloadScannedPdf(
        [{ title, meta: metaParts.join(" · "), tags: fork?.personal_tags ?? [], personalNote: fork?.personal_summary ?? undefined, bodyHtml: body }],
        title,
        user?.email ? `Personal copy - ${user.email}` : undefined
      );
    } catch {
      setDownloadError("Could not generate the PDF. Try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-5">
      <Link className="inline-flex items-center gap-2 text-sm font-bold text-civic" href="/current-affairs/workspace">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Notes Space
      </Link>

      {error && <p className="rounded-lg border border-berry/30 bg-berry/10 p-4 text-sm font-semibold text-berry">{error}</p>}
      {loading && !fork && <p className="rounded-lg border border-line bg-white p-5 text-sm font-semibold text-ink/70">Loading article...</p>}

      {fork && (
        <>
          <header className="border-b border-line pb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/45">
              {article?.content_kind ? contentKindLabel(article.content_kind) : "Saved article"}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-ink md:text-3xl">{title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink/60">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="h-4 w-4 text-civic" />
                {formatDate(article?.publication_date)}
              </span>
              {article?.slug && (
                <Link className="font-bold text-civic hover:underline" href={articleHref(article.slug)}>
                  View original article
                </Link>
              )}
              <button
                className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold text-ink disabled:opacity-60"
                disabled={downloadingPdf}
                onClick={downloadPdf}
                type="button"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {downloadingPdf ? "Preparing..." : "Download PDF"}
              </button>
            </div>
            {downloadError && <p className="mt-2 text-xs font-semibold text-berry">{downloadError}</p>}
          </header>

          <ArticleAnnotator
            body={body}
            className="article-body rounded-lg border border-line bg-white p-4 text-base text-ink shadow-sm md:p-6"
            forkId={fork.id}
            highlights={fork.highlights ?? []}
            notes={fork.notes ?? []}
            onChanged={load}
          />

          <SourceArticleConnections article={article} />
        </>
      )}
    </main>
  );
}
