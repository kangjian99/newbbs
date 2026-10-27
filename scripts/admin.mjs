import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { loadLocalEnv, normalizePostgresUrl } from "./env.mjs";

loadLocalEnv();

const DEMO_ACCOUNTS = [
  { username: "admin", password: "admin123456" },
  ...["lin", "he", "su", "zhao", "miao", "qiao", "guang"].map((username) => ({ username, password: "demo123456" })),
];
const ROLES = ["user", "moderator", "admin"];

const USAGE = `用法：
  npm run admin -- status                    列出管理员、版主，以及仍在用公开密码的演示账号
  npm run admin -- grant <用户名> [角色]      设置角色，角色为 admin（默认）、moderator 或 user
  npm run admin -- lock-demo                 给仍在用公开密码的演示账号换成随机密码，并退出它们的登录

连接顺序：DATABASE_URL_DIRECT、DIRECT_URL、DATABASE_URL；都没有时使用本地 data/forum.db。`;

async function openDb() {
  const url = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: normalizePostgresUrl(url) });
    await client.connect();
    const toPg = (sql) => {
      let index = 0;
      return sql.replace(/\?/g, () => `$${++index}`);
    };
    return {
      label: "Postgres",
      all: async (sql, params = []) => (await client.query(toPg(sql), params)).rows,
      run: async (sql, params = []) => (await client.query(toPg(sql), params)).rowCount ?? 0,
      close: () => client.end(),
    };
  }
  const file = path.join(process.cwd(), "data", "forum.db");
  if (!fs.existsSync(file)) throw new Error("没有设置 DATABASE_URL，本地也没有 data/forum.db。");
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  return {
    label: "SQLite（本地）",
    all: async (sql, params = []) => db.prepare(sql).all(...params),
    run: async (sql, params = []) => db.prepare(sql).run(...params).changes,
    close: async () => db.close(),
  };
}

async function exposedDemoAccounts(db) {
  const exposed = [];
  for (const demo of DEMO_ACCOUNTS) {
    const [row] = await db.all("SELECT id, username, role, password_hash FROM users WHERE username = ?", [demo.username]);
    if (row && (await bcrypt.compare(demo.password, row.password_hash))) exposed.push(row);
  }
  return exposed;
}

async function status(db) {
  const staff = await db.all("SELECT username, nickname, role FROM users WHERE role IN ('admin', 'moderator') ORDER BY role, username");
  console.log(staff.length ? "管理员与版主：" : "库里还没有管理员或版主。");
  for (const row of staff) console.log(`  ${row.role === "admin" ? "管理员" : "版主"}  ${row.username}（${row.nickname}）`);
  const exposed = await exposedDemoAccounts(db);
  if (exposed.length) {
    console.log("\n以下演示账号仍在用 README 里公开的密码，任何人都能登录：");
    for (const row of exposed) console.log(`  ${row.username}（${row.role}）`);
    console.log("\n运行 npm run admin -- lock-demo 可以一次性锁住它们。");
  } else {
    console.log("\n没有仍在用公开密码的演示账号。");
  }
}

async function grant(db, username, role = "admin") {
  if (!username) throw new Error(USAGE);
  if (!ROLES.includes(role)) throw new Error(`角色只能是 ${ROLES.join("、")}`);
  const changed = await db.run("UPDATE users SET role = ? WHERE username = ?", [role, username.trim().toLowerCase()]);
  if (!changed) throw new Error(`找不到用户 ${username}`);
  console.log(`已把 ${username} 设为 ${role}。`);
}

async function lockDemo(db) {
  const exposed = await exposedDemoAccounts(db);
  if (!exposed.length) {
    console.log("没有仍在用公开密码的演示账号，无需处理。");
    return;
  }
  for (const row of exposed) {
    const hash = await bcrypt.hash(randomBytes(32).toString("base64url"), 10);
    await db.run("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?", [hash, row.id]);
    await db.run("DELETE FROM sessions WHERE user_id = ?", [row.id]);
    console.log(`已锁住 ${row.username}（${row.role}）：密码换成无人知道的随机值，现有登录已退出。`);
  }
}

const [command, ...args] = process.argv.slice(2);
if (!["status", "grant", "lock-demo"].includes(command ?? "")) {
  console.log(USAGE);
  process.exit(command ? 1 : 0);
}

let db;
try {
  db = await openDb();
  console.log(`数据库：${db.label}\n`);
  if (command === "status") await status(db);
  if (command === "grant") await grant(db, args[0], args[1]);
  if (command === "lock-demo") await lockDemo(db);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]"));
  process.exitCode = 1;
} finally {
  await db?.close().catch(() => undefined);
}
