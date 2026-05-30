DO $$
BEGIN
  IF to_regclass('public.membership_auto_renew_agreement') IS NOT NULL
    AND EXISTS (SELECT 1 FROM "membership_auto_renew_agreement")
  THEN
    RAISE EXCEPTION
      'Refusing to remove membership auto-renewal: membership_auto_renew_agreement still contains rows';
  END IF;

  IF to_regclass('public.payment_order') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "payment_order"
      WHERE "subscription_mode" IN (2, 3)
        OR "auto_renew_agreement_id" IS NOT NULL
    )
  THEN
    RAISE EXCEPTION
      'Refusing to remove membership auto-renewal: payment_order still contains auto-renewal rows';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "payment_order"
  DROP CONSTRAINT IF EXISTS "payment_order_subscription_mode_valid_chk";
--> statement-breakpoint
ALTER TABLE "payment_order"
  ADD CONSTRAINT "payment_order_subscription_mode_valid_chk"
  CHECK ("subscription_mode" IN (1));
--> statement-breakpoint
ALTER TABLE "payment_order"
  DROP COLUMN IF EXISTS "auto_renew_agreement_id";
--> statement-breakpoint
ALTER TABLE "membership_plan"
  DROP COLUMN IF EXISTS "auto_renew_enabled";
--> statement-breakpoint
ALTER TABLE "membership_page_config"
  DROP COLUMN IF EXISTS "auto_renew_notice";
--> statement-breakpoint
ALTER TABLE "payment_provider_config"
  DROP COLUMN IF EXISTS "agreement_notify_url";
--> statement-breakpoint
ALTER TABLE "payment_provider_config"
  DROP COLUMN IF EXISTS "supports_auto_renew";
--> statement-breakpoint
DROP TABLE IF EXISTS "membership_auto_renew_agreement";
