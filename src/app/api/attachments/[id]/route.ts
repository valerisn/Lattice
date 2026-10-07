import { z } from "zod";
import { database } from "@/server/db";
import { requireUser } from "@/server/auth";
import { membership } from "@/server/workspaces";
import { requirePage } from "@/server/permissions";
import { errorResponse,AppError } from "@/server/errors";
import { checkOrigin } from "@/server/security";
import { storage } from "@/server/storage";
type Context={params:Promise<{id:string}>};
async function handle(request:Request,{params}:Context){try{checkOrigin(request);const user=await requireUser();const db=await database();const {id}=await params;z.uuid().parse(id);const [file]=await db.query<{name:string;mime:string;storage_key:string;workspace_id:string;page_id:string}>("SELECT * FROM attachments WHERE id=$1",[id]);if(!file)throw new AppError(404,"Attachment not found.");const workspace=await membership(db,user.id,file.workspace_id);await requirePage(db,workspace,user.id,file.page_id,request.method==="DELETE" ? "edit" : "read");if(request.method==="DELETE"){await db.query("DELETE FROM attachments WHERE id=$1",[id]);await storage.remove(file.storage_key);return Response.json({ok:true});}const bytes=await storage.get(file.storage_key);return new Response(bytes as BodyInit,{headers:{"Content-Type":file.mime,"Content-Disposition":`${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});}catch(e){return errorResponse(e);}}
export {handle as GET,handle as DELETE};
