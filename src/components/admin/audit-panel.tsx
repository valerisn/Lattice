"use client";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { auditActions, type AuditPage } from "@/shared/audit";

export function AuditPanel({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/w/${workspaceId}/audit`;
  useEffect(() => {
    let active = true;
    api<AuditPage>(url)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [url]);
  const load = async (older: boolean) => {
    setBusy(true);
    setError("");
    try {
      const next = await api<AuditPage>(
        url + (older && data?.nextCursor ? `?before=${data.nextCursor}` : ""),
      );
      setData({
        ...next,
        events: older ? [...(data?.events || []), ...next.events] : next.events,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <p className="muted">
        Successful changes to settings, invitations, member roles, groups, and
        access grants. History starts when audit logging was installed.
      </p>
      <div>
        <button type="button" disabled={busy} onClick={() => void load(false)}>
          Refresh activity
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading activity…</p>}
      {data?.events.length === 0 && (
        <p className="empty muted">No administrative changes recorded yet.</p>
      )}
      <ol className="audit-list">
        {data?.events.map((event) => (
          <li key={event.id}>
            <div className="audit-marker" aria-hidden="true">
              {event.actor_name.slice(0, 1)}
            </div>
            <div>
              <strong>
                {auditActions[event.action] || "Administrative change"}
              </strong>
              <p>{event.target}</p>
              <p className="muted">
                {event.actor_name} ·{" "}
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </p>
            </div>
          </li>
        ))}
      </ol>
      {data?.nextCursor && (
        <button type="button" disabled={busy} onClick={() => void load(true)}>
          {busy ? "Loading…" : "Load older activity"}
        </button>
      )}
    </div>
  );
}
