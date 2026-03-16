ALTER TABLE "forum_section"
ALTER COLUMN "name" TYPE VARCHAR(100);

ALTER TABLE "work"
ADD COLUMN "forum_section_id" INTEGER;

CREATE UNIQUE INDEX "work_forum_section_id_key" ON "work"("forum_section_id");

CREATE INDEX "work_forum_section_id_idx" ON "work"("forum_section_id");

ALTER TABLE "work"
ADD CONSTRAINT "work_forum_section_id_fkey"
FOREIGN KEY ("forum_section_id") REFERENCES "forum_section"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
