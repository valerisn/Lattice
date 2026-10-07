"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FileText, Folder, Search } from "lucide-react";
import { Modal } from "./modal";
import { api } from "@/client/api";
interface Result {
  id: string;
  title: string;
  excerpt: string;
  kind: "page" | "collection";
}
export function SearchDialog({
  workspaceId,
  onSelect,
  onClose,
}: {
  workspaceId: string;
  onSelect: (id: string, kind: "page" | "collection") => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index, results]);
  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api<Result[]>(
          `/api/w/${workspaceId}/search?q=${encodeURIComponent(query)}`,
        );
        if (!cancelled) {
          setResults(data);
          setError("");
          setIndex(0);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setPending(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, workspaceId]);
  return (
    <Modal title="Find your way" onClose={onClose}>
      <div className="search-input row">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search pages and collections"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            results[index] ? `${listId}-${index}` : undefined
          }
          placeholder="Search your knowledge…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults([]);
            setIndex(0);
            setError("");
            setPending(Boolean(e.target.value.trim()));
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && results[index]) {
              e.preventDefault();
              onSelect(results[index].id, results[index].kind);
            }
          }}
        />
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {pending
          ? "Searching…"
          : error
            ? "Search failed."
            : results.length
              ? `${results.length} results. Use the arrow keys to choose a result.`
              : query.trim()
                ? "No matches."
                : ""}
      </p>
      <div className="search-results" ref={list}>
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          aria-busy={pending}
        >
          {results.map((result, i) => (
            <button
              className={`search-result ${i === index ? "selected" : ""}`}
              key={result.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === index}
              tabIndex={-1}
              onClick={() => onSelect(result.id, result.kind)}
            >
              {result.kind === "page" ? (
                <FileText size={18} />
              ) : (
                <Folder size={18} />
              )}
              <span>
                <strong>{result.title}</strong>
                <small>{result.excerpt}</small>
              </span>
            </button>
          ))}
        </div>
        {!results.length && !error && (
          <p className="empty muted">
            {pending
              ? "Searching…"
              : query.trim()
                ? "No matches. Try another word."
                : "Search page titles, content, and collections."}
          </p>
        )}
      </div>
      <footer className="muted">↑ ↓ navigate · Enter open · Esc close</footer>
    </Modal>
  );
}
