"use client";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import type { PageTemplate, TemplateSummary } from "@/shared/templates";
import { Modal } from "../modal";
import { Markdown } from "../markdown";

type TemplateDraft = Pick<PageTemplate, "name" | "content"> &
  Partial<Pick<PageTemplate, "id" | "version">>;

export function TemplatesPanel({ workspaceId }: { workspaceId: string }) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/w/${workspaceId}/templates`;
  useEffect(() => {
    let active = true;
    api<TemplateSummary[]>(base)
      .then((result) => {
        if (active) setTemplates(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base]);
  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      setTemplates(await api<TemplateSummary[]>(base));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const edit = async (id: string, duplicate = false) => {
    setBusy(true);
    setError("");
    try {
      const template = await api<PageTemplate>(`${base}/${id}`);
      setEditing(
        duplicate
          ? {
              name: `${template.name.slice(0, 73).trimEnd()} (copy)`,
              content: template.content,
            }
          : template,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (template: TemplateSummary) => {
    if (
      !window.confirm(
        `Delete the “${template.name}” template? Existing pages will keep their content.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`${base}/${template.id}`, "DELETE");
      setTemplates(
        (current) => current?.filter((item) => item.id !== template.id) || [],
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <p className="muted">
        Give writers a consistent starting point for guides, runbooks, or
        meeting notes. Templates are available to all writers in this workspace.
      </p>
      <div>
        <button
          type="button"
          className="primary"
          disabled={busy || templates === null}
          onClick={() => setEditing({ name: "", content: "" })}
        >
          New template
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!templates && error && (
        <button type="button" disabled={busy} onClick={() => void reload()}>
          Retry loading templates
        </button>
      )}
      {!templates && !error && <p role="status">Loading templates…</p>}
      {templates?.length === 0 && (
        <p className="empty muted">
          No templates yet. Create one, then choose it when adding a new page.
        </p>
      )}
      {templates?.map((template) => (
        <section className="settings-section" key={template.id}>
          <h2>{template.name}</h2>
          <p className="muted">
            Updated {new Date(template.updated_at).toLocaleDateString()}
          </p>
          <div className="row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void edit(template.id)}
            >
              Edit {template.name}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void edit(template.id, true)}
            >
              Duplicate {template.name}
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => void remove(template)}
            >
              Delete {template.name}
            </button>
          </div>
        </section>
      ))}
      {editing && (
        <TemplateEditor
          template={editing}
          base={base}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTemplates((current) =>
              [
                ...(current || []).filter((item) => item.id !== saved.id),
                saved,
              ].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  base,
  onClose,
  onSaved,
}: {
  template: TemplateDraft;
  base: string;
  onClose: () => void;
  onSaved: (template: PageTemplate) => void;
}) {
  const [name, setName] = useState(template.name);
  const [content, setContent] = useState(template.content);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => {
    if (busy) return;
    if (
      (name !== template.name || content !== template.content) &&
      !window.confirm("Discard unsaved template changes?")
    )
      return;
    onClose();
  };
  return (
    <Modal
      title={template.id ? "Edit page template" : "Create page template"}
      onClose={close}
      closeDisabled={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onSaved(
              await api<PageTemplate>(
                template.id ? `${base}/${template.id}` : base,
                template.id ? "PATCH" : "POST",
                { name, content, version: template.version },
              ),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="settings-fieldset stack">
          <label>
            Template name
            <input
              aria-label="Template name"
              required
              maxLength={80}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div>
            <button
              type="button"
              aria-pressed={preview}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Edit Markdown" : "Preview template"}
            </button>
          </div>
          {preview ? (
            <div className="template-preview">
              <Markdown content={content || "This template is empty."} />
            </div>
          ) : (
            <label>
              Starting content (Markdown)
              <textarea
                aria-label="Template Markdown"
                rows={16}
                maxLength={500000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
          )}
          <p className="muted">
            Content is copied when a page is created. Changes here do not update
            existing pages.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="row">
            <button type="submit" className="primary">
              {busy ? "Saving…" : "Save template"}
            </button>
            <button type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
