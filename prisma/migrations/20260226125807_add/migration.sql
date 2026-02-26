-- AlterTable
ALTER TABLE "work" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "download_points" INTEGER DEFAULT 0,
ADD COLUMN     "download_rule" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN     "required_download_level_id" INTEGER;

-- CreateIndex
CREATE INDEX "work_required_download_level_id_idx" ON "work"("required_download_level_id");

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
