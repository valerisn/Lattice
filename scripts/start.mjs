import { cp, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
await access(path.join(standalone, "server.js"));
for (const directory of ["public", "migrations"]) {
  await cp(path.join(root, directory), path.join(standalone, directory), {
    recursive: true,
  });
}
await cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
if (!process.env.DATABASE_URL)
  throw new Error(
    "Production requires DATABASE_URL. Use npm run dev for local PGlite development.",
  );
process.env.UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(root, "uploads"),
);
process.env.HOSTNAME ||= "0.0.0.0";
process.chdir(standalone);
await import(pathToFileURL(path.join(standalone, "server.js")).href);
