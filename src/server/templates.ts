import { z } from "zod";
import type { Database } from "./db";
import type { Workspace } from "@/shared/types";
import { canManage, canEdit } from "@/shared/types";
import type { PageTemplate, TemplateSummary } from "@/shared/templates";
import { AppError } from "./errors";

const templateInput = z.object({
  name: z.string().trim().min(1).max(80),
  content: z.string().max(500000),
});

export async function listTemplates(db: Database, workspace: Workspace) {
  if (!canEdit(workspace.role))
    throw new AppError(403, "Only writers can use page templates.");
  return db.query<TemplateSummary>(
    "SELECT id,name,version,updated_at FROM page_templates WHERE workspace_id=$1 ORDER BY name",
    [workspace.id],
  );
}

export async function getTemplate(
  db: Database,
  workspace: Workspace,
  id: string,
) {
  if (!canEdit(workspace.role))
    throw new AppError(403, "Only writers can use page templates.");
  z.uuid().parse(id);
  const [template] = await db.query<PageTemplate>(
    "SELECT id,name,content,version,created_at,updated_at FROM page_templates WHERE id=$1 AND workspace_id=$2",
    [id, workspace.id],
  );
  if (!template) throw new AppError(404, "Template not found.");
  return template;
}

export async function createTemplate(
  db: Database,
  workspace: Workspace,
  body: unknown,
) {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can manage templates.");
  const data = templateInput.parse(body);
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [
      workspace.id,
    ]);
    const [count] = await tx.query<{ count: string }>(
      "SELECT count(*) AS count FROM page_templates WHERE workspace_id=$1",
      [workspace.id],
    );
    if (Number(count.count) >= 100)
      throw new AppError(400, "A workspace can have up to 100 templates.");
    const [template] = await tx.query<PageTemplate>(
      "INSERT INTO page_templates(id,workspace_id,name,content) VALUES($1,$2,$3,$4) RETURNING id,name,content,version,created_at,updated_at",
      [crypto.randomUUID(), workspace.id, data.name, data.content],
    );
    return template;
  });
}

export async function updateTemplate(
  db: Database,
  workspace: Workspace,
  id: string,
  body: unknown,
) {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can manage templates.");
  z.uuid().parse(id);
  const data = templateInput
    .extend({ version: z.number().int().positive() })
    .parse(body);
  await getTemplate(db, workspace, id);
  const [template] = await db.query<PageTemplate>(
    "UPDATE page_templates SET name=$1,content=$2,version=version+1,updated_at=now() WHERE id=$3 AND workspace_id=$4 AND version=$5 RETURNING id,name,content,version,created_at,updated_at",
    [data.name, data.content, id, workspace.id, data.version],
  );
  if (!template)
    throw new AppError(
      409,
      "This template changed in another session. Copy your changes and reopen it before saving.",
    );
  return template;
}

export async function deleteTemplate(
  db: Database,
  workspace: Workspace,
  id: string,
) {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can manage templates.");
  z.uuid().parse(id);
  const removed = await db.query(
    "DELETE FROM page_templates WHERE id=$1 AND workspace_id=$2 RETURNING id",
    [id, workspace.id],
  );
  if (!removed.length) throw new AppError(404, "Template not found.");
}
