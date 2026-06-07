# Task Event Failure Hard Cutover

This migration enforces the task execution hard cutover before adding durable
task event failure facts.

Preflight SQL for release review:

```sql
-- claim_mode: 1=AUTO, 2=MANUAL
-- trigger_mode: 1=MANUAL, 2=EVENT
select
  d.id as task_id,
  d.title as task_title,
  d.status as task_status,
  d.claim_mode,
  s.id as step_id,
  s.trigger_mode,
  count(i.id) as instance_count
from task_definition d
join task_step s on s.task_id = d.id
left join task_instance i on i.task_id = d.id and i.deleted_at is null
where d.deleted_at is null
  and (
    (d.claim_mode = 1 and s.trigger_mode <> 2)
    or (d.claim_mode = 2 and s.trigger_mode <> 1)
  )
group by d.id, d.title, d.status, d.claim_mode, s.id, s.trigger_mode
order by d.id, s.id;
```

The migration deliberately fails fast when illegal rows exist. It does not
rewrite `claim_mode` or `trigger_mode`, because that would silently change task
execution semantics. PostgreSQL cannot express the cross-table
`task_definition.claim_mode + task_step.trigger_mode` matrix with a plain check
constraint, so the durable guard is service-layer validation plus this preflight
block.

New query indexes:

- `task_instance_live_task_created_idx` supports admin task-filtered instance pages.
- `task_event_failure_status_created_at_idx` supports pending-failure retry scans.
- `task_event_failure_event_key_biz_key_idx` supports idempotent event lookup.
- `task_event_failure_user_created_at_idx` supports admin user-scoped failure search.

Rollback:

```sql
DROP TABLE IF EXISTS "task_event_failure";
DROP INDEX IF EXISTS "task_instance_live_task_created_idx";
```
