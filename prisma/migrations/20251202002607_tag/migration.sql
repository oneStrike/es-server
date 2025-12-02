-- CreateTable
CREATE TABLE "work_comic_tag" (
    "comic_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_comic_tag_pkey" PRIMARY KEY ("comic_id","tag_id")
);

-- CreateTable
CREATE TABLE "work_tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "work_tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_comic_tag_tag_id_idx" ON "work_comic_tag"("tag_id");

-- CreateIndex
CREATE INDEX "work_comic_tag_comic_id_idx" ON "work_comic_tag"("comic_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_tag_name_key" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_order_idx" ON "work_tag"("order");

-- CreateIndex
CREATE INDEX "work_tag_name_idx" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_is_enabled_idx" ON "work_tag"("is_enabled");
