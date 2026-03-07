-- CreateTable
CREATE TABLE "chat_conversation_member" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" SMALLINT NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "last_read_message_id" BIGINT,
    "last_read_at" TIMESTAMPTZ(6),
    "unread_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chat_conversation_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversation" (
    "id" SERIAL NOT NULL,
    "biz_key" VARCHAR(100) NOT NULL,
    "last_message_id" BIGINT,
    "last_message_at" TIMESTAMPTZ(6),
    "last_sender_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" BIGSERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "message_seq" BIGINT NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "message_type" SMALLINT NOT NULL,
    "content" TEXT NOT NULL,
    "payload" JSONB,
    "status" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_outbox" (
    "id" BIGSERIAL NOT NULL,
    "domain" VARCHAR(20) NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "biz_key" VARCHAR(180) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "message_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "biz_key" VARCHAR(160) NOT NULL,
    "actor_user_id" INTEGER,
    "target_type" SMALLINT,
    "target_id" INTEGER,
    "subject_type" VARCHAR(40),
    "subject_id" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "payload" JSONB,
    "aggregate_key" VARCHAR(160),
    "aggregate_count" INTEGER NOT NULL DEFAULT 1,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversation_member_conversation_id_idx" ON "chat_conversation_member"("conversation_id");

-- CreateIndex
CREATE INDEX "chat_conversation_member_user_id_unread_count_conversation__idx" ON "chat_conversation_member"("user_id", "unread_count", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversation_member_conversation_id_user_id_key" ON "chat_conversation_member"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "chat_conversation_last_message_at_idx" ON "chat_conversation"("last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversation_biz_key_key" ON "chat_conversation"("biz_key");

-- CreateIndex
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "chat_message"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "chat_message_sender_id_created_at_idx" ON "chat_message"("sender_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_conversation_id_message_seq_key" ON "chat_message"("conversation_id", "message_seq");

-- CreateIndex
CREATE INDEX "message_outbox_status_next_retry_at_id_idx" ON "message_outbox"("status", "next_retry_at", "id");

-- CreateIndex
CREATE INDEX "message_outbox_domain_status_created_at_idx" ON "message_outbox"("domain", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_outbox_biz_key_key" ON "message_outbox"("biz_key");

-- CreateIndex
CREATE INDEX "user_notification_user_id_is_read_created_at_idx" ON "user_notification"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_notification_user_id_created_at_idx" ON "user_notification"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_notification_type_created_at_idx" ON "user_notification"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_notification_user_id_aggregate_key_created_at_idx" ON "user_notification"("user_id", "aggregate_key", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_user_id_biz_key_key" ON "user_notification"("user_id", "biz_key");

-- AddForeignKey
ALTER TABLE "chat_conversation_member" ADD CONSTRAINT "chat_conversation_member_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation_member" ADD CONSTRAINT "chat_conversation_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_last_sender_id_fkey" FOREIGN KEY ("last_sender_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
