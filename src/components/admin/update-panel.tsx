"use client";
import { useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { api } from "@/client/api";
import type { UpdateCheck } from "@/shared/updates";

export function UpdatePanel({
  workspaceId,
  installed,
  initial,
}: {
  workspaceId: string;
  installed: string;
  initial: UpdateCheck | null;
}) {
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="settings-section stack" aria-label="Software updates">
      <div>
        <p className="eyebrow">LATTICE UPDATES</p>
        <h2>Version {installed}</h2>
      </div>
      <p className="muted">
        Check for stable releases on GitHub. Checks send no workspace or account
        data and are cached for five minutes.
      </p>
      {result && (
        <div role="status">
          <p>{result.message}</p>
          {result.latest && (
            <p>
              Latest stable version: <strong>{result.latest}</strong>
            </p>
          )}
          <p className="muted">
            Last checked {new Date(result.checkedAt).toLocaleString()}
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setResult(
                await api<UpdateCheck>(
                  `/api/w/${workspaceId}/updates`,
                  "POST",
                  {},
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={15} />
          {busy ? "Checking…" : "Check for updates"}
        </button>
        <a
          href={
            result?.releaseUrl || "https://github.com/valerisn/Lattice/releases"
          }
          target="_blank"
          rel="noreferrer"
        >
          View releases <ExternalLink size={13} />
        </a>
      </div>
      <p className="muted">
        Before upgrading, back up your database and uploads. Follow the release
        notes and self-hosting guide.
      </p>
    </section>
  );
}
