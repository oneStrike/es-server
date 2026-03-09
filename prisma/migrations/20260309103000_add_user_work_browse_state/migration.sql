CREATE TABLE "user_work_browse_state" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "last_viewed_at" TIMESTAMPTZ(6) NOT NULL,
    "last_viewed_chapter_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_work_browse_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_work_browse_state_user_id_work_id_key"
ON "user_work_browse_state"("user_id", "work_id");

CREATE INDEX "user_work_browse_state_user_id_work_type_last_viewed_at_idx"
ON "user_work_browse_state"("user_id", "work_type", "last_viewed_at");

CREATE INDEX "user_work_browse_state_work_id_idx"
ON "user_work_browse_state"("work_id");

CREATE INDEX "user_work_browse_state_last_viewed_chapter_id_idx"
ON "user_work_browse_state"("last_viewed_chapter_id");

ALTER TABLE "user_work_browse_state"
ADD CONSTRAINT "user_work_browse_state_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_work_browse_state"
ADD CONSTRAINT "user_work_browse_state_work_id_fkey"
FOREIGN KEY ("work_id") REFERENCES "work"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_work_browse_state"
ADD CONSTRAINT "user_work_browse_state_last_viewed_chapter_id_fkey"
FOREIGN KEY ("last_viewed_chapter_id") REFERENCES "work_chapter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
