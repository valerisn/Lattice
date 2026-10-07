import { z } from "zod";
import type { Database } from "./db";
import { AppError } from "./errors";
import type { AuditEvent, AuditPage } from "@/shared/audit";
import { auditActions } from "@/shared/audit";
import type { Workspace, User } from "@/shared/types";
import { canManage } from "@/shared/types";

export async function listAuditEvents(
  db: Database,
  workspace: Workspace,
  cursor: string | null,
  filters: unknown = {},
): Promise<AuditPage> {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can read the audit log.");
  const { action, query } = z
    .object({
      action: z
        .string()
        .refine(
          (value) => value === "" || Object.hasOwn(auditActions, value),
          "Unknown audit action",
        )
        .default(""),
      query: z.string().trim().max(200).default(""),
    })
    .strict()
    .parse(filters);
  if (cursor) {
    z.uuid().parse(cursor);
    if (
      !(
        await db.query(
          "SELECT id FROM audit_events WHERE id=$1 AND workspace_id=$2",
          [cursor, workspace.id],
        )
      ).length
    )
      throw new AppError(400, "Invalid audit cursor.");
  }
  const values: unknown[] = [workspace.id];
  const conditions = ["workspace_id=$1"];
  if (cursor) {
    values.push(cursor);
    conditions.push(
      `(created_at,id) < (SELECT created_at,id FROM audit_events WHERE id=$${values.length} AND workspace_id=$1)`,
    );
  }
  if (action) {
    values.push(action);
    conditions.push(`action=$${values.length}`);
  }
  if (query) {
    values.push(query);
    conditions.push(
      `strpos(lower(actor_name || ' ' || target),lower($${values.length})) > 0`,
    );
  }
  const rows = await db.query<AuditEvent>(
    `SELECT id,actor_name,action,target,created_at FROM audit_events WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT 51`,
    values,
  );
  const events = rows.slice(0, 50);
  return { events, nextCursor: rows.length > 50 ? events[49].id : null };
}

export async function writeAuditEvent(
  db: Database,
  workspace: Workspace,
  user: User,
  action: string,
  target: string,
) {
  await db.query(
    "INSERT INTO audit_events(id,workspace_id,actor_id,actor_name,action,target) VALUES($1,$2,$3,$4,$5,$6)",
    [
      crypto.randomUUID(),
      workspace.id,
      user.id,
      user.name,
      action,
      target.slice(0, 250),
    ],
  );
}

export async function auditTarget(
  db: Database,
  workspace: Workspace,
  resource: string,
  id: string | undefined,
  body: Record<string, unknown>,
) {
  if (resource === "admin" || resource === "documentation")
    return workspace.name;
  if (resource === "invites" && typeof body.email === "string")
    return body.email;
  if (
    (resource === "groups" || resource === "templates") &&
    typeof body.name === "string"
  )
    return body.name;
  if (!id || !z.uuid().safeParse(id).success) return "Workspace access";
  const queries: Record<string, string> = {
    templates:
      "SELECT name AS label FROM page_templates WHERE id=$1 AND workspace_id=$2",
    members:
      "SELECT u.name AS label FROM users u JOIN workspace_members m ON m.user_id=u.id WHERE u.id=$1 AND m.workspace_id=$2",
    groups: "SELECT name AS label FROM groups WHERE id=$1 AND workspace_id=$2",
    invites:
      "SELECT email AS label FROM invites WHERE id=$1 AND workspace_id=$2",
    permissions:
      "SELECT COALESCE(p.title,c.name) AS label FROM permissions g LEFT JOIN pages p ON p.id=g.page_id LEFT JOIN collections c ON c.id=g.collection_id WHERE g.id=$1 AND g.workspace_id=$2",
  };
  const sql = queries[resource];
  if (!sql) return "Workspace access";
  const [row] = await db.query<{ label: string }>(sql, [id, workspace.id]);
  return row?.label || "Workspace access";
}
