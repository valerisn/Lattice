import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  database,
  embeddedDatabase,
  migrate,
  type Database,
} from "../src/server/db";
import { requireUser } from "../src/server/auth";
import { createWorkspace } from "../src/server/workspaces";
import { PATCH } from "../src/app/api/w/[workspaceId]/[...path]/route";
import { POST as upload } from "../src/app/api/w/[workspaceId]/pages/[pageId]/attachments/route";
import { storage } from "../src/server/storage";
import { AppError } from "../src/server/errors";
import type { User } from "../src/shared/types";

vi.mock("../src/server/db", async (original) => ({
  ...(await original<typeof import("../src/server/db")>()),
  database: vi.fn(),
}));
vi.mock("../src/server/auth", async (original) => ({
  ...(await original<typeof import("../src/server/auth")>()),
  requireUser: vi.fn(),
}));
vi.mock("../src/server/storage", async (original) => ({
  ...(await original<typeof import("../src/server/storage")>()),
  storage: { put: vi.fn(), remove: vi.fn() },
}));

describe("authorization after slow request bodies", () => {
  let client: PGlite;
  let db: Database;
  let workspaceId: string;
  let pageId: string;
  const owner = crypto.randomUUID();
  const actor: User = {
    id: crypto.randomUUID(),
    name: "Admin",
    email: "race@example.test",
    username: "race-admin",
    avatar: null,
    created_at: new Date().toISOString(),
  };
  beforeAll(async () => {
    client = new PGlite();
    db = embeddedDatabase(client);
    await migrate(db);
    for (const id of [owner, actor.id])
      await db.query(
        "INSERT INTO users(id,email,name,username,password_hash) VALUES($1,$2,'Test',$3,'unused')",
        [id, `${id}@example.test`, id],
      );
    vi.mocked(database).mockResolvedValue(db);
    vi.stubEnv("APP_URL", "http://localhost:3211");
  });
  beforeEach(async () => {
    vi.mocked(requireUser).mockReset().mockResolvedValue(actor);
    vi.mocked(storage.put).mockClear();
    vi.mocked(storage.remove).mockClear();
    workspaceId = await createWorkspace(db, owner, {
      name: "Protected",
      slug: crypto.randomUUID(),
    });
    await db.query(
      "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'admin')",
      [workspaceId, actor.id],
    );
    const [page] = await db.query<{ id: string }>(
      "SELECT id FROM pages WHERE workspace_id=$1 LIMIT 1",
      [workspaceId],
    );
    pageId = page.id;
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await client.close();
  });
  function slowRequest(method: string, contentType = "application/json") {
    const reading = Promise.withResolvers<void>();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          stream = controller;
        },
        pull() {
          reading.resolve();
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("http://localhost:3211/api/test", {
      method,
      headers: { origin: "http://localhost:3211", "content-type": contentType },
      body,
      duplex: "half",
    } as RequestInit);
    return {
      request,
      reading: reading.promise,
      finish(bytes: Uint8Array) {
        stream.enqueue(bytes);
        stream.close();
      },
    };
  }
  for (const removal of [false, true])
    it(`rejects a queued admin mutation after ${removal ? "removal" : "demotion"}`, async () => {
      const slow = slowRequest("PATCH");
      const response = PATCH(slow.request, {
        params: Promise.resolve({ workspaceId, path: ["admin"] }),
      });
      await slow.reading;
      await db.query(
        removal
          ? "DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2"
          : "UPDATE workspace_members SET role='viewer' WHERE workspace_id=$1 AND user_id=$2",
        [workspaceId, actor.id],
      );
      slow.finish(
        new TextEncoder().encode(
          JSON.stringify({ name: "Unauthorized change" }),
        ),
      );
      expect((await response).status).toBe(removal ? 404 : 403);
      expect(
        await db.query("SELECT name FROM workspaces WHERE id=$1", [
          workspaceId,
        ]),
      ).toEqual([{ name: "Protected" }]);
    });
  it("rejects a request whose session was revoked while its body arrived", async () => {
    const slow = slowRequest("PATCH");
    const response = PATCH(slow.request, {
      params: Promise.resolve({ workspaceId, path: ["admin"] }),
    });
    await slow.reading;
    vi.mocked(requireUser).mockRejectedValue(
      new AppError(401, "Please sign in."),
    );
    slow.finish(
      new TextEncoder().encode(JSON.stringify({ name: "Unauthorized change" })),
    );
    expect((await response).status).toBe(401);
  });
  it("discards an upload when page access is revoked during transfer", async () => {
    await db.query(
      "UPDATE workspace_members SET role='editor' WHERE workspace_id=$1 AND user_id=$2",
      [workspaceId, actor.id],
    );
    const form = new FormData();
    form.set(
      "file",
      new File(["private upload"], "note.txt", { type: "text/plain" }),
    );
    const encoded = new Request("http://localhost", {
      method: "POST",
      body: form,
    });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const slow = slowRequest("POST", encoded.headers.get("content-type")!);
    const response = upload(slow.request, {
      params: Promise.resolve({ workspaceId, pageId }),
    });
    await slow.reading;
    await db.query(
      "INSERT INTO permissions(id,workspace_id,page_id,user_id,capability) VALUES($1,$2,$3,$4,'edit')",
      [crypto.randomUUID(), workspaceId, pageId, owner],
    );
    slow.finish(bytes);
    expect((await response).status).toBe(404);
    expect(
      await db.query("SELECT id FROM attachments WHERE page_id=$1", [pageId]),
    ).toHaveLength(0);
    expect(storage.remove).toHaveBeenCalledWith(
      vi.mocked(storage.put).mock.calls[0][0],
    );
  });
});
