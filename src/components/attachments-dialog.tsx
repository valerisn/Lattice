"use client";
import { useEffect, useState } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { api } from "@/client/api";
import { Modal } from "./modal";
import type { WikiPage } from "@/shared/types";
interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}
export function AttachmentsDialog({
  page,
  editable,
  onClose,
}: {
  page: WikiPage;
  editable: boolean;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const base = `/api/w/${page.workspace_id}/pages/${page.id}/attachments`;
  useEffect(() => {
    let alive = true;
    api<Attachment[]>(base)
      .then((data) => {
        if (alive) setFiles(data);
      })
      .catch((e) => {
        if (alive) setLoadError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [base, attempt]);
  return (
    <Modal title="Files that belong here" onClose={onClose}>
      <p className="muted">
        Attachments inherit this page’s access permissions.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loadError && (
        <div className="error" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError("");
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Retry loading attachments
          </button>
        </div>
      )}
      <div className="attachment-list">
        {files.map((file) => (
          <div className="row" key={file.id}>
            <Paperclip size={16} />
            <a
              href={`/api/attachments/${file.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {file.name}
            </a>
            <span className="muted">{Math.ceil(file.size / 1024)} KB</span>
            <button
              onClick={async () => {
                setError("");
                setNotice("");
                try {
                  const name = file.name.replace(/[\[\]\\]/g, "_");
                  await navigator.clipboard.writeText(
                    `${file.mime.startsWith("image/") ? "!" : ""}[${name}](/api/attachments/${file.id})`,
                  );
                  setNotice("Markdown copied. Paste it into the page editor.");
                } catch {
                  setError("Clipboard is unavailable in this browser.");
                }
              }}
            >
              Copy Markdown
            </button>
            {editable && (
              <button
                className="icon-button danger"
                aria-label={`Delete ${file.name}`}
                disabled={Boolean(busy) || loading || Boolean(loadError)}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete ${file.name}? Existing links will stop working.`,
                    )
                  )
                    return;
                  setBusy("delete");
                  setError("");
                  setNotice("");
                  try {
                    await api(`/api/attachments/${file.id}`, "DELETE");
                    setFiles((current) =>
                      current.filter((f) => f.id !== file.id),
                    );
                    setNotice(`${file.name} deleted.`);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {loading && (
          <p className="empty muted" role="status">
            Loading attachments…
          </p>
        )}
        {!loading && !loadError && !files.length && (
          <p className="empty muted">No attachments yet.</p>
        )}
      </div>
      {editable && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy("upload");
            setError("");
            setNotice("");
            try {
              const uploaded = await api<Attachment>(
                base,
                "POST",
                new FormData(form),
              );
              setFiles((current) => [...current, uploaded]);
              form.reset();
              setNotice(
                `${uploaded.name} uploaded. Copy its Markdown to add it to the page.`,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(null);
            }
          }}
        >
          <label>
            Upload a file
            <input
              name="file"
              type="file"
              required
              disabled={Boolean(busy) || loading || Boolean(loadError)}
              accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.json,.log"
            />
          </label>
          <button
            className="primary"
            disabled={Boolean(busy) || loading || Boolean(loadError)}
          >
            {busy === "upload" ? "Uploading…" : "Upload attachment"}
          </button>
          <small className="muted">
            Images, PDFs, and plain text documents. Your workspace’s size limit
            applies.
          </small>
        </form>
      )}
    </Modal>
  );
}
