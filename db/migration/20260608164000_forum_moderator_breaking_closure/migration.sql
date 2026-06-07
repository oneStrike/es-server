CREATE TABLE IF NOT EXISTS "forum_moderator_lifecycle_log" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "event_type" smallint NOT NULL,
  "moderator_id" integer,
  "application_id" integer,
  "actor_admin_user_id" integer NOT NULL,
  "reason" varchar(500),
  "before_data" jsonb,
  "after_data" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_lifecycle_log_moderator_created_at_idx"
  ON "forum_moderator_lifecycle_log" ("moderator_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_lifecycle_log_application_created_at_idx"
  ON "forum_moderator_lifecycle_log" ("application_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_lifecycle_log_event_type_created_at_idx"
  ON "forum_moderator_lifecycle_log" ("event_type", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_lifecycle_log_created_at_idx"
  ON "forum_moderator_lifecycle_log" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_action_log_moderator_created_at_idx"
  ON "forum_moderator_action_log" ("moderator_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_action_log_action_type_created_at_idx"
  ON "forum_moderator_action_log" ("action_type", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_action_log_target_created_at_idx"
  ON "forum_moderator_action_log" ("target_type", "target_id", "created_at" DESC);
--> statement-breakpoint
DROP INDEX IF EXISTS "forum_moderator_action_log_created_at_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_moderator_action_log_created_at_idx"
  ON "forum_moderator_action_log" ("created_at" DESC);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_lifecycle_log"
    ADD CONSTRAINT "forum_moderator_lifecycle_log_event_type_valid_chk"
    CHECK ("event_type" IN (1,2,3,4,5,6,7,8,9));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_lifecycle_log"
    ADD CONSTRAINT "forum_moderator_lifecycle_log_actor_admin_user_id_positive_chk"
    CHECK ("actor_admin_user_id" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_lifecycle_log"
    ADD CONSTRAINT "forum_moderator_lifecycle_log_moderator_id_positive_chk"
    CHECK ("moderator_id" IS NULL OR "moderator_id" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_lifecycle_log"
    ADD CONSTRAINT "forum_moderator_lifecycle_log_application_id_positive_chk"
    CHECK ("application_id" IS NULL OR "application_id" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_lifecycle_log"
    ADD CONSTRAINT "forum_moderator_lifecycle_log_subject_present_chk"
    CHECK ("moderator_id" IS NOT NULL OR "application_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
