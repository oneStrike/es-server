-- AlterTable
ALTER TABLE "work_comic" ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "work_comic_view_count_idx" ON "work_comic"("view_count");
