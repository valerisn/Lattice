import type { Database } from "./db";
import { AppError } from "./errors";
import {
  canManage,
  type WikiPage,
  type Workspace,
  type Collection,
} from "@/shared/types";

interface Grant {
  page_id: string | null;
  collection_id: string | null;
  capability: "read" | "edit";
  applies: boolean;
}
export async function accessContext(
  db: Database,
  workspace: Workspace,
  userId: string,
) {
  const pages = await db.query<WikiPage>(
    `SELECT p.*,u.name AS author,EXISTS(SELECT 1 FROM favorites f WHERE f.page_id=p.id AND f.user_id=$2) AS favorite
    FROM pages p JOIN users u ON u.id=p.updated_by WHERE p.workspace_id=$1 ORDER BY p.position,p.created_at`,
    [workspace.id, userId],
  );
  const collections = await db.query<Collection>(
    "SELECT * FROM collections WHERE workspace_id=$1 ORDER BY name",
    [workspace.id],
  );
  const grants = await db.query<Grant>(
    `SELECT p.page_id,p.collection_id,p.capability,(p.user_id=$2 OR p.group_id IN(SELECT group_id FROM group_members WHERE user_id=$2 AND workspace_id=$1)) IS TRUE AS applies FROM permissions p WHERE p.workspace_id=$1`,
    [workspace.id, userId],
  );
  const byId = new Map(pages.map((p) => [p.id, p]));
  const allowedCollection = (
    collectionId: string | null,
    action: "read" | "edit" = "read",
  ) => {
    if (!collectionId || canManage(workspace.role)) return true;
    const rules = grants.filter((g) => g.collection_id === collectionId);
    const restricted =
      collections.find((c) => c.id === collectionId)?.visibility ===
      "restricted";
    return (
      (!restricted && !rules.length) ||
      rules.some(
        (g) => g.applies && (action === "read" || g.capability === "edit"),
      )
    );
  };
  const allowed = (page: WikiPage, action: "read" | "edit" = "read") => {
    if (canManage(workspace.role)) return true;
    if (action === "edit" && workspace.role === "viewer") return false;
    const visited = new Set<string>();
    let current: WikiPage | undefined = page;
    while (current) {
      if (visited.has(current.id)) return false;
      visited.add(current.id);
      if (current.state === "draft" && workspace.role === "viewer")
        return false;
      if (!allowedCollection(current.collection_id, action)) return false;
      const rules = grants.filter((g) => g.page_id === current!.id);
      if (
        rules.length &&
        !rules.some(
          (g) => g.applies && (action === "read" || g.capability === "edit"),
        )
      )
        return false;
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return true;
  };
  return { pages, collections, allowed, allowedCollection };
}
export async function requirePage(
  db: Database,
  workspace: Workspace,
  userId: string,
  pageId: string,
  action: "read" | "edit" = "read",
) {
  const context = await accessContext(db, workspace, userId);
  const page = context.pages.find((p) => p.id === pageId);
  if (!page || !context.allowed(page, "read"))
    throw new AppError(404, "Page not found.");
  if (!context.allowed(page, action))
    throw new AppError(403, "You cannot edit this page.");
  return page;
}
