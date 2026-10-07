import type { WikiPage } from "./types";

export function pageSubtreeIds(pageId: string, pages: WikiPage[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.parent_id) continue;
    const siblings = children.get(page.parent_id) || [];
    siblings.push(page.id);
    children.set(page.parent_id, siblings);
  }
  const ids = new Set([pageId]);
  const pending = [pageId];
  for (let index = 0; index < pending.length; index++) {
    for (const child of children.get(pending[index]) || []) {
      if (ids.has(child)) continue;
      ids.add(child);
      pending.push(child);
    }
  }
  return ids;
}

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
