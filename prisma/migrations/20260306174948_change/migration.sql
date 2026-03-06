-- DropForeignKey
ALTER TABLE "sys_config" DROP CONSTRAINT "sys_config_updated_by_id_fkey";

-- CreateIndex
CREATE INDEX "sys_config_created_at_idx" ON "sys_config"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "sys_config" ADD CONSTRAINT "sys_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
