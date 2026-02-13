-- CreateTable
CREATE TABLE "task_assignment" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cycle_key" VARCHAR(32) NOT NULL,
    "status" SMALLINT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "claimed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "task_snapshot" JSONB,
    "context" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_progress_log" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "before_value" INTEGER NOT NULL,
    "after_value" INTEGER NOT NULL,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_progress_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "cover" VARCHAR(255),
    "type" SMALLINT NOT NULL,
    "status" SMALLINT NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "claim_mode" SMALLINT NOT NULL,
    "complete_mode" SMALLINT NOT NULL,
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "reward_config" JSONB,
    "publish_start_at" TIMESTAMPTZ(6),
    "publish_end_at" TIMESTAMPTZ(6),
    "repeat_rule" JSONB,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignment_user_id_status_idx" ON "task_assignment"("user_id", "status");

-- CreateIndex
CREATE INDEX "task_assignment_task_id_idx" ON "task_assignment"("task_id");

-- CreateIndex
CREATE INDEX "task_assignment_completed_at_idx" ON "task_assignment"("completed_at");

-- CreateIndex
CREATE INDEX "task_assignment_expired_at_idx" ON "task_assignment"("expired_at");

-- CreateIndex
CREATE INDEX "task_assignment_deleted_at_idx" ON "task_assignment"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignment_task_id_user_id_cycle_key_key" ON "task_assignment"("task_id", "user_id", "cycle_key");

-- CreateIndex
CREATE INDEX "task_progress_log_assignment_id_idx" ON "task_progress_log"("assignment_id");

-- CreateIndex
CREATE INDEX "task_progress_log_user_id_created_at_idx" ON "task_progress_log"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_code_key" ON "task"("code");

-- CreateIndex
CREATE INDEX "task_status_is_enabled_idx" ON "task"("status", "is_enabled");

-- CreateIndex
CREATE INDEX "task_type_idx" ON "task"("type");

-- CreateIndex
CREATE INDEX "task_publish_start_at_idx" ON "task"("publish_start_at");

-- CreateIndex
CREATE INDEX "task_publish_end_at_idx" ON "task"("publish_end_at");

-- CreateIndex
CREATE INDEX "task_created_at_idx" ON "task"("created_at");

-- CreateIndex
CREATE INDEX "task_deleted_at_idx" ON "task"("deleted_at");

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_log" ADD CONSTRAINT "task_progress_log_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "task_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_log" ADD CONSTRAINT "task_progress_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
