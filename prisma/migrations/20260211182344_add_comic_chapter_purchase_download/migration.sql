-- CreateTable
CREATE TABLE "work_comic_chapter_download" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comic_chapter_download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_chapter_purchase" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_comic_chapter_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_comic_chapter_download_chapter_id_idx" ON "work_comic_chapter_download"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_download_user_id_idx" ON "work_comic_chapter_download"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_download_created_at_idx" ON "work_comic_chapter_download"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_download_chapter_id_user_id_key" ON "work_comic_chapter_download"("chapter_id", "user_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_purchase_chapter_id_idx" ON "work_comic_chapter_purchase"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_purchase_user_id_idx" ON "work_comic_chapter_purchase"("user_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_purchase_created_at_idx" ON "work_comic_chapter_purchase"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_purchase_chapter_id_user_id_key" ON "work_comic_chapter_purchase"("chapter_id", "user_id");

-- AddForeignKey
ALTER TABLE "work_comic_chapter_download" ADD CONSTRAINT "work_comic_chapter_download_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_comic_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_download" ADD CONSTRAINT "work_comic_chapter_download_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_purchase" ADD CONSTRAINT "work_comic_chapter_purchase_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_comic_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter_purchase" ADD CONSTRAINT "work_comic_chapter_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
