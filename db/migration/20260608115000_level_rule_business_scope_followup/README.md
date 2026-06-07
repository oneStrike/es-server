# Level Rule Business Scope Follow-up

This follow-up migration keeps already-applied migration history stable while closing the default-business edge case.

## Contract

- Converts blank or whitespace-only `user_level_rule.business` values to `NULL`.
- Fails before normalization if the normalized enabled business threshold set would contain duplicates.
- Replaces quota helper indexes with `(user_id, created_at)` indexes that match global per-user daily quota counts.

## Preflight

```sql
SELECT NULLIF(btrim(COALESCE(business, '')), '') AS normalized_business,
  required_experience,
  count(*) AS duplicate_count
FROM user_level_rule
WHERE is_enabled = true
GROUP BY NULLIF(btrim(COALESCE(business, '')), ''), required_experience
HAVING count(*) > 1;
```
