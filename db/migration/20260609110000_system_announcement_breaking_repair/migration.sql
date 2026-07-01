DO $$
DECLARE
  empty_platform_count bigint;
  invalid_fanout_status_count bigint;
  invalid_priority_count bigint;
  invalid_publish_window_count bigint;
  invalid_type_count bigint;
  unsupported_platform_count bigint;
  unsupported_popup_position_count bigint;
BEGIN
  SELECT count(*)
    INTO unsupported_platform_count
  FROM "app_announcement"
  WHERE "enable_platform" IS NOT NULL
    AND NOT ("enable_platform" <@ ARRAY[1,2,3]::smallint[]);

  SELECT count(*)
    INTO empty_platform_count
  FROM "app_announcement"
  WHERE "enable_platform" = ARRAY[]::smallint[];

  SELECT count(*)
    INTO invalid_publish_window_count
  FROM "app_announcement"
  WHERE "publish_start_time" IS NOT NULL
    AND "publish_end_time" IS NOT NULL
    AND "publish_start_time" >= "publish_end_time";

  SELECT count(*)
    INTO unsupported_popup_position_count
  FROM "app_announcement"
  WHERE "popup_background_position" IS NOT NULL
    AND "popup_background_position" NOT IN (
      'center',
      'top center',
      'top left',
      'top right',
      'bottom center',
      'bottom left',
      'bottom right',
      'left center',
      'right center'
    );

  SELECT count(*)
    INTO invalid_type_count
  FROM "app_announcement"
  WHERE "announcement_type" NOT IN (0,1,2,3,4);

  SELECT count(*)
    INTO invalid_priority_count
  FROM "app_announcement"
  WHERE "priority_level" NOT IN (0,1,2,3);

  SELECT count(*)
    INTO invalid_fanout_status_count
  FROM "app_announcement_notification_fanout_task"
  WHERE "status" NOT IN (0,1,2,3);

  IF unsupported_platform_count <> 0
    OR empty_platform_count <> 0
    OR invalid_publish_window_count <> 0
    OR unsupported_popup_position_count <> 0
    OR invalid_type_count <> 0
    OR invalid_priority_count <> 0
    OR invalid_fanout_status_count <> 0 THEN
    RAISE EXCEPTION
      'system announcement breaking repair blocked: unsupported_platform_count=%, empty_platform_count=%, invalid_publish_window_count=%, unsupported_popup_position_count=%, invalid_type_count=%, invalid_priority_count=%, invalid_fanout_status_count=%',
      unsupported_platform_count,
      empty_platform_count,
      invalid_publish_window_count,
      unsupported_popup_position_count,
      invalid_type_count,
      invalid_priority_count,
      invalid_fanout_status_count;
  END IF;
END $$;
--> statement-breakpoint
UPDATE "app_announcement"
SET "enable_platform" = ARRAY[1,2,3]::smallint[]
WHERE "enable_platform" IS NULL;
--> statement-breakpoint
UPDATE "app_announcement"
SET "popup_background_position" = 'center'
WHERE "popup_background_position" IS NULL;
--> statement-breakpoint
ALTER TABLE "app_announcement"
  ADD COLUMN IF NOT EXISTS "notification_start_boundary_at" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_end_boundary_at" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_fanout_task_id" integer,
  ADD COLUMN IF NOT EXISTS "notification_fanout_desired_event_key" varchar(120),
  ADD COLUMN IF NOT EXISTS "notification_fanout_status" smallint,
  ADD COLUMN IF NOT EXISTS "notification_fanout_last_error" varchar(500),
  ADD COLUMN IF NOT EXISTS "notification_fanout_updated_at" timestamp(6) with time zone,
  ALTER COLUMN "enable_platform" SET DEFAULT ARRAY[1,2,3]::smallint[],
  ALTER COLUMN "enable_platform" SET NOT NULL,
  ALTER COLUMN "popup_background_position" SET DEFAULT 'center',
  ALTER COLUMN "popup_background_position" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_type_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_type_valid_chk"
    CHECK ("announcement_type" IN (0,1,2,3,4));

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_priority_level_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_priority_level_valid_chk"
    CHECK ("priority_level" IN (0,1,2,3));

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_enable_platform_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_enable_platform_valid_chk"
    CHECK (
      "enable_platform" <@ ARRAY[1,2,3]::smallint[]
      AND cardinality("enable_platform") > 0
    );

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_publish_window_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_publish_window_valid_chk"
    CHECK (
      "publish_start_time" IS NULL
      OR "publish_end_time" IS NULL
      OR "publish_start_time" < "publish_end_time"
    );

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_popup_position_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_popup_position_valid_chk"
    CHECK (
      "popup_background_position" IN (
        'center',
        'top center',
        'top left',
        'top right',
        'bottom center',
        'bottom left',
        'bottom right',
        'left center',
        'right center'
      )
    );

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_popup_background_required_chk";

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_view_count_non_negative_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_view_count_non_negative_chk"
    CHECK ("view_count" >= 0);

  ALTER TABLE "app_announcement"
    DROP CONSTRAINT IF EXISTS "app_announcement_notification_fanout_status_valid_chk";
  ALTER TABLE "app_announcement"
    ADD CONSTRAINT "app_announcement_notification_fanout_status_valid_chk"
    CHECK (
      "notification_fanout_status" IS NULL
      OR "notification_fanout_status" IN (0,1,2,3)
    );
END $$;
--> statement-breakpoint
ALTER TABLE "app_announcement_notification_fanout_task"
  ADD COLUMN IF NOT EXISTS "event_boundary_key" varchar(160),
  ADD COLUMN IF NOT EXISTS "fanout_key" varchar(320),
  ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "processing_lease_expires_at" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp(6) with time zone;
--> statement-breakpoint
UPDATE "app_announcement_notification_fanout_task"
SET
  "attempt_count" = coalesce("attempt_count", 0),
  "event_boundary_key" = CASE
    WHEN btrim(coalesce("event_boundary_key", '')) <> ''
      THEN "event_boundary_key"
    ELSE concat(
      'manual:legacy:',
      "id",
      ':',
      to_char("updated_at" AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')
    )
  END;
--> statement-breakpoint
UPDATE "app_announcement_notification_fanout_task"
SET "fanout_key" = CASE
  WHEN btrim(coalesce("fanout_key", '')) <> ''
    THEN "fanout_key"
  ELSE concat(
    'announcement:',
    "announcement_id",
    ':',
    "desired_event_key",
    ':',
    "event_boundary_key"
  )
END;
--> statement-breakpoint
UPDATE "app_announcement" AS "announcement"
SET "notification_start_boundary_at" = "announcement"."publish_start_time"
WHERE "announcement"."publish_start_time" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "app_announcement_notification_fanout_task" AS "fanout_task"
    WHERE "fanout_task"."announcement_id" = "announcement"."id"
      AND "fanout_task"."desired_event_key" = 'announcement.published'
      AND "fanout_task"."event_boundary_key" = concat(
        'start:',
        to_char("announcement"."publish_start_time" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  );
--> statement-breakpoint
UPDATE "app_announcement" AS "announcement"
SET "notification_end_boundary_at" = "announcement"."publish_end_time"
WHERE "announcement"."publish_end_time" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "app_announcement_notification_fanout_task" AS "fanout_task"
    WHERE "fanout_task"."announcement_id" = "announcement"."id"
      AND "fanout_task"."desired_event_key" = 'announcement.unpublished'
      AND "fanout_task"."event_boundary_key" = concat(
        'end:',
        to_char("announcement"."publish_end_time" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  );
--> statement-breakpoint
DO $$
DECLARE
  duplicate_fanout_key_count bigint;
BEGIN
  SELECT count(*)
    INTO duplicate_fanout_key_count
  FROM (
    SELECT "fanout_key"
    FROM "app_announcement_notification_fanout_task"
    GROUP BY "fanout_key"
    HAVING count(*) > 1
  ) AS duplicate_keys;

  IF duplicate_fanout_key_count <> 0 THEN
    RAISE EXCEPTION
      'system announcement fanout key backfill blocked: duplicate_fanout_key_count=%',
      duplicate_fanout_key_count;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "app_announcement_notification_fanout_task"
  ALTER COLUMN "event_boundary_key" SET NOT NULL,
  ALTER COLUMN "fanout_key" SET NOT NULL,
  ALTER COLUMN "attempt_count" SET DEFAULT 0,
  ALTER COLUMN "attempt_count" SET NOT NULL;
--> statement-breakpoint
UPDATE "app_announcement" AS "announcement"
SET
  "notification_fanout_task_id" = "latest_task"."id",
  "notification_fanout_desired_event_key" = "latest_task"."desired_event_key",
  "notification_fanout_status" = "latest_task"."status",
  "notification_fanout_last_error" = "latest_task"."last_error",
  "notification_fanout_updated_at" = "latest_task"."updated_at"
FROM (
  SELECT DISTINCT ON ("announcement_id")
    "id",
    "announcement_id",
    "desired_event_key",
    "status",
    "last_error",
    "updated_at"
  FROM "app_announcement_notification_fanout_task"
  ORDER BY "announcement_id", "updated_at" DESC, "id" DESC
) AS "latest_task"
WHERE "latest_task"."announcement_id" = "announcement"."id";
--> statement-breakpoint
ALTER TABLE "app_announcement_notification_fanout_task"
  DROP CONSTRAINT IF EXISTS "app_announcement_notification_fanout_task_announcement_id_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_notification_fanout_task_announcement_id_key";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_announcement_notification_fanout_task_fanout_key_key'
  ) THEN
    ALTER TABLE "app_announcement_notification_fanout_task"
      ADD CONSTRAINT "app_announcement_notification_fanout_task_fanout_key_key"
      UNIQUE ("fanout_key");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "app_announcement_notification_fanout_task"
    DROP CONSTRAINT IF EXISTS "app_ann_fanout_task_status_valid_chk";
  ALTER TABLE "app_announcement_notification_fanout_task"
    ADD CONSTRAINT "app_ann_fanout_task_status_valid_chk"
    CHECK ("status" IN (0,1,2,3));

  ALTER TABLE "app_announcement_notification_fanout_task"
    DROP CONSTRAINT IF EXISTS "app_ann_fanout_task_attempt_count_chk";
  ALTER TABLE "app_announcement_notification_fanout_task"
    ADD CONSTRAINT "app_ann_fanout_task_attempt_count_chk"
    CHECK ("attempt_count" >= 0);

  ALTER TABLE "app_announcement_notification_fanout_task"
    DROP CONSTRAINT IF EXISTS "app_ann_fanout_task_fanout_key_not_blank_chk";
  ALTER TABLE "app_announcement_notification_fanout_task"
    ADD CONSTRAINT "app_ann_fanout_task_fanout_key_not_blank_chk"
    CHECK (btrim("fanout_key") <> '');

  ALTER TABLE "app_announcement_notification_fanout_task"
    DROP CONSTRAINT IF EXISTS "app_ann_fanout_task_boundary_key_not_blank_chk";
  ALTER TABLE "app_announcement_notification_fanout_task"
    ADD CONSTRAINT "app_ann_fanout_task_boundary_key_not_blank_chk"
    CHECK (btrim("event_boundary_key") <> '');
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_notification_fanout_task_status_updated_at_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_notification_fanout_task_runnable_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_fanout_pending_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_fanout_failed_retry_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_fanout_lease_expired_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_fanout_pending_idx"
  ON "app_announcement_notification_fanout_task" (
    "status",
    "updated_at",
    "id"
  )
  WHERE "status" = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_fanout_failed_retry_idx"
  ON "app_announcement_notification_fanout_task" (
    "status",
    "next_attempt_at",
    "attempt_count",
    "updated_at",
    "id"
  )
  WHERE "status" = 3;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_fanout_lease_expired_idx"
  ON "app_announcement_notification_fanout_task" (
    "status",
    "processing_lease_expires_at",
    "updated_at",
    "id"
  )
  WHERE "status" = 1;
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_notification_fanout_task_announcement_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_notification_fanout_task_announcement_idx"
  ON "app_announcement_notification_fanout_task" (
    "announcement_id",
    "updated_at" DESC,
    "id" DESC
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_announcement_view" (
  "announcement_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "viewed_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("announcement_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_view_user_id_viewed_at_idx"
  ON "app_announcement_view" ("user_id", "viewed_at" DESC);
--> statement-breakpoint
COMMENT ON TABLE "app_announcement_view" IS E'系统公告浏览记录表。\n用于按用户去重公告浏览次数，避免接口重试或刷新重复累加。';
--> statement-breakpoint
COMMENT ON COLUMN "app_announcement_view"."announcement_id" IS E'关联的公告 ID。';
--> statement-breakpoint
COMMENT ON COLUMN "app_announcement_view"."user_id" IS E'浏览用户 ID。';
--> statement-breakpoint
COMMENT ON COLUMN "app_announcement_view"."viewed_at" IS E'首次浏览时间。';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_app_visible_window_idx"
  ON "app_announcement" (
    "is_published",
    "publish_start_time",
    "publish_end_time",
    "is_pinned" DESC,
    "id" DESC
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_enable_platform_gin_idx"
  ON "app_announcement" USING gin ("enable_platform");
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_realtime_publish_start_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_realtime_publish_start_pending_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_realtime_publish_start_pending_idx"
  ON "app_announcement" ("publish_start_time", "id")
  WHERE "is_realtime" = true
    AND "is_published" = true
    AND "enable_platform" && ARRAY[2]::smallint[]
    AND "publish_start_time" IS NOT NULL
    AND "notification_start_boundary_at" IS DISTINCT FROM "publish_start_time";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_realtime_publish_end_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "app_announcement_realtime_publish_end_pending_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_realtime_publish_end_pending_idx"
  ON "app_announcement" ("publish_end_time", "id")
  WHERE "is_realtime" = true
    AND "is_published" = true
    AND "enable_platform" && ARRAY[2]::smallint[]
    AND "publish_end_time" IS NOT NULL
    AND "notification_end_boundary_at" IS DISTINCT FROM "publish_end_time";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_announcement_notification_fanout_status_idx"
  ON "app_announcement" (
    "notification_fanout_status",
    "notification_fanout_updated_at" DESC,
    "id" DESC
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_user_active_fanout_scan_idx"
  ON "app_user" ("id")
  WHERE "is_enabled" = true AND "deleted_at" IS NULL;
