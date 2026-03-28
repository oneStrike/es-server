ALTER TABLE "task_assignment" ADD COLUMN "reward_status" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD COLUMN "reward_result_type" smallint;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD COLUMN "reward_settled_at" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD COLUMN "reward_ledger_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD COLUMN "last_reward_error" varchar(500);