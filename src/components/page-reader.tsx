"use client";
import { FileText, ArrowUpRight } from "lucide-react";
import type { WikiPage, Collection } from "@/shared/types";
import { Markdown, headingId } from "./markdown";
export function PageReader({
  page,
  collections,
}: {
  page: WikiPage;
  collections: Collection[];
}) {
  const headings = [...page.content.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(
    (m) => ({ depth: m[1].length, title: m[2] }),
  );
  const collection = collections.find((c) => c.id === page.collection_id);
  return (
    <div className="reader-layout">
      <article className="page-article">
        <div className="page-symbol">
          <FileText size={25} strokeWidth={1.5} />
        </div>
        <div className="row">
          <p className="eyebrow">{collection?.name || "YOUR WORKSPACE"}</p>
          {page.state === "draft" && <span className="badge">DRAFT</span>}
        </div>
        <h1>{page.title}</h1>
        {page.description && (
          <p className="page-description">{page.description}</p>
        )}
        <div className="page-meta">
          <span className="avatar small">
            {page.author?.slice(0, 1) || "L"}
          </span>
          <span>{page.author || "You"}</span>
          <span>·</span>
          <span>
            Updated{" "}
            {new Date(page.updated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span>·</span>
          <span>
            {Math.max(1, Math.ceil(page.content.split(/\s+/).length / 220))} min
            read
          </span>
        </div>
        <div className="page-divider" />
        {page.content ? (
          <Markdown content={page.content} />
        ) : (
          <p className="empty muted">
            A little space for your next idea. Edit this page to start writing.
          </p>
        )}
        <footer className="page-footer">
          <span>Made with care. Kept in Lattice.</span>
          <a
            href="https://github.com/valerisn/Lattice"
            target="_blank"
            rel="noreferrer"
          >
            Open source <ArrowUpRight size={12} />
          </a>
        </footer>
      </article>
      {headings.length > 1 && (
        <aside className="table-of-contents">
          <p className="eyebrow">ON THIS PAGE</p>
          {headings.map((h, i) => (
            <a
              key={i}
              href={`#${headingId(h.title)}`}
              style={{ paddingLeft: h.depth === 3 ? 14 : 0 }}
            >
              {h.title}
            </a>
          ))}
        </aside>
      )}
    </div>
  );
}
