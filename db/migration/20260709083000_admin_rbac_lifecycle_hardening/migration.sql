ALTER TABLE "admin_rbac_revision"
  ADD COLUMN IF NOT EXISTS "menu_seeded_at" timestamp(6) with time zone;
--> statement-breakpoint
INSERT INTO "admin_rbac_revision" ("code", "revision", "updated_at", "menu_seeded_at")
SELECT
  'global',
  GREATEST(COALESCE(MAX("revision"), 1), 1),
  COALESCE(MAX("updated_at"), now()),
  CASE WHEN EXISTS (SELECT 1 FROM "admin_menu") THEN now() ELSE NULL END
FROM "admin_rbac_revision"
WHERE "code" IN ('admin', 'global')
ON CONFLICT ("code") DO UPDATE SET
  "revision" = GREATEST("admin_rbac_revision"."revision", EXCLUDED."revision"),
  "updated_at" = GREATEST("admin_rbac_revision"."updated_at", EXCLUDED."updated_at"),
  "menu_seeded_at" = COALESCE("admin_rbac_revision"."menu_seeded_at", EXCLUDED."menu_seeded_at");
--> statement-breakpoint
DELETE FROM "admin_rbac_revision" WHERE "code" = 'admin';
