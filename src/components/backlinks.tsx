"use client";
import { useMemo, useSyncExternalStore } from "react";
import { Link2, ArrowUpRight } from "lucide-react";
import { findBacklinks } from "@/shared/backlinks";
import type { WikiPage } from "@/shared/types";

const subscribe = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

export function Backlinks({
  pages,
  pageId,
  workspaceSlug,
  onSelect,
}: {
  pages: WikiPage[];
  pageId: string;
  workspaceSlug: string;
  onSelect: (id: string) => void;
}) {
  const origin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const links = useMemo(
    () => findBacklinks(pages, pageId, workspaceSlug, origin),
    [pages, pageId, workspaceSlug, origin],
  );
  if (!links.length) return null;
  return (
    <section className="page-backlinks" aria-label="Linked from">
      <h2>
        <Link2 size={16} />
        Linked from <span className="muted">{links.length}</span>
      </h2>
      <ul>
        {links.map((page) => (
          <li key={page.id}>
            <a
              href={`/w/${workspaceSlug}?page=${page.id}`}
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
                onSelect(page.id);
              }}
            >
              <span>
                {page.title}
                {page.description && <small>{page.description}</small>}
              </span>
              <ArrowUpRight size={14} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
