/*
  Warnings:

  - You are about to drop the column `can_comment` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `can_download` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `comment_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `download_points` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `like_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `rating_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `read_points` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `read_rule` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `total_chapters` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `total_views` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_amount` on the `work_comic_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_count` on the `work_comic_version` table. All the data in the column will be lost.
  - You are about to drop the column `like_count` on the `work_comic_version` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_amount` on the `work_comic_version` table. All the data in the column will be lost.
  - You are about to drop the column `rating_count` on the `work_comic_version` table. All the data in the column will be lost.
  - You are about to drop the column `read_rule` on the `work_comic_version` table. All the data in the column will be lost.
  - You are about to drop the column `total_views` on the `work_comic_version` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_comic_favorite_count_idx";

-- DropIndex
DROP INDEX "work_comic_rating_rating_count_idx";

-- DropIndex
DROP INDEX "work_comic_read_rule_idx";

-- DropIndex
DROP INDEX "work_comic_total_views_idx";

-- DropIndex
DROP INDEX "work_comic_version_favorite_count_idx";

-- DropIndex
DROP INDEX "work_comic_version_rating_rating_count_idx";

-- DropIndex
DROP INDEX "work_comic_version_total_views_idx";

-- AlterTable
ALTER TABLE "work_comic" DROP COLUMN "can_comment",
DROP COLUMN "can_download",
DROP COLUMN "comment_count",
DROP COLUMN "download_points",
DROP COLUMN "favorite_count",
DROP COLUMN "like_count",
DROP COLUMN "rating_count",
DROP COLUMN "read_points",
DROP COLUMN "read_rule",
DROP COLUMN "total_chapters",
DROP COLUMN "total_views";

-- AlterTable
ALTER TABLE "work_comic_chapter" DROP COLUMN "purchase_amount",
ADD COLUMN     "can_comment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "can_download" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN     "download_points" INTEGER DEFAULT 0,
ADD COLUMN     "read_points" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "work_comic_version" DROP COLUMN "favorite_count",
DROP COLUMN "like_count",
DROP COLUMN "purchase_amount",
DROP COLUMN "rating_count",
DROP COLUMN "read_rule",
DROP COLUMN "total_views";

-- CreateIndex
CREATE INDEX "work_comic_rating_idx" ON "work_comic"("rating");
