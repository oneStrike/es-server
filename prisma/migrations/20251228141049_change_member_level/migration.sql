-- AlterTable
ALTER TABLE "member_level" ADD COLUMN     "level" SMALLINT NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "member_level_level_idx" ON "member_level"("level");
