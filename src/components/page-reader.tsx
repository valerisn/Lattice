"use client";
import { useEffect, useMemo, useRef } from "react";
import { FileText, ArrowUpRight } from "lucide-react";
import type { WikiPage, Collection } from "@/shared/types";
import { Markdown } from "./markdown";
import { pageHeadings } from "@/shared/headings";
import { Backlinks } from "./backlinks";
import { LatticeWeave } from "./lattice-weave";
import { TableOfContents } from "./table-of-contents";
import {
  documentationSettings,
  type DocumentationSettings,
} from "@/shared/documentation";
export function PageReader({
  page,
  collections,
  documentation,
  pages,
  workspaceSlug,
  onSelect,
}: {
  page: WikiPage;
  collections: Collection[];
  documentation?: Partial<DocumentationSettings>;
  pages: WikiPage[];
  workspaceSlug: string;
  onSelect: (id: string) => void;
}) {
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    const opened = new Set<HTMLDetailsElement>();
    const beforePrint = () => {
      article.current
        ?.querySelectorAll<HTMLDetailsElement>("details:not([open])")
        .forEach((element) => {
          opened.add(element);
          element.open = true;
        });
    };
    const afterPrint = () => {
      opened.forEach((element) => {
        element.open = false;
      });
      opened.clear();
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      afterPrint();
    };
  }, [page.id]);
  const settings = documentationSettings(documentation);
  const headings = useMemo(
    () => (settings.show_toc ? pageHeadings(page.content) : []),
    [page.content, settings.show_toc],
  );
  const collection = collections.find((c) => c.id === page.collection_id);
  return (
    <div
      className={`reader-layout ${settings.reading_width === "wide" ? "reader-wide" : ""} ${!settings.show_toc || headings.length < 2 ? "reader-without-toc" : ""}`}
    >
      <article className="page-article" ref={article}>
        <header className="page-masthead">
          <div className="page-flourish">
            <LatticeWeave />
          </div>
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
          {(settings.show_author ||
            settings.show_updated ||
            settings.show_reading_time) && (
            <div className="page-meta">
              {settings.show_author && (
                <>
                  <span className="avatar small">
                    {page.author?.slice(0, 1) || "L"}
                  </span>
                  <span>{page.author || "You"}</span>
                </>
              )}
              {settings.show_updated && (
                <>
                  {settings.show_author && <span>·</span>}
                  <span>
                    Updated{" "}
                    {new Date(page.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
              {settings.show_reading_time && (
                <>
                  {(settings.show_author || settings.show_updated) && (
                    <span>·</span>
                  )}
                  <span>
                    {Math.max(
                      1,
                      Math.ceil(page.content.split(/\s+/).length / 220),
                    )}{" "}
                    min read
                  </span>
                </>
              )}
            </div>
          )}
        </header>
        <div className="page-divider" />
        {page.content ? (
          <Markdown content={page.content} />
        ) : (
          <p className="empty muted">
            A little space for your next idea. Edit this page to start writing.
          </p>
        )}
        <Backlinks
          pages={pages}
          pageId={page.id}
          workspaceSlug={workspaceSlug}
          onSelect={onSelect}
        />
        <footer className="page-footer">
          {settings.footer_text && <span>{settings.footer_text}</span>}
          <a
            href="https://github.com/valerisn/Lattice"
            target="_blank"
            rel="noreferrer"
          >
            Open source <ArrowUpRight size={12} />
          </a>
        </footer>
      </article>
      {settings.show_toc && headings.length > 1 && (
        <TableOfContents headings={headings} article={article} />
      )}
    </div>
  );
}
