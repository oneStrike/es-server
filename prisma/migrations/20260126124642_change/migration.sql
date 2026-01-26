/*
  Warnings:

  - You are about to drop the column `is_locked` on the `admin_user` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_at` on the `admin_user` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_count` on the `admin_user` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_ip` on the `admin_user` table. All the data in the column will be lost.
  - You are about to drop the `_TopicTags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operation_member_level` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_TopicTags" DROP CONSTRAINT "_TopicTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_TopicTags" DROP CONSTRAINT "_TopicTags_B_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_download_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_read_level_id_fkey";

-- DropIndex
DROP INDEX "admin_user_is_locked_idx";

-- AlterTable
ALTER TABLE "admin_user" DROP COLUMN "is_locked",
DROP COLUMN "login_fail_at",
DROP COLUMN "login_fail_count",
DROP COLUMN "login_fail_ip";

-- AlterTable
ALTER TABLE "app_level_rule" ADD COLUMN     "blacklist_limit" SMALLINT NOT NULL DEFAULT 10,
ADD COLUMN     "discount" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "login_days" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "work_collection_limit" SMALLINT NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "order" DROP NOT NULL;

-- DropTable
DROP TABLE "_TopicTags";

-- DropTable
DROP TABLE "operation_member_level";

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "app_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "app_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
