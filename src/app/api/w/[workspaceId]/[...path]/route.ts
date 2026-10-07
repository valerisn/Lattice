import { z } from "zod";
import { requireUser } from "@/server/auth";
import { database } from "@/server/db";
import { AppError, errorResponse } from "@/server/errors";
import { checkOrigin } from "@/server/security";
import { membership } from "@/server/workspaces";
import { accessContext, requirePage } from "@/server/permissions";
import { createPage, updatePage, deletePage, revisions, restoreRevision } from "@/server/pages";
import { searchProvider } from "@/server/search";
import { createCollection,updateCollection,deleteCollection } from "@/server/collections";
import { adminRequest } from "@/server/admin";
import { boundedRequest } from "@/server/body";

type Context = { params: Promise<{ workspaceId: string; path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(); const db = await database();
    const { workspaceId, path } = await context.params;
    z.uuid().parse(workspaceId);
    const [resource, id, action] = path;
    const method = request.method;
    const workspace = await membership(db, user.id, workspaceId);
    request=await boundedRequest(request);
    const adminResponse = await adminRequest(request,path,db,workspace,user);
    if(adminResponse) return adminResponse;
    if (resource === "search" && method === "GET") return Response.json(await searchProvider.search(db, workspace, user.id, new URL(request.url).searchParams.get("q") || ""));
    if (resource === "collections" && method === "POST") return Response.json(await createCollection(db, workspace, await request.json()), { status: 201 });
    if(resource === "collections" && method === "PATCH" && id){await updateCollection(db,workspace,id,await request.json());return Response.json({ok:true});}
    if(resource === "collections" && method === "DELETE" && id){await deleteCollection(db,workspace,id);return Response.json({ok:true});}
    if (resource === "pages") {
      if (id) z.uuid().parse(id);
      if (method === "GET" && !id) { const ctx = await accessContext(db, workspace, user.id); return Response.json(ctx.pages.filter(p => ctx.allowed(p))); }
      if (method === "GET" && action === "revisions") return Response.json(await revisions(db, workspace, user.id, id));
      if (method === "GET" && id) return Response.json(await requirePage(db, workspace, user.id, id));
      if (method === "POST" && action === "favorite") {
        await requirePage(db, workspace, user.id, id);
        const { favorite } = z.object({ favorite: z.boolean() }).parse(await request.json());
        if (favorite) await db.query("INSERT INTO favorites(user_id,page_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [user.id, id]);
        else await db.query("DELETE FROM favorites WHERE user_id=$1 AND page_id=$2", [user.id, id]);
        return Response.json({ ok: true });
      }
      if (method === "POST" && action === "restore") return Response.json(await restoreRevision(db, workspace, user.id, id, await request.json()));
      if (method === "POST" && !id) return Response.json(await createPage(db, workspace, user.id, await request.json()), { status: 201 });
      if (method === "PATCH" && id && !action) return Response.json(await updatePage(db, workspace, user.id, id, await request.json()));
      if (method === "DELETE" && id && !action) { await deletePage(db, workspace, user.id, id); return Response.json({ ok: true }); }
    }
    throw new AppError(404, "Not found.");
  } catch (error) { return errorResponse(error); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
