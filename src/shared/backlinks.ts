import { markdownLinks } from "./headings";
import type { WikiPage } from "./types";

export function findBacklinks(
  visiblePages: WikiPage[],
  targetId: string,
  workspaceSlug: string,
  origin: string,
) {
  const base = new URL(
    `/w/${workspaceSlug}`,
    origin || "https://lattice.invalid",
  );
  return visiblePages
    .filter((page) => {
      if (page.id === targetId || !page.content.includes(targetId))
        return false;
      return markdownLinks(page.content).some((href) => {
        try {
          const url = new URL(href, base);
          return (
            url.origin === base.origin &&
            url.pathname.replace(/\/$/, "") === base.pathname &&
            url.searchParams.get("page") === targetId
          );
        } catch {
          return false;
        }
      });
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
