import { z } from "zod";
import { database } from "@/server/db";
import { requireUser } from "@/server/auth";
import { membership } from "@/server/workspaces";
import { requirePage } from "@/server/permissions";
import { errorResponse, AppError } from "@/server/errors";
import { checkOrigin, rateLimit } from "@/server/security";
import { storage, detectMime } from "@/server/storage";
import { boundedRequest } from "@/server/body";
type Context = { params: Promise<{ workspaceId: string; pageId: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const db = await database();
    const { workspaceId, pageId } = await params;
    z.uuid().parse(workspaceId);
    z.uuid().parse(pageId);
    const workspace = await membership(db, user.id, workspaceId);
    await requirePage(db, workspace, user.id, pageId);
    return Response.json(
      await db.query(
        "SELECT id,name,mime,size,created_at FROM attachments WHERE page_id=$1 ORDER BY created_at",
        [pageId],
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const db = await database();
    const { workspaceId, pageId } = await params;
    z.uuid().parse(workspaceId);
    z.uuid().parse(pageId);
    const workspace = await membership(db, user.id, workspaceId, "edit");
    await requirePage(db, workspace, user.id, pageId, "edit");
    await rateLimit(db, `upload:${user.id}`, 60, 3600);
    const form = await (
      await boundedRequest(request, workspace.upload_limit + 16384)
    ).formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > workspace.upload_limit
    )
      throw new AppError(
        400,
        "Choose a non-empty file within the workspace upload limit.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 200);
    const mime = detectMime(bytes, name);
    if (!mime)
      throw new AppError(
        400,
        "Supported files: PNG, JPEG, GIF, WebP, PDF, and plain text documents.",
      );
    const id = crypto.randomUUID();
    await storage.put(id, bytes);
    try {
      await db.query(
        "INSERT INTO attachments(id,workspace_id,page_id,name,storage_key,mime,size,uploaded_by) VALUES($1,$2,$3,$4,$8,$5,$6,$7)",
        [id, workspaceId, pageId, name, mime, file.size, user.id, id],
      );
    } catch (e) {
      await storage.remove(id);
      throw e;
    }
    return Response.json(
      { id, name, mime, size: file.size, url: `/api/attachments/${id}` },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
