-- 封禁账号：banned_at 不为空即被封禁，ban_reason 只给管理员看。
-- ADD COLUMN 在 Postgres 与 SQLite 上写法一致。

ALTER TABLE users ADD COLUMN banned_at BIGINT;
ALTER TABLE users ADD COLUMN ban_reason TEXT NOT NULL DEFAULT '';
