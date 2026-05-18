# Drop content_import_event_link rollback note

Before applying the migration in an environment with database access, capture:

```sql
select count(*) from content_import_event_link;
```

Rollback requires recreating the table from `rollback.sql`, regenerating DB comments if the active schema is restored, then rerunning:

```powershell
pnpm -C D:\code\es\es-server db:comments:check
pnpm -C D:\code\es\es-server type-check
```
