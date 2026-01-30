-- CreateTable
CREATE TABLE "sys_config" (
    "id" SERIAL NOT NULL,
    "aliyun_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sys_config_pkey" PRIMARY KEY ("id")
);
