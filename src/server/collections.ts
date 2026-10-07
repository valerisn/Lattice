import { z } from "zod";
import type { Database } from "./db";
import type { Workspace } from "@/shared/types";
import { canManage } from "@/shared/types";
import { AppError } from "./errors";
export async function createCollection(db: Database, workspace: Workspace, body: unknown) {
  if (!canManage(workspace.role)) throw new AppError(403, "Only workspace administrators can manage collections.");
  const data = z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(500).default(""), visibility: z.enum(["workspace","restricted"]).default("workspace") }).parse(body);
  const [collection] = await db.query("INSERT INTO collections(id,workspace_id,name,description,visibility) VALUES($1,$2,$3,$4,$5) RETURNING *", [crypto.randomUUID(), workspace.id, data.name, data.description, data.visibility]);
  return collection;
}
export async function updateCollection(db:Database,workspace:Workspace,id:string,body:unknown){
  if(!canManage(workspace.role))throw new AppError(403,"Administrator access required.");z.uuid().parse(id);const data=z.object({name:z.string().trim().min(1).max(80),description:z.string().max(500),visibility:z.enum(["workspace","restricted"])}).parse(body);const rows=await db.query("UPDATE collections SET name=$1,description=$2,visibility=$3 WHERE id=$4 AND workspace_id=$5 RETURNING id",[data.name,data.description,data.visibility,id,workspace.id]);if(!rows.length)throw new AppError(404,"Collection not found.");
}
export async function deleteCollection(db:Database,workspace:Workspace,id:string){if(!canManage(workspace.role))throw new AppError(403,"Administrator access required.");z.uuid().parse(id);await db.query("DELETE FROM collections WHERE id=$1 AND workspace_id=$2",[id,workspace.id]);}
