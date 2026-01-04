/*
  Warnings:

  - You are about to alter the column `points` on the `forum_point_record` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `before_points` on the `forum_point_record` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `after_points` on the `forum_point_record` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "forum_point_record" ALTER COLUMN "points" SET DATA TYPE INTEGER,
ALTER COLUMN "before_points" SET DATA TYPE INTEGER,
ALTER COLUMN "after_points" SET DATA TYPE INTEGER;
