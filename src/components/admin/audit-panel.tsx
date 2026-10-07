"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { auditActions, type AuditPage } from "@/shared/audit";

export function AuditPanel({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<AuditPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [refresh, setRefresh] = useState(0);
  const generation = useRef({ value: 0 });
  const params = new URLSearchParams({ q: query, action });
  const url = `/api/w/${workspaceId}/audit?${params}`;
  useEffect(() => {
    const counter = generation.current;
    const current = ++counter.value;
    const timer = setTimeout(() => {
      void api<AuditPage>(url)
        .then((result) => {
          if (counter.value === current) setData(result);
        })
        .catch((e) => {
          if (counter.value === current) setError(e.message);
        })
        .finally(() => {
          if (counter.value === current) setBusy(false);
        });
    }, 150);
    return () => {
      counter.value++;
      clearTimeout(timer);
    };
  }, [url, refresh]);
  const loadOlder = async () => {
    const current = ++generation.current.value;
    setBusy(true);
    setError("");
    try {
      const next = await api<AuditPage>(
        url +
          (data?.nextCursor
            ? `&before=${encodeURIComponent(data.nextCursor)}`
            : ""),
      );
      if (generation.current.value === current)
        setData({
          ...next,
          events: [...(data?.events || []), ...next.events],
        });
    } catch (e) {
      if (generation.current.value === current) setError((e as Error).message);
    } finally {
      if (generation.current.value === current) setBusy(false);
    }
  };
  const reset = () => {
    generation.current.value++;
    setData(null);
    setBusy(true);
    setError("");
  };
  return (
    <div className="stack">
      <p className="muted">
        Successful changes to settings, templates, invitations, member roles,
        groups, and access grants. History starts when audit logging was
        installed.
      </p>
      <div className="audit-filters">
        <label>
          Search activity
          <input
            type="search"
            value={query}
            maxLength={200}
            placeholder="Name or changed item"
            onChange={(event) => {
              reset();
              setQuery(event.target.value);
            }}
          />
        </label>
        <label>
          Activity type
          <select
            value={action}
            onChange={(event) => {
              reset();
              setAction(event.target.value);
            }}
          >
            <option value="">All activity</option>
            {Object.entries(auditActions).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            reset();
            setRefresh((value) => value + 1);
          }}
        >
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
        <p className="empty muted">
          {query.trim() || action
            ? "No administrative changes match these filters."
            : "No administrative changes recorded yet."}
        </p>
      )}
      <ol className="audit-list" aria-busy={busy}>
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
        <button type="button" disabled={busy} onClick={() => void loadOlder()}>
          {busy ? "Loading…" : "Load older activity"}
        </button>
      )}
    </div>
  );
}
