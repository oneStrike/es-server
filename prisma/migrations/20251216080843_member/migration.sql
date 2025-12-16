-- CreateTable
CREATE TABLE "member_level" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "points" INTEGER NOT NULL,
    "login_days" SMALLINT NOT NULL DEFAULT 0,
    "icon" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20),
    "blacklist_limit" SMALLINT NOT NULL DEFAULT 10,
    "work_collection_limit" SMALLINT NOT NULL DEFAULT 100,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "remark" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "member_level_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_level_points_idx" ON "member_level"("points");

-- CreateIndex
CREATE INDEX "member_level_is_enabled_idx" ON "member_level"("is_enabled");

-- CreateIndex
CREATE INDEX "member_level_created_at_idx" ON "member_level"("created_at");
