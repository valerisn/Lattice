"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  children,
  language,
}: {
  children?: ReactNode;
  language?: string;
}) {
  const pre = useRef<HTMLPreElement>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "failed"
  >("idle");
  useEffect(
    () => () => {
      if (reset.current) clearTimeout(reset.current);
    },
    [],
  );

  async function copy() {
    if (reset.current) clearTimeout(reset.current);
    setStatus("copying");
    try {
      const text = pre.current?.textContent;
      if (text === undefined || text === null || !navigator.clipboard)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      reset.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="code-block-language">{language || "Plain text"}</span>
        <button
          type="button"
          onClick={copy}
          disabled={status === "copying"}
          aria-label="Copy code"
        >
          {status === "copied" ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {status === "copied"
            ? "Copied"
            : status === "failed"
              ? "Try again"
              : "Copy"}
        </button>
      </div>
      <span
        className={status === "failed" ? "code-block-error" : "sr-only"}
        role="status"
      >
        {status === "failed"
          ? "Couldn’t copy. Select the code to copy it manually, or try again."
          : status === "copied"
            ? "Code copied to clipboard."
            : ""}
      </span>
      <pre
        ref={pre}
        tabIndex={0}
        aria-label={language ? `${language} code` : "Code example"}
      >
        {children}
      </pre>
    </div>
  );
}
