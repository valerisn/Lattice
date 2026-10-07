import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { database } from "@/server/db";
import { checkOrigin, digest } from "@/server/security";
import { boundedRequest } from "@/server/body";
import { AppError, errorResponse } from "@/server/errors";
import { changePassword, revokeOtherSessions } from "@/server/sessions";
export async function GET() {
  try {
    const user = await requireUser();
    const db = await database();
    const hash = digest((await cookies()).get("lattice_session")?.value || "");
    const sessions = await db.query(
      "SELECT created_at,expires_at,(token_hash=$2) AS current FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC",
      [user.id, hash],
    );
    return Response.json({ user, sessions });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const db = await database();
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        username: z
          .string()
          .regex(
            /^[a-zA-Z0-9_-]{3,40}$/,
            "Username must be 3–40 letters, numbers, underscores, or hyphens.",
          ),
        avatar: z
          .string()
          .max(2000)
          .refine(
            (v) => !v || v.startsWith("https://"),
            "Use an HTTPS avatar URL.",
          ),
      })
      .parse(await (await boundedRequest(request, 16384)).json());
    await db.query(
      "UPDATE users SET name=$1,username=$2,avatar=$3 WHERE id=$4",
      [data.name, data.username, data.avatar || null, user.id],
    );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const db = await database();
    const data = z
      .object({
        action: z.enum(["password", "revoke"]),
        currentPassword: z.string().max(128).optional(),
        password: z.string().min(12).max(128).optional(),
      })
      .parse(await (await boundedRequest(request, 16384)).json());
    const current = digest(
      (await cookies()).get("lattice_session")?.value || "",
    );
    if (data.action === "password") {
      if (!data.currentPassword || !data.password)
        throw new AppError(400, "Your current password is incorrect.");
      await changePassword(
        db,
        user.id,
        current,
        data.currentPassword,
        data.password,
      );
    } else await revokeOtherSessions(db, user.id, current);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
