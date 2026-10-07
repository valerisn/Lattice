import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDatabase, migrate, type Database } from "../src/server/db";
import { createWorkspace, membership } from "../src/server/workspaces";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplate,
} from "../src/server/templates";
import { createPage } from "../src/server/pages";
import { requirePage } from "../src/server/permissions";
import type { Workspace } from "../src/shared/types";

describe("workspace page templates", () => {
  let client: PGlite;
  let db: Database;
  let workspace: Workspace;
  const owner = crypto.randomUUID();
  beforeAll(async () => {
    client = new PGlite();
    db = embeddedDatabase(client);
    await migrate(db);
    await db.query(
      "INSERT INTO users(id,email,name,username,password_hash) VALUES($1,'templates@example.test','Templates','templates','unused')",
      [owner],
    );
    workspace = await membership(
      db,
      owner,
      await createWorkspace(db, owner, {
        name: "Templates",
        slug: "templates",
      }),
    );
  });
  afterAll(async () => {
    await client.close();
  });
  it("allows administrators to manage templates and writers to use them", async () => {
    const template = await createTemplate(db, workspace, {
      name: "Runbook",
      content: "## Procedure\n\n- [ ] Verify the service",
    });
    const editor = { ...workspace, role: "editor" as const };
    expect(await listTemplates(db, editor)).toHaveLength(1);
    const page = await createPage(db, editor, owner, {
      title: "Service runbook",
      template_id: template.id,
    });
    expect(page.content).toBe(template.content);
    await updateTemplate(db, workspace, template.id, {
      name: "Runbook",
      content: "New starting point",
      version: template.version,
    });
    await expect(
      updateTemplate(db, workspace, template.id, {
        name: "Runbook",
        content: "Stale text",
        version: template.version,
      }),
    ).rejects.toThrow("another session");
    expect((await requirePage(db, workspace, owner, page.id)).content).toBe(
      template.content,
    );
    expect(
      (
        await createPage(db, editor, owner, {
          title: "Explicit content",
          template_id: template.id,
          content: "",
        })
      ).content,
    ).toBe("");
    await expect(
      createTemplate(db, editor, { name: "Forbidden", content: "" }),
    ).rejects.toThrow("administrators");
    await expect(deleteTemplate(db, editor, template.id)).rejects.toThrow(
      "administrators",
    );
    await deleteTemplate(db, workspace, template.id);
    expect((await requirePage(db, workspace, owner, page.id)).content).toBe(
      template.content,
    );
    await expect(getTemplate(db, workspace, template.id)).rejects.toThrow(
      "not found",
    );
  });
  it("rejects viewers and templates from another workspace", async () => {
    const template = await createTemplate(db, workspace, {
      name: "Private template",
      content: "Team-only content",
    });
    await expect(
      listTemplates(db, { ...workspace, role: "viewer" }),
    ).rejects.toThrow("writers");
    const other = await membership(
      db,
      owner,
      await createWorkspace(db, owner, {
        name: "Other",
        slug: "template-other",
      }),
    );
    await expect(
      createPage(db, other, owner, {
        title: "Cross-workspace",
        template_id: template.id,
      }),
    ).rejects.toThrow("not found");
    await expect(
      createTemplate(db, workspace, {
        name: "Too long",
        content: "x".repeat(500001),
      }),
    ).rejects.toThrow();
  });
});
