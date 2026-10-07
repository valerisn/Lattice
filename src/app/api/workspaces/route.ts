import { requireUser } from "@/server/auth";
import { database } from "@/server/db";
import { errorResponse } from "@/server/errors";
import { checkOrigin } from "@/server/security";
import { workspaceSchema, createWorkspace, listWorkspaces } from "@/server/workspaces";
export async function GET() { try { const user = await requireUser(); return Response.json(await listWorkspaces(await database(), user.id)); } catch (e) { return errorResponse(e); } }
export async function POST(request: Request) { try { checkOrigin(request); const user = await requireUser(); const data = workspaceSchema.parse(await request.json()); const db = await database(); return Response.json({ id: await db.transaction(tx => createWorkspace(tx, user.id, data)), slug: data.slug }, { status: 201 }); } catch (e) { return errorResponse(e); } }
