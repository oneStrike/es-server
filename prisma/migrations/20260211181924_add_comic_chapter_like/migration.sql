-- CreateTable
CREATE TABLE "work_comic_chapter_like" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comic_chapter_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_favorite" (
    "id" SERIAL NOT NULL,
    "comic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comic_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_like" (
    "id" SERIAL NOT NULL,
    "comic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comic_like_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_comic_chapter_like_chapter_id_idx" ON "work_comic_chapter_like"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_like_user_id_idx" ON "work_comic_chapter_like"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_like_created_at_idx" ON "work_comic_chapter_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_like_chapter_id_user_id_key" ON "work_comic_chapter_like"("chapter_id", "user_id");

-- CreateIndex
CREATE INDEX "work_comic_favorite_comic_id_idx" ON "work_comic_favorite"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_favorite_user_id_idx" ON "work_comic_favorite"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_favorite_created_at_idx" ON "work_comic_favorite"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_favorite_comic_id_user_id_key" ON "work_comic_favorite"("comic_id", "user_id");

-- CreateIndex
CREATE INDEX "work_comic_like_comic_id_idx" ON "work_comic_like"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_like_user_id_idx" ON "work_comic_like"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_like_created_at_idx" ON "work_comic_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_like_comic_id_user_id_key" ON "work_comic_like"("comic_id", "user_id");

-- AddForeignKey
ALTER TABLE "work_comic_chapter_like" ADD CONSTRAINT "work_comic_chapter_like_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_comic_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_like" ADD CONSTRAINT "work_comic_chapter_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_favorite" ADD CONSTRAINT "work_comic_favorite_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_favorite" ADD CONSTRAINT "work_comic_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_like" ADD CONSTRAINT "work_comic_like_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_like" ADD CONSTRAINT "work_comic_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
