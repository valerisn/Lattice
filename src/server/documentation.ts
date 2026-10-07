import { z } from "zod";
import type { Database } from "./db";
import type { Workspace } from "@/shared/types";
import { canManage } from "@/shared/types";
import { AppError } from "./errors";
import {
  documentationSettings,
  type DocumentationSettings,
} from "@/shared/documentation";

const documentationPatch = z
  .object({
    default_state: z.enum(["draft", "published"]),
    reading_width: z.enum(["comfortable", "wide"]),
    show_toc: z.boolean(),
    show_author: z.boolean(),
    show_updated: z.boolean(),
    show_reading_time: z.boolean(),
    footer_text: z.string().trim().max(200),
  })
  .partial()
  .strict();

export async function saveDocumentation(
  db: Database,
  workspace: Workspace,
  body: unknown,
) {
  if (!canManage(workspace.role))
    throw new AppError(403, "Only administrators can configure documentation.");
  const data = documentationPatch.parse(body);
  const [updated] = await db.query<{
    documentation: Partial<DocumentationSettings>;
  }>(
    "UPDATE workspaces SET documentation=documentation || $1::jsonb WHERE id=$2 RETURNING documentation",
    [JSON.stringify(data), workspace.id],
  );
  return documentationSettings(updated.documentation);
}
