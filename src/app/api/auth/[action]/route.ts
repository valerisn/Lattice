import { checkOrigin, rateLimit } from "@/server/security";
import { errorResponse, AppError } from "@/server/errors";
import { login, logout } from "@/server/auth";
import { setup } from "@/server/workspaces";
import { database } from "@/server/db";
import { boundedRequest } from "@/server/body";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const { action } = await params;
    if (action === "logout") {
      await logout();
      return Response.json({ ok: true });
    }
    if (Number(request.headers.get("content-length")) > 16384)
      throw new AppError(413, "Request too large.");
    const body: unknown = await (await boundedRequest(request, 16384)).json();
    if (action === "login") {
      await login(body);
      return Response.json({ ok: true });
    }
    if (action === "setup") {
      await rateLimit(await database(), "setup", 20);
      return Response.json(await setup(body), { status: 201 });
    }
    throw new AppError(404, "Not found.");
  } catch (error) {
    return errorResponse(error);
  }
}
