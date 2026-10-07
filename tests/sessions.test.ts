import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDatabase, migrate, type Database } from "../src/server/db";
import {
  changePassword,
  insertSession,
  revokeOtherSessions,
} from "../src/server/sessions";
import { digest, hashPassword, verifyPassword } from "../src/server/security";

describe("credential changes and session races", () => {
  let client: PGlite;
  let db: Database;
  const oldPassword = "old-long-test-passphrase";
  const newPassword = "new-long-test-passphrase";
  beforeAll(async () => {
    client = new PGlite();
    db = embeddedDatabase(client);
    await migrate(db);
  });
  afterAll(async () => {
    await client.close();
  });
  async function account() {
    const id = crypto.randomUUID();
    const hash = await hashPassword(oldPassword);
    await db.query(
      "INSERT INTO users(id,name,email,username,password_hash) VALUES($1,'Test',$2,$4,$3)",
      [id, `${id}@example.test`, hash, id],
    );
    const current = digest(crypto.randomUUID());
    await insertSession(db, id, current, { expectedHash: hash });
    return { id, hash, current };
  }
  it("rejects an old-password login finishing after a password change, including legacy rehashes", async () => {
    const { id, hash, current } = await account();
    const other = digest(crypto.randomUUID());
    await insertSession(db, id, other, { expectedHash: hash });
    await changePassword(db, id, current, oldPassword, newPassword);
    for (const replacementHash of [
      undefined,
      await hashPassword(oldPassword),
    ]) {
      await expect(
        insertSession(db, id, digest(crypto.randomUUID()), {
          expectedHash: hash,
          replacementHash,
        }),
      ).rejects.toMatchObject({ status: 401 });
    }
    expect(
      await db.query("SELECT token_hash FROM sessions WHERE user_id=$1", [id]),
    ).toEqual([{ token_hash: current }]);
    const [user] = await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [id],
    );
    expect(await verifyPassword(newPassword, user.password_hash)).toBe(true);
    await insertSession(db, id, other, { expectedHash: user.password_hash });
  });
  it("does not let a delayed password change overwrite a newer one", async () => {
    const { id, current } = await account();
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const delayed: Database = {
      ...db,
      transaction: async (fn) => {
        entered.resolve();
        await resume.promise;
        return db.transaction(fn);
      },
    };
    const change = changePassword(
      delayed,
      id,
      current,
      oldPassword,
      "attacker-replacement-password",
    );
    const rejected = expect(change).rejects.toMatchObject({ status: 409 });
    await entered.promise;
    await changePassword(db, id, current, oldPassword, newPassword);
    resume.resolve();
    await rejected;
    const [user] = await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [id],
    );
    expect(await verifyPassword(newPassword, user.password_hash)).toBe(true);
  });
  it("refuses session-management actions from revoked or expired sessions", async () => {
    const { id, current } = await account();
    const revoked = digest(crypto.randomUUID());
    await expect(revokeOtherSessions(db, id, revoked)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      changePassword(db, id, revoked, oldPassword, newPassword),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      await db.query("SELECT token_hash FROM sessions WHERE user_id=$1", [id]),
    ).toEqual([{ token_hash: current }]);
    await db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [current],
    );
    await expect(revokeOtherSessions(db, id, current)).rejects.toMatchObject({
      status: 401,
    });
  });
});
