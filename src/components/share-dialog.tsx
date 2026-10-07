"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { pageHeadings } from "@/shared/headings";
import type { WikiPage } from "@/shared/types";
import { Modal } from "./modal";

const subscribe = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

export function ShareDialog({
  page,
  workspaceSlug,
  onClose,
}: {
  page: WikiPage;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const origin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const headings = useMemo(() => pageHeadings(page.content), [page.content]);
  const [section, setSection] = useState("");
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  const url = `${origin}/w/${workspaceSlug}?page=${page.id}${section ? `#${encodeURIComponent(section)}` : ""}`;
  return (
    <Modal title="Share this page" onClose={onClose}>
      <div className="stack share-dialog">
        <div className="share-destination">
          <Link2 size={20} aria-hidden="true" />
          <strong>{page.title}</strong>
        </div>
        <p className="muted">
          Recipients need access to this page. Sharing a link does not change
          its permissions.
        </p>
        {headings.length > 0 && (
          <label>
            Link destination
            <select
              value={section}
              disabled={status === "copying"}
              onChange={(event) => {
                setSection(event.target.value);
                setStatus("idle");
              }}
            >
              <option value="">Entire page</option>
              {headings.map((heading) => (
                <option key={heading.id} value={heading.id}>
                  {heading.depth === 3 ? "↳ " : ""}
                  {heading.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Page link
          <input
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={status === "copying" || !origin}
            onClick={async () => {
              setStatus("copying");
              try {
                await navigator.clipboard.writeText(url);
                setStatus("copied");
              } catch {
                setStatus("failed");
              }
            }}
          >
            {status === "copied" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {status === "copying" ? "Copying…" : "Copy link"}
          </button>
        </div>
        <p className={status === "failed" ? "error" : "muted"} role="status">
          {status === "copied"
            ? "Link copied."
            : status === "failed"
              ? "Could not copy. Select the link above and copy it manually, or try again."
              : headings.length
                ? "Choose the whole page or a specific section."
                : "Copy the link or select it above to copy it manually."}
        </p>
      </div>
    </Modal>
  );
}
