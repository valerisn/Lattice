import type { Database } from "./db";
import type { Workspace } from "@/shared/types";
import { accessContext } from "./permissions";
export interface SearchProvider {
  search(
    db: Database,
    workspace: Workspace,
    userId: string,
    query: string,
  ): Promise<
    {
      id: string;
      title: string;
      excerpt: string;
      kind: "page" | "collection";
    }[]
  >;
}
export const searchProvider: SearchProvider = {
  async search(db, workspace, userId, query) {
    const ctx = await accessContext(db, workspace, userId);
    const needle = query.trim().toLowerCase().slice(0, 200);
    if (!needle) return [];
    const pages = ctx.pages
      .filter(
        (p) =>
          ctx.allowed(p) &&
          `${p.title} ${p.content}`.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(needle)) -
          Number(a.title.toLowerCase().includes(needle)),
      )
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        title: p.title,
        excerpt: p.content.slice(
          Math.max(0, p.content.toLowerCase().indexOf(needle) - 40),
          Math.max(0, p.content.toLowerCase().indexOf(needle) - 40) + 150,
        ),
        kind: "page" as const,
      }));
    const collections = ctx.collections
      .filter(
        (c) =>
          ctx.allowedCollection(c.id) &&
          `${c.name} ${c.description}`.toLowerCase().includes(needle),
      )
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        title: c.name,
        excerpt: c.description,
        kind: "collection" as const,
      }));
    return [...pages, ...collections];
  },
};
