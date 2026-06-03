WITH audit_metrics AS (
  SELECT metric, value
  FROM "migration_audit"
  WHERE "migration_key" = '20260603081500_membership_benefit_closure_breaking'
)
SELECT
  'deleted_invalid_plan_benefit_count' AS check_name,
  COALESCE(
    (SELECT value FROM audit_metrics WHERE metric = 'deleted_invalid_plan_benefit_count'),
    0
  ) AS issue_count
UNION ALL
SELECT
  'deleted_orphan_plan_benefit_count' AS check_name,
  COALESCE(
    (SELECT value FROM audit_metrics WHERE metric = 'deleted_orphan_plan_benefit_count'),
    0
  ) AS issue_count
UNION ALL
SELECT
  'deleted_unsupported_benefit_definition_count' AS check_name,
  COALESCE(
    (SELECT value FROM audit_metrics WHERE metric = 'deleted_unsupported_benefit_definition_count'),
    0
  ) AS issue_count
UNION ALL
SELECT
  'unsupported_benefit_definition_count' AS check_name,
  count(*) AS issue_count
FROM "membership_benefit_definition"
WHERE "benefit_type" NOT IN (1, 2)
UNION ALL
SELECT
  'invalid_plan_benefit_pair_count' AS check_name,
  count(*) AS issue_count
FROM "membership_plan_benefit" mpb
JOIN "membership_benefit_definition" mbd ON mbd."id" = mpb."benefit_id"
WHERE mpb."grant_policy" NOT IN (1, 2)
   OR (mbd."benefit_type" = 1 AND mpb."grant_policy" <> 1)
   OR (mbd."benefit_type" = 2 AND mpb."grant_policy" <> 2)
UNION ALL
SELECT
  'orphan_plan_benefit_count' AS check_name,
  count(*) AS issue_count
FROM "membership_plan_benefit" mpb
LEFT JOIN "membership_plan" mp ON mp."id" = mpb."plan_id"
LEFT JOIN "membership_benefit_definition" mbd ON mbd."id" = mpb."benefit_id"
WHERE mp."id" IS NULL OR mbd."id" IS NULL
UNION ALL
SELECT
  'claim_table_present_count' AS check_name,
  count(*) AS issue_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'membership_benefit_claim_record';
