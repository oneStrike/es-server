-- CreateTable
CREATE TABLE "app_agreement" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "is_force" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_agreement_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "agreement_id" INTEGER NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "agreed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "device_info" VARCHAR(500),

    CONSTRAINT "app_agreement_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_agreement_type_is_published_idx" ON "app_agreement"("type", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "app_agreement_type_version_key" ON "app_agreement"("type", "version");

-- CreateIndex
CREATE INDEX "app_agreement_log_user_id_agreement_id_idx" ON "app_agreement_log"("user_id", "agreement_id");

-- CreateIndex
CREATE INDEX "app_agreement_log_agreed_at_idx" ON "app_agreement_log"("agreed_at");

-- AddForeignKey
ALTER TABLE "app_agreement_log" ADD CONSTRAINT "app_agreement_log_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "app_agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_agreement_log" ADD CONSTRAINT "app_agreement_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
