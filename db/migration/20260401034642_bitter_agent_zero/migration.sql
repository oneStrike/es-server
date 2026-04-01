CREATE TABLE "check_in_cycle" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_cycle_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"cycle_key" varchar(32) NOT NULL,
	"cycle_start_date" date NOT NULL,
	"cycle_end_date" date NOT NULL,
	"signed_count" integer DEFAULT 0 NOT NULL,
	"makeup_used_count" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"last_signed_date" date,
	"plan_snapshot_version" integer NOT NULL,
	"plan_snapshot" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_cycle_user_plan_cycle_key_key" UNIQUE("user_id","plan_id","cycle_key"),
	CONSTRAINT "check_in_cycle_signed_count_non_negative_chk" CHECK ("signed_count" >= 0),
	CONSTRAINT "check_in_cycle_makeup_used_count_non_negative_chk" CHECK ("makeup_used_count" >= 0),
	CONSTRAINT "check_in_cycle_current_streak_non_negative_chk" CHECK ("current_streak" >= 0),
	CONSTRAINT "check_in_cycle_snapshot_version_positive_chk" CHECK ("plan_snapshot_version" > 0),
	CONSTRAINT "check_in_cycle_date_range_valid_chk" CHECK ("cycle_end_date" >= "cycle_start_date")
);
--> statement-breakpoint
CREATE TABLE "check_in_plan" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_code" varchar(50) NOT NULL CONSTRAINT "check_in_plan_plan_code_key" UNIQUE,
	"plan_name" varchar(200) NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"timezone" varchar(100) NOT NULL,
	"cycle_type" varchar(16) NOT NULL,
	"cycle_anchor_date" date NOT NULL,
	"allow_makeup_count_per_cycle" integer DEFAULT 0 NOT NULL,
	"base_reward_config" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"publish_start_at" timestamp(6) with time zone,
	"publish_end_at" timestamp(6) with time zone,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "check_in_plan_allow_makeup_non_negative_chk" CHECK ("allow_makeup_count_per_cycle" >= 0),
	CONSTRAINT "check_in_plan_version_positive_chk" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"sign_date" date NOT NULL,
	"record_type" smallint NOT NULL,
	"reward_status" smallint,
	"reward_result_type" smallint,
	"biz_key" varchar(180) NOT NULL,
	"base_reward_ledger_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"operator_type" smallint NOT NULL,
	"remark" varchar(500),
	"last_reward_error" varchar(500),
	"context" jsonb,
	"reward_settled_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_record_user_plan_sign_date_key" UNIQUE("user_id","plan_id","sign_date"),
	CONSTRAINT "check_in_record_user_biz_key_key" UNIQUE("user_id","biz_key")
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_reward_grant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_reward_grant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"rule_id" integer NOT NULL,
	"trigger_sign_date" date NOT NULL,
	"grant_status" smallint DEFAULT 0 NOT NULL,
	"grant_result_type" smallint,
	"biz_key" varchar(200) NOT NULL,
	"ledger_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"last_grant_error" varchar(500),
	"plan_snapshot_version" integer NOT NULL,
	"context" jsonb,
	"grant_settled_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_streak_grant_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "check_in_streak_grant_snapshot_version_positive_chk" CHECK ("plan_snapshot_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_reward_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_reward_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"plan_version" integer NOT NULL,
	"rule_code" varchar(50) NOT NULL,
	"streak_days" integer NOT NULL,
	"reward_config" jsonb NOT NULL,
	"repeatable" boolean DEFAULT false NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "check_in_streak_rule_plan_rule_code_key" UNIQUE("plan_id","plan_version","rule_code"),
	CONSTRAINT "check_in_streak_rule_plan_streak_days_key" UNIQUE("plan_id","plan_version","streak_days"),
	CONSTRAINT "check_in_streak_rule_streak_days_positive_chk" CHECK ("streak_days" > 0),
	CONSTRAINT "check_in_streak_rule_plan_version_positive_chk" CHECK ("plan_version" > 0),
	CONSTRAINT "check_in_streak_rule_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX "check_in_cycle_user_id_plan_id_idx" ON "check_in_cycle" ("user_id","plan_id");--> statement-breakpoint
CREATE INDEX "check_in_cycle_cycle_start_date_idx" ON "check_in_cycle" ("cycle_start_date");--> statement-breakpoint
CREATE INDEX "check_in_cycle_cycle_end_date_idx" ON "check_in_cycle" ("cycle_end_date");--> statement-breakpoint
CREATE INDEX "check_in_plan_status_is_enabled_idx" ON "check_in_plan" ("status","is_enabled");--> statement-breakpoint
CREATE INDEX "check_in_plan_publish_start_at_idx" ON "check_in_plan" ("publish_start_at");--> statement-breakpoint
CREATE INDEX "check_in_plan_publish_end_at_idx" ON "check_in_plan" ("publish_end_at");--> statement-breakpoint
CREATE INDEX "check_in_plan_deleted_at_idx" ON "check_in_plan" ("deleted_at");--> statement-breakpoint
CREATE INDEX "check_in_record_cycle_id_idx" ON "check_in_record" ("cycle_id");--> statement-breakpoint
CREATE INDEX "check_in_record_user_id_plan_id_idx" ON "check_in_record" ("user_id","plan_id");--> statement-breakpoint
CREATE INDEX "check_in_record_sign_date_idx" ON "check_in_record" ("sign_date");--> statement-breakpoint
CREATE INDEX "check_in_record_reward_status_idx" ON "check_in_record" ("reward_status");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_cycle_id_idx" ON "check_in_streak_reward_grant" ("cycle_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_user_id_plan_id_idx" ON "check_in_streak_reward_grant" ("user_id","plan_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_rule_id_idx" ON "check_in_streak_reward_grant" ("rule_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_trigger_sign_date_idx" ON "check_in_streak_reward_grant" ("trigger_sign_date");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_status_idx" ON "check_in_streak_reward_grant" ("grant_status");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_plan_id_status_idx" ON "check_in_streak_reward_rule" ("plan_id","plan_version","status");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_deleted_at_idx" ON "check_in_streak_reward_rule" ("deleted_at");