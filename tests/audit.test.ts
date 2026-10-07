import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDatabase, migrate, type Database } from "../src/server/db";
import { createWorkspace, membership } from "../src/server/workspaces";
import { adminRequest } from "../src/server/admin";
import { listAuditEvents } from "../src/server/audit";
import type { User, Workspace } from "../src/shared/types";

describe("administrator audit log", () => {
  let client: PGlite;
  let db: Database;
  let workspace: Workspace;
  const owner: User = {
    id: crypto.randomUUID(),
    email: "audit@example.test",
    name: "Audit Owner",
    username: "audit-owner",
    avatar: null,
    created_at: new Date().toISOString(),
  };
  const request = (method: string, body?: unknown) =>
    new Request("https://lattice.example/api/admin", {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  beforeAll(async () => {
    client = new PGlite();
    db = embeddedDatabase(client);
    await migrate(db);
    await db.query(
      "INSERT INTO users(id,email,name,username,password_hash) VALUES($1,$2,$3,$4,'unused')",
      [owner.id, owner.email, owner.name, owner.username],
    );
    const id = await createWorkspace(db, owner.id, {
      name: "Audit space",
      slug: "audit-space",
    });
    workspace = await membership(db, owner.id, id);
  });
  afterAll(async () => {
    await client.close();
  });

  it("records settings and nested group changes with the actor", async () => {
    await adminRequest(
      request("PATCH", { footer_text: "A shared handbook" }),
      ["documentation"],
      db,
      workspace,
      owner,
    );
    await adminRequest(
      request("POST", { name: "Writers" }),
      ["groups"],
      db,
      workspace,
      owner,
    );
    const [group] = await db.query<{ id: string }>(
      "SELECT id FROM groups WHERE workspace_id=$1",
      [workspace.id],
    );
    await adminRequest(
      request("PATCH", { members: [owner.id] }),
      ["groups", group.id],
      db,
      workspace,
      owner,
    );
    const result = await listAuditEvents(db, workspace, null);
    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toMatchObject({
      actor_name: owner.name,
      action: "groups.PATCH",
      target: "Writers",
    });
    expect(
      result.events.some((event) => event.action === "documentation.PATCH"),
    ).toBe(true);
  });
  it("does not log failed or denied operations", async () => {
    await expect(
      adminRequest(
        request("DELETE"),
        ["groups", crypto.randomUUID()],
        db,
        workspace,
        owner,
      ),
    ).rejects.toThrow("not found");
    await expect(
      adminRequest(
        request("PATCH", { footer_text: false }),
        ["documentation"],
        db,
        workspace,
        owner,
      ),
    ).rejects.toThrow();
    await expect(
      adminRequest(
        request("PATCH", { name: "Forbidden" }),
        ["admin"],
        db,
        { ...workspace, role: "viewer" },
        owner,
      ),
    ).rejects.toThrow("administrators");
    await expect(
      listAuditEvents(db, { ...workspace, role: "viewer" }, null),
    ).rejects.toThrow("administrators");
    expect((await listAuditEvents(db, workspace, null)).events).toHaveLength(3);
  });
  it("rolls back the administrative change and audit event together", async () => {
    await expect(
      db.transaction(async (tx) => {
        await adminRequest(
          request("PATCH", { name: "Rolled back" }),
          ["admin"],
          tx,
          workspace,
          owner,
        );
        throw new Error("Rollback");
      }),
    ).rejects.toThrow("Rollback");
    expect((await membership(db, owner.id, workspace.id)).name).toBe(
      workspace.name,
    );
    expect((await listAuditEvents(db, workspace, null)).events).toHaveLength(3);
  });
  it("paginates equal timestamps without duplicates and isolates workspaces", async () => {
    await db.query(
      "INSERT INTO audit_events(id,workspace_id,actor_id,actor_name,action,target) SELECT gen_random_uuid(),$1,$2,'Audit Owner','admin.PATCH','Fixture' FROM generate_series(1,102)",
      [workspace.id, owner.id],
    );
    const first = await listAuditEvents(db, workspace, null);
    expect(first.events).toHaveLength(50);
    const second = await listAuditEvents(db, workspace, first.nextCursor);
    const third = await listAuditEvents(db, workspace, second.nextCursor);
    expect(
      new Set(
        [...first.events, ...second.events, ...third.events].map(
          (event) => event.id,
        ),
      ).size,
    ).toBe(105);
    expect(third.nextCursor).toBeNull();
    const otherId = await createWorkspace(db, owner.id, {
      name: "Other",
      slug: "audit-other",
    });
    const other = await membership(db, owner.id, otherId);
    expect((await listAuditEvents(db, other, null)).events).toHaveLength(0);
    await expect(listAuditEvents(db, other, first.nextCursor)).rejects.toThrow(
      "cursor",
    );
  });
  it("filters the complete history with literal text, action, and stable pagination", async () => {
    const id = await createWorkspace(db, owner.id, {
      name: "Filtered history",
      slug: "filtered-history",
    });
    const filtered = await membership(db, owner.id, id);
    await db.query(
      "INSERT INTO audit_events(id,workspace_id,actor_id,actor_name,action,target) SELECT gen_random_uuid(),$1,$2,'Alice','templates.POST','Guide ' || i FROM generate_series(1,60) AS i",
      [id, owner.id],
    );
    await db.query(
      "INSERT INTO audit_events(id,workspace_id,actor_id,actor_name,action,target) VALUES(gen_random_uuid(),$1,$2,'Bob','admin.PATCH','100% _ready')",
      [id, owner.id],
    );
    const filters = { action: "templates.POST", query: "aLiCe" };
    const first = await listAuditEvents(db, filtered, null, filters);
    const second = await listAuditEvents(
      db,
      filtered,
      first.nextCursor,
      filters,
    );
    expect(first.events).toHaveLength(50);
    expect(second.events).toHaveLength(10);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.events, ...second.events].map((event) => event.id))
        .size,
    ).toBe(60);
    expect(
      (await listAuditEvents(db, filtered, null, { query: "% _" })).events,
    ).toHaveLength(1);
    expect(
      (await listAuditEvents(db, filtered, null, { query: "' OR 1=1 --" }))
        .events,
    ).toHaveLength(0);
    expect(
      (await listAuditEvents(db, workspace, null, { query: "Guide" })).events,
    ).toHaveLength(0);
    await expect(
      listAuditEvents(db, filtered, null, { action: "unknown" }),
    ).rejects.toThrow("Unknown audit action");
    await expect(
      listAuditEvents(db, filtered, null, { query: "x".repeat(201) }),
    ).rejects.toThrow();
    const response = await adminRequest(
      new Request(`https://lattice.example/api/audit?action=admin.PATCH&q=Bob`),
      ["audit"],
      db,
      filtered,
      owner,
    );
    expect((await response!.json()).events).toHaveLength(1);
  });
});
