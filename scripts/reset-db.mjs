import fs from "fs";
import path from "path";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(process.cwd(), ".env.local"));
loadEnv(path.join(process.cwd(), ".env"));

if (process.env.DATABASE_URL || process.env.DATABASE_URL_DIRECT) {
  console.log("检测到 DATABASE_URL。本命令不会清空远程 Postgres。");
}

for (const file of ["data/forum.db", "data/forum.db-wal", "data/forum.db-shm"]) {
  fs.rmSync(file, { force: true });
}
console.log("已删除本地 SQLite 文件（如果存在）。下次在没有 DATABASE_URL 时启动会重建并写入演示数据。");
