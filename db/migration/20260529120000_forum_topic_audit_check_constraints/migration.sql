UPDATE "forum_topic"
SET "audit_status" = 1
WHERE "audit_status" NOT IN (0, 1, 2);
--> statement-breakpoint
UPDATE "forum_topic"
SET "audit_role" = NULL
WHERE "audit_role" IS NOT NULL AND "audit_role" NOT IN (0, 1);
--> statement-breakpoint
ALTER TABLE "forum_topic"
  DROP CONSTRAINT IF EXISTS "forum_topic_audit_status_valid_chk";
--> statement-breakpoint
ALTER TABLE "forum_topic"
  ADD CONSTRAINT "forum_topic_audit_status_valid_chk"
  CHECK ("audit_status" IN (0, 1, 2));
--> statement-breakpoint
ALTER TABLE "forum_topic"
  DROP CONSTRAINT IF EXISTS "forum_topic_audit_role_valid_chk";
--> statement-breakpoint
ALTER TABLE "forum_topic"
  ADD CONSTRAINT "forum_topic_audit_role_valid_chk"
  CHECK ("audit_role" IS NULL OR "audit_role" IN (0, 1));
