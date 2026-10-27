-- 北地巷议初始结构。
-- 这份 SQL 同时适用于 Postgres 与 SQLite：
-- 时间用毫秒 BIGINT（SQLite 对含 INT 的类型名按整数亲和处理），
-- 布尔用 INTEGER 0/1，主键用 TEXT，避免 SERIAL / BOOLEAN / TIMESTAMPTZ 分叉。

CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at BIGINT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_hue INTEGER NOT NULL DEFAULT 152,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  last_visit_at BIGINT NOT NULL,
  prev_visit_at BIGINT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_post_at BIGINT NOT NULL,
  last_post_user_id TEXT REFERENCES users(id),
  deleted_at BIGINT
);

CREATE INDEX idx_threads_board ON threads(board_id, is_pinned, last_post_at);
CREATE INDEX idx_threads_last ON threads(last_post_at);
CREATE INDEX idx_threads_author ON threads(author_id);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT REFERENCES posts(id),
  content TEXT NOT NULL,
  is_op INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  edited_at BIGINT,
  deleted_at BIGINT,
  hidden_at BIGINT,
  hidden_by TEXT REFERENCES users(id),
  hidden_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_posts_thread ON posts(thread_id, created_at);
CREATE INDEX idx_posts_parent ON posts(parent_id);
CREATE INDEX idx_posts_author ON posts(author_id);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT REFERENCES users(id),
  resolved_at BIGINT,
  resolution_note TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE UNIQUE INDEX idx_reports_open_unique
  ON reports(reporter_id, target_type, target_id) WHERE status = 'open';

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL,
  read_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE thread_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  last_read_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);

CREATE TABLE captcha_challenges (
  id TEXT PRIMARY KEY,
  answer_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT
);

CREATE TABLE form_tokens (
  id TEXT PRIMARY KEY,
  issued_at BIGINT NOT NULL,
  used_at BIGINT
);

CREATE TABLE auth_attempts (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_auth_attempts_key ON auth_attempts(action, key, created_at);
