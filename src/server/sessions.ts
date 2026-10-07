import type { Database } from "./db";
import { AppError } from "./errors";
import { hashPassword, rateLimit, verifyPassword } from "./security";

export interface PasswordProof {
  expectedHash: string;
  replacementHash?: string;
}

export async function insertSession(
  db: Database,
  userId: string,
  tokenHash: string,
  proof?: PasswordProof,
) {
  await db.transaction(async (tx) => {
    // Password changes take this same lock. A login verified against the old
    // password must not slip in after the session revocation has committed.
    const [user] = await tx.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
      [userId],
    );
    if (!user || (proof && user.password_hash !== proof.expectedHash))
      throw new AppError(401, "Email or password is incorrect.");
    if (proof?.replacementHash)
      await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        proof.replacementHash,
        userId,
      ]);
    await tx.query("DELETE FROM sessions WHERE expires_at<now()");
    await tx.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
      [tokenHash, userId],
    );
  });
}

async function lockSession(db: Database, userId: string, current: string) {
  const [user] = await db.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
    [userId],
  );
  const session = await db.query(
    "SELECT token_hash FROM sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()",
    [current, userId],
  );
  if (!user || !session.length)
    throw new AppError(401, "Please sign in again.");
  return user;
}

export async function changePassword(
  db: Database,
  userId: string,
  current: string,
  oldPassword: string,
  newPassword: string,
) {
  await rateLimit(db, `password:${userId}`, 10);
  const [verified] = await db.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=$1",
    [userId],
  );
  if (!verified || !(await verifyPassword(oldPassword, verified.password_hash)))
    throw new AppError(400, "Your current password is incorrect.");
  const replacement = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const user = await lockSession(tx, userId, current);
    if (user.password_hash !== verified.password_hash)
      throw new AppError(
        409,
        "Your password changed in another session. Sign in again.",
      );
    await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      replacement,
      userId,
    ]);
    await tx.query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [
      userId,
      current,
    ]);
  });
}

export async function revokeOtherSessions(
  db: Database,
  userId: string,
  current: string,
) {
  await db.transaction(async (tx) => {
    await lockSession(tx, userId, current);
    await tx.query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [
      userId,
      current,
    ]);
  });
}
