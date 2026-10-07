"use client";
import { useEffect, useState } from "react";
import type { WikiPage, Revision } from "@/shared/types";
import { Modal } from "./modal";
import { Markdown } from "./markdown";
import { api } from "@/client/api";
import { RevisionComparison } from "./revision-comparison";
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
  const [items, setItems] = useState<Revision[] | null>(null);
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
  const reload = async () => {
    setError("");
    try {
      setItems(await api<Revision[]>(`${base}/revisions`));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const revision = items?.find((r) => r.id === selected) || items?.[0];
  return (
    <Modal
      title="Every chapter, remembered"
      wide
      onClose={onClose}
      closeDisabled={busy}
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items && error && (
        <button type="button" onClick={() => void reload()}>
          Retry loading revisions
        </button>
      )}
      <div className="history-layout">
        <nav aria-label="Page revisions">
          {items?.map((r) => (
            <button
              key={r.id}
              className={r.id === revision?.id ? "active" : ""}
              aria-current={r.id === revision?.id ? "true" : undefined}
              disabled={busy}
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
                      disabled={busy}
                      onChange={(e) => setCompare(e.target.checked)}
                    />
                    Compare with current
                  </label>
                  {editable && revision.version !== page.version && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
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
                      {busy
                        ? "Restoring…"
                        : `Restore version ${revision.version}`}
                    </button>
                  )}
                </div>
              </div>
              {compare ? (
                <RevisionComparison revision={revision} page={page} />
              ) : (
                <Markdown content={revision.content} />
              )}
            </>
          ) : (
            !error && (
              <p className="muted" role="status">
                {items
                  ? "No revisions are available for this page."
                  : "Loading revisions…"}
              </p>
            )
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
