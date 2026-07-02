"use client";

import Link from "next/link";
import { ArrowRight, FolderKanban, Plus, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { StudentCollection } from "../../../lib/api";
import { splitWorkspaceTags, workspaceSlug } from "../../../lib/workspace";
import { authenticatedPost, useAuth } from "../../auth/auth-context";

type RepositoryManagerProps = {
  collections: StudentCollection[];
  onChanged: () => Promise<void>;
};

export function RepositoryManager({ collections, onChanged }: RepositoryManagerProps) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customTags, setCustomTags] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function createRepository(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setPending(true);
    setMessage(null);
    try {
      if (!token) {
        const guestCollectionsStr = localStorage.getItem("waytoias_guest_collections");
        const guestCollections = guestCollectionsStr ? JSON.parse(guestCollectionsStr) : [];
        
        const newCollection: StudentCollection = {
          id: -(guestCollections.length + 1),
          name,
          slug: workspaceSlug(name),
          description: description.trim() || null,
          custom_tags: splitWorkspaceTags(customTags),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        guestCollections.push(newCollection);
        localStorage.setItem("waytoias_guest_collections", JSON.stringify(guestCollections));
        
        setName("");
        setDescription("");
        setCustomTags("");
        setShowCreateForm(false);
        await onChanged();
        setMessage("Guest repository created locally.");
        return;
      }

      await authenticatedPost<StudentCollection>("/api/v1/current-affairs/me/collections", token, {
        name,
        slug: workspaceSlug(name),
        description: description.trim() || undefined,
        custom_tags: splitWorkspaceTags(customTags)
      });
      setName("");
      setDescription("");
      setCustomTags("");
      setShowCreateForm(false);
      await onChanged();
      setMessage("Repository created.");
    } catch {
      setMessage("Could not create repository. Use a unique name.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban aria-hidden="true" className="h-5 w-5 text-civic" />
          <h2 className="text-lg font-black text-ink">Repositories</h2>
        </div>
        <button
          id="tour-create-repo-btn"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-civic px-3 text-sm font-bold text-white hover:bg-civic/90"
          onClick={() => setShowCreateForm((value) => !value)}
          type="button"
        >
          {showCreateForm ? <X aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
          {showCreateForm ? "Close" : "New repository"}
        </button>
      </div>

      {showCreateForm && (
        <form className="grid gap-3 rounded-lg border border-line bg-white p-4" onSubmit={createRepository}>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Repository name
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Description
            <textarea
              className="min-h-20 rounded-md border border-line px-3 py-2 text-base font-normal leading-6"
              onChange={(event) => setDescription(event.target.value)}
              value={description || ""}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-ink">
            Custom tags
            <input
              className="h-11 rounded-md border border-line px-3 text-base font-normal"
              onChange={(event) => setCustomTags(event.target.value)}
              placeholder="Weak topic, Revise before mock, Done"
              value={customTags}
            />
            <span className="text-xs font-medium text-ink/55">Define the tag choices used for quick edits inside this repository.</span>
          </label>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-civic px-4 text-sm font-bold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {pending ? "Creating..." : "Create repository"}
          </button>
        </form>
      )}
      {message && <p className="rounded-lg border border-civic/20 bg-civic/10 px-3 py-2 text-sm font-semibold text-civic">{message}</p>}

      <div className="grid gap-3">
        {collections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-ink/65">
            Create repositories for monthly revision, syllabus topics, interview prep, or PYQ practice.
          </p>
        ) : (
          collections.map((collection) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 hover:border-civic"
              href={`/current-affairs/workspace/repositories/${collection.id}`}
              key={collection.id}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-extrabold text-ink">{collection.name}</span>
                <span className="mt-1 block text-sm text-ink/65">
                  {collection.item_count ?? 0} items
                  {collection.description ? ` - ${collection.description}` : ""}
                </span>
                {collection.custom_tags && collection.custom_tags.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {collection.custom_tags.slice(0, 4).map((tag) => (
                      <span className="rounded-full bg-civic/10 px-2 py-0.5 text-[11px] font-bold text-civic" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-civic" />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
