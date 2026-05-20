-- Breaking workflow/content-import error contract migration.
-- Server keeps durable codes/facts/diagnostics; admin owns all display wording.

ALTER TABLE "workflow_job"
  ADD COLUMN "progress_code" varchar(120),
  ADD COLUMN "progress_context" jsonb;

UPDATE "workflow_job"
SET
  "progress_code" = 'UNKNOWN_WORKFLOW_PROGRESS',
  "progress_context" = jsonb_strip_nulls(
    jsonb_build_object(
      'legacyProgressMessage', "progress_message",
      'migratedFrom', 'workflow_job.progress_message'
    )
  )
WHERE "progress_message" IS NOT NULL;

ALTER TABLE "workflow_job"
  DROP COLUMN "progress_message";

ALTER TABLE "workflow_attempt"
  ADD COLUMN "error_domain" varchar(80),
  ADD COLUMN "error_stage" varchar(80),
  ADD COLUMN "error_severity" varchar(40),
  ADD COLUMN "error_retryable" boolean,
  ADD COLUMN "error_context" jsonb,
  ADD COLUMN "error_diagnostic" jsonb;

UPDATE "workflow_attempt"
SET
  "error_code" = coalesce("error_code", 'UNKNOWN_WORKFLOW_ERROR'),
  "error_domain" = coalesce("error_domain", 'unknown'),
  "error_stage" = coalesce("error_stage", 'legacy'),
  "error_severity" = coalesce("error_severity", 'error'),
  "error_retryable" = coalesce("error_retryable", false),
  "error_context" = coalesce("error_context", '{"legacy":true}'::jsonb),
  "error_diagnostic" = coalesce(
    "error_diagnostic",
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacyMessage', "error_message",
        'migratedFrom', 'workflow_attempt.error_message'
      )
    )
  )
WHERE "error_code" IS NOT NULL
  OR "error_message" IS NOT NULL;

ALTER TABLE "workflow_attempt"
  DROP COLUMN "error_message";

ALTER TABLE "workflow_event"
  ADD COLUMN "event_code" varchar(120);

UPDATE "workflow_event"
SET
  "event_code" = CASE "event_type"
    WHEN 1 THEN 'WORKFLOW_JOB_CREATED'
    WHEN 2 THEN 'WORKFLOW_JOB_CONFIRMED'
    WHEN 3 THEN 'WORKFLOW_ATTEMPT_CLAIMED'
    WHEN 4 THEN 'WORKFLOW_ATTEMPT_HEARTBEAT'
    WHEN 5 THEN 'WORKFLOW_PROGRESS_UPDATED'
    WHEN 6 THEN 'WORKFLOW_ITEM_SUCCEEDED'
    WHEN 7 THEN 'WORKFLOW_ITEM_FAILED'
    WHEN 8 THEN 'WORKFLOW_ATTEMPT_COMPLETED'
    WHEN 9 THEN 'WORKFLOW_CANCEL_REQUESTED'
    WHEN 10 THEN 'WORKFLOW_MANUAL_RETRY_ATTEMPT_CREATED'
    WHEN 11 THEN 'WORKFLOW_DRAFT_EXPIRED'
    WHEN 12 THEN 'WORKFLOW_RETAINED_RESOURCE_CLEANED'
    ELSE 'WORKFLOW_EVENT_LEGACY'
  END,
  "detail" = coalesce("detail", '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'legacyMessage', "message",
        'migratedFrom', 'workflow_event.message'
      )
    )
WHERE "event_code" IS NULL;

ALTER TABLE "workflow_event"
  ALTER COLUMN "event_code" SET NOT NULL,
  DROP CONSTRAINT IF EXISTS "workflow_event_message_nonblank_chk",
  DROP COLUMN "message";

ALTER TABLE "workflow_event"
  ADD CONSTRAINT "workflow_event_code_nonblank_chk"
  CHECK (length(trim("event_code")) > 0);

ALTER TABLE "content_import_item"
  ADD COLUMN "last_error_domain" varchar(80),
  ADD COLUMN "last_error_stage" varchar(80),
  ADD COLUMN "last_error_severity" varchar(40),
  ADD COLUMN "last_error_retryable" boolean,
  ADD COLUMN "last_error_context" jsonb,
  ADD COLUMN "last_error_diagnostic" jsonb,
  ADD COLUMN "last_retry_context" jsonb,
  ADD COLUMN "last_retry_diagnostic" jsonb;

UPDATE "content_import_item"
SET
  "last_error_code" = coalesce("last_error_code", 'UNKNOWN_WORKFLOW_ERROR'),
  "last_error_domain" = coalesce("last_error_domain", 'unknown'),
  "last_error_stage" = coalesce("last_error_stage", 'legacy'),
  "last_error_severity" = coalesce("last_error_severity", 'error'),
  "last_error_retryable" = coalesce("last_error_retryable", false),
  "last_error_context" = coalesce("last_error_context", '{"legacy":true}'::jsonb),
  "last_error_diagnostic" = coalesce(
    "last_error_diagnostic",
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacyMessage', "last_error_message",
        'migratedFrom', 'content_import_item.last_error_message'
      )
    )
  )
WHERE "last_error_code" IS NOT NULL
  OR "last_error_message" IS NOT NULL;

UPDATE "content_import_item"
SET
  "last_retry_code" = coalesce("last_retry_code", 'CONTENT_IMPORT_RATE_LIMITED'),
  "last_retry_context" = coalesce("last_retry_context", '{"legacy":true}'::jsonb),
  "last_retry_diagnostic" = coalesce(
    "last_retry_diagnostic",
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacyMessage', "last_retry_reason",
        'migratedFrom', 'content_import_item.last_retry_reason'
      )
    )
  )
WHERE "last_retry_code" IS NOT NULL
  OR "last_retry_reason" IS NOT NULL;

ALTER TABLE "content_import_item"
  DROP COLUMN "last_error_message",
  DROP COLUMN "last_retry_reason";

ALTER TABLE "content_import_item_attempt"
  ADD COLUMN "error_domain" varchar(80),
  ADD COLUMN "error_stage" varchar(80),
  ADD COLUMN "error_severity" varchar(40),
  ADD COLUMN "error_retryable" boolean,
  ADD COLUMN "error_context" jsonb,
  ADD COLUMN "error_diagnostic" jsonb;

UPDATE "content_import_item_attempt"
SET
  "error_code" = coalesce("error_code", 'UNKNOWN_WORKFLOW_ERROR'),
  "error_domain" = coalesce("error_domain", 'unknown'),
  "error_stage" = coalesce("error_stage", 'legacy'),
  "error_severity" = coalesce("error_severity", 'error'),
  "error_retryable" = coalesce("error_retryable", false),
  "error_context" = coalesce("error_context", '{"legacy":true}'::jsonb),
  "error_diagnostic" = coalesce(
    "error_diagnostic",
    jsonb_strip_nulls(
      jsonb_build_object(
        'legacyMessage', "error_message",
        'migratedFrom', 'content_import_item_attempt.error_message'
      )
    )
  )
WHERE "error_code" IS NOT NULL
  OR "error_message" IS NOT NULL;

ALTER TABLE "content_import_item_attempt"
  DROP COLUMN "error_message";
