ALTER TABLE "forum_section" ADD COLUMN "cover" varchar(500);--> statement-breakpoint
ALTER TABLE "forum_section" ALTER COLUMN "icon" SET DATA TYPE varchar(500) USING "icon"::varchar(500);--> statement-breakpoint
UPDATE "forum_section" AS "section"
SET
  "icon" = COALESCE("section"."icon", "work"."cover", "section"."cover", ''),
  "cover" = COALESCE("section"."cover", "section"."icon", "work"."cover", '')
FROM "work"
WHERE "work"."forum_section_id" = "section"."id";--> statement-breakpoint
UPDATE "forum_section"
SET
  "icon" = COALESCE("icon", "cover", ''),
  "cover" = COALESCE("cover", "icon", '')
WHERE "icon" IS NULL OR "cover" IS NULL;--> statement-breakpoint
ALTER TABLE "forum_section" ALTER COLUMN "icon" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forum_section" ALTER COLUMN "cover" SET NOT NULL;
