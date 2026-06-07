# Forum Topic Breaking Repair

This release replaces the previous one-way admin topic deletion behavior with a recoverable-delete contract for server/admin only.

## Contract Changes

- Admin topic list supports `deletedState=active|deleted|all`.
- Admin topic list date filters now apply to `createdAt` with the shared application time-zone date-only range.
- Unknown admin topic `orderBy` fields or directions are rejected instead of ignored.
- Deleting a topic soft-deletes the topic and only currently live forum-topic comments, marking those comments with `topicDeleteCascadeId`.
- Restoring a topic only revives comments with the matching topic-delete cascade marker. Comments deleted before the topic delete are not restored.
- Admin topic detail can read deleted topics so operators can inspect deleted-list records before restore.

## Governance

Topic governance actions now write to the widened forum governance log:

- moderator actions write `actorType=moderator`, `actorUserId=<moderator user id>`, and `moderatorId`;
- admin actions write `actorType=admin`, `actorUserId=<admin user id>`, and `moderatorId=null`;
- restore uses action type `16`.
- admin/moderator topic content updates use action type `17` and do not write user action log rows.
- admin comment deletion uses the same governance log as moderator deletion and does not rely only on generic request audit metadata.

The generic API audit decorator remains as request audit metadata, but it is no longer the only domain-level fact for admin topic governance actions.

## Migration And Indexes

The migration adds:

- `user_comment.topic_delete_cascade_id`;
- governance actor columns and constraints on `forum_moderator_action_log`;
- admin topic list indexes for active/default, audit, section, user, created-date, and deleted-review paths.
- admin comment list indexes for live default pagination, user filtering, and audit-status filtering.

The checked-in Drizzle migrations use normal `CREATE INDEX IF NOT EXISTS`
statements because `db:migrate:prod` runs migrations through Drizzle's
transactional migrator. On large production `forum_topic` or `user_comment`
tables, operators should pre-create the same indexes with `CREATE INDEX
CONCURRENTLY IF NOT EXISTS` outside the migrator during a production-safe
window, then run `db:migrate:prod` to apply the remaining idempotent DDL and
record the migration.

## Admin Surface

- The comment list user filter is a user picker instead of a raw `userId` input.
- The comment list exposes delete through governance-backed confirmation.

Old moderator action logs are backfilled from `forum_moderator.user_id`. If a
legacy row references a missing moderator record, migration fails fast so
operators can repair or archive that orphan row before the new actor constraint
is installed.

## App Scope

Public/app topic queries continue to exclude deleted topics. App clients were not reviewed in this round.
