import type { WikiPage } from "./types";

export function pageAncestors(
  page: WikiPage | undefined,
  pages: WikiPage[],
): WikiPage[] {
  if (!page) return [];
  const byId = new Map(pages.map((item) => [item.id, item]));
  const seen = new Set([page.id]);
  const ancestors: WikiPage[] = [];
  let parent = page.parent_id ? byId.get(page.parent_id) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    ancestors.unshift(parent);
    parent = parent.parent_id ? byId.get(parent.parent_id) : undefined;
  }
  return ancestors;
}
