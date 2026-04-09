CREATE TABLE "check_in_daily_reward_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_daily_reward_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"plan_version" integer NOT NULL,
	"day_index" integer NOT NULL,
	"reward_config" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_daily_reward_rule_plan_day_index_key" UNIQUE("plan_id","plan_version","day_index"),
	CONSTRAINT "check_in_daily_reward_rule_day_index_valid_chk" CHECK ("day_index" >= 1 and "day_index" <= 31),
	CONSTRAINT "check_in_daily_reward_rule_plan_version_positive_chk" CHECK ("plan_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "check_in_record" ADD COLUMN "reward_day_index" integer;--> statement-breakpoint
ALTER TABLE "check_in_record" ADD COLUMN "resolved_reward_config" jsonb;--> statement-breakpoint
ALTER TABLE "check_in_plan" DROP COLUMN "base_reward_config";--> statement-breakpoint
CREATE INDEX "check_in_daily_reward_rule_plan_id_version_idx" ON "check_in_daily_reward_rule" ("plan_id","plan_version");--> statement-breakpoint
CREATE INDEX "check_in_daily_reward_rule_day_index_idx" ON "check_in_daily_reward_rule" ("day_index");--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_reward_day_index_valid_chk" CHECK ("reward_day_index" is null or ("reward_day_index" >= 1 and "reward_day_index" <= 31));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_reward_resolution_consistent_chk" CHECK ((
      "reward_status" is null
      and "reward_day_index" is null
      and "resolved_reward_config" is null
    ) or (
      "reward_status" in (0, 1, 2)
      and "reward_day_index" is not null
      and "resolved_reward_config" is not null
    ));