"use client";
import { useEffect, useState } from "react";
import type { WikiPage, Revision } from "@/shared/types";
import { Modal } from "./modal";
import { Markdown } from "./markdown";
import { api } from "@/client/api";
export function HistoryDialog({
  page,
  editable,
  onClose,
  onRestored,
}: {
  page: WikiPage;
  editable: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [items, setItems] = useState<Revision[]>([]);
  const [selected, setSelected] = useState("");
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/w/${page.workspace_id}/pages/${page.id}`;
  useEffect(() => {
    let alive = true;
    api<Revision[]>(`${base}/revisions`)
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [base]);
  const revision = items.find((r) => r.id === selected) || items[0];
  return (
    <Modal title="Every chapter, remembered" wide onClose={onClose}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="history-layout">
        <nav aria-label="Page revisions">
          {items.map((r) => (
            <button
              key={r.id}
              className={r.id === revision?.id ? "active" : ""}
              onClick={() => setSelected(r.id)}
            >
              <strong>Version {r.version}</strong>
              <span>
                {r.editor} · {new Date(r.created_at).toLocaleString()}
              </span>
              <small>{r.summary || "Page updated"}</small>
            </button>
          ))}
        </nav>
        <section>
          {revision ? (
            <>
              <div className="row spread">
                <h3>{revision.title}</h3>
                <div className="row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={compare}
                      onChange={(e) => setCompare(e.target.checked)}
                    />
                    Compare with current
                  </label>
                  {editable && revision.version !== page.version && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api(`${base}/restore`, "POST", {
                            revisionId: revision.id,
                            version: page.version,
                          });
                          onRestored();
                        } catch (e) {
                          setError((e as Error).message);
                          setBusy(false);
                        }
                      }}
                    >
                      Restore version {revision.version}
                    </button>
                  )}
                </div>
              </div>
              {compare ? (
                <div className="revision-comparison">
                  <div>
                    <h4>Version {revision.version}</h4>
                    <pre>{revision.content}</pre>
                  </div>
                  <div>
                    <h4>Current · version {page.version}</h4>
                    <pre>{page.content}</pre>
                  </div>
                </div>
              ) : (
                <Markdown content={revision.content} />
              )}
            </>
          ) : (
            <p className="muted">Loading revisions…</p>
          )}
        </section>
      </div>
      <p className="muted">
        Restoring creates a new revision. The previous versions stay in your
        history. Showing the latest 100 revisions.
      </p>
    </Modal>
  );
}
