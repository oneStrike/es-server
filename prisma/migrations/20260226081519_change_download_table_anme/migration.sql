/*
  Warnings:

  - You are about to drop the `user_download` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_download" DROP CONSTRAINT "user_download_user_id_fkey";

-- DropTable
DROP TABLE "user_download";

-- CreateTable
CREATE TABLE "user_download_record" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_download_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_download_record_target_type_target_id_idx" ON "user_download_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_download_record_user_id_idx" ON "user_download_record"("user_id");

-- CreateIndex
CREATE INDEX "user_download_record_created_at_idx" ON "user_download_record"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_download_record_target_type_target_id_user_id_key" ON "user_download_record"("target_type", "target_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_download_record" ADD CONSTRAINT "user_download_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
