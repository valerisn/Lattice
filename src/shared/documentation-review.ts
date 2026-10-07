import type { WikiPage } from "./types";

export function olderPublishedPages(
  pages: WikiPage[],
  now: number,
): WikiPage[] {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  return pages
    .filter(
      (page) =>
        page.state === "published" && Date.parse(page.updated_at) <= cutoff,
    )
    .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
}
