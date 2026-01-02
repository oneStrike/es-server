-- AlterTable
ALTER TABLE "work_comic_chapter" ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "purchase_count" INTEGER NOT NULL DEFAULT 0;
