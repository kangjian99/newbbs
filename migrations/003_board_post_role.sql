-- 版块发帖权限：post_role 是能在这个版块发新主题的最低角色（user 全体会员、moderator 版主及以上、admin 仅管理员）。
-- 回复不受影响。演示数据里的“站务公告”版块默认改为仅管理员可发帖。

ALTER TABLE boards ADD COLUMN post_role TEXT NOT NULL DEFAULT 'user';

UPDATE boards SET post_role = 'admin' WHERE id = 'brd_notice';
