"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Search,
  Home,
  Clock3,
  Star,
  Plus,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ChevronRight,
  Share2,
  Download,
  Leaf,
  ArrowUpRight,
} from "lucide-react";
import {
  type Workspace,
  type WikiPage,
  type Collection,
  type User,
  canEdit,
  canManage,
} from "@/shared/types";
import { api } from "@/client/api";
import { HistoryDialog } from "./history-dialog";
import { AttachmentsDialog } from "./attachments-dialog";
import { PageEditor } from "./page-editor";
import { PageTree } from "./page-tree";
import { PageReader } from "./page-reader";
import { CreateDialog } from "./create-dialog";
import { SearchDialog } from "./search-dialog";
import { ThemePicker } from "./theme-picker";

export interface WorkspaceProps {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  pages: WikiPage[];
  collections: Collection[];
  editableIds: string[];
  initialPageId?: string;
}
export function WorkspaceApp({
  user,
  workspace,
  workspaces,
  pages,
  collections,
  editableIds,
  initialPageId,
}: WorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(
    initialPageId || workspace.homepage_id || pages[0]?.id || null,
  );
  const [view, setView] = useState("page");
  const [sidebar, setSidebar] = useState(true);
  const [search, setSearch] = useState(false);
  const [create, setCreate] = useState<"page" | "collection" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<WikiPage | null>(null);
  const [history, setHistory] = useState(false);
  const [attachments, setAttachments] = useState(false);
  const page = pages.find((p) => p.id === selected);
  const base = `/api/w/${workspace.id}`;
  const refresh = () => startTransition(() => router.refresh());
  const selectPage = (id: string) => {
    setSelected(id);
    setView("page");
    setError("");
    window.history.replaceState(null, "", `?page=${id}`);
    if (window.innerWidth < 850) setSidebar(false);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const filtered =
    view === "favorites"
      ? pages.filter((p) => p.favorite)
      : view === "recent"
        ? [...pages]
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
            .slice(0, 20)
        : pages.filter((p) => p.collection_id === view);
  const title =
    view === "favorites"
      ? "Your favorites"
      : view === "recent"
        ? "Recently updated"
        : collections.find((c) => c.id === view)?.name || "Pages";
  return (
    <div
      className={`app-shell ${sidebar ? "" : "sidebar-hidden"}`}
      style={{ "--workspace-accent": workspace.accent } as React.CSSProperties}
    >
      {sidebar && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => setSidebar(false)}
          />
          <aside className="sidebar">
            <div className="workspace-brand">
              <img
                src={workspace.logo || "/lattice-logo.png"}
                alt=""
                width="34"
                height="34"
              />
              <div>
                <strong>{workspace.name}</strong>
                <span>Knowledge, connected.</span>
              </div>
              <button
                className="icon-button ghost"
                aria-label="Collapse sidebar"
                onClick={() => setSidebar(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <label className="sr-only" htmlFor="workspace-select">
              Switch workspace
            </label>
            <select
              id="workspace-select"
              className="workspace-select"
              value={workspace.slug}
              onChange={(e) => router.push(`/w/${e.target.value}`)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.slug}>
                  {w.name}
                </option>
              ))}
            </select>
            <button className="sidebar-search" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Search anything</span>
              <kbd>Ctrl K</kbd>
            </button>
            <nav className="main-nav" aria-label="Workspace">
              <button
                className={
                  view === "page" && selected === workspace.homepage_id
                    ? "active"
                    : ""
                }
                onClick={() => {
                  if (workspace.homepage_id) selectPage(workspace.homepage_id);
                  else setView("recent");
                }}
              >
                <Home size={17} />
                Home
              </button>
              <button
                className={view === "recent" ? "active" : ""}
                onClick={() => setView("recent")}
              >
                <Clock3 size={17} />
                Recent pages
              </button>
              <button
                className={view === "favorites" ? "active" : ""}
                onClick={() => setView("favorites")}
              >
                <Star size={17} />
                Favorites
              </button>
            </nav>
            <div className="sidebar-scroll">
              <div className="section-label">
                <span>YOUR KNOWLEDGE</span>
                {canEdit(workspace.role) && (
                  <button
                    className="icon-button ghost"
                    onClick={() => setCreate("page")}
                    aria-label="Add page"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <PageTree
                pages={pages}
                selected={view === "page" ? selected : null}
                onSelect={selectPage}
                canEdit={canEdit(workspace.role)}
                onMove={(id, parentId, beforeId) =>
                  run(async () => {
                    await api(`${base}/pages/${id}/move`, "POST", {
                      parent_id: parentId,
                      before_id: beforeId,
                    });
                    refresh();
                  })
                }
              />
              <div className="section-label">
                <span>COLLECTIONS</span>
                {canManage(workspace.role) && (
                  <button
                    className="icon-button ghost"
                    onClick={() => setCreate("collection")}
                    aria-label="Add collection"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <nav className="main-nav" aria-label="Collections">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    className={view === c.id ? "active" : ""}
                    onClick={() => setView(c.id)}
                  >
                    <Folder size={16} />
                    <span>{c.name}</span>
                    <small>
                      {pages.filter((p) => p.collection_id === c.id).length}
                    </small>
                  </button>
                ))}
              </nav>
              {canEdit(workspace.role) && (
                <button className="new-page" onClick={() => setCreate("page")}>
                  <Plus size={16} />
                  New page
                </button>
              )}
            </div>
            <div className="sidebar-bottom">
              <ThemePicker />
              {canManage(workspace.role) && (
                <Link
                  className="settings-link"
                  href={`/w/${workspace.slug}/settings`}
                >
                  Workspace settings
                </Link>
              )}
              <Link href="/new-workspace" className="new-workspace">
                + Create workspace
              </Link>
              <div className="profile">
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <div>
                  <Link href="/account">
                    <strong>{user.name}</strong>
                  </Link>
                  <span>{workspace.role}</span>
                </div>
                <button
                  className="icon-button ghost"
                  aria-label="Sign out"
                  onClick={() =>
                    run(async () => {
                      await api("/api/auth/logout", "POST");
                      router.push("/login");
                      router.refresh();
                    })
                  }
                >
                  <LogOut size={16} />
                </button>
              </div>
              <a
                className="powered-by"
                href="https://github.com/valerisn/Lattice"
                target="_blank"
                rel="noreferrer"
              >
                <Leaf size={13} /> Grown with Lattice <ArrowUpRight size={11} />
              </a>
            </div>
          </aside>
        </>
      )}
      <main className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            {!sidebar && (
              <button
                className="icon-button ghost"
                aria-label="Open navigation"
                onClick={() => setSidebar(true)}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <span>{workspace.name}</span>
            <ChevronRight size={13} />
            <strong>{view === "page" ? page?.title || "Page" : title}</strong>
          </div>
          {view === "page" && page && (
            <div className="page-actions">
              <details className="more-menu">
                <summary aria-label="More page actions">•••</summary>
                <div>
                  <button onClick={() => setHistory(true)}>
                    Version history
                  </button>
                  <button onClick={() => setAttachments(true)}>
                    Attachments
                  </button>
                  {editableIds.includes(page.id) && (
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${page.title}? This also deletes its revision history.`,
                          )
                        )
                          void run(async () => {
                            await api(`${base}/pages/${page.id}`, "DELETE");
                            setSelected(null);
                            refresh();
                          });
                      }}
                    >
                      Delete page
                    </button>
                  )}
                </div>
              </details>
              {editableIds.includes(page.id) && (
                <button
                  className="primary"
                  onClick={() =>
                    run(async () => {
                      setEditing(
                        await api<WikiPage>(`${base}/pages/${page.id}`),
                      );
                    })
                  }
                >
                  <Pencil size={14} />
                  <span>Edit page</span>
                </button>
              )}
              <button
                className="icon-button ghost"
                aria-label={page.favorite ? "Remove favorite" : "Add favorite"}
                onClick={() =>
                  run(async () => {
                    await api(`${base}/pages/${page.id}/favorite`, "POST", {
                      favorite: !page.favorite,
                    });
                    refresh();
                  })
                }
              >
                <Star
                  size={17}
                  fill={page.favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                className="ghost"
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/w/${workspace.slug}?page=${page.id}`,
                    );
                    setNotice(
                      "Page link copied. Workspace access is required.",
                    );
                  })
                }
              >
                <Share2 size={15} />
                <span>Share</span>
              </button>
              <button
                className="icon-button ghost"
                aria-label="Export Markdown"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([`# ${page.title}\n\n${page.content}`], {
                      type: "text/markdown",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${page.slug}.md`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={16} />
              </button>
            </div>
          )}
        </header>
        {error && (
          <div className="workspace-alert error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        {view === "page" ? (
          page ? (
            <PageReader
              page={page}
              collections={collections}
              documentation={workspace.documentation}
              pages={pages}
              workspaceSlug={workspace.slug}
              onSelect={selectPage}
            />
          ) : (
            <div className="empty">
              <h2>This page is not available.</h2>
              <p className="muted">Choose another page from the sidebar.</p>
            </div>
          )
        ) : (
          <section className="page-list">
            <p className="eyebrow">YOUR KNOWLEDGE, TOGETHER</p>
            <h1>{title}</h1>
            <p className="muted">
              {collections.find((c) => c.id === view)?.description ||
                "A little less searching. A little more knowing."}
            </p>
            <div className="list-rows">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => selectPage(p.id)}>
                  <div>
                    <strong>{p.title}</strong>
                    <span>{p.description || "Ready for your next idea."}</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!filtered.length && (
                <p className="empty muted">
                  Nothing here yet.{" "}
                  {view === "favorites"
                    ? "Star a page to keep it close."
                    : "Create a page to start growing this space."}
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      {history && page && (
        <HistoryDialog
          page={page}
          editable={editableIds.includes(page.id)}
          onClose={() => setHistory(false)}
          onRestored={() => {
            setHistory(false);
            refresh();
          }}
        />
      )}
      {attachments && page && (
        <AttachmentsDialog
          page={page}
          editable={editableIds.includes(page.id)}
          onClose={() => setAttachments(false)}
        />
      )}
      {editing && (
        <PageEditor
          page={editing}
          pages={pages}
          collections={collections}
          workspaceSlug={workspace.slug}
          onClose={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {search && (
        <SearchDialog
          workspaceId={workspace.id}
          onClose={() => setSearch(false)}
          onSelect={(id, kind) => {
            setSearch(false);
            if (kind === "page") selectPage(id);
            else setView(id);
          }}
        />
      )}
      {create && (
        <CreateDialog
          kind={create}
          defaultState={workspace.documentation.default_state}
          workspaceId={workspace.id}
          pages={pages.filter((p) => editableIds.includes(p.id))}
          collections={collections}
          onClose={() => setCreate(null)}
          onCreated={(id) => {
            const kind = create;
            setCreate(null);
            refresh();
            if (kind === "page") selectPage(id);
            else setView(id);
          }}
        />
      )}
    </div>
  );
}
