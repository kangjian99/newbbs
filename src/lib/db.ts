import "server-only";
import fs from "fs";
import path from "path";

function splitSql(source: string) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function loadMigrations(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      id: file,
      statements: splitSql(fs.readFileSync(path.join(dir, file), "utf8")),
    }));
}

export type Dialect = "postgres" | "sqlite";

export type Sql = {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
};

type Runtime = {
  dialect: Dialect;
  sql: Sql;
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const globalState = globalThis as typeof globalThis & {
  __xiangyi?: {
    init?: Promise<void>;
    runtime?: Runtime;
    phase: "new" | "init" | "ready";
  };
};

function state() {
  if (!globalState.__xiangyi) {
    globalState.__xiangyi = { phase: "new" };
  }
  return globalState.__xiangyi;
}

export function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return value || null;
}

export function directDatabaseUrl() {
  const direct = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DIRECT_URL?.trim();
  return direct || databaseUrl();
}

export function shouldSeedDemo() {
  const flag = process.env.SEED_DEMO?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

function safeDbError(error: unknown) {
  const message = error instanceof Error ? error.message : "连接失败";
  const redacted = /postgres(ql)?:\/\//i.test(message) ? "连接失败" : message;
  if (databaseUrl()) {
    return new Error(`无法连接 DATABASE_URL 指向的 Postgres。请检查网络、SSL 和账号。${redacted}`);
  }
  return error instanceof Error ? error : new Error(redacted);
}

function toPostgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizePostgresUrl(url: string) {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode");
  if (!mode || mode === "require" || mode === "prefer" || mode === "verify-ca") {
    parsed.searchParams.set("sslmode", "verify-full");
  }
  return parsed.toString();
}

async function openPostgres(url: string): Promise<Runtime> {
  const pg = await import("pg");
  pg.types.setTypeParser(20, (value) => Number(value));
  pg.types.setTypeParser(21, (value) => Number(value));
  const pool = new pg.Pool({
    connectionString: normalizePostgresUrl(url),
    max: 5,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 20_000,
  });

  const sqlFor = (client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  }): Sql => ({
    async all(sql, params = []) {
      const result = await client.query(toPostgresPlaceholders(sql), params);
      return result.rows as never[];
    },
    async get(sql, params = []) {
      const result = await client.query(toPostgresPlaceholders(sql), params);
      return result.rows[0] as never;
    },
    async run(sql, params = []) {
      const result = await client.query(toPostgresPlaceholders(sql), params);
      return { changes: result.rowCount ?? 0 };
    },
  });

  return {
    dialect: "postgres",
    sql: sqlFor(pool),
    async transaction(fn) {
      const client = await pool.connect();
      const tx = sqlFor(client);
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* already aborted */
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function openSqlite(): Promise<Runtime> {
  const { default: Database } = await import("better-sqlite3");
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "forum.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  let queue: Promise<void> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>) => {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const sqlFor = (): Sql => ({
    async all(sql, params = []) {
      return db.prepare(sql).all(...params) as never[];
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...params) as never;
    },
    async run(sql, params = []) {
      const info = db.prepare(sql).run(...params);
      return { changes: info.changes };
    },
  });

  return {
    dialect: "sqlite",
    sql: {
      all: (sql, params) => enqueue(() => sqlFor().all(sql, params)),
      get: (sql, params) => enqueue(() => sqlFor().get(sql, params)),
      run: (sql, params) => enqueue(() => sqlFor().run(sql, params)),
    },
    transaction(fn) {
      return enqueue(async () => {
        const tx = sqlFor();
        db.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn(tx);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      });
    },
    async close() {
      db.close();
    },
  };
}

async function applied(sql: Sql, id: string) {
  try {
    const row = await sql.get<{ id: string }>("SELECT id FROM schema_migrations WHERE id = ?", [id]);
    return Boolean(row);
  } catch {
    return false;
  }
}

async function migrateWith(runtime: Runtime) {
  const dir = path.join(process.cwd(), "migrations");
  const files = loadMigrations(dir);
  for (const file of files) {
    if (await applied(runtime.sql, file.id)) continue;
    await runtime.transaction(async (tx) => {
      for (const statement of file.statements) {
        await tx.run(statement);
      }
      await tx.run("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)", [file.id, Date.now()]);
    });
    console.info(`[北地巷议] 已应用迁移 ${file.id}`);
  }
}

async function migrate() {
  const runtime = state().runtime;
  if (!runtime) throw new Error("数据库尚未打开");
  if (runtime.dialect === "sqlite") {
    await migrateWith(runtime);
    return;
  }
  const direct = directDatabaseUrl();
  const pooled = databaseUrl();
  if (direct && direct !== pooled) {
    const migrator = await openPostgres(direct);
    try {
      await migrateWith(migrator);
      console.info("[北地巷议] 迁移使用 DATABASE_URL_DIRECT");
    } finally {
      await migrator.close();
    }
    return;
  }
  await migrateWith(runtime);
}

async function doInit() {
  const current = state();
  current.phase = "init";
  try {
    const url = databaseUrl();
    current.runtime = url ? await openPostgres(url) : await openSqlite();
    console.info(`[北地巷议] 数据库：${current.runtime.dialect === "postgres" ? "Postgres" : "SQLite"}`);
    await migrate();
    const { seedIfEmpty } = await import("@/server/seed");
    await seedIfEmpty();
  } catch (error) {
    await current.runtime?.close().catch(() => undefined);
    current.runtime = undefined;
    current.phase = "new";
    current.init = undefined;
    throw safeDbError(error);
  }
}

export async function ready() {
  const current = state();
  if (current.phase === "ready") return;
  if (!current.init) current.init = doInit().then(() => {
    state().phase = "ready";
  });
  await current.init;
}

function runtime() {
  const current = state().runtime;
  if (!current) throw new Error("数据库尚未就绪");
  return current;
}

export async function dbAll<T>(sql: string, params: unknown[] = []) {
  await ready();
  return runtime().sql.all<T>(sql, params);
}

export async function dbGet<T>(sql: string, params: unknown[] = []) {
  await ready();
  return runtime().sql.get<T>(sql, params);
}

export async function dbRun(sql: string, params: unknown[] = []) {
  await ready();
  return runtime().sql.run(sql, params);
}

export async function transaction<T>(fn: (tx: Sql) => Promise<T>) {
  const current = state();
  if (current.phase !== "ready") {
    return runtime().transaction(fn);
  }
  await ready();
  return runtime().transaction(fn);
}

export function dialect() {
  return state().runtime?.dialect ?? (databaseUrl() ? "postgres" : "sqlite");
}

export function dialectLabel() {
  return dialect() === "postgres" ? "Postgres" : "SQLite（本地）";
}
