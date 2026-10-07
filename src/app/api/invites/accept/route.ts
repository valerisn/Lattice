import { checkOrigin } from "@/server/security";
import { errorResponse } from "@/server/errors";
import { acceptInvite } from "@/server/invites";
export async function POST(request:Request){try{checkOrigin(request);await acceptInvite(await request.json());return Response.json({ok:true});}catch(e){return errorResponse(e);}}
