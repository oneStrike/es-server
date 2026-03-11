-- 迁移 growth_ledger_record 表的 asset_type 从 VARCHAR(30) 到 SmallInt

-- 1. 先添加新的临时列
ALTER TABLE "growth_ledger_record" ADD COLUMN "asset_type_new" SMALLINT;

-- 2. 迁移数据（将字符串转换为整数）
-- 'POINTS' -> 1, 'EXPERIENCE' -> 2
UPDATE "growth_ledger_record" SET "asset_type_new" = 
  CASE 
    WHEN "asset_type" = 'POINTS' THEN 1
    WHEN "asset_type" = 'EXPERIENCE' THEN 2
    WHEN "asset_type" = '1' THEN 1
    WHEN "asset_type" = '2' THEN 2
    ELSE CAST("asset_type" AS INTEGER)
  END;

-- 3. 删除旧列
ALTER TABLE "growth_ledger_record" DROP COLUMN "asset_type";

-- 4. 重命名新列为原列名
ALTER TABLE "growth_ledger_record" RENAME COLUMN "asset_type_new" TO "asset_type";

-- 5. 设置 NOT NULL 约束
ALTER TABLE "growth_ledger_record" ALTER COLUMN "asset_type" SET NOT NULL;

-- 6. 重建索引
DROP INDEX IF EXISTS "growth_ledger_record_user_id_asset_type_created_at_idx";
CREATE INDEX "growth_ledger_record_user_id_asset_type_created_at_idx" ON "growth_ledger_record"("user_id", "asset_type", "created_at");
