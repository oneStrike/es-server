-- AlterTable
ALTER TABLE "work_comic_chapter" ADD COLUMN     "required_download_level_id" INTEGER,
ADD COLUMN     "required_read_level_id" INTEGER;

-- CreateIndex
CREATE INDEX "work_comic_chapter_required_read_level_id_idx" ON "work_comic_chapter"("required_read_level_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_required_download_level_id_idx" ON "work_comic_chapter"("required_download_level_id");
