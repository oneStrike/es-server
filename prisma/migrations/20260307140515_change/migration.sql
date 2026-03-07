-- 为用户下载记录表添加唯一约束
-- 确保同一用户对同一章节只能有一条下载记录，实现下载操作幂等

-- 先删除重复记录，保留每组中ID最小的记录
DELETE FROM "user_download_record"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "user_download_record"
    GROUP BY target_type, target_id, user_id
);

-- 添加唯一约束（使用小写名称以匹配 Prisma 生成的约束名）
ALTER TABLE "user_download_record" ADD CONSTRAINT "user_download_record_targettype_targetid_userid_key" UNIQUE ("target_type", "target_id", "user_id");
