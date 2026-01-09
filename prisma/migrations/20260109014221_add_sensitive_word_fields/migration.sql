-- AlterTable
ALTER TABLE "forum_sensitive_word" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "hit_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_hit_at" TIMESTAMPTZ(6),
ADD COLUMN     "match_mode" SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN     "updated_by" INTEGER;

-- CreateIndex
CREATE INDEX "forum_sensitive_word_match_mode_idx" ON "forum_sensitive_word"("match_mode");
