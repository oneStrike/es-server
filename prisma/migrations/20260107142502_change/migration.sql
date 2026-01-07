-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_user_id_fkey";

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
