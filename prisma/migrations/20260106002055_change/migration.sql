-- AlterTable
ALTER TABLE "dictionary_item" ALTER COLUMN "order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "forum_level_rule" ALTER COLUMN "max_file_size" SET DATA TYPE INTEGER;
