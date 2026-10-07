import { cookies } from "next/headers";
import { z } from "zod";
import { database, type Database } from "./db";
import {
  digest,
  hashPassword,
  newToken,
  rateLimit,
  verifyPassword,
} from "./security";
import { AppError } from "./errors";
import type { User } from "@/shared/types";

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(12, "Use at least 12 characters for your password.")
    .max(128),
});
const cookieName = "lattice_session";
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const db = await database();
  const users = await db.query<User>(
    `SELECT u.id,u.name,u.email,u.username,u.avatar,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [digest(token)],
  );
  return users[0] || null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, "Please sign in.");
  return user;
}
export async function createSession(userId: string) {
  const token = newToken();
  const db = await database();
  await db.query("DELETE FROM sessions WHERE expires_at<now()");
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
    [digest(token), userId],
  );
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure:
      new URL(process.env.APP_URL || "http://localhost:3000").protocol ===
      "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 86400,
  });
}
export async function logout() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token)
    await (
      await database()
    ).query("DELETE FROM sessions WHERE token_hash=$1", [digest(token)]);
  (await cookies()).delete(cookieName);
}
export async function insertUser(
  db: Database,
  data: z.infer<typeof accountSchema>,
) {
  const id = crypto.randomUUID();
  const hash = await hashPassword(data.password);
  await db.query(
    "INSERT INTO users(id,name,email,username,password_hash) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      data.name,
      data.email,
      `${data.email
        .split("@")[0]
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 25)}-${id.slice(0, 8)}`,
      hash,
    ],
  );
  return id;
}
export async function login(body: unknown) {
  const data = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      password: z.string().max(128),
    })
    .parse(body);
  const db = await database();
  await rateLimit(db, "login-global", 300);
  await rateLimit(db, `login:${data.email}`);
  const [user] = await db.query<{ id: string; password_hash: string }>(
    "SELECT id,password_hash FROM users WHERE email=$1",
    [data.email],
  );
  const dummy = "scrypt-v2:00000000000000000000000000000000:" + "00".repeat(64);
  const valid = await verifyPassword(
    data.password,
    user?.password_hash || dummy,
  );
  if (!user || !valid)
    throw new AppError(401, "Email or password is incorrect.");
  if (user.password_hash.startsWith("scrypt:"))
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      await hashPassword(data.password),
      user.id,
    ]);
  await createSession(user.id);
}
