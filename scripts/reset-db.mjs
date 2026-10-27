import fs from "fs";
import { loadLocalEnv } from "./env.mjs";

loadLocalEnv();

if (process.env.DATABASE_URL || process.env.DATABASE_URL_DIRECT) {
  console.log("检测到 DATABASE_URL。本命令不会清空远程 Postgres。");
}

for (const file of ["data/forum.db", "data/forum.db-wal", "data/forum.db-shm"]) {
  fs.rmSync(file, { force: true });
}
console.log("已删除本地 SQLite 文件（如果存在）。下次在没有 DATABASE_URL 时启动会重建并写入演示数据。");
