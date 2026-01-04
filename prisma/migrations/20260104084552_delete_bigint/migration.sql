/*
  Warnings:

  - You are about to alter the column `required_points` on the `forum_level_rule` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to drop the column `object_id` on the `forum_point_record` table. All the data in the column will be lost.
  - You are about to drop the column `object_type` on the `forum_point_record` table. All the data in the column will be lost.
  - You are about to alter the column `points` on the `forum_profile` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- DropIndex
DROP INDEX "forum_point_record_object_type_object_id_idx";

-- AlterTable
ALTER TABLE "forum_level_rule" ALTER COLUMN "required_points" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "forum_point_record" DROP COLUMN "object_id",
DROP COLUMN "object_type";

-- AlterTable
ALTER TABLE "forum_profile" ALTER COLUMN "points" SET DATA TYPE INTEGER;
