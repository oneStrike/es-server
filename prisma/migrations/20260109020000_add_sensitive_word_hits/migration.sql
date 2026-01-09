-- AlterTable
ALTER TABLE "forum_topic" ADD COLUMN     "sensitive_word_hits" JSONB;

-- AlterTable
ALTER TABLE "forum_reply" ADD COLUMN     "sensitive_word_hits" JSONB;
