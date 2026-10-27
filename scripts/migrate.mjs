import path from "path";
import pg from "pg";
import { loadMigrations } from "../src/lib/schema-migrate.mjs";
import { loadLocalEnv, normalizePostgresUrl } from "./env.mjs";

loadLocalEnv();

const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!connectionString) {
  console.log("未设置 DATABASE_URL。本地 SQLite 会在启动应用时自动迁移。");
  process.exit(0);
}

const usingDirect = Boolean(process.env.DATABASE_URL_DIRECT);
pg.types.setTypeParser(20, (value) => Number(value));
const client = new pg.Client({ connectionString: normalizePostgresUrl(connectionString) });

try {
  await client.connect();
  const dir = path.join(process.cwd(), "migrations");
  for (const file of loadMigrations(dir)) {
    const found = await client.query("SELECT id FROM schema_migrations WHERE id = $1", [file.id]).catch(() => null);
    if (found && found.rows.length > 0) continue;
    await client.query("BEGIN");
    try {
      for (const statement of file.statements) {
        await client.query(statement);
      }
      await client.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [file.id, Date.now()]);
      await client.query("COMMIT");
      console.log(`已应用迁移 ${file.id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log(usingDirect ? "迁移完成（DATABASE_URL_DIRECT）" : "迁移完成（DATABASE_URL）");
} catch (error) {
  const message = error instanceof Error ? error.message : "迁移失败";
  console.error(message.includes("postgres") ? "迁移失败，请检查数据库连接。" : message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
