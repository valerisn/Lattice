import { z } from "zod";
import { database } from "./db";
import { AppError } from "./errors";
import { digest, rateLimit } from "./security";
import { accountSchema, currentUser, createSession, insertUser } from "./auth";
interface Invite {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
}
export async function acceptInvite(body: unknown) {
  const { token } = z
    .object({ token: z.string().min(30).max(100) })
    .parse(body);
  const user = await currentUser();
  const db = await database();
  await rateLimit(db, "invitation-accept", 50);
  const userId = await db.transaction(async (tx) => {
    const [invite] = await tx.query<Invite>(
      "SELECT * FROM invites WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE",
      [digest(token)],
    );
    if (!invite)
      throw new AppError(
        404,
        "This invitation has expired or already been used.",
      );
    let id = user?.id;
    if (user && user.email !== invite.email)
      throw new AppError(
        403,
        `Sign in with the invited email address to accept this invitation.`,
      );
    if (!id) {
      const data = accountSchema.parse(body);
      if (data.email !== invite.email)
        throw new AppError(
          403,
          "Use the email address this invitation was sent to.",
        );
      id = await insertUser(tx, data);
    }
    await tx.query(
      "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [invite.workspace_id, id, invite.role],
    );
    await tx.query("UPDATE invites SET accepted_at=now() WHERE id=$1", [
      invite.id,
    ]);
    return id;
  });
  if (!user) await createSession(userId);
}
