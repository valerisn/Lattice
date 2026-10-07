"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BookOpen, GitBranch, LockKeyhole } from "lucide-react";
import { api } from "@/client/api";

export function AuthForm({
  setup = false,
  tokenRequired = false,
  inviteToken,
  destination = "/",
}: {
  setup?: boolean;
  tokenRequired?: boolean;
  inviteToken?: string;
  destination?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspace, setWorkspace] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link className="brand" href="/">
          <img src="/lattice-logo.png" width="40" height="40" alt="" />
          Lattice<span className="badge">OPEN SOURCE</span>
        </Link>
        <div>
          <p className="eyebrow">A HOME FOR WHAT YOU KNOW</p>
          <h1>
            Good ideas.
            <br />
            Shared understanding.
            <br />
            <span>Room to grow.</span>
          </h1>
          <p>
            A calm, connected space for your team’s knowledge.
            <br />
            Built to be yours, from the first page.
          </p>
          <div className="auth-benefits">
            <span>
              <BookOpen size={18} /> Beautifully organized
            </span>
            <span>
              <GitBranch size={18} /> Open by design
            </span>
            <span>
              <LockKeyhole size={18} /> On your infrastructure
            </span>
          </div>
        </div>
        <p className="muted">
          Lattice · Open knowledge, beautifully organized.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">
            {setup
              ? "YOUR NEXT CHAPTER"
              : inviteToken
                ? "BETTER, TOGETHER"
                : "WELCOME BACK"}
          </p>
          <h2>
            {setup
              ? "Plant the first seed."
              : inviteToken
                ? "Join your workspace."
                : "Your knowledge awaits."}
          </h2>
          <p className="muted">
            {setup
              ? "Create your workspace and make yourself at home."
              : inviteToken
                ? "Create your account to accept this invitation. Existing users should sign in first."
                : "Sign in to pick up where you left off."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              const data = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              try {
                await api(
                  inviteToken
                    ? "/api/invites/accept"
                    : `/api/auth/${setup ? "setup" : "login"}`,
                  "POST",
                  { ...data, token: inviteToken },
                );
                router.push(destination);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {setup && (
              <>
                <label>
                  Workspace name
                  <input
                    name="workspaceName"
                    required
                    maxLength={80}
                    value={workspace}
                    placeholder="Acorn Studio"
                    onChange={(e) => {
                      setWorkspace(e.target.value);
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                      );
                    }}
                  />
                </label>
                <label>
                  Workspace slug
                  <input
                    name="slug"
                    required
                    minLength={2}
                    maxLength={60}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </label>
              </>
            )}
            {(setup || inviteToken) && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                aria-label="Password"
                type="password"
                autoComplete={
                  setup || inviteToken ? "new-password" : "current-password"
                }
                required
                minLength={setup || inviteToken ? 12 : undefined}
                maxLength={128}
              />
              {(setup || inviteToken) && (
                <span className="muted">
                  At least 12 characters. A passphrase works well.
                </span>
              )}
            </label>
            {setup && tokenRequired && (
              <label>
                Installation setup token
                <input
                  name="setupToken"
                  type="password"
                  required
                  autoComplete="off"
                />
              </label>
            )}
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy} type="submit">
              {busy
                ? "One moment…"
                : setup
                  ? "Create your workspace"
                  : inviteToken
                    ? "Create account & join"
                    : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          {inviteToken && (
            <p>
              <a
                href={`/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`}
              >
                Already have an account? Sign in
              </a>
            </p>
          )}
          <p className="auth-footnote">
            Your knowledge. Your server. Your space.
          </p>
        </div>
      </section>
    </main>
  );
}
