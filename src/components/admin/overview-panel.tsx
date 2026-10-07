"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Workspace, WikiPage, Collection } from "@/shared/types";
import { olderPublishedPages } from "@/shared/documentation-review";

export function OverviewPanel({
  workspace,
  pages,
  collections,
}: {
  workspace: Workspace;
  pages: WikiPage[];
  collections: Collection[];
}) {
  const [review, setReview] = useState("drafts");
  const [reviewTime] = useState(() => Date.now());
  const [limit, setLimit] = useState(8);
  const drafts = pages.filter((page) => page.state === "draft");
  const empty = pages.filter((page) => !page.content.trim());
  const older = olderPublishedPages(pages, reviewTime);
  const candidates =
    review === "drafts"
      ? drafts
      : review === "empty"
        ? empty
        : review === "older"
          ? older
          : pages;
  const recent = [...candidates].sort((a, b) =>
    review === "older"
      ? +new Date(a.updated_at) - +new Date(b.updated_at)
      : +new Date(b.updated_at) - +new Date(a.updated_at),
  );
  return (
    <div className="admin-overview">
      <p className="muted">
        A snapshot of your workspace documentation. Open a page to keep it
        moving.
      </p>
      <dl className="overview-stats" aria-label="Documentation totals">
        {[
          ["Total pages", pages.length],
          ["Published", pages.length - drafts.length],
          ["Drafts", drafts.length],
          ["Collections", collections.length],
        ].map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <p className="overview-note muted">
        Publication counts describe page states. Access grants and draft
        ancestors still determine who can read each page.
      </p>
      <div className="overview-shortcuts">
        <Link href={`/w/${workspace.slug}/settings?section=documentation`}>
          Configure documentation <ArrowUpRight size={15} />
        </Link>
        <Link href={`/w/${workspace.slug}/settings?section=templates`}>
          Manage templates <ArrowUpRight size={15} />
        </Link>
      </div>
      <section className="settings-section" aria-labelledby="review-heading">
        <div className="overview-review-heading">
          <div>
            <h2 id="review-heading">Documentation review</h2>
            <p className="muted">
              {review === "older"
                ? "Published pages not updated in at least 90 days, oldest first. Use this list to decide what needs attention."
                : "Most recently updated pages first."}
            </p>
          </div>
          <div className="overview-review-filter">
            <label htmlFor="documentation-review">Review list</label>
            <select
              id="documentation-review"
              value={review}
              onChange={(event) => {
                setReview(event.target.value);
                setLimit(8);
              }}
            >
              <option value="drafts">Drafts ({drafts.length})</option>
              <option value="empty">Empty pages ({empty.length})</option>
              <option value="older">
                Not updated in 90 days ({older.length})
              </option>
              <option value="recent">Recently updated ({pages.length})</option>
            </select>
          </div>
        </div>
        <ul className="overview-pages">
          {recent.slice(0, limit).map((page) => (
            <li key={page.id}>
              <Link href={`/w/${workspace.slug}?page=${page.id}`}>
                <div>
                  <strong>{page.title}</strong>
                  <span>{page.description || "No description yet"}</span>
                </div>
                <div className="overview-page-detail">
                  <span>{page.state === "draft" ? "Draft" : "Published"}</span>
                  <time dateTime={page.updated_at}>
                    {new Date(page.updated_at).toLocaleDateString()}
                  </time>
                </div>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        {!recent.length && (
          <p className="empty muted">
            {review === "drafts"
              ? "No drafts waiting for review."
              : review === "empty"
                ? "Every page has content."
                : review === "older"
                  ? "No published pages have reached the 90-day review window."
                  : "No pages yet."}
          </p>
        )}
        {recent.length > 0 && (
          <div className="row spread overview-pagination">
            <span className="muted" role="status">
              Showing {Math.min(limit, recent.length)} of {recent.length} pages
            </span>
            {recent.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((count) => count + 8)}
              >
                Show more pages
              </button>
            )}
          </div>
        )}
        {review === "drafts" && drafts.length > 0 && (
          <Link href={`/w/${workspace.slug}?view=drafts`}>
            Browse all drafts <ArrowUpRight size={13} />
          </Link>
        )}
      </section>
    </div>
  );
}
