"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Search,
  Home,
  Clock3,
  FilePenLine,
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
import { pageAncestors } from "@/shared/page-tree";
import {
  homepageId as getHomepageId,
  pageViewTitle,
} from "@/shared/navigation";

export interface WorkspaceProps {
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];
  pages: WikiPage[];
  collections: Collection[];
  editableIds: string[];
}
export function WorkspaceApp({
  user,
  workspace,
  workspaces,
  pages,
  collections,
  editableIds,
}: WorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navigating, startTransition] = useTransition();
  const homepageId = getHomepageId(workspace, pages);
  const selected = searchParams.get("page") || homepageId;
  const view = searchParams.get("view") || "page";
  const [sidebar, setSidebar] = useState(true);
  const [search, setSearch] = useState(false);
  const [create, setCreate] = useState<"page" | "collection" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<WikiPage | null>(null);
  const [history, setHistory] = useState(false);
  const [attachments, setAttachments] = useState(false);
  const page = pages.find((p) => p.id === selected);
  const ancestors = useMemo(() => pageAncestors(page, pages), [page, pages]);
  const base = `/api/w/${workspace.id}`;
  const refresh = () => startTransition(() => router.refresh());
  const setView = (next: string) => {
    if (next !== view)
      startTransition(() =>
        router.push(`/w/${workspace.slug}?view=${encodeURIComponent(next)}`, {
          scroll: false,
        }),
      );
    setError("");
    if (window.innerWidth < 850) setSidebar(false);
  };
  const selectPage = (id: string) => {
    if (id !== selected || view !== "page")
      startTransition(() =>
        router.push(`/w/${workspace.slug}?page=${id}`, { scroll: false }),
      );
    setError("");
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
      : view === "drafts"
        ? pages
            .filter((p) => p.state === "draft")
            .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
        : view === "recent"
          ? [...pages]
              .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
              .slice(0, 20)
          : pages.filter((p) => p.collection_id === view);
  const title = pageViewTitle(view, page, collections);
  const currentTitle = title;
  return (
    <div
      className={`app-shell ${sidebar ? "" : "sidebar-hidden"}`}
      aria-busy={navigating}
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
                  view === "page" && selected === homepageId ? "active" : ""
                }
                onClick={() => {
                  if (homepageId) selectPage(homepageId);
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
              {canEdit(workspace.role) && (
                <button
                  className={view === "drafts" ? "active" : ""}
                  onClick={() => setView("drafts")}
                >
                  <FilePenLine size={17} />
                  Drafts
                  <small>
                    {pages.filter((p) => p.state === "draft").length}
                  </small>
                </button>
              )}
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
          <nav className="breadcrumbs" aria-label="Breadcrumb">
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
            {view === "page" && ancestors.length > 2 && (
              <span
                title={ancestors
                  .slice(0, -2)
                  .map((ancestor) => ancestor.title)
                  .join(" / ")}
              >
                …
              </span>
            )}
            {view === "page" &&
              ancestors.slice(-2).map((ancestor) => (
                <span className="ancestor-crumb" key={ancestor.id}>
                  <a
                    href={`/w/${workspace.slug}?page=${ancestor.id}`}
                    title={ancestor.title}
                    onClick={(event) => {
                      if (
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      selectPage(ancestor.id);
                    }}
                  >
                    {ancestor.title}
                  </a>
                  <ChevronRight size={13} aria-hidden="true" />
                </span>
              ))}
            <strong aria-current="page">{currentTitle}</strong>
          </nav>
          {view === "page" && page && (
            <div className="page-actions" inert={navigating}>
              <details className="more-menu">
                <summary aria-label="More page actions">•••</summary>
                <div>
                  <button onClick={() => setHistory(true)}>
                    Version history
                  </button>
                  <button onClick={() => setAttachments(true)}>
                    Attachments
                  </button>
                  <button
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      window.print();
                    }}
                  >
                    Print / Save as PDF
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
                            startTransition(() =>
                              router.replace(
                                `/w/${workspace.slug}?view=recent`,
                                { scroll: false },
                              ),
                            );
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
              key={page.id}
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
          <section className="page-list" key={view}>
            <p className="eyebrow">YOUR KNOWLEDGE, TOGETHER</p>
            <h1>{title}</h1>
            <p className="muted">
              {view === "drafts"
                ? "Work in progress, hidden from viewers. Open a page to edit or publish it."
                : collections.find((c) => c.id === view)?.description ||
                  "A little less searching. A little more knowing."}
            </p>
            <div className="list-rows">
              {filtered.map((p, index) => (
                <button key={p.id} onClick={() => selectPage(p.id)}>
                  <span className="list-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{p.title}</strong>
                    <span>{p.description || "Ready for your next idea."}</span>
                  </div>
                  <span className="list-state">
                    {p.state === "draft" ? "DRAFT" : "PAGE"}
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!filtered.length && (
                <p className="empty muted">
                  Nothing here yet.{" "}
                  {view === "favorites"
                    ? "Star a page to keep it close."
                    : view === "drafts"
                      ? "Pages saved as drafts appear here."
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
          editableIds={editableIds}
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
            if (kind === "page") selectPage(id);
            else setView(id);
          }}
        />
      )}
    </div>
  );
}
