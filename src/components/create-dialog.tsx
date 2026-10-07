"use client";
import { useEffect, useState } from "react";
import type { WikiPage, Collection } from "@/shared/types";
import { Modal } from "./modal";
import { api } from "@/client/api";
import type { TemplateSummary } from "@/shared/templates";
export function CreateDialog({
  kind,
  workspaceId,
  pages,
  collections,
  onClose,
  onCreated,
  defaultState = "published",
}: {
  kind: "page" | "collection";
  workspaceId: string;
  pages: WikiPage[];
  collections: Collection[];
  onClose: () => void;
  onCreated: (id: string) => void;
  defaultState?: "draft" | "published";
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateError, setTemplateError] = useState("");
  useEffect(() => {
    if (kind !== "page") return;
    let active = true;
    api<TemplateSummary[]>(`/api/w/${workspaceId}/templates`)
      .then((result) => {
        if (active) setTemplates(result);
      })
      .catch(() => {
        if (active)
          setTemplateError(
            "Templates could not be loaded. You can still create a blank page.",
          );
      });
    return () => {
      active = false;
    };
  }, [kind, workspaceId]);
  return (
    <Modal
      title={kind === "page" ? "Give your idea a home" : "Create a collection"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>(
              `/api/w/${workspaceId}/${kind === "page" ? "pages" : "collections"}`,
              "POST",
              {
                ...form,
                parent_id: form.parent_id || null,
                collection_id: form.collection_id || null,
                template_id: form.template_id || null,
              },
            );
            onCreated(result.id);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <label>
          {kind === "page" ? "Page title" : "Collection name"}
          <input
            autoFocus
            name={kind === "page" ? "title" : "name"}
            required
            maxLength={kind === "page" ? 200 : 80}
            placeholder={
              kind === "page" ? "Something worth keeping" : "Engineering"
            }
          />
        </label>
        <label>
          Description
          <textarea name="description" maxLength={500} rows={2} />
        </label>
        {kind === "page" ? (
          <>
            {templates.length > 0 && (
              <label>
                Starting template
                <select name="template_id" aria-label="Starting template">
                  <option value="">Blank page</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {templateError && (
              <p className="muted" role="status">
                {templateError}
              </p>
            )}
            <label>
              Parent page
              <select name="parent_id">
                <option value="">Top level</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Collection
              <select name="collection_id">
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Publication
              <select
                aria-label="Publication"
                name="state"
                defaultValue={defaultState}
              >
                <option value="published">Published to workspace</option>
                <option value="draft">Draft (hidden from viewers)</option>
              </select>
            </label>
          </>
        ) : (
          <label>
            Visibility
            <select name="visibility">
              <option value="workspace">Workspace members</option>
              <option value="restricted">
                Restricted (administrators until granted access)
              </option>
            </select>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : `Create ${kind}`}
        </button>
      </form>
    </Modal>
  );
}
