"use client";
import { useEffect, useRef, useState } from "react";
import type { WikiPage, Collection } from "@/shared/types";
import { api } from "@/client/api";
import { Modal } from "./modal";
import { RichEditor } from "./rich-editor";
export function PageEditor({
  page,
  pages,
  collections,
  workspaceSlug,
  onClose,
}: {
  page: WikiPage;
  pages: WikiPage[];
  collections: Collection[];
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(page);
  const [mode, setMode] = useState<"rich" | "markdown">("rich");
  const [status, setStatus] = useState("Saved");
  const [error, setError] = useState("");
  const latest = useRef(page);
  const version = useRef(page.version);
  const saved = useRef(JSON.stringify(page));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const dirty = useRef(false);
  async function save(): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    if (inflight.current) {
      const ok = await inflight.current;
      return ok ? save() : false;
    }
    if (!dirty.current) return true;
    if (!latest.current.title.trim()) {
      setError("Give this page a title before saving.");
      return false;
    }
    const snapshot = { ...latest.current };
    const serialized = JSON.stringify(snapshot);
    setStatus("Saving…");
    inflight.current = (async () => {
      try {
        const updated = await api<WikiPage>(
          `/api/w/${page.workspace_id}/pages/${page.id}`,
          "PATCH",
          { ...snapshot, version: version.current },
        );
        version.current = updated.version;
        saved.current = serialized;
        dirty.current = JSON.stringify(latest.current) !== serialized;
        setStatus(dirty.current ? "Unsaved changes" : "Saved");
        setError("");
        return true;
      } catch (e) {
        setStatus("Not saved");
        setError((e as Error).message);
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    const ok = await inflight.current;
    if (ok && dirty.current) return save();
    return ok;
  }
  function change(patch: Partial<WikiPage>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    dirty.current = JSON.stringify(next) !== saved.current;
    setStatus("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save();
    }, 900);
  }
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const done = async () => {
    if (await save()) onClose();
  };
  return (
    <Modal
      title="Make it worth keeping"
      wide
      onClose={() => {
        void done();
      }}
    >
      <div className="editor-heading row spread">
        <div className="segmented">
          <button
            className={mode === "rich" ? "active" : ""}
            onClick={() => setMode("rich")}
          >
            Rich text
          </button>
          <button
            className={mode === "markdown" ? "active" : ""}
            onClick={() => setMode("markdown")}
          >
            Markdown
          </button>
        </div>
        <div className="row">
          <span className="save-status muted" role="status">
            {status}
          </span>
          <button
            className="primary"
            onClick={() => {
              void done();
            }}
          >
            Done
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <div className="row">
            <button
              onClick={() => {
                void save();
              }}
            >
              Retry save
            </button>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([latest.current.content], { type: "text/markdown" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "unsaved-page.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download your changes
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Close the editor and discard unsaved changes?",
                  )
                ) {
                  dirty.current = false;
                  onClose();
                }
              }}
            >
              Discard changes
            </button>
          </div>
        </div>
      )}
      <label className="editor-title">
        Title
        <input
          value={draft.title}
          maxLength={200}
          onChange={(e) => change({ title: e.target.value })}
        />
      </label>
      <label className="editor-description">
        Description
        <input
          value={draft.description}
          maxLength={500}
          onChange={(e) => change({ description: e.target.value })}
          placeholder="A little context goes a long way."
        />
      </label>
      <div className="editor-location">
        <label>
          Parent page
          <select
            value={draft.parent_id || ""}
            onChange={(e) => change({ parent_id: e.target.value || null })}
          >
            <option value="">Top level</option>
            {pages
              .filter((p) => p.id !== page.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Collection
          <select
            value={draft.collection_id || ""}
            onChange={(e) => change({ collection_id: e.target.value || null })}
          >
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
            value={draft.state}
            onChange={(e) =>
              change({ state: e.target.value as "draft" | "published" })
            }
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>
      {mode === "rich" ? (
        <RichEditor
          key={mode}
          initialContent={draft.content}
          onChange={(content) => change({ content })}
          pages={pages}
          workspaceSlug={workspaceSlug}
          workspaceId={page.workspace_id}
        />
      ) : (
        <label className="markdown-label">
          <span className="sr-only">Markdown content</span>
          <textarea
            aria-label="Markdown content"
            className="markdown-source"
            value={draft.content}
            onChange={(e) => change({ content: e.target.value })}
            spellCheck={false}
          />
        </label>
      )}
    </Modal>
  );
}
