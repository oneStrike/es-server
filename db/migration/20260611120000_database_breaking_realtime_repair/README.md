# Database Breaking Realtime Repair Migration

## Operational Notes

This migration is destructive and must run in a controlled deployment window. It uses plain `ALTER TABLE` and `CREATE INDEX IF NOT EXISTS` statements because project migrations run as normal migration DDL, not as out-of-transaction online index jobs.

Legacy `work_chapter.content` is removed. During the cutover, novel rows move the old value to `novel_content_path`; comic rows only move the old value to `comic_content_manifest` when it is already a JSON image-path array. Existing non-array comic text is preserved only as `description` when that field is empty, then the obsolete mixed-purpose `content` column is dropped.

Expected lock-sensitive objects:

- `work_chapter`
- `sys_request_log`
- `domain_event_dispatch`
- `notification_delivery`
- `user_notification`
- `chat_message`
- `chat_conversation`
- `user_comment`
- `forum_user_action_log`
- `task_event_log`
- `growth_audit_log`
- `growth_ledger_record`
- `user_browse_log`
- `sensitive_word_hit_log`
- `payment_notify_event`

Deploy sequence:

1. Stop or drain write-heavy workers for the tables above.
2. Apply this migration during the database maintenance window.
3. Run the reconciliation/static checks listed in the Autopilot verification report.
4. Resume workers after migration success.

## Retention Defaults

`retention_until` is an eligibility boundary for later cleanup jobs. This migration does not delete or archive existing rows.

New rows get database defaults even when an application writer omits the field:

- `sys_request_log`: `now() + interval '180 days'`
- `domain_event_dispatch`: `now() + interval '90 days'`
- `notification_delivery`: `now() + interval '180 days'`
- `user_notification`: `now() + interval '180 days'`
- `chat_message`: `now() + interval '365 days'`
- `chat_conversation`: `now() + interval '365 days'`
- `user_comment`: `now() + interval '365 days'`
- `forum_user_action_log`: `now() + interval '180 days'`
- `task_event_log`: `now() + interval '180 days'`
- `growth_audit_log`: `now() + interval '365 days'`
- `growth_ledger_record`: `now() + interval '730 days'`
- `user_browse_log`: `now() + interval '180 days'`
- `sensitive_word_hit_log`: `now() + interval '180 days'`
- `payment_notify_event`: `now() + interval '730 days'`

No table in this retention checklist intentionally relies on a nullable new-row path.
