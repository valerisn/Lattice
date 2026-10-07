"use client";
import { useRef, useState } from "react";
import {
  readMarkdownFile,
  type ImportedMarkdown,
} from "@/client/markdown-import";

export function MarkdownImport({
  value,
  onChange,
  onBusyChange,
}: {
  value: ImportedMarkdown | null;
  onChange: (value: ImportedMarkdown | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="markdown-import">
      <label>
        Import Markdown
        <input
          ref={input}
          type="file"
          aria-label="Import Markdown"
          accept=".md,.markdown"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setBusy(true);
            onBusyChange(true);
            setError("");
            try {
              onChange(await readMarkdownFile(file));
            } catch (e) {
              setError((e as Error).message);
              onChange(null);
              if (input.current) input.current.value = "";
            } finally {
              setBusy(false);
              onBusyChange(false);
            }
          }}
        />
      </label>
      {busy && (
        <p className="muted" role="status">
          Reading Markdown…
        </p>
      )}
      {value && (
        <div className="row">
          <p className="muted" role="status">
            Ready to import {value.name}
          </p>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              onChange(null);
              if (input.current) input.current.value = "";
            }}
          >
            Clear import
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted">
        Up to 500 KB. Images and linked files need to be uploaded separately.
      </p>
    </div>
  );
}
