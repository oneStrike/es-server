DROP TABLE IF EXISTS "notification_delivery" CASCADE;
DROP TABLE IF EXISTS "notification_preference" CASCADE;
DROP TABLE IF EXISTS "notification_template" CASCADE;
DROP TABLE IF EXISTS "user_notification" CASCADE;
DROP TABLE IF EXISTS "domain_event_dispatch" CASCADE;
DROP TABLE IF EXISTS "domain_event" CASCADE;
DROP TABLE IF EXISTS "message_outbox" CASCADE;

CREATE TABLE "domain_event" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_key" varchar(120) NOT NULL,
  "domain" varchar(40) NOT NULL,
  "subject_type" varchar(40) NOT NULL,
  "subject_id" integer NOT NULL,
  "target_type" varchar(40) NOT NULL,
  "target_id" integer NOT NULL,
  "operator_id" integer,
  "occurred_at" timestamptz(6) NOT NULL,
  "context" jsonb,
  "created_at" timestamptz(6) DEFAULT now() NOT NULL
);

CREATE INDEX "domain_event_event_key_created_at_idx"
ON "domain_event" ("event_key", "created_at" DESC);

CREATE INDEX "domain_event_domain_occurred_at_idx"
ON "domain_event" ("domain", "occurred_at" DESC);

CREATE INDEX "domain_event_subject_type_subject_id_idx"
ON "domain_event" ("subject_type", "subject_id");

CREATE INDEX "domain_event_target_type_target_id_idx"
ON "domain_event" ("target_type", "target_id");

CREATE TABLE "domain_event_dispatch" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id" bigint NOT NULL,
  "consumer" varchar(40) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamptz(6),
  "last_error" varchar(500),
  "processed_at" timestamptz(6),
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "domain_event_dispatch"
ADD CONSTRAINT "domain_event_dispatch_event_id_consumer_key"
UNIQUE ("event_id", "consumer");

CREATE INDEX "domain_event_dispatch_consumer_status_next_retry_at_id_idx"
ON "domain_event_dispatch" ("consumer", "status", "next_retry_at", "id");

CREATE INDEX "domain_event_dispatch_event_id_idx"
ON "domain_event_dispatch" ("event_id");

CREATE TABLE "notification_template" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "category_key" varchar(80) NOT NULL,
  "title_template" varchar(200) NOT NULL,
  "content_template" varchar(1000) NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "remark" varchar(500),
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "notification_template"
ADD CONSTRAINT "notification_template_category_key_key"
UNIQUE ("category_key");

CREATE INDEX "notification_template_category_key_idx"
ON "notification_template" ("category_key");

CREATE INDEX "notification_template_is_enabled_idx"
ON "notification_template" ("is_enabled");

CREATE INDEX "notification_template_updated_at_idx"
ON "notification_template" ("updated_at");

CREATE TABLE "notification_preference" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "user_id" integer NOT NULL,
  "category_key" varchar(80) NOT NULL,
  "is_enabled" boolean NOT NULL,
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "notification_preference"
ADD CONSTRAINT "notification_preference_user_id_category_key_key"
UNIQUE ("user_id", "category_key");

CREATE INDEX "notification_preference_user_id_idx"
ON "notification_preference" ("user_id");

CREATE INDEX "notification_preference_user_id_is_enabled_idx"
ON "notification_preference" ("user_id", "is_enabled");

CREATE TABLE "user_notification" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "category_key" varchar(80) NOT NULL,
  "projection_key" varchar(180) NOT NULL,
  "receiver_user_id" integer NOT NULL,
  "actor_user_id" integer,
  "title" varchar(200) NOT NULL,
  "content" varchar(1000) NOT NULL,
  "payload" jsonb,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamptz(6),
  "expires_at" timestamptz(6),
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "user_notification"
ADD CONSTRAINT "user_notification_receiver_user_id_projection_key_key"
UNIQUE ("receiver_user_id", "projection_key");

CREATE INDEX "user_notification_receiver_user_id_is_read_created_at_idx"
ON "user_notification" ("receiver_user_id", "is_read", "created_at" DESC);

CREATE INDEX "user_notification_receiver_user_id_category_key_created_at_idx"
ON "user_notification" ("receiver_user_id", "category_key", "created_at" DESC);

CREATE INDEX "user_notification_receiver_user_id_created_at_idx"
ON "user_notification" ("receiver_user_id", "created_at" DESC);

CREATE INDEX "user_notification_receiver_user_id_expires_at_idx"
ON "user_notification" ("receiver_user_id", "expires_at");

CREATE TABLE "notification_delivery" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id" bigint NOT NULL,
  "dispatch_id" bigint NOT NULL,
  "event_key" varchar(120) NOT NULL,
  "receiver_user_id" integer,
  "projection_key" varchar(180),
  "category_key" varchar(80),
  "notification_id" integer,
  "status" varchar(32) NOT NULL,
  "template_id" integer,
  "used_template" boolean DEFAULT false NOT NULL,
  "fallback_reason" varchar(64),
  "failure_reason" varchar(500),
  "last_attempt_at" timestamptz(6) NOT NULL,
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "notification_delivery"
ADD CONSTRAINT "notification_delivery_dispatch_id_key"
UNIQUE ("dispatch_id");

CREATE INDEX "notification_delivery_status_updated_at_idx"
ON "notification_delivery" ("status", "updated_at" DESC);

CREATE INDEX "notification_delivery_receiver_user_id_updated_at_idx"
ON "notification_delivery" ("receiver_user_id", "updated_at" DESC);

CREATE INDEX "notification_delivery_category_key_status_updated_at_idx"
ON "notification_delivery" ("category_key", "status", "updated_at" DESC);

CREATE INDEX "notification_delivery_event_id_idx"
ON "notification_delivery" ("event_id");

CREATE TABLE "app_announcement_notification_fanout_task" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "announcement_id" integer NOT NULL,
  "desired_event_key" varchar(120) NOT NULL,
  "status" varchar(32) NOT NULL,
  "cursor_user_id" integer,
  "last_error" varchar(500),
  "started_at" timestamptz(6),
  "finished_at" timestamptz(6),
  "created_at" timestamptz(6) DEFAULT now() NOT NULL,
  "updated_at" timestamptz(6) NOT NULL
);

ALTER TABLE "app_announcement_notification_fanout_task"
ADD CONSTRAINT "app_announcement_notification_fanout_task_announcement_id_key"
UNIQUE ("announcement_id");

CREATE INDEX "app_announcement_notification_fanout_task_status_idx"
ON "app_announcement_notification_fanout_task" ("status");

CREATE INDEX "app_announcement_notification_fanout_task_status_updated_at_idx"
ON "app_announcement_notification_fanout_task" ("status", "updated_at" DESC);
