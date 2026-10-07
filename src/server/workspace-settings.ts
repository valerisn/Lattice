import { z } from "zod";
import type { Database } from "./db";
import type { Workspace } from "@/shared/types";
import { canManage } from "@/shared/types";
import { AppError } from "./errors";

const settingsPatch = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logo: z
      .string()
      .max(2000)
      .refine(
        (v) =>
          !v ||
          v.startsWith("https://") ||
          /^\/api\/attachments\/[0-9a-f-]+$/.test(v),
        "Use an HTTPS image URL or uploaded attachment.",
      )
      .transform((v) => v || null),
    homepage_id: z.uuid().nullable(),
    upload_limit: z.number().int().min(1024).max(52428800),
  })
  .partial();

export async function saveWorkspaceSettings(
  db: Database,
  workspace: Workspace,
  body: unknown,
) {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can manage this workspace.");
  const data = settingsPatch.parse(body);
  const entries = Object.entries(data);
  if (!entries.length)
    throw new AppError(400, "Provide at least one setting to update.");
  if (
    data.homepage_id &&
    !(
      await db.query("SELECT id FROM pages WHERE id=$1 AND workspace_id=$2", [
        data.homepage_id,
        workspace.id,
      ])
    ).length
  )
    throw new AppError(400, "Homepage must belong to this workspace.");
  // Column names come exclusively from the schema, never the original request keys.
  await db.query(
    `UPDATE workspaces SET ${entries.map(([key], index) => `${key}=$${index + 1}`).join(",")} WHERE id=$${entries.length + 1}`,
    [...entries.map(([, value]) => value), workspace.id],
  );
}
