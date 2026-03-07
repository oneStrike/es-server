/*
  Warnings:

  - A unique constraint covering the columns `[conversation_id,sender_id,client_message_id]` on the table `chat_message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "client_message_id" VARCHAR(64);

-- CreateTable
CREATE TABLE "message_ws_metric" (
    "id" BIGSERIAL NOT NULL,
    "bucket_at" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "ack_success_count" INTEGER NOT NULL DEFAULT 0,
    "ack_error_count" INTEGER NOT NULL DEFAULT 0,
    "ack_latency_total_ms" BIGINT NOT NULL DEFAULT 0,
    "reconnect_count" INTEGER NOT NULL DEFAULT 0,
    "resync_trigger_count" INTEGER NOT NULL DEFAULT 0,
    "resync_success_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "message_ws_metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_ws_metric_bucket_at_idx" ON "message_ws_metric"("bucket_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_ws_metric_bucket_at_key" ON "message_ws_metric"("bucket_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_conversation_id_sender_id_client_message_id_key" ON "chat_message"("conversation_id", "sender_id", "client_message_id");
