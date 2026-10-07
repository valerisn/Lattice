import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

export interface Database {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
}

function postgresDatabase(): Database {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
  return {
    query: async <T>(sql: string, params?: unknown[]) =>
      (await pool.query(sql, params)).rows as T[],
    async transaction<T>(fn: (tx: Database) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx: Database = {
          query: async <R>(sql: string, params?: unknown[]) =>
            (await client.query(sql, params)).rows as R[],
          transaction: async (fn) => fn(tx),
        };
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function embeddedDatabase(client: PGlite): Database {
  const adapt = (connection: Pick<PGlite, "query">): Database => ({
    query: async <T>(sql: string, params?: unknown[]) =>
      (await connection.query<T>(sql, params)).rows,
    transaction: async (fn) => client.transaction((tx) => fn(adapt(tx))),
  });
  return adapt(client);
}

export async function migrate(db: Database) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await db.transaction(async (tx) => {
    await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
    for (const name of (await readdir(path.join(process.cwd(), "migrations")))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const exists = await tx.query(
        "SELECT name FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (exists.length) continue;
      const sql = await readFile(
        path.join(process.cwd(), "migrations", name),
        "utf8",
      );
      for (const statement of sql.split(";").filter((s) => s.trim()))
        await tx.query(statement);
      await tx.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
    }
  });
}

const globalDb = globalThis as unknown as { latticeDb?: Promise<Database> };
export function database(): Promise<Database> {
  globalDb.latticeDb ??= (async () => {
    let db: Database;
    if (process.env.DATABASE_URL) db = postgresDatabase();
    else {
      if (process.env.NODE_ENV === "production")
        throw new Error("DATABASE_URL is required in production");
      const dir =
        process.env.DATA_DIR || path.join(process.cwd(), "data", "dev-db");
      await mkdir(dir, { recursive: true });
      db = embeddedDatabase(new PGlite(dir));
    }
    await migrate(db);
    return db;
  })();
  return globalDb.latticeDb;
}
