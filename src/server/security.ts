import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Database } from "./db";
import { AppError } from "./errors";

const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function checkOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) throw new AppError(503, "APP_URL must be configured.");
  const localUrl = new URL(request.url);
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${localUrl.protocol}//${request.headers.get("host") || localUrl.host}`;
  if (request.headers.get("origin") !== expected) throw new AppError(403, "Request origin is not allowed.");
}
export async function rateLimit(db: Database, key: string, maximum = 10, seconds = 900) {
  const rows = await db.query<{ hits: number }>(`INSERT INTO rate_limits(key,hits,resets_at) VALUES($1,1,now()+($2 * interval '1 second'))
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.resets_at < now() THEN 1 ELSE rate_limits.hits+1 END,
    resets_at=CASE WHEN rate_limits.resets_at < now() THEN excluded.resets_at ELSE rate_limits.resets_at END RETURNING hits`, [digest(key), seconds]);
  if (rows[0].hits > maximum) throw new AppError(429, "Too many attempts. Please try again later.");
}
