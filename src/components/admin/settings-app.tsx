"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  Users,
  Shield,
  Palette,
  HardDrive,
  Plug,
  Server,
  Folder,
  BookOpen,
  ScrollText,
  LayoutTemplate,
} from "lucide-react";
import type { Workspace, WikiPage, Collection } from "@/shared/types";
import { api } from "@/client/api";
import type { AdminData } from "./types";
import { MembersPanel } from "./members-panel";
import { AccessPanel } from "./access-panel";
import { ThemePicker } from "../theme-picker";
import { UpdatePanel } from "./update-panel";
import { DocumentationPanel } from "./documentation-panel";
import { AuditPanel } from "./audit-panel";
import { TemplatesPanel } from "./templates-panel";
import { adminSectionId, adminSectionName } from "@/shared/navigation";
export function SettingsApp({
  workspace,
  pages,
  collections,
}: {
  workspace: Workspace;
  pages: WikiPage[];
  collections: Collection[];
}) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, transition] = useTransition();
  const router = useRouter();
  const base = `/api/w/${workspace.id}`;
  useEffect(() => {
    let alive = true;
    api<AdminData>(`${base}/admin`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [base]);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      setData(await api<AdminData>(`${base}/admin`));
      setNotice("Changes saved.");
      transition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tabs = [
    ["General", Settings2],
    ["Documentation", BookOpen],
    ["Templates", LayoutTemplate],
    ["Members", Users],
    ["Groups & access", Shield],
    ["Collections", Folder],
    ["Appearance", Palette],
    ["Storage", HardDrive],
    ["Security", Shield],
    ["Audit log", ScrollText],
    ["Integrations", Plug],
    ["System", Server],
  ] as const;
  const tab = adminSectionName(searchParams.get("section"));
  useEffect(() => {
    const previous = document.title;
    document.title = `${tab} · ${workspace.name} · Lattice`;
    return () => {
      document.title = previous;
    };
  }, [tab, workspace.name]);
  return (
    <main className="settings-layout">
      <aside className="settings-sidebar">
        <Link className="row" href={`/w/${workspace.slug}`}>
          <ArrowLeft size={16} />
          Back to workspace
        </Link>
        <div className="admin-brand">
          <img
            src={workspace.logo || "/lattice-logo.png"}
            alt=""
            width={32}
            height={32}
          />
          <h2>{workspace.name}</h2>
        </div>
        <p className="eyebrow">WORKSPACE SETTINGS</p>
        <nav aria-label="Settings sections">
          {tabs.map(([name, Icon]) => (
            <button
              className={tab === name ? "active" : ""}
              key={name}
              disabled={busy || refreshing}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => {
                if (tab !== name) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("section", adminSectionId(name));
                  window.history.pushState(null, "", `?${params.toString()}`);
                }
                setNotice("");
                setError("");
              }}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
        {data && <p className="muted">Lattice {data.system.version}</p>}
      </aside>
      <section className="settings-content">
        <p className="eyebrow">MAKE YOURSELF AT HOME</p>
        <h1>{tab}</h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        {!data ? (
          error ? (
            <button
              type="button"
              onClick={async () => {
                setError("");
                try {
                  setData(await api<AdminData>(`${base}/admin`));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Retry loading settings
            </button>
          ) : (
            <p className="muted" role="status">
              Loading workspace settings…
            </p>
          )
        ) : (
          <fieldset disabled={busy || refreshing} className="settings-fieldset">
            {tab === "Templates" && (
              <TemplatesPanel workspaceId={workspace.id} />
            )}
            {tab === "Audit log" && <AuditPanel workspaceId={workspace.id} />}
            {tab === "Documentation" && (
              <DocumentationPanel workspace={workspace} run={run} />
            )}
            {tab === "General" && (
              <form
                key={
                  workspace.name + workspace.description + workspace.homepage_id
                }
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void run(async () => {
                    await api(`${base}/admin`, "PATCH", {
                      ...form,
                      homepage_id: form.homepage_id || null,
                    });
                  });
                }}
              >
                <label>
                  Workspace name
                  <input
                    name="name"
                    defaultValue={workspace.name}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    defaultValue={workspace.description}
                    maxLength={500}
                    rows={3}
                  />
                </label>
                <label>
                  Default homepage
                  <select
                    name="homepage_id"
                    defaultValue={workspace.homepage_id || ""}
                  >
                    <option value="">First available page</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Workspace URL
                  <input readOnly value={`/w/${workspace.slug}`} />
                </label>
                <button className="primary">Save general settings</button>
              </form>
            )}
            {tab === "Members" && (
              <MembersPanel workspace={workspace} data={data} run={run} />
            )}
            {tab === "Groups & access" && (
              <AccessPanel
                workspace={workspace}
                data={data}
                pages={pages}
                collections={collections}
                run={run}
              />
            )}
            {tab === "Appearance" && (
              <div className="stack">
                <ThemePicker />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = Object.fromEntries(
                      new FormData(e.currentTarget),
                    );
                    void run(async () => {
                      await api(`${base}/admin`, "PATCH", {
                        ...form,
                      });
                    });
                  }}
                >
                  <label>
                    Workspace logo URL
                    <input
                      name="logo"
                      defaultValue={workspace.logo || ""}
                      placeholder="https://… or an uploaded attachment URL"
                    />
                  </label>
                  <label>
                    Accent color
                    <input
                      type="color"
                      name="accent"
                      defaultValue={workspace.accent}
                    />
                  </label>
                  <p className="muted">
                    The default logo and favicon use the Lattice mark. Color
                    applies to light-mode workspace accents.
                  </p>
                  <button className="primary">Save appearance</button>
                </form>
              </div>
            )}
            {tab === "Storage" && (
              <div className="stack">
                <p>
                  {data.storage.count} attachments ·{" "}
                  {(Number(data.storage.bytes) / 1024 / 1024).toFixed(2)} MB
                  stored
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = Number(
                      new FormData(e.currentTarget).get("limit"),
                    );
                    void run(async () => {
                      await api(`${base}/admin`, "PATCH", {
                        upload_limit: Math.round(value * 1024 * 1024),
                      });
                    });
                  }}
                >
                  <label>
                    Maximum upload size (MB)
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={Math.round(
                        workspace.upload_limit / 1024 / 1024,
                      )}
                      required
                    />
                  </label>
                  <button className="primary">Save storage settings</button>
                </form>
                <p className="muted">
                  Local filesystem storage. S3-compatible storage providers are
                  planned; the storage interface is ready for an adapter.
                </p>
              </div>
            )}
            {tab === "Collections" && (
              <div className="stack">
                {collections.map((c) => (
                  <form
                    className="settings-section"
                    key={c.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      void run(async () => {
                        await api(`${base}/collections/${c.id}`, "PATCH", form);
                      });
                    }}
                  >
                    <label>
                      Name
                      <input
                        name="name"
                        defaultValue={c.name}
                        required
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        name="description"
                        defaultValue={c.description}
                        maxLength={500}
                      />
                    </label>
                    <label>
                      Visibility
                      <select name="visibility" defaultValue={c.visibility}>
                        <option value="workspace">
                          Workspace members (unless access grants restrict it)
                        </option>
                        <option value="restricted">
                          Restricted to access grants and administrators
                        </option>
                      </select>
                    </label>
                    <div className="row">
                      <button>Save collection</button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this empty collection? Move its pages first.",
                            )
                          )
                            void run(async () => {
                              await api(
                                `${base}/collections/${c.id}`,
                                "DELETE",
                              );
                            });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))}
                {!collections.length && (
                  <p className="muted">
                    Create a collection from your workspace sidebar.
                  </p>
                )}
              </div>
            )}
            {tab === "Security" && (
              <div className="stack">
                <h2>Secure foundations</h2>
                <p>
                  Email and password authentication uses salted scrypt hashes
                  and expiring, server-stored sessions. Passwords require at
                  least 12 characters.
                </p>
                <p>
                  Only invitation holders can create additional accounts.
                  Workspace owners manage elevated roles. Every API operation
                  checks permissions on the server.
                </p>
                <Link href="/account">
                  Manage your profile, password, and sessions
                </Link>
                <p className="muted">
                  Single sign-on, password reset email, and configurable account
                  policies are planned.
                </p>
              </div>
            )}
            {tab === "Integrations" && (
              <div className="stack">
                <h2>Room to connect</h2>
                <p className="muted">
                  External authentication, webhooks, and integration plugins are
                  planned. No integrations are active in this release.
                </p>
                <p>
                  Contributor interfaces for storage and search live in the
                  server service layer.
                </p>
              </div>
            )}
            {tab === "System" && (
              <div className="stack">
                <UpdatePanel
                  workspaceId={workspace.id}
                  installed={data.system.version}
                  initial={data.update}
                  onChecked={(update) =>
                    setData((current) =>
                      current ? { ...current, update } : current,
                    )
                  }
                />
                <dl className="system-info">
                  {Object.entries(data.system).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>License</dt>
                    <dd>AGPL-3.0-only</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      <a href="https://github.com/valerisn/Lattice">
                        valerisn/Lattice
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </fieldset>
        )}
      </section>
    </main>
  );
}
