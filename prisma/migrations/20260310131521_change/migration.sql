-- AlterTable
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_browse_log" ALTER COLUMN "device" SET DATA TYPE VARCHAR(200);
