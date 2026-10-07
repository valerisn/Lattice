import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const file = `APP_URL=http://localhost:3000\nPOSTGRES_PASSWORD=${randomBytes(24).toString("hex")}\nSETUP_TOKEN=${randomBytes(24).toString("hex")}\nUPLOAD_DIR=./uploads\n`;
try {
  await writeFile(".env", file, { flag: "wx", mode: 0o600 });
  console.log(
    "Created .env with random database and setup credentials. Read SETUP_TOKEN from .env for first-run setup. Set APP_URL to your public HTTPS URL before exposing the server.",
  );
} catch (error) {
  if (error.code === "EEXIST") {
    console.error(".env already exists; no changes made.");
    process.exitCode = 1;
  } else throw error;
}
