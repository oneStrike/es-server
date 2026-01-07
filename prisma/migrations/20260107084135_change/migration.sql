/*
  Warnings:

  - You are about to drop the column `custom_permissions` on the `forum_moderator_section` table. All the data in the column will be lost.
  - You are about to drop the column `final_permissions` on the `forum_moderator_section` table. All the data in the column will be lost.
  - You are about to drop the column `inherit_from_parent` on the `forum_moderator_section` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dictionary_item" ALTER COLUMN "order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "forum_moderator" ADD COLUMN     "group_id" INTEGER,
ADD COLUMN     "role_type" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "forum_moderator_section" DROP COLUMN "custom_permissions",
DROP COLUMN "final_permissions",
DROP COLUMN "inherit_from_parent",
ADD COLUMN     "permissions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "forum_section" ADD COLUMN     "max_moderators" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "forum_section_group" ADD COLUMN     "max_moderators" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "forum_moderator_role_type_idx" ON "forum_moderator"("role_type");

-- CreateIndex
CREATE INDEX "forum_moderator_group_id_idx" ON "forum_moderator"("group_id");

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "forum_section_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
