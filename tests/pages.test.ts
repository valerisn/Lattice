import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDatabase, migrate, type Database } from "../src/server/db";
import { createWorkspace, membership } from "../src/server/workspaces";
import { createPage, updatePage, deletePage, revisions, restoreRevision } from "../src/server/pages";
import { accessContext, requirePage } from "../src/server/permissions";
import { rateLimit } from "../src/server/security";
import type { Workspace, WikiPage } from "../src/shared/types";

describe("workspace services", () => {
  let client: PGlite; let db: Database; let workspace: Workspace; let page: WikiPage;
  const owner = crypto.randomUUID(); const viewer = crypto.randomUUID(); const stranger = crypto.randomUUID();
  beforeAll(async () => {
    client = new PGlite(); db = embeddedDatabase(client); await migrate(db); await migrate(db);
    for (const id of [owner, viewer, stranger]) await db.query("INSERT INTO users(id,email,name,username,password_hash) VALUES($1,$2,'Test',$1,'unused')", [id, `${id}@example.test`]);
    const id = await db.transaction(tx => createWorkspace(tx, owner, { name: "Test space", slug: "test-space" }));
    await db.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'viewer')", [id, viewer]);
    workspace = await membership(db, owner, id);
  });
  afterAll(async () => { await client.close(); });
  it("enforces membership and viewer restrictions", async () => {
    await expect(membership(db, stranger, workspace.id)).rejects.toThrow("Workspace not found");
    await expect(membership(db, viewer, workspace.id, "edit")).rejects.toThrow("permission");
    const view = await membership(db, viewer, workspace.id);
    await expect(createPage(db, view, viewer, { title: "Nope" })).rejects.toThrow("Viewers");
  });
  it("creates revisions, prevents lost updates, and restores with a new revision", async () => {
    page = await createPage(db, workspace, owner, { title: "A real page", content: "Original" });
    const original = page;
    page = await updatePage(db, workspace, owner, page.id, { ...page, content: "Changed" });
    await expect(updatePage(db, workspace, owner, page.id, { ...original, content: "Stale" })).rejects.toThrow("another session");
    const history = await revisions(db, workspace, owner, page.id);
    expect(history).toHaveLength(2);
    page = await restoreRevision(db, workspace, owner, page.id, { revisionId: history[1].id, version: page.version });
    expect(page.content).toBe("Original"); expect(page.version).toBe(3);
  });
  it("rejects tree cycles and cross-workspace parents", async () => {
    const child = await createPage(db, workspace, owner, { title: "Child", parent_id: page.id });
    await expect(updatePage(db, workspace, owner, page.id, { ...page, parent_id: child.id })).rejects.toThrow("inside itself");
    await expect(deletePage(db, workspace, owner, page.id)).rejects.toThrow("child pages");
    const otherId = await db.transaction(tx => createWorkspace(tx, owner, { name: "Other", slug: "other" }));
    const other = await membership(db, owner, otherId);
    await expect(createPage(db, other, owner, { title: "Wrong parent", parent_id: page.id })).rejects.toThrow("Parent page");
  });
  it("inherits page restrictions and hides drafts from viewers", async () => {
    await db.query("INSERT INTO permissions(id,workspace_id,page_id,user_id,capability) VALUES($1,$2,$3,$4,'read')", [crypto.randomUUID(), workspace.id, page.id, owner]);
    const view = await membership(db, viewer, workspace.id);
    await expect(requirePage(db, view, viewer, page.id)).rejects.toThrow("Page not found");
    const ctx = await accessContext(db, view, viewer);
    expect(ctx.pages.filter(p => p.parent_id === page.id).every(p => !ctx.allowed(p))).toBe(true);
    const draft = await createPage(db, workspace, owner, { title: "Draft", state: "draft" });
    await expect(requirePage(db, view, viewer, draft.id)).rejects.toThrow("Page not found");
  });
  it("uses durable rate limits", async () => {
    await rateLimit(db, "attempt", 1); await expect(rateLimit(db, "attempt", 1)).rejects.toThrow("Too many");
  });
});
