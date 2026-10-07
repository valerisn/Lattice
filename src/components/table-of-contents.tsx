"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PageHeading } from "@/shared/headings";

export function TableOfContents({
  headings,
  article,
}: {
  headings: PageHeading[];
  article: RefObject<HTMLElement | null>;
}) {
  const [active, setActive] = useState("");
  const links = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const visible = headings
        .map((heading) => document.getElementById(heading.id))
        .filter((element): element is HTMLElement =>
          Boolean(
            element &&
            article.current?.contains(element) &&
            element.getClientRects().length,
          ),
        );
      let current = visible[0]?.id || "";
      for (const element of visible) {
        if (element.getBoundingClientRect().top > 105) break;
        current = element.id;
      }
      // A short final section may never reach the sticky header.
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
      )
        current = visible.at(-1)?.id || current;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (article.current) observer.observe(article.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [headings, article]);
  useEffect(() => {
    const nav = links.current;
    const selected = nav?.querySelector('[aria-current="location"]');
    if (!nav || !selected) return;
    const outer = nav.getBoundingClientRect();
    const inner = selected.getBoundingClientRect();
    if (inner.top < outer.top) nav.scrollTop += inner.top - outer.top;
    else if (inner.bottom > outer.bottom)
      nav.scrollTop += inner.bottom - outer.bottom;
  }, [active]);
  return (
    <aside className="table-of-contents">
      <p className="eyebrow">ON THIS PAGE</p>
      <nav aria-label="On this page" ref={links}>
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            aria-current={active === heading.id ? "location" : undefined}
            style={{ paddingLeft: heading.depth === 3 ? 24 : 10 }}
          >
            {heading.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
