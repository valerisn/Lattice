"use client";
import { useEffect, useRef, useState } from "react";
import type { WikiPage, Collection } from "@/shared/types";
import { Modal } from "./modal";
import { api } from "@/client/api";
import type { TemplateSummary } from "@/shared/templates";
import type { ImportedMarkdown } from "@/client/markdown-import";
import { MarkdownImport } from "./markdown-import";
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
  const [imported, setImported] = useState<ImportedMarkdown | null>(null);
  const [importing, setImporting] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
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
      closeDisabled={busy || importing}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || importing) return;
          setBusy(true);
          setError("");
          const form = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>(
              `/api/w/${workspaceId}/${kind === "page" ? "pages" : "collections"}`,
              "POST",
              {
                ...form,
                parent_id: form.parent_id || null,
                collection_id: form.collection_id || null,
                template_id: imported ? null : form.template_id || null,
                content: imported?.content,
              },
            );
            onCreated(result.id);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="settings-fieldset">
          <label>
            {kind === "page" ? "Page title" : "Collection name"}
            <input
              ref={titleInput}
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
                  <select
                    name="template_id"
                    aria-label="Starting template"
                    disabled={imported !== null}
                  >
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
              <MarkdownImport
                value={imported}
                onBusyChange={setImporting}
                onChange={(value) => {
                  setImported(value);
                  if (
                    value &&
                    titleInput.current &&
                    !titleInput.current.value.trim()
                  )
                    titleInput.current.value = value.title;
                }}
              />
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
          <button
            className="primary"
            type="submit"
            disabled={busy || importing}
          >
            {busy ? "Creating…" : `Create ${kind}`}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
