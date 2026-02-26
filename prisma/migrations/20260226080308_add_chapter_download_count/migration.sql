-- AlterTable
ALTER TABLE "work_chapter" ADD COLUMN     "download_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "content_path" SET DATA TYPE TEXT;
