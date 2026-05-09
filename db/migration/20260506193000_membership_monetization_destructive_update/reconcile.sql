SELECT
  (SELECT count(*)::int FROM "work" WHERE "view_rule" = 2) AS "workViewRuleVipCount",
  (SELECT count(*)::int FROM "work_chapter" WHERE "view_rule" = 2) AS "chapterViewRuleVipCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "status" = 1 AND "target_type" in (1, 2)
  ) AS "successPurchaseCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "status" = 1 AND "target_type" in (1, 2)
  ) AS "migratablePurchaseEntitlementCount",
  (
    SELECT count(*)::int
    FROM "user_content_entitlement"
    WHERE "grant_source" = 1 AND "status" = 1 AND "target_type" in (1, 2)
  ) AS "existingPurchaseEntitlementCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "status" = 2 AND "target_type" in (1, 2)
  ) AS "failedPurchaseSkippedCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "status" = 4 AND "target_type" in (1, 2)
  ) AS "refundedPurchaseSkippedCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "payment_method" = 4
  ) AS "legacyPointsPaymentCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record"
    WHERE "payment_method" = 4
  ) AS "paymentMethodToLegacyPointsCount",
  0 AS "duplicatePurchaseDedupCount",
  (
    SELECT count(*)::int
    FROM "user_purchase_record" upr
    LEFT JOIN "work_chapter" wc ON wc."id" = upr."target_id"
    WHERE upr."status" = 1
      AND upr."target_type" in (1, 2)
      AND wc."id" IS NULL
  ) AS "orphanPurchaseTargetCount",
  (
    SELECT count(*)::int
    FROM "user_content_entitlement"
    WHERE "grant_source" = 1 AND "status" = 1 AND "target_type" in (1, 2)
  ) AS "postMigrationPurchaseEntitlementCount";

