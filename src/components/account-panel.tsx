"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@/shared/types";
import { api } from "@/client/api";
interface Session {
  created_at: string;
  expires_at: string;
  current: boolean;
}
export function AccountPanel({ user }: { user: User }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const sessionRequest = useRef(0);
  const fetchSessions = useCallback(() => {
    const request = ++sessionRequest.current;
    return api<{ sessions: Session[] }>("/api/account")
      .then((data) => {
        if (request === sessionRequest.current) setSessions(data.sessions);
      })
      .catch((e: Error) => {
        if (request === sessionRequest.current) setSessionError(e.message);
      })
      .finally(() => {
        if (request === sessionRequest.current) setLoadingSessions(false);
      });
  }, []);
  useEffect(() => {
    const counter = sessionRequest;
    void fetchSessions();
    return () => {
      counter.current++;
    };
  }, [fetchSessions]);
  const refreshSessions = () => {
    setLoadingSessions(true);
    setSessionError("");
    setSessions([]);
    return fetchSessions();
  };
  const run = async (
    fn: () => Promise<void>,
    success: string,
    refresh = false,
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      if (refresh) await refreshSessions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="account-page">
      <Link href="/">← Back to workspace</Link>
      <p className="eyebrow">YOUR CORNER OF LATTICE</p>
      <h1>Profile & security</h1>
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="settings-fieldset stack">
        <form
          className="settings-section"
          onSubmit={(e) => {
            e.preventDefault();
            const body = Object.fromEntries(new FormData(e.currentTarget));
            void run(async () => {
              await api("/api/account", "PATCH", body);
            }, "Profile saved.");
          }}
        >
          <h2>Your profile</h2>
          <label>
            Display name
            <input
              name="name"
              defaultValue={user.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Username
            <input
              name="username"
              defaultValue={user.username}
              required
              minLength={3}
              maxLength={40}
            />
          </label>
          <label>
            Email
            <input readOnly value={user.email} />
          </label>
          <label>
            Avatar URL
            <input name="avatar" defaultValue={user.avatar || ""} type="url" />
          </label>
          <p className="muted">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
          <button className="primary">Save profile</button>
        </form>
        <form
          className="settings-section"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const body = Object.fromEntries(new FormData(form));
            void run(
              async () => {
                await api("/api/account", "POST", {
                  ...body,
                  action: "password",
                });
                form.reset();
              },
              "Password updated. Other sessions have been signed out.",
              true,
            );
          }}
        >
          <h2>Change password</h2>
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <p className="muted">
            Changing your password signs out all other sessions.
          </p>
          <button>Update password</button>
        </form>
        <section className="settings-section">
          <h2>Active sessions</h2>
          {loadingSessions && <p role="status">Loading sessions…</p>}
          {sessionError && (
            <div>
              <p role="alert" className="error">
                Could not load active sessions: {sessionError}
              </p>
              <button type="button" onClick={() => void refreshSessions()}>
                Retry loading sessions
              </button>
            </div>
          )}
          {sessions.map((s, i) => (
            <p key={i}>
              {s.current ? "This session" : "Another session"} · Created{" "}
              {new Date(s.created_at).toLocaleString()}
              <br />
              <small className="muted">
                Expires {new Date(s.expires_at).toLocaleString()}
              </small>
            </p>
          ))}
          {!loadingSessions &&
            !sessionError &&
            !sessions.some((session) => !session.current) && (
              <p className="muted">You have no other active sessions.</p>
            )}
          <button
            type="button"
            disabled={
              loadingSessions ||
              !!sessionError ||
              !sessions.some((session) => !session.current)
            }
            onClick={() =>
              run(
                async () => {
                  await api("/api/account", "POST", { action: "revoke" });
                },
                "Other sessions have been signed out.",
                true,
              )
            }
          >
            Sign out other sessions
          </button>
        </section>
      </fieldset>
    </main>
  );
}
