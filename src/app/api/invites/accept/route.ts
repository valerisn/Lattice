import { checkOrigin } from "@/server/security";
import { errorResponse } from "@/server/errors";
import { acceptInvite } from "@/server/invites";
import { boundedRequest } from "@/server/body";
export async function POST(request:Request){try{checkOrigin(request);await acceptInvite(await (await boundedRequest(request,16384)).json());return Response.json({ok:true});}catch(e){return errorResponse(e);}}
