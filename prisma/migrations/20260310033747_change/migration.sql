-- AlterTable
ALTER TABLE "user_work_browse_state" RENAME CONSTRAINT "user_work_browse_state_pkey" TO "user_browse_state_pkey";

-- RenameForeignKey
ALTER TABLE "user_work_browse_state" RENAME CONSTRAINT "user_work_browse_state_last_viewed_chapter_id_fkey" TO "user_browse_state_last_viewed_chapter_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_work_browse_state" RENAME CONSTRAINT "user_work_browse_state_user_id_fkey" TO "user_browse_state_user_id_fkey";
