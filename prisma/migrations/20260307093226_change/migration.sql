/*
  Warnings:

  - You are about to drop the `user_experience_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_point_record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_experience_record" DROP CONSTRAINT "user_experience_record_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "user_experience_record" DROP CONSTRAINT "user_experience_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_point_record" DROP CONSTRAINT "user_point_record_purchase_id_fkey";

-- DropForeignKey
ALTER TABLE "user_point_record" DROP CONSTRAINT "user_point_record_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "user_point_record" DROP CONSTRAINT "user_point_record_user_id_fkey";

-- DropTable
DROP TABLE "user_experience_record";

-- DropTable
DROP TABLE "user_point_record";
