# Membership Benefit Closure Breaking Migration

This migration destructively narrows membership benefits to the v1 contract:

- `membership_benefit_definition.benefit_type in (1, 2)`
- `membership_plan_benefit.grant_policy in (1, 2)`
- valid pairs are `DISPLAY + DISPLAY_ONLY` and `COUPON_GRANT + AUTO_GRANT_ON_SUBSCRIBE`
- `membership_benefit_claim_record` is dropped with `CASCADE` because daily/manual claim flows are not implemented

Unsupported item grants, no-ad policy, early-access policy, subscription entitlement, daily claim, active-during-subscription, and manual claim rows are intentionally deleted. Future no-ad, early-access, claim, or item grant features must be reintroduced through a separate entitlement-engine PRD with app APIs, revoke/refund behavior, and tests.

## Preflight impact SQL

Run before migration if release reviewers need the destructive impact preview:

```sql
SELECT count(*) AS would_delete_invalid_plan_benefit_count
FROM "membership_plan_benefit" mpb
JOIN "membership_benefit_definition" mbd ON mbd."id" = mpb."benefit_id"
WHERE mbd."benefit_type" NOT IN (1, 2)
   OR mpb."grant_policy" NOT IN (1, 2)
   OR (mbd."benefit_type" = 1 AND mpb."grant_policy" <> 1)
   OR (mbd."benefit_type" = 2 AND mpb."grant_policy" <> 2);

SELECT count(*) AS would_delete_unsupported_benefit_definition_count
FROM "membership_benefit_definition"
WHERE "benefit_type" NOT IN (1, 2);
```

## Release checklist

1. Run the migration.
2. Run `reconcile.sql`.
3. Confirm these final counts are `0`:
   - `unsupported_benefit_definition_count`
   - `invalid_plan_benefit_pair_count`
   - `orphan_plan_benefit_count`
   - `claim_table_present_count`
4. Record audit metrics from `reconcile.sql`:
   - `deleted_invalid_plan_benefit_count`
   - `deleted_orphan_plan_benefit_count`
   - `deleted_unsupported_benefit_definition_count`

Cross-table pair validation remains service-owned and reconcile-owned because `benefit_type` lives on `membership_benefit_definition` while `grant_policy` lives on `membership_plan_benefit`.
