-- Add subsection fields to ForumSection
ALTER TABLE "forum_section" ADD COLUMN "parent_id" INTEGER;
ALTER TABLE "forum_section" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "forum_section" ADD COLUMN "path" VARCHAR(200);
ALTER TABLE "forum_section" ADD COLUMN "inherit_permission" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "forum_section" ADD COLUMN "reply_count" INTEGER NOT NULL DEFAULT 0;

-- Add indexes for new columns
CREATE INDEX "idx_forum_section_parent_id" ON "forum_section"("parent_id");
CREATE INDEX "idx_forum_section_level" ON "forum_section"("level");

-- Add permission fields to ForumModeratorSection
ALTER TABLE "forum_moderator_section" ADD COLUMN "inherit_from_parent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "forum_moderator_section" ADD COLUMN "custom_permission_mask" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "forum_moderator_section" ADD COLUMN "final_permission_mask" INTEGER NOT NULL DEFAULT 0;

-- Update existing ForumSection records to set default values
UPDATE "forum_section"
SET "path" = '/' || "id"::TEXT
WHERE "path" IS NULL;

-- Add foreign key constraint for parent_id
ALTER TABLE "forum_section"
ADD CONSTRAINT "fk_forum_section_parent"
FOREIGN KEY ("parent_id")
REFERENCES "forum_section"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
