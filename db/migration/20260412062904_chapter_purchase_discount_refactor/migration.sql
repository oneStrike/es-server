ALTER TABLE "user_level_rule"
RENAME COLUMN "discount" TO "purchase_payable_rate";

UPDATE "user_level_rule"
SET "purchase_payable_rate" = CASE
  WHEN "purchase_payable_rate" IS NULL THEN 1.00
  ELSE LEAST(GREATEST(ROUND(1 - "purchase_payable_rate", 2), 0.00), 1.00)
END;

ALTER TABLE "user_level_rule"
ALTER COLUMN "purchase_payable_rate" SET DEFAULT '1.00';

ALTER TABLE "user_purchase_record"
ADD COLUMN "original_price" integer;

ALTER TABLE "user_purchase_record"
ADD COLUMN "paid_price" integer;

ALTER TABLE "user_purchase_record"
ADD COLUMN "payable_rate" numeric(3, 2) DEFAULT '1.00';

UPDATE "user_purchase_record"
SET
  "original_price" = "price",
  "paid_price" = "price",
  "payable_rate" = '1.00'
WHERE "price" IS NOT NULL;

ALTER TABLE "user_purchase_record"
ALTER COLUMN "original_price" SET NOT NULL;

ALTER TABLE "user_purchase_record"
ALTER COLUMN "paid_price" SET NOT NULL;

ALTER TABLE "user_purchase_record"
ALTER COLUMN "payable_rate" SET NOT NULL;

ALTER TABLE "user_purchase_record"
DROP COLUMN "price";
