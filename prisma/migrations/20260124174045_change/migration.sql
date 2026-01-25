-- CreateTable
CREATE TABLE "app_user_token" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "jti" VARCHAR(255) NOT NULL,
    "token_type" VARCHAR(20) NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" VARCHAR(50),
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_user_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_token_jti_key" ON "app_user_token"("jti");

-- CreateIndex
CREATE INDEX "app_user_token_user_id_idx" ON "app_user_token"("user_id");

-- CreateIndex
CREATE INDEX "app_user_token_jti_idx" ON "app_user_token"("jti");

-- CreateIndex
CREATE INDEX "app_user_token_token_type_idx" ON "app_user_token"("token_type");

-- CreateIndex
CREATE INDEX "app_user_token_expires_at_idx" ON "app_user_token"("expires_at");

-- CreateIndex
CREATE INDEX "app_user_token_revoked_at_idx" ON "app_user_token"("revoked_at");

-- CreateIndex
CREATE INDEX "app_user_token_is_active_idx" ON "app_user_token"("is_active");

-- CreateIndex
CREATE INDEX "app_user_token_user_id_token_type_idx" ON "app_user_token"("user_id", "token_type");

-- CreateIndex
CREATE INDEX "app_user_token_user_id_is_active_idx" ON "app_user_token"("user_id", "is_active");

-- AddForeignKey
ALTER TABLE "app_user_token" ADD CONSTRAINT "app_user_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
