import type { Collection, WikiPage, Workspace } from "./types";

export const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
export const homepageId = (workspace: Workspace, pages: WikiPage[]) =>
  pages.find((page) => page.id === workspace.homepage_id)?.id ||
  pages[0]?.id ||
  null;
export function pageViewTitle(
  view: string,
  page: WikiPage | undefined,
  collections: Collection[],
) {
  if (view === "page") return page?.title || "Page";
  if (view === "favorites") return "Your favorites";
  if (view === "recent") return "Recently updated";
  return (
    collections.find((collection) => collection.id === view)?.name || "Pages"
  );
}

export const adminSectionId = (name: string) =>
  name.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-");
const adminSections = [
  "General",
  "Documentation",
  "Templates",
  "Members",
  "Groups & access",
  "Collections",
  "Appearance",
  "Storage",
  "Security",
  "Audit log",
  "Integrations",
  "System",
];
export const adminSectionName = (section: string | null | undefined) =>
  adminSections.find((name) => adminSectionId(name) === section) || "General";
