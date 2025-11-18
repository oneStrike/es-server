-- AlterTable
ALTER TABLE "admin_user" ALTER COLUMN "password" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "dictionary_item" ALTER COLUMN "order" DROP NOT NULL;
