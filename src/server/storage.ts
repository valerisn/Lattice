import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
export interface StorageProvider {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
function location(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return path.join(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR ||
      path.join(process.cwd(), "uploads"),
    key,
  );
}
export const storage: StorageProvider = {
  async put(key, bytes) {
    const file = location(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  },
  async get(key) {
    return new Uint8Array(
      await readFile(/* turbopackIgnore: true */ location(key)),
    );
  },
  async remove(key) {
    try {
      await unlink(location(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  },
};
export function detectMime(bytes: Uint8Array, name: string): string | null {
  const hex = Buffer.from(bytes.slice(0, 12)).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("474946383761") || hex.startsWith("474946383961"))
    return "image/gif";
  if (hex.startsWith("52494646") && hex.slice(16) === "57454250")
    return "image/webp";
  if (hex.startsWith("255044462d")) return "application/pdf";
  if (/\.(txt|md|csv|json|log)$/i.test(name) && !bytes.includes(0))
    return "text/plain";
  return null;
}
