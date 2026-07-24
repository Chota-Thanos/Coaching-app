"use client";

import { FilePlus2, Save, Tags, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { StudentArticle, StudentCollection } from "../../../lib/api";
import { createUniqueWorkspaceSlug, joinWorkspaceTags, splitWorkspaceTags } from "../../../lib/workspace";
import { authenticatedPatch, authenticatedPost, useAuth } from "../../auth/auth-context";

type RepositoryOwnArticleModalProps = {
  repository: StudentCollection;
  article?: StudentArticle | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export function RepositoryOwnArticleModal({
  repository,
  article,
  open,
  onClose,
  onSaved
}: RepositoryOwnArticleModalProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isEditing = Boolean(article);
  const selectedTags = useMemo(() => splitWorkspaceTags(tagDraft), [tagDraft]);

  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? "");
    setBody(article?.body ?? "");
    setSourceUrl(article?.source_url ?? "");
    setTagDraft(joinWorkspaceTags(article?.personal_tags));
    setMessage(null);
  }, [article, open]);

  if (!open) return null;

  function toggleTag(tag: string): void {
    const current = splitWorkspaceTags(tagDraft);
    const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    setTagDraft(joinWorkspaceTags(next));
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setMessage("Add a title and article body before saving.");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      if (article) {
        await authenticatedPatch<StudentArticle>(`/api/v1/current-affairs/me/articles/${article.id}`, token, {
          title: cleanTitle,
          body: cleanBody,
          source_url: sourceUrl.trim() || null,
          personal_tags: selectedTags,
          status: "published"
        });
      } else {
        const createdArticle = await authenticatedPost<StudentArticle>("/api/v1/current-affairs/me/articles", token, {
          title: cleanTitle,
          slug: createUniqueWorkspaceSlug(cleanTitle),
          body: cleanBody,
          source_url: sourceUrl.trim() || undefined,
          personal_tags: selectedTags,
          status: "published"
        });

        await authenticatedPost(`/api/v1/current-affairs/me/collections/${repository.id}/items`, token, {
          student_article_id: createdArticle.id
        });
      }

      await onSaved();
      onClose();
    } catch {
      setMessage("Could not save this article. Check the source URL and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/55 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-civic">
              <FilePlus2 aria-hidden="true" className="h-4 w-4" />
              {isEditing ? "Edit own article" : "Add own article"}
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-ink">
              {isEditing ? "Update your repository article" : `Write directly in ${repository.name}`}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-paper"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <form className="max-h-[calc(92vh-96px)] overflow-y-auto p-5" onSubmit={saveArticle}>
          <div className="grid gap-4">
            <label className="grid gap-1 text-sm font-bold text-ink">
              Title
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal text-ink outline-none focus:border-civic"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Write the current affairs note title"
                required
                value={title}
              />
            </label>

            <label className="grid gap-1 text-sm font-bold text-ink">
              Article body
              <textarea
                className="min-h-56 rounded-md border border-line px-3 py-2 text-base font-normal leading-7 text-ink outline-none focus:border-civic"
                onChange={(event) => setBody(event.target.value)}
                placeholder="Add the full note, analysis, facts, examples, or quick revision points."
                required
                value={body}
              />
            </label>

            <label className="grid gap-1 text-sm font-bold text-ink">
              Source URL
              <input
                className="h-11 rounded-md border border-line px-3 text-base font-normal text-ink outline-none focus:border-civic"
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Optional"
                type="url"
                value={sourceUrl}
              />
            </label>

            <div className="rounded-lg border border-line bg-paper/40 p-3">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-ink/65">
                <Tags aria-hidden="true" className="h-4 w-4 text-civic" />
                Select Tags
              </p>
              {repository.custom_tags && repository.custom_tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {repository.custom_tags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold transition-all ${
                          isSelected
                            ? "border-civic bg-civic text-white"
                            : "border-civic/30 bg-surface text-civic hover:bg-civic/10"
                        }`}
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        type="button"
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs italic text-ink/45">
                  No tags defined in this repository folder.
                </p>
              )}
            </div>

            {message && (
              <p className="rounded-md border border-berry/30 bg-berry/10 px-3 py-2 text-sm font-semibold text-berry">
                {message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-paper"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white hover:bg-civic/90 disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                {pending ? "Saving..." : isEditing ? "Save article" : "Add to repository"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
