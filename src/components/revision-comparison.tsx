"use client";
import { useMemo, useState } from "react";
import type { Revision, WikiPage } from "@/shared/types";
import { revisionDiff } from "@/shared/revision-diff";

export function RevisionComparison({
  revision,
  page,
}: {
  revision: Revision;
  page: WikiPage;
}) {
  const [format, setFormat] = useState("highlighted");
  const diff = useMemo(
    () => revisionDiff(revision.content, page.content),
    [revision.content, page.content],
  );
  return (
    <div className="revision-review">
      <p className="muted">
        Version {revision.version} → current version {page.version}
      </p>
      {(["title", "description"] as const)
        .filter((field) => revision[field] !== page[field])
        .map((field) => (
          <div className="revision-field-change" key={field}>
            <strong>
              {field === "title" ? "Title changed" : "Description changed"}
            </strong>
            <p>
              <span className="muted">Before: </span>
              {revision[field] || "(empty)"}
            </p>
            <p>
              <span className="muted">Current: </span>
              {page[field] || "(empty)"}
            </p>
          </div>
        ))}
      <label htmlFor="comparison-format">Comparison format</label>
      <select
        id="comparison-format"
        value={format}
        onChange={(event) => setFormat(event.target.value)}
      >
        <option value="highlighted">Highlighted changes</option>
        <option value="side-by-side">Side by side</option>
      </select>
      {format === "highlighted" && diff ? (
        <>
          <p className="diff-summary" role="status">
            {diff.added === 0 && diff.removed === 0
              ? "No content changes."
              : `${diff.added} lines added · ${diff.removed} lines removed`}
          </p>
          {(diff.added > 0 || diff.removed > 0) && (
            <>
              <p className="muted diff-legend">
                + added in current version · − removed from selected version
              </p>
              <pre
                className="revision-diff"
                aria-label="Highlighted revision changes"
              >
                <code>
                  {diff.parts.map((part, index) => (
                    <span
                      key={index}
                      className={
                        part.added
                          ? "diff-added"
                          : part.removed
                            ? "diff-removed"
                            : "diff-unchanged"
                      }
                    >
                      {(part.value.match(/[^\n]*\n|[^\n]+$/g) || [])
                        .map(
                          (line) =>
                            `${part.added ? "+" : part.removed ? "−" : " "} ${line.replace(/\n$/, "")}\n`,
                        )
                        .join("")}
                      {!part.value.endsWith("\n") &&
                      (part.added || part.removed)
                        ? "\\ No newline at end of document\n"
                        : ""}
                    </span>
                  ))}
                </code>
              </pre>
            </>
          )}
        </>
      ) : (
        <>
          {format === "highlighted" && (
            <p className="muted" role="status">
              This comparison is too large to highlight quickly. Both versions
              are shown below.
            </p>
          )}
          <div className="revision-comparison">
            <div>
              <h4>Version {revision.version}</h4>
              <pre>{revision.content || "(empty)"}</pre>
            </div>
            <div>
              <h4>Current · version {page.version}</h4>
              <pre>{page.content || "(empty)"}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
