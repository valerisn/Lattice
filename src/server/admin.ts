import { z } from "zod";
import type { Database } from "./db";
import type { Workspace, User, Role } from "@/shared/types";
import { canManage } from "@/shared/types";
import { AppError } from "./errors";
import { newToken, digest } from "./security";
import { saveDocumentation } from "./documentation";
import { saveWorkspaceSettings } from "./workspace-settings";
import { installedVersion, lastUpdateCheck, checkForUpdates } from "./updates";

export async function adminRequest(
  request: Request,
  path: string[],
  db: Database,
  workspace: Workspace,
  user: User,
): Promise<Response | null> {
  const [resource, id] = path;
  const method = request.method;
  if (
    ![
      "admin",
      "members",
      "invites",
      "groups",
      "permissions",
      "updates",
      "documentation",
    ].includes(resource)
  )
    return null;
  if (resource === "members" && method === "GET")
    return Response.json(
      await db.query(
        "SELECT u.id,u.name,u.username,m.role FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name",
        [workspace.id],
      ),
    );
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can manage this workspace.");
  if (resource === "documentation" && method === "PATCH")
    return Response.json(
      await saveDocumentation(db, workspace, await request.json()),
    );
  if (resource === "updates" && method === "POST")
    return Response.json(await checkForUpdates(), {
      headers: { "Cache-Control": "no-store" },
    });
  if (resource === "admin" && method === "GET") {
    const members = await db.query(
      "SELECT u.id,u.name,u.email,u.username,u.avatar,m.role,m.joined_at FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name",
      [workspace.id],
    );
    const invites = await db.query(
      "SELECT id,email,role,expires_at,accepted_at FROM invites WHERE workspace_id=$1 ORDER BY created_at DESC",
      [workspace.id],
    );
    const groups = await db.query(
      "SELECT g.*,COALESCE((SELECT json_agg(gm.user_id) FROM group_members gm WHERE gm.group_id=g.id),'[]') AS members FROM groups g WHERE workspace_id=$1 ORDER BY name",
      [workspace.id],
    );
    const permissions = await db.query(
      "SELECT * FROM permissions WHERE workspace_id=$1",
      [workspace.id],
    );
    const [storage] = await db.query<{ count: string; bytes: string }>(
      "SELECT count(*) AS count,COALESCE(sum(size),0) AS bytes FROM attachments WHERE workspace_id=$1",
      [workspace.id],
    );
    return Response.json({
      members,
      invites,
      groups,
      permissions,
      storage,
      update: lastUpdateCheck(),
      system: {
        version: installedVersion,
        database: "Connected",
        storage: "Local filesystem",
        authentication: "Email and password",
      },
    });
  }
  if (resource === "admin" && method === "PATCH") {
    await saveWorkspaceSettings(db, workspace, await request.json());
    return Response.json({ ok: true });
  }
  if (resource === "invites" && method === "POST") {
    const data = z
      .object({
        email: z.email().transform((v) => v.toLowerCase()),
        role: z.enum(["admin", "editor", "viewer"]),
      })
      .parse(await request.json());
    if (data.role === "admin" && workspace.role !== "owner")
      throw new AppError(403, "Only owners can invite administrators.");
    const token = newToken();
    await db.query(
      "INSERT INTO invites(id,workspace_id,email,role,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')",
      [
        crypto.randomUUID(),
        workspace.id,
        data.email,
        data.role,
        digest(token),
        user.id,
      ],
    );
    return Response.json(
      {
        url: `${new URL(process.env.APP_URL || request.url).origin}/invite/${token}`,
      },
      { status: 201 },
    );
  }
  if (resource === "invites" && method === "DELETE") {
    z.uuid().parse(id);
    await db.query("DELETE FROM invites WHERE id=$1 AND workspace_id=$2", [
      id,
      workspace.id,
    ]);
    return Response.json({ ok: true });
  }
  if (resource === "members" && (method === "PATCH" || method === "DELETE")) {
    z.uuid().parse(id);
    const role =
      method === "PATCH"
        ? z
            .object({ role: z.enum(["owner", "admin", "editor", "viewer"]) })
            .parse(await request.json()).role
        : null;
    await db.transaction(async (tx) => {
      await tx.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [
        workspace.id,
      ]);
      const [target] = await tx.query<{ role: Role }>(
        "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
        [workspace.id, id],
      );
      if (!target) throw new AppError(404, "Member not found.");
      if (
        workspace.role !== "owner" &&
        (target.role === "owner" ||
          target.role === "admin" ||
          role === "owner" ||
          role === "admin")
      )
        throw new AppError(
          403,
          "Only owners can manage administrators and owners.",
        );
      if (target.role === "owner" && role !== "owner") {
        const owners = await tx.query(
          "SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND role='owner'",
          [workspace.id],
        );
        if (owners.length <= 1)
          throw new AppError(
            409,
            "The workspace must keep at least one owner.",
          );
      }
      if (role)
        await tx.query(
          "UPDATE workspace_members SET role=$1 WHERE workspace_id=$2 AND user_id=$3",
          [role, workspace.id, id],
        );
      else
        await tx.query(
          "DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
          [workspace.id, id],
        );
    });
    return Response.json({ ok: true });
  }
  if (resource === "groups" && method === "POST") {
    const { name } = z
      .object({ name: z.string().trim().min(1).max(80) })
      .parse(await request.json());
    await db.query(
      "INSERT INTO groups(id,workspace_id,name) VALUES($1,$2,$3)",
      [crypto.randomUUID(), workspace.id, name],
    );
    return Response.json({ ok: true }, { status: 201 });
  }
  if (resource === "groups" && method === "PATCH") {
    z.uuid().parse(id);
    const { members } = z
      .object({ members: z.array(z.uuid()).max(500) })
      .parse(await request.json());
    await db.transaction(async (tx) => {
      const found = await tx.query(
        "SELECT id FROM groups WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
        [id, workspace.id],
      );
      if (!found.length) throw new AppError(404, "Group not found.");
      await tx.query("DELETE FROM group_members WHERE group_id=$1", [id]);
      for (const member of new Set(members))
        await tx.query(
          "INSERT INTO group_members(workspace_id,group_id,user_id) VALUES($1,$2,$3)",
          [workspace.id, id, member],
        );
    });
    return Response.json({ ok: true });
  }
  if (resource === "groups" && method === "DELETE") {
    z.uuid().parse(id);
    await db.query("DELETE FROM groups WHERE id=$1 AND workspace_id=$2", [
      id,
      workspace.id,
    ]);
    return Response.json({ ok: true });
  }
  if (resource === "permissions" && method === "POST") {
    const data = z
      .object({
        page_id: z.uuid().nullable(),
        collection_id: z.uuid().nullable(),
        group_id: z.uuid().nullable(),
        user_id: z.uuid().nullable(),
        capability: z.enum(["read", "edit"]),
      })
      .refine(
        (d) =>
          Number(!!d.page_id) + Number(!!d.collection_id) === 1 &&
          Number(!!d.user_id) + Number(!!d.group_id) === 1,
        "Choose one resource and one member or group.",
      )
      .parse(await request.json());
    await db.query(
      "INSERT INTO permissions(id,workspace_id,page_id,collection_id,group_id,user_id,capability) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        crypto.randomUUID(),
        workspace.id,
        data.page_id,
        data.collection_id,
        data.group_id,
        data.user_id,
        data.capability,
      ],
    );
    return Response.json({ ok: true }, { status: 201 });
  }
  if (resource === "permissions" && method === "DELETE") {
    z.uuid().parse(id);
    await db.query("DELETE FROM permissions WHERE id=$1 AND workspace_id=$2", [
      id,
      workspace.id,
    ]);
    return Response.json({ ok: true });
  }
  throw new AppError(405, "Method not allowed.");
}
