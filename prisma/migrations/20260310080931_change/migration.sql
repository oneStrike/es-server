/*
  Warnings:

  - You are about to drop the `user_browse_state` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_browse_state" DROP CONSTRAINT "user_browse_state_last_viewed_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "user_browse_state" DROP CONSTRAINT "user_browse_state_user_id_fkey";

-- DropTable
DROP TABLE "user_browse_state";

-- CreateTable
CREATE TABLE "user_work_reading_state" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL,
    "last_read_chapter_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_work_reading_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_work_reading_state_user_id_work_type_last_read_at_idx" ON "user_work_reading_state"("user_id", "work_type", "last_read_at");

-- CreateIndex
CREATE INDEX "user_work_reading_state_work_id_idx" ON "user_work_reading_state"("work_id");

-- CreateIndex
CREATE INDEX "user_work_reading_state_last_read_chapter_id_idx" ON "user_work_reading_state"("last_read_chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_work_reading_state_user_id_work_id_key" ON "user_work_reading_state"("user_id", "work_id");

-- AddForeignKey
ALTER TABLE "user_work_reading_state" ADD CONSTRAINT "user_work_reading_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_reading_state" ADD CONSTRAINT "user_work_reading_state_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_reading_state" ADD CONSTRAINT "user_work_reading_state_last_read_chapter_id_fkey" FOREIGN KEY ("last_read_chapter_id") REFERENCES "work_chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
