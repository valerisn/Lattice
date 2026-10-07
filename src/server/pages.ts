import { z } from "zod";
import type { Database } from "./db";
import type { Workspace, WikiPage, Revision } from "@/shared/types";
import { requirePage, accessContext } from "./permissions";
import { AppError } from "./errors";

export const pageInput = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().max(500).default(""), content: z.string().max(500000).default(""),
  parent_id: z.uuid().nullable().default(null), collection_id: z.uuid().nullable().default(null),
  state: z.enum(["draft", "published"]).default("published"), position: z.number().int().min(0).max(100000).default(0),
});
export const pageUpdate = pageInput.extend({ version: z.number().int().positive(), summary: z.string().max(200).default("") });
const slugify = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,80) || "page";
async function validateLocation(db: Database, workspace: Workspace, userId: string, parentId: string | null, collectionId: string | null, pageId?: string) {
  const ctx = await accessContext(db, workspace, userId);
  if (collectionId && (!ctx.collections.some(c => c.id === collectionId) || !ctx.allowedCollection(collectionId, "edit"))) throw new AppError(403, "Collection is not available.");
  if (!parentId) return;
  let parent = ctx.pages.find(p => p.id === parentId);
  if (!parent || !ctx.allowed(parent, "edit")) throw new AppError(403, "Parent page is not available.");
  const seen = new Set<string>();
  while (parent) {
    if (parent.id === pageId || seen.has(parent.id)) throw new AppError(400, "A page cannot be nested inside itself.");
    seen.add(parent.id);
    parent = ctx.pages.find(p => p.id === parent?.parent_id);
  }
}
async function revision(db: Database, page: WikiPage, userId: string, summary: string) {
  await db.query("INSERT INTO page_revisions(id,page_id,version,title,description,content,editor_id,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(), page.id, page.version, page.title, page.description, page.content, userId, summary]);
}
export async function createPage(db: Database, workspace: Workspace, userId: string, body: unknown) {
  const data = pageInput.parse(body);
  if (workspace.role === "viewer") throw new AppError(403, "Viewers cannot create pages.");
  return db.transaction(async tx => {
    await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [workspace.id]);
    await validateLocation(tx, workspace, userId, data.parent_id, data.collection_id);
    const id = crypto.randomUUID();
    const [page] = await tx.query<WikiPage>("INSERT INTO pages(id,workspace_id,title,slug,description,content,parent_id,collection_id,state,position,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *", [id, workspace.id, data.title, `${slugify(data.title)}-${id.slice(0,8)}`, data.description, data.content, data.parent_id, data.collection_id, data.state, data.position, userId]);
    await revision(tx, page, userId, "Created page");
    return page;
  });
}
export async function updatePage(db: Database, workspace: Workspace, userId: string, pageId: string, body: unknown) {
  const data = pageUpdate.parse(body);
  return db.transaction(async tx => {
    await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [workspace.id]);
    const current = await requirePage(tx, workspace, userId, pageId, "edit");
    if (current.version !== data.version) throw new AppError(409, "This page changed in another session. Copy your changes, then reload before saving.");
    await validateLocation(tx, workspace, userId, data.parent_id, data.collection_id, pageId);
    const [page] = await tx.query<WikiPage>("UPDATE pages SET title=$1,description=$2,content=$3,parent_id=$4,collection_id=$5,state=$6,position=$7,updated_by=$8,updated_at=now(),version=version+1 WHERE id=$9 AND workspace_id=$10 RETURNING *", [data.title, data.description, data.content, data.parent_id, data.collection_id, data.state, data.position, userId, pageId, workspace.id]);
    await revision(tx, page, userId, data.summary);
    return page;
  });
}
export async function deletePage(db: Database, workspace: Workspace, userId: string, pageId: string) {
  return db.transaction(async tx => {
    await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [workspace.id]);
    await requirePage(tx, workspace, userId, pageId, "edit");
    const children = await tx.query("SELECT id FROM pages WHERE parent_id=$1", [pageId]);
    if (children.length) throw new AppError(409, "Move or delete child pages first.");
    await tx.query("UPDATE workspaces SET homepage_id=NULL WHERE homepage_id=$1", [pageId]);
    await tx.query("DELETE FROM pages WHERE id=$1", [pageId]);
  });
}
export async function revisions(db: Database, workspace: Workspace, userId: string, pageId: string) {
  await requirePage(db, workspace, userId, pageId);
  return db.query<Revision>("SELECT r.*,u.name AS editor FROM page_revisions r JOIN users u ON u.id=r.editor_id WHERE r.page_id=$1 ORDER BY r.version DESC LIMIT 100", [pageId]);
}
export async function restoreRevision(db: Database, workspace: Workspace, userId: string, pageId: string, body: unknown) {
  const { revisionId, version } = z.object({ revisionId: z.uuid(), version: z.number().int().positive() }).parse(body);
  const page = await requirePage(db, workspace, userId, pageId, "edit");
  const [old] = await db.query<Revision>("SELECT * FROM page_revisions WHERE page_id=$1 AND id=$2", [pageId, revisionId]);
  if (!old) throw new AppError(404, "Revision not found.");
  return updatePage(db, workspace, userId, pageId, { ...page, title: old.title, description: old.description, content: old.content, version, summary: `Restored version ${old.version}` });
}
