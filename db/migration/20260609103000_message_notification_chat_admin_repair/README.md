# Message notification/chat admin repair migration

This migration closes the database portion of the message notification and chat
admin repair pass.

## What changes

- Adds `chat_conversation_member.is_pinned` for app/admin conversation pinning.
- Adds `chat_conversation_member.hidden_at` for user-scoped conversation hide
  without marking the direct-chat member as left.
- Adds `user_notification.is_hidden` for app notification hide semantics.
- Adds `message_ws_metric.fanout_skipped_count` and
  `message_ws_metric.fanout_publish_error_count` so admin WS monitoring can
  surface cross-instance realtime fanout risks instead of relying on logs only.
- Rebuilds user notification inbox indexes so hidden rows stay out of app reads.
- Rebuilds chat conversation member indexes so pinned conversations can be read
  without a table scan.
- Adds monitor/admin indexes for notification delivery, domain-event dispatch,
  and notification template list filters and sort orders.

## Default path

`db:migrate:prod` and `db:migrate` run this SQL through Drizzle migrators, so
pending migration statements execute inside a transaction. The checked-in SQL
therefore uses ordinary `ALTER TABLE`, `DROP INDEX IF EXISTS`, and
`CREATE INDEX IF NOT EXISTS` statements.

This checked-in default path assumes the migration has not been partially
applied. If any added column already exists before Drizzle records this
migration as applied, stop and treat the rollout as a partial manual deployment;
do not rerun this file as a recovery shortcut, because the column phase uses
plain `ADD COLUMN` to preserve the committed migration contract. Complete
recovery by validating the manual column/index state and recording one explicit
migration decision before resuming later migrations.

Use this default path during a maintenance window for production data sets. The
column adds are short metadata changes on modern PostgreSQL, but index rebuilds
on `chat_conversation_member` and `user_notification`, plus new indexes on
`notification_delivery` and `domain_event_dispatch`, can still take locks and
consume IO on hot tables.

## Large table online path

If online rollout is required for large production tables, run the schema/index
work manually in dedicated database sessions before marking this migration as
applied. Do not run the checked-in `migration.sql` after the full manual path,
because it intentionally drops and rebuilds several indexes in a transaction.

Use short lock timeouts for the column phase:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '5min';

ALTER TABLE "chat_conversation_member"
  ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;

ALTER TABLE "chat_conversation_member"
  ADD COLUMN IF NOT EXISTS "hidden_at" timestamp(6) with time zone;

ALTER TABLE "user_notification"
  ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false NOT NULL;

ALTER TABLE "message_ws_metric"
  ADD COLUMN IF NOT EXISTS "fanout_skipped_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "message_ws_metric"
  ADD COLUMN IF NOT EXISTS "fanout_publish_error_count" integer DEFAULT 0 NOT NULL;
```

Run index changes outside any transaction:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '30min';

DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_user_id_joined_at_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_conversation_member_user_id_joined_at_idx"
  ON "chat_conversation_member" ("user_id", "is_pinned" DESC, "joined_at", "conversation_id");

DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_active_user_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_conversation_member_active_user_idx"
  ON "chat_conversation_member" ("user_id", "is_pinned" DESC, "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_active_unread_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_conversation_member_active_unread_idx"
  ON "chat_conversation_member" ("user_id", "unread_count", "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NULL;

DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_hidden_user_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "chat_conversation_member_hidden_user_idx"
  ON "chat_conversation_member" ("user_id", "hidden_at" DESC, "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_is_read_created_at_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_notification_receiver_user_id_is_read_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "is_read", "created_at" DESC);

DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_category_key_created_at_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_notification_receiver_user_id_category_key_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "category_key", "created_at" DESC);

DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_created_at_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_notification_receiver_user_id_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_delivery_status_updated_at_id_idx"
  ON "notification_delivery" ("status", "updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_delivery_updated_at_id_idx"
  ON "notification_delivery" ("updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_delivery_category_status_updated_at_id_idx"
  ON "notification_delivery" ("category_key", "status", "updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_delivery_receiver_updated_at_id_idx"
  ON "notification_delivery" ("receiver_user_id", "updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_event_dispatch_consumer_status_updated_at_id_idx"
  ON "domain_event_dispatch" ("consumer", "status", "updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_template_enabled_updated_at_id_idx"
  ON "notification_template" ("is_enabled", "updated_at" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_template_category_updated_at_id_idx"
  ON "notification_template" ("category_key", "updated_at" DESC, "id" DESC);
```

After the manual path completes, inspect invalid concurrent indexes before
marking the migration applied:

```sql
SELECT indexrelid::regclass AS index_name, indisvalid, indisready
FROM pg_index
WHERE indexrelid::regclass::text IN (
  'chat_conversation_member_user_id_joined_at_idx',
  'chat_conversation_member_active_user_idx',
  'chat_conversation_member_active_unread_idx',
  'chat_conversation_member_hidden_user_idx',
  'user_notification_receiver_user_id_is_read_created_at_idx',
  'user_notification_receiver_user_id_category_key_created_at_idx',
  'user_notification_receiver_user_id_created_at_idx',
  'notification_delivery_status_updated_at_id_idx',
  'notification_delivery_updated_at_id_idx',
  'notification_delivery_category_status_updated_at_id_idx',
  'notification_delivery_receiver_updated_at_id_idx',
  'domain_event_dispatch_consumer_status_updated_at_id_idx',
  'notification_template_enabled_updated_at_id_idx',
  'notification_template_category_updated_at_id_idx'
);
```

## Rollback

```sql
DROP INDEX CONCURRENTLY IF EXISTS "notification_template_category_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "notification_template_enabled_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "domain_event_dispatch_consumer_status_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "notification_delivery_receiver_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "notification_delivery_category_status_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "notification_delivery_updated_at_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "notification_delivery_status_updated_at_id_idx";

DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_created_at_idx";
DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_category_key_created_at_idx";
DROP INDEX CONCURRENTLY IF EXISTS "user_notification_receiver_user_id_is_read_created_at_idx";

DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_active_user_idx";
DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_active_unread_idx";
DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_hidden_user_idx";
DROP INDEX CONCURRENTLY IF EXISTS "chat_conversation_member_user_id_joined_at_idx";

ALTER TABLE "user_notification" DROP COLUMN IF EXISTS "is_hidden";
ALTER TABLE "message_ws_metric" DROP COLUMN IF EXISTS "fanout_publish_error_count";
ALTER TABLE "message_ws_metric" DROP COLUMN IF EXISTS "fanout_skipped_count";
ALTER TABLE "chat_conversation_member" DROP COLUMN IF EXISTS "hidden_at";
ALTER TABLE "chat_conversation_member" DROP COLUMN IF EXISTS "is_pinned";
```
