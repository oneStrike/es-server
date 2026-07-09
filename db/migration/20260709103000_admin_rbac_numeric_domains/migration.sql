LOCK TABLE "admin_permission", "admin_menu" IN ACCESS EXCLUSIVE MODE;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "admin_permission" WHERE "source" <> 'api') THEN
    RAISE EXCEPTION 'admin_permission.source contains values outside api';
  END IF;
  IF EXISTS (SELECT 1 FROM "admin_menu" WHERE "type" NOT IN ('catalog', 'menu')) THEN
    RAISE EXCEPTION 'admin_menu.type contains values outside catalog/menu';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "admin_permission" DROP CONSTRAINT IF EXISTS "admin_permission_source_chk";--> statement-breakpoint
ALTER TABLE "admin_menu" DROP CONSTRAINT IF EXISTS "admin_menu_type_chk";--> statement-breakpoint
ALTER TABLE "admin_permission" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admin_permission" ALTER COLUMN "source" TYPE smallint USING CASE
  WHEN "source" = 'api' THEN 1
END;--> statement-breakpoint
ALTER TABLE "admin_permission" ALTER COLUMN "source" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "admin_permission" ADD CONSTRAINT "admin_permission_source_chk" CHECK ("source" in (1));--> statement-breakpoint
ALTER TABLE "admin_menu" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admin_menu" ALTER COLUMN "type" TYPE smallint USING CASE
  WHEN "type" = 'catalog' THEN 1
  WHEN "type" = 'menu' THEN 2
END;--> statement-breakpoint
ALTER TABLE "admin_menu" ALTER COLUMN "type" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "admin_menu" ADD CONSTRAINT "admin_menu_type_chk" CHECK ("type" in (1, 2));
