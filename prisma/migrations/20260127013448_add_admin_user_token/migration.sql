-- CreateTable
CREATE TABLE "admin_user_token" (
    "id" SERIAL NOT NULL,
    "jti" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_type" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" VARCHAR(50),
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_user_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_token_jti_key" ON "admin_user_token"("jti");

-- CreateIndex
CREATE INDEX "admin_user_token_user_id_idx" ON "admin_user_token"("user_id");

-- CreateIndex
CREATE INDEX "admin_user_token_jti_idx" ON "admin_user_token"("jti");

-- CreateIndex
CREATE INDEX "admin_user_token_token_type_idx" ON "admin_user_token"("token_type");

-- CreateIndex
CREATE INDEX "admin_user_token_expires_at_idx" ON "admin_user_token"("expires_at");

-- CreateIndex
CREATE INDEX "admin_user_token_revoked_at_idx" ON "admin_user_token"("revoked_at");

-- CreateIndex
CREATE INDEX "admin_user_token_user_id_token_type_idx" ON "admin_user_token"("user_id", "token_type");

-- AddForeignKey
ALTER TABLE "admin_user_token" ADD CONSTRAINT "admin_user_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
