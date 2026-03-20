CREATE TABLE "admin_user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" varchar(20) NOT NULL CONSTRAINT "admin_user_username_key" UNIQUE,
	"password" varchar(500) NOT NULL,
	"mobile" varchar(11),
	"avatar" varchar(200),
	"role" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp(6) with time zone,
	"last_login_ip" varchar(45),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_user_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"jti" varchar(255) NOT NULL CONSTRAINT "admin_user_token_jti_key" UNIQUE,
	"user_id" integer NOT NULL,
	"token_type" varchar(20) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(50),
	"device_info" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_agreement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_agreement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"version" varchar(50) NOT NULL,
	"is_force" boolean DEFAULT false NOT NULL,
	"show_in_auth" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_agreement_title_version_key" UNIQUE("title","version")
);
--> statement-breakpoint
CREATE TABLE "app_agreement_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_agreement_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"agreement_id" integer NOT NULL,
	"version" varchar(50) NOT NULL,
	"agreed_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"device_info" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "app_announcement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_announcement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"page_id" integer,
	"title" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"summary" varchar(500),
	"announcement_type" smallint DEFAULT 0 NOT NULL,
	"priority_level" smallint DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"show_as_popup" boolean DEFAULT false NOT NULL,
	"popup_background_image" varchar(200),
	"enable_platform" integer[],
	"publish_start_time" timestamp(6) with time zone,
	"publish_end_time" timestamp(6) with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_announcement_read" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_announcement_read_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"announcement_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_announcement_read_announcement_id_user_id_key" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"app_name" varchar(100) NOT NULL,
	"app_desc" varchar(500),
	"app_logo" varchar(500),
	"onboarding_image" varchar(1000),
	"theme_color" varchar(20) DEFAULT '#007AFF' NOT NULL,
	"secondary_color" varchar(20),
	"optional_theme_colors" varchar(500),
	"enable_maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" varchar(500),
	"version" varchar(50) DEFAULT '1.0.0' NOT NULL,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_page" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_page_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(50) NOT NULL CONSTRAINT "app_page_code_key" UNIQUE,
	"path" varchar(300) NOT NULL CONSTRAINT "app_page_path_key" UNIQUE,
	"name" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(500),
	"access_level" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enable_platform" integer[],
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"account" varchar(20) NOT NULL CONSTRAINT "app_user_account_key" UNIQUE,
	"phone_number" varchar(20) CONSTRAINT "app_user_phone_number_key" UNIQUE,
	"email_address" varchar(255) CONSTRAINT "app_user_email_address_key" UNIQUE,
	"level_id" integer,
	"nickname" varchar(100) NOT NULL,
	"password" varchar(500) NOT NULL,
	"avatar_url" varchar(500),
	"signature" varchar(200),
	"bio" varchar(500),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"gender_type" smallint DEFAULT 0 NOT NULL,
	"birth_date" date,
	"points" integer DEFAULT 0 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"ban_reason" varchar(500),
	"ban_until" timestamp(6) with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_user_count" (
	"user_id" integer PRIMARY KEY,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_count" integer DEFAULT 0 NOT NULL,
	"comment_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_favorite_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"jti" varchar(255) NOT NULL CONSTRAINT "app_user_token_jti_key" UNIQUE,
	"user_id" integer NOT NULL,
	"token_type" varchar(20) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(50),
	"device_info" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" varchar(80),
	"user_id" integer NOT NULL,
	"biz_key" varchar(120) NOT NULL,
	"asset_type" varchar(30) NOT NULL,
	"action" varchar(30) NOT NULL,
	"rule_type" smallint,
	"decision" varchar(20) NOT NULL,
	"reason" varchar(80),
	"delta_requested" integer,
	"delta_applied" integer,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_ledger_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_ledger_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"delta" integer NOT NULL,
	"before_value" integer NOT NULL,
	"after_value" integer NOT NULL,
	"biz_key" varchar(120) NOT NULL,
	"rule_type" smallint,
	"rule_id" integer,
	"target_type" smallint,
	"target_id" integer,
	"remark" varchar(500),
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_ledger_record_user_id_biz_key_key" UNIQUE("user_id","biz_key")
);
--> statement-breakpoint
CREATE TABLE "growth_rule_usage_slot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_rule_usage_slot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"asset_type" varchar(30) NOT NULL,
	"rule_key" varchar(80) NOT NULL,
	"slot_type" varchar(20) NOT NULL,
	"slot_value" varchar(60) NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_rule_usage_slot_user_id_asset_type_rule_key_slot_typ_key" UNIQUE("user_id","asset_type","rule_key","slot_type","slot_value")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(50) NOT NULL CONSTRAINT "task_code_key" UNIQUE,
	"title" varchar(200) NOT NULL,
	"description" varchar(1000),
	"cover" varchar(255),
	"type" smallint NOT NULL,
	"status" smallint NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"claim_mode" smallint NOT NULL,
	"complete_mode" smallint NOT NULL,
	"target_count" integer DEFAULT 1 NOT NULL,
	"reward_config" jsonb,
	"repeat_rule" jsonb,
	"publish_start_at" timestamp(6) with time zone,
	"publish_end_at" timestamp(6) with time zone,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "task_assignment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_assignment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"cycle_key" varchar(32) NOT NULL,
	"status" smallint NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer DEFAULT 1 NOT NULL,
	"task_snapshot" jsonb,
	"context" jsonb,
	"version" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp(6) with time zone,
	"completed_at" timestamp(6) with time zone,
	"expired_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "task_assignment_task_id_user_id_cycle_key_key" UNIQUE("task_id","user_id","cycle_key")
);
--> statement-breakpoint
CREATE TABLE "task_progress_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_progress_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"assignment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action_type" smallint NOT NULL,
	"delta" integer NOT NULL,
	"before_value" integer NOT NULL,
	"after_value" integer NOT NULL,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badge" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_badge_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL,
	"type" smallint NOT NULL,
	"description" varchar(200),
	"icon" varchar(255),
	"business" varchar(20),
	"event_key" varchar(50),
	"sortOrder" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badge_assignment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_badge_assignment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badge_assignment_user_id_badge_id_key" UNIQUE("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "user_browse_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_browse_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(45),
	"device" varchar(200),
	"user_agent" varchar(500),
	"viewed_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_comment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_comment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"floor" integer,
	"reply_to_id" integer,
	"actual_reply_to_id" integer,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"audit_status" smallint DEFAULT 0 NOT NULL,
	"audit_by_id" integer,
	"audit_role" smallint,
	"audit_reason" varchar(500),
	"audit_at" timestamp(6) with time zone,
	"like_count" integer DEFAULT 0 NOT NULL,
	"sensitive_word_hits" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "user_download_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_download_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_download_record_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_experience_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_experience_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" smallint NOT NULL CONSTRAINT "user_experience_rule_type_key" UNIQUE,
	"experience" integer NOT NULL,
	"daily_limit" integer DEFAULT 0 NOT NULL,
	"total_limit" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_favorite_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorite_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_level_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_level_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "user_level_rule_name_key" UNIQUE,
	"required_experience" integer NOT NULL,
	"login_days" smallint DEFAULT 0 NOT NULL,
	"description" varchar(200),
	"icon" varchar(255),
	"badge" varchar(255),
	"color" varchar(20),
	"sortOrder" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"business" varchar(20),
	"daily_topic_limit" smallint DEFAULT 0 NOT NULL,
	"daily_reply_comment_limit" smallint DEFAULT 0 NOT NULL,
	"post_interval" smallint DEFAULT 0 NOT NULL,
	"daily_like_limit" smallint DEFAULT 0 NOT NULL,
	"daily_favorite_limit" smallint DEFAULT 0 NOT NULL,
	"blacklist_limit" smallint DEFAULT 10 NOT NULL,
	"work_collection_limit" smallint DEFAULT 100 NOT NULL,
	"discount" numeric(3,2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_like" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_like_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"scene_type" smallint NOT NULL,
	"scene_id" integer NOT NULL,
	"comment_level" smallint,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_like_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_point_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_point_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" smallint NOT NULL CONSTRAINT "user_point_rule_type_key" UNIQUE,
	"points" integer NOT NULL,
	"daily_limit" integer DEFAULT 0 NOT NULL,
	"total_limit" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_purchase_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_purchase_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"price" integer NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"payment_method" smallint NOT NULL,
	"out_trade_no" varchar(100),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_report" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_report_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reporter_id" integer NOT NULL,
	"handler_id" integer,
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"scene_type" smallint NOT NULL,
	"scene_id" integer NOT NULL,
	"comment_level" smallint,
	"reason_type" smallint NOT NULL,
	"description" varchar(500),
	"evidence_url" varchar(500),
	"status" smallint DEFAULT 1 NOT NULL,
	"handling_note" varchar(500),
	"handled_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_report_reporter_id_target_type_target_id_key" UNIQUE("reporter_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "user_work_reading_state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_work_reading_state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"work_id" integer NOT NULL,
	"work_type" smallint NOT NULL,
	"last_read_at" timestamp(6) with time zone NOT NULL,
	"last_read_chapter_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_work_reading_state_user_id_work_id_key" UNIQUE("user_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "forum_moderator" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL CONSTRAINT "forum_moderator_user_id_key" UNIQUE,
	"group_id" integer,
	"role_type" integer DEFAULT 3 NOT NULL,
	"permissions" integer[] DEFAULT ARRAY[]::integer[],
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_action_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_action_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"moderator_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"action_type" smallint NOT NULL,
	"target_type" smallint NOT NULL,
	"action_description" varchar(200) NOT NULL,
	"before_data" text,
	"after_data" text,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_application" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"applicant_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"audit_by_id" integer,
	"status" smallint DEFAULT 0 NOT NULL,
	"permissions" integer[] DEFAULT ARRAY[]::integer[],
	"reason" varchar(500) NOT NULL,
	"audit_reason" varchar(500),
	"remark" varchar(500),
	"audit_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_moderator_application_applicant_id_section_id_key" UNIQUE("applicant_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_section" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_section_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"moderator_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"permissions" integer[] DEFAULT ARRAY[]::integer[],
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "forum_moderator_section_moderator_id_section_id_key" UNIQUE("moderator_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "forum_section" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_section_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer,
	"user_level_rule_id" integer,
	"last_topic_id" integer,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"icon" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"topic_review_policy" integer DEFAULT 1 NOT NULL,
	"remark" varchar(500),
	"topic_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_section_group" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_section_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL CONSTRAINT "forum_section_group_name_key" UNIQUE,
	"description" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"max_moderators" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_tag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "forum_tag_name_key" UNIQUE,
	"icon" varchar(255),
	"description" varchar(200),
	"sortOrder" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_topic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_topic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"section_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"last_reply_user_id" integer,
	"audit_by_id" integer,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"audit_status" smallint DEFAULT 1 NOT NULL,
	"audit_role" smallint,
	"audit_reason" varchar(500),
	"audit_at" timestamp(6) with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"sensitive_word_hits" jsonb,
	"view_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"last_reply_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "forum_topic_tag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_topic_tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"topic_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_topic_tag_topic_id_tag_id_key" UNIQUE("topic_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "forum_user_action_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_user_action_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"action_type" smallint NOT NULL,
	"target_type" smallint NOT NULL,
	"before_data" text,
	"after_data" text,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_conversation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"biz_key" varchar(100) NOT NULL CONSTRAINT "chat_conversation_biz_key_key" UNIQUE,
	"last_message_id" bigint,
	"last_message_at" timestamp(6) with time zone,
	"last_sender_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversation_member" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_conversation_member_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" smallint NOT NULL,
	"joined_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp(6) with time zone,
	"is_muted" boolean DEFAULT false NOT NULL,
	"last_read_message_id" bigint,
	"last_read_at" timestamp(6) with time zone,
	"unread_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_conversation_member_conversation_id_user_id_key" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"message_seq" bigint NOT NULL,
	"sender_id" integer NOT NULL,
	"client_message_id" varchar(64),
	"message_type" smallint NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb,
	"status" smallint NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp(6) with time zone,
	"revoked_at" timestamp(6) with time zone,
	CONSTRAINT "chat_message_conversation_id_message_seq_key" UNIQUE("conversation_id","message_seq"),
	CONSTRAINT "chat_message_conversation_id_sender_id_client_message_id_key" UNIQUE("conversation_id","sender_id","client_message_id")
);
--> statement-breakpoint
CREATE TABLE "message_outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"domain" smallint NOT NULL,
	"event_type" smallint NOT NULL,
	"biz_key" varchar(180) NOT NULL CONSTRAINT "message_outbox_biz_key_key" UNIQUE,
	"payload" jsonb NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp(6) with time zone,
	"last_error" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "message_ws_metric" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_ws_metric_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bucket_at" timestamp(6) with time zone NOT NULL CONSTRAINT "message_ws_metric_bucket_at_key" UNIQUE,
	"request_count" integer DEFAULT 0 NOT NULL,
	"ack_success_count" integer DEFAULT 0 NOT NULL,
	"ack_error_count" integer DEFAULT 0 NOT NULL,
	"ack_latency_total_ms" bigint DEFAULT 0 NOT NULL,
	"reconnect_count" integer DEFAULT 0 NOT NULL,
	"resync_trigger_count" integer DEFAULT 0 NOT NULL,
	"resync_success_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"type" smallint NOT NULL,
	"biz_key" varchar(160) NOT NULL,
	"actor_user_id" integer,
	"target_type" smallint,
	"target_id" integer,
	"subject_type" smallint,
	"subject_id" integer,
	"title" varchar(200) NOT NULL,
	"content" varchar(1000) NOT NULL,
	"payload" jsonb,
	"aggregate_key" varchar(160),
	"aggregate_count" integer DEFAULT 1 NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp(6) with time zone,
	"expired_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_user_id_biz_key_key" UNIQUE("user_id","biz_key")
);
--> statement-breakpoint
CREATE TABLE "sys_request_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_request_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"username" text,
	"api_type" varchar(20),
	"method" varchar(10) NOT NULL,
	"path" varchar(255) NOT NULL,
	"params" jsonb,
	"ip" varchar(45),
	"user_agent" varchar(255),
	"device" jsonb,
	"action_type" varchar(50),
	"is_success" boolean NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_word" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sensitive_word_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"word" varchar(100) NOT NULL CONSTRAINT "sensitive_word_word_key" UNIQUE,
	"replace_word" varchar(100),
	"level" smallint DEFAULT 2 NOT NULL,
	"type" smallint DEFAULT 5 NOT NULL,
	"match_mode" smallint DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"remark" varchar(500),
	"created_by" integer,
	"updated_by" integer,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_by_id" integer,
	"aliyun_config" jsonb,
	"site_config" jsonb,
	"maintenance_config" jsonb,
	"content_review_policy" jsonb,
	"upload_config" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_dictionary" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_dictionary_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(50) NOT NULL CONSTRAINT "sys_dictionary_name_key" UNIQUE,
	"code" varchar(50) NOT NULL CONSTRAINT "sys_dictionary_code_key" UNIQUE,
	"cover" varchar(200),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"description" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "sys_dictionary_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_dictionary_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dictionary_code" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(50) NOT NULL,
	"sort_order" smallserial,
	"cover" varchar(200),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"description" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "sys_dictionary_item_dictionary_code_code_key" UNIQUE("dictionary_code","code")
);
--> statement-breakpoint
CREATE TABLE "work" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" smallint NOT NULL,
	"name" varchar(100) NOT NULL,
	"alias" varchar(200),
	"cover" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"language" varchar(10) NOT NULL,
	"region" varchar(10) NOT NULL,
	"ageRating" varchar(10),
	"serialStatus" smallint DEFAULT 0 NOT NULL,
	"publisher" varchar(100),
	"originalSource" varchar(100),
	"copyright" varchar(500),
	"disclaimer" text,
	"remark" varchar(1000),
	"isPublished" boolean DEFAULT true NOT NULL,
	"isRecommended" boolean DEFAULT false NOT NULL,
	"isHot" boolean DEFAULT false NOT NULL,
	"isNew" boolean DEFAULT false NOT NULL,
	"publishAt" date,
	"lastUpdated" timestamp(6) with time zone,
	"view_rule" smallint DEFAULT 0 NOT NULL,
	"required_view_level_id" integer,
	"forum_section_id" integer CONSTRAINT "work_forum_section_id_key" UNIQUE,
	"chapter_price" integer DEFAULT 0 NOT NULL,
	"can_comment" boolean DEFAULT true NOT NULL,
	"recommendWeight" double precision DEFAULT 1 NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"favoriteCount" integer DEFAULT 0 NOT NULL,
	"likeCount" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"downloadCount" integer DEFAULT 0 NOT NULL,
	"rating" double precision,
	"ratingCount" integer DEFAULT 0 NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone NOT NULL,
	"deletedAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "work_author" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_author_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL CONSTRAINT "work_author_name_key" UNIQUE,
	"avatar" varchar(500),
	"description" varchar(1000),
	"nationality" varchar(50),
	"gender" smallint DEFAULT 0 NOT NULL,
	"type" smallint[],
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"remark" varchar(1000),
	"work_count" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "work_author_relation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_author_relation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "work_author_relation_work_id_author_id_key" UNIQUE("work_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "work_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "work_category_name_key" UNIQUE,
	"description" varchar(200),
	"icon" varchar(255),
	"content_type" integer[],
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_category_relation" (
	"work_id" integer,
	"category_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "work_category_relation_pkey" PRIMARY KEY("work_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "work_chapter" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_chapter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL,
	"work_type" smallint NOT NULL,
	"title" varchar(100) NOT NULL,
	"subtitle" varchar(200),
	"cover" varchar(500),
	"description" varchar(1000),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp(6) with time zone,
	"view_rule" smallint DEFAULT -1 NOT NULL,
	"required_read_level_id" integer,
	"price" integer DEFAULT 0 NOT NULL,
	"can_download" boolean DEFAULT true NOT NULL,
	"can_comment" boolean DEFAULT true NOT NULL,
	"content" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"remark" varchar(1000),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_chapter_work_id_sort_order_key" UNIQUE("work_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "work_comic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_comic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workId" integer NOT NULL CONSTRAINT "work_comic_workId_key" UNIQUE,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_novel" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_novel_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workId" integer NOT NULL CONSTRAINT "work_novel_workId_key" UNIQUE,
	"wordCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_tag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "work_tag_name_key" UNIQUE,
	"icon" varchar(255),
	"description" varchar(200),
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_tag_relation" (
	"work_id" integer,
	"tag_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "work_tag_relation_pkey" PRIMARY KEY("work_id","tag_id")
);
--> statement-breakpoint
CREATE INDEX "admin_user_is_enabled_idx" ON "admin_user" ("is_enabled");--> statement-breakpoint
CREATE INDEX "admin_user_role_idx" ON "admin_user" ("role");--> statement-breakpoint
CREATE INDEX "admin_user_created_at_idx" ON "admin_user" ("created_at");--> statement-breakpoint
CREATE INDEX "admin_user_last_login_at_idx" ON "admin_user" ("last_login_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_user_id_idx" ON "admin_user_token" ("user_id");--> statement-breakpoint
CREATE INDEX "admin_user_token_jti_idx" ON "admin_user_token" ("jti");--> statement-breakpoint
CREATE INDEX "admin_user_token_token_type_idx" ON "admin_user_token" ("token_type");--> statement-breakpoint
CREATE INDEX "admin_user_token_expires_at_idx" ON "admin_user_token" ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_revoked_at_idx" ON "admin_user_token" ("revoked_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_user_id_token_type_idx" ON "admin_user_token" ("user_id","token_type");--> statement-breakpoint
CREATE INDEX "app_agreement_title_is_published_idx" ON "app_agreement" ("title","is_published");--> statement-breakpoint
CREATE INDEX "app_agreement_log_user_id_agreement_id_idx" ON "app_agreement_log" ("user_id","agreement_id");--> statement-breakpoint
CREATE INDEX "app_agreement_log_agreed_at_idx" ON "app_agreement_log" ("agreed_at");--> statement-breakpoint
CREATE INDEX "app_announcement_is_published_publish_start_time_publish_en_idx" ON "app_announcement" ("is_published","publish_start_time","publish_end_time");--> statement-breakpoint
CREATE INDEX "app_announcement_announcement_type_is_published_idx" ON "app_announcement" ("announcement_type","is_published");--> statement-breakpoint
CREATE INDEX "app_announcement_priority_level_is_pinned_idx" ON "app_announcement" ("priority_level","is_pinned");--> statement-breakpoint
CREATE INDEX "app_announcement_created_at_idx" ON "app_announcement" ("created_at");--> statement-breakpoint
CREATE INDEX "app_announcement_page_id_idx" ON "app_announcement" ("page_id");--> statement-breakpoint
CREATE INDEX "app_announcement_show_as_popup_is_published_idx" ON "app_announcement" ("show_as_popup","is_published");--> statement-breakpoint
CREATE INDEX "app_announcement_read_announcement_id_idx" ON "app_announcement_read" ("announcement_id");--> statement-breakpoint
CREATE INDEX "app_announcement_read_user_id_idx" ON "app_announcement_read" ("user_id");--> statement-breakpoint
CREATE INDEX "app_announcement_read_read_at_idx" ON "app_announcement_read" ("read_at");--> statement-breakpoint
CREATE INDEX "app_config_updated_by_id_idx" ON "app_config" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "app_page_access_level_is_enabled_idx" ON "app_page" ("access_level","is_enabled");--> statement-breakpoint
CREATE INDEX "app_user_is_enabled_idx" ON "app_user" ("is_enabled");--> statement-breakpoint
CREATE INDEX "app_user_gender_type_idx" ON "app_user" ("gender_type");--> statement-breakpoint
CREATE INDEX "app_user_created_at_idx" ON "app_user" ("created_at");--> statement-breakpoint
CREATE INDEX "app_user_last_login_at_idx" ON "app_user" ("last_login_at");--> statement-breakpoint
CREATE INDEX "app_user_phone_number_idx" ON "app_user" ("phone_number");--> statement-breakpoint
CREATE INDEX "app_user_email_address_idx" ON "app_user" ("email_address");--> statement-breakpoint
CREATE INDEX "app_user_points_idx" ON "app_user" ("points");--> statement-breakpoint
CREATE INDEX "app_user_status_idx" ON "app_user" ("status");--> statement-breakpoint
CREATE INDEX "app_user_level_id_idx" ON "app_user" ("level_id");--> statement-breakpoint
CREATE INDEX "app_user_token_user_id_idx" ON "app_user_token" ("user_id");--> statement-breakpoint
CREATE INDEX "app_user_token_jti_idx" ON "app_user_token" ("jti");--> statement-breakpoint
CREATE INDEX "app_user_token_token_type_idx" ON "app_user_token" ("token_type");--> statement-breakpoint
CREATE INDEX "app_user_token_expires_at_idx" ON "app_user_token" ("expires_at");--> statement-breakpoint
CREATE INDEX "app_user_token_revoked_at_idx" ON "app_user_token" ("revoked_at");--> statement-breakpoint
CREATE INDEX "app_user_token_user_id_token_type_idx" ON "app_user_token" ("user_id","token_type");--> statement-breakpoint
CREATE INDEX "growth_audit_log_user_id_biz_key_idx" ON "growth_audit_log" ("user_id","biz_key");--> statement-breakpoint
CREATE INDEX "growth_audit_log_asset_type_action_decision_created_at_idx" ON "growth_audit_log" ("asset_type","action","decision","created_at");--> statement-breakpoint
CREATE INDEX "growth_audit_log_request_id_idx" ON "growth_audit_log" ("request_id");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_user_id_asset_type_created_at_idx" ON "growth_ledger_record" ("user_id","asset_type","created_at");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_target_type_target_id_idx" ON "growth_ledger_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "growth_rule_usage_slot_user_id_asset_type_rule_key_created__idx" ON "growth_rule_usage_slot" ("user_id","asset_type","rule_key","created_at");--> statement-breakpoint
CREATE INDEX "task_status_is_enabled_idx" ON "task" ("status","is_enabled");--> statement-breakpoint
CREATE INDEX "task_type_idx" ON "task" ("type");--> statement-breakpoint
CREATE INDEX "task_publish_start_at_idx" ON "task" ("publish_start_at");--> statement-breakpoint
CREATE INDEX "task_publish_end_at_idx" ON "task" ("publish_end_at");--> statement-breakpoint
CREATE INDEX "task_created_at_idx" ON "task" ("created_at");--> statement-breakpoint
CREATE INDEX "task_deleted_at_idx" ON "task" ("deleted_at");--> statement-breakpoint
CREATE INDEX "task_assignment_user_id_status_idx" ON "task_assignment" ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_assignment_task_id_idx" ON "task_assignment" ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignment_completed_at_idx" ON "task_assignment" ("completed_at");--> statement-breakpoint
CREATE INDEX "task_assignment_expired_at_idx" ON "task_assignment" ("expired_at");--> statement-breakpoint
CREATE INDEX "task_assignment_deleted_at_idx" ON "task_assignment" ("deleted_at");--> statement-breakpoint
CREATE INDEX "task_progress_log_assignment_id_idx" ON "task_progress_log" ("assignment_id");--> statement-breakpoint
CREATE INDEX "task_progress_log_user_id_created_at_idx" ON "task_progress_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_badge_type_idx" ON "user_badge" ("type");--> statement-breakpoint
CREATE INDEX "user_badge_business_event_key_idx" ON "user_badge" ("business","event_key");--> statement-breakpoint
CREATE INDEX "user_badge_sortOrder_idx" ON "user_badge" ("sortOrder");--> statement-breakpoint
CREATE INDEX "user_badge_is_enabled_idx" ON "user_badge" ("is_enabled");--> statement-breakpoint
CREATE INDEX "user_badge_created_at_idx" ON "user_badge" ("created_at");--> statement-breakpoint
CREATE INDEX "user_badge_assignment_user_id_idx" ON "user_badge_assignment" ("user_id");--> statement-breakpoint
CREATE INDEX "user_badge_assignment_badge_id_idx" ON "user_badge_assignment" ("badge_id");--> statement-breakpoint
CREATE INDEX "user_badge_assignment_created_at_idx" ON "user_badge_assignment" ("created_at");--> statement-breakpoint
CREATE INDEX "user_browse_log_target_type_target_id_idx" ON "user_browse_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_user_id_idx" ON "user_browse_log" ("user_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_viewed_at_idx" ON "user_browse_log" ("viewed_at");--> statement-breakpoint
CREATE INDEX "user_browse_log_target_type_target_id_user_id_idx" ON "user_browse_log" ("target_type","target_id","user_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_user_id_viewed_at_idx" ON "user_browse_log" ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_created_at_idx" ON "user_comment" ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_reply_to_id_floor_idx" ON "user_comment" ("target_type","target_id","reply_to_id","floor");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_audit_status_is_hidden_d_idx" ON "user_comment" ("target_type","target_id","audit_status","is_hidden","deleted_at");--> statement-breakpoint
CREATE INDEX "user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx" ON "user_comment" ("actual_reply_to_id","audit_status","is_hidden","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_deleted_at_created_at_idx" ON "user_comment" ("target_type","target_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_user_id_idx" ON "user_comment" ("user_id");--> statement-breakpoint
CREATE INDEX "user_comment_created_at_idx" ON "user_comment" ("created_at");--> statement-breakpoint
CREATE INDEX "user_comment_audit_status_idx" ON "user_comment" ("audit_status");--> statement-breakpoint
CREATE INDEX "user_comment_is_hidden_idx" ON "user_comment" ("is_hidden");--> statement-breakpoint
CREATE INDEX "user_comment_reply_to_id_idx" ON "user_comment" ("reply_to_id");--> statement-breakpoint
CREATE INDEX "user_comment_actual_reply_to_id_idx" ON "user_comment" ("actual_reply_to_id");--> statement-breakpoint
CREATE INDEX "user_comment_deleted_at_idx" ON "user_comment" ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_download_record_target_type_target_id_idx" ON "user_download_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_download_record_user_id_idx" ON "user_download_record" ("user_id");--> statement-breakpoint
CREATE INDEX "user_download_record_created_at_idx" ON "user_download_record" ("created_at");--> statement-breakpoint
CREATE INDEX "user_experience_rule_type_idx" ON "user_experience_rule" ("type");--> statement-breakpoint
CREATE INDEX "user_experience_rule_is_enabled_idx" ON "user_experience_rule" ("is_enabled");--> statement-breakpoint
CREATE INDEX "user_experience_rule_created_at_idx" ON "user_experience_rule" ("created_at");--> statement-breakpoint
CREATE INDEX "user_favorite_target_type_target_id_idx" ON "user_favorite" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_favorite_user_id_idx" ON "user_favorite" ("user_id");--> statement-breakpoint
CREATE INDEX "user_favorite_created_at_idx" ON "user_favorite" ("created_at");--> statement-breakpoint
CREATE INDEX "user_level_rule_is_enabled_sortOrder_idx" ON "user_level_rule" ("is_enabled","sortOrder");--> statement-breakpoint
CREATE INDEX "user_like_target_type_target_id_idx" ON "user_like" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_like_scene_type_scene_id_idx" ON "user_like" ("scene_type","scene_id");--> statement-breakpoint
CREATE INDEX "user_like_user_id_scene_type_created_at_idx" ON "user_like" ("user_id","scene_type","created_at");--> statement-breakpoint
CREATE INDEX "user_like_created_at_idx" ON "user_like" ("created_at");--> statement-breakpoint
CREATE INDEX "user_point_rule_type_idx" ON "user_point_rule" ("type");--> statement-breakpoint
CREATE INDEX "user_point_rule_is_enabled_idx" ON "user_point_rule" ("is_enabled");--> statement-breakpoint
CREATE INDEX "user_point_rule_created_at_idx" ON "user_point_rule" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_purchase_record_success_unique_idx" ON "user_purchase_record" ("target_type","target_id","user_id") WHERE "status" = 1;--> statement-breakpoint
CREATE INDEX "user_purchase_record_target_type_target_id_idx" ON "user_purchase_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_purchase_record_user_id_idx" ON "user_purchase_record" ("user_id");--> statement-breakpoint
CREATE INDEX "user_purchase_record_status_idx" ON "user_purchase_record" ("status");--> statement-breakpoint
CREATE INDEX "user_purchase_record_created_at_idx" ON "user_purchase_record" ("created_at");--> statement-breakpoint
CREATE INDEX "user_purchase_record_user_id_status_target_type_created_at__idx" ON "user_purchase_record" ("user_id","status","target_type","created_at","target_id");--> statement-breakpoint
CREATE INDEX "user_report_target_type_target_id_idx" ON "user_report" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_report_scene_type_scene_id_status_idx" ON "user_report" ("scene_type","scene_id","status");--> statement-breakpoint
CREATE INDEX "user_report_scene_type_status_created_at_idx" ON "user_report" ("scene_type","status","created_at");--> statement-breakpoint
CREATE INDEX "user_report_reason_type_status_created_at_idx" ON "user_report" ("reason_type","status","created_at");--> statement-breakpoint
CREATE INDEX "user_report_handler_id_status_handled_at_idx" ON "user_report" ("handler_id","status","handled_at");--> statement-breakpoint
CREATE INDEX "user_report_created_at_idx" ON "user_report" ("created_at");--> statement-breakpoint
CREATE INDEX "user_work_reading_state_user_id_work_type_last_read_at_idx" ON "user_work_reading_state" ("user_id","work_type","last_read_at");--> statement-breakpoint
CREATE INDEX "user_work_reading_state_work_id_idx" ON "user_work_reading_state" ("work_id");--> statement-breakpoint
CREATE INDEX "user_work_reading_state_last_read_chapter_id_idx" ON "user_work_reading_state" ("last_read_chapter_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_group_id_idx" ON "forum_moderator" ("group_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_role_type_idx" ON "forum_moderator" ("role_type");--> statement-breakpoint
CREATE INDEX "forum_moderator_is_enabled_idx" ON "forum_moderator" ("is_enabled");--> statement-breakpoint
CREATE INDEX "forum_moderator_created_at_idx" ON "forum_moderator" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_deleted_at_idx" ON "forum_moderator" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_moderator_id_idx" ON "forum_moderator_action_log" ("moderator_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log" ("action_type");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_created_at_idx" ON "forum_moderator_action_log" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_applicant_id_idx" ON "forum_moderator_application" ("applicant_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_section_id_idx" ON "forum_moderator_application" ("section_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_status_idx" ON "forum_moderator_application" ("status");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_audit_by_id_idx" ON "forum_moderator_application" ("audit_by_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_created_at_idx" ON "forum_moderator_application" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_deleted_at_idx" ON "forum_moderator_application" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_section_moderator_id_idx" ON "forum_moderator_section" ("moderator_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_section_section_id_idx" ON "forum_moderator_section" ("section_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_section_created_at_idx" ON "forum_moderator_section" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_section_group_id_idx" ON "forum_section" ("group_id");--> statement-breakpoint
CREATE INDEX "forum_section_sort_order_idx" ON "forum_section" ("sort_order");--> statement-breakpoint
CREATE INDEX "forum_section_is_enabled_idx" ON "forum_section" ("is_enabled");--> statement-breakpoint
CREATE INDEX "forum_section_topic_count_idx" ON "forum_section" ("topic_count");--> statement-breakpoint
CREATE INDEX "forum_section_last_post_at_idx" ON "forum_section" ("last_post_at");--> statement-breakpoint
CREATE INDEX "forum_section_created_at_idx" ON "forum_section" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_section_deleted_at_idx" ON "forum_section" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_section_group_sort_order_idx" ON "forum_section_group" ("sort_order");--> statement-breakpoint
CREATE INDEX "forum_section_group_is_enabled_idx" ON "forum_section_group" ("is_enabled");--> statement-breakpoint
CREATE INDEX "forum_section_group_created_at_idx" ON "forum_section_group" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_section_group_deleted_at_idx" ON "forum_section_group" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_tag_sortOrder_idx" ON "forum_tag" ("sortOrder");--> statement-breakpoint
CREATE INDEX "forum_tag_name_idx" ON "forum_tag" ("name");--> statement-breakpoint
CREATE INDEX "forum_tag_is_enabled_idx" ON "forum_tag" ("is_enabled");--> statement-breakpoint
CREATE INDEX "forum_tag_use_count_idx" ON "forum_tag" ("use_count");--> statement-breakpoint
CREATE INDEX "forum_tag_created_at_idx" ON "forum_tag" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_idx" ON "forum_topic" ("section_id");--> statement-breakpoint
CREATE INDEX "forum_topic_user_id_idx" ON "forum_topic" ("user_id");--> statement-breakpoint
CREATE INDEX "forum_topic_is_pinned_created_at_idx" ON "forum_topic" ("is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_is_featured_created_at_idx" ON "forum_topic" ("is_featured","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_is_locked_idx" ON "forum_topic" ("is_locked");--> statement-breakpoint
CREATE INDEX "forum_topic_is_hidden_idx" ON "forum_topic" ("is_hidden");--> statement-breakpoint
CREATE INDEX "forum_topic_audit_status_idx" ON "forum_topic" ("audit_status");--> statement-breakpoint
CREATE INDEX "forum_topic_view_count_idx" ON "forum_topic" ("view_count");--> statement-breakpoint
CREATE INDEX "forum_topic_reply_count_idx" ON "forum_topic" ("reply_count");--> statement-breakpoint
CREATE INDEX "forum_topic_like_count_idx" ON "forum_topic" ("like_count");--> statement-breakpoint
CREATE INDEX "forum_topic_comment_count_idx" ON "forum_topic" ("comment_count");--> statement-breakpoint
CREATE INDEX "forum_topic_favorite_count_idx" ON "forum_topic" ("favorite_count");--> statement-breakpoint
CREATE INDEX "forum_topic_last_reply_at_idx" ON "forum_topic" ("last_reply_at");--> statement-breakpoint
CREATE INDEX "forum_topic_created_at_idx" ON "forum_topic" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_updated_at_idx" ON "forum_topic" ("updated_at");--> statement-breakpoint
CREATE INDEX "forum_topic_deleted_at_idx" ON "forum_topic" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_is_pinned_created_at_idx" ON "forum_topic" ("section_id","is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_is_featured_created_at_idx" ON "forum_topic" ("section_id","is_featured","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_last_reply_at_idx" ON "forum_topic" ("section_id","last_reply_at");--> statement-breakpoint
CREATE INDEX "forum_topic_tag_topic_id_idx" ON "forum_topic_tag" ("topic_id");--> statement-breakpoint
CREATE INDEX "forum_topic_tag_tag_id_idx" ON "forum_topic_tag" ("tag_id");--> statement-breakpoint
CREATE INDEX "forum_topic_tag_created_at_idx" ON "forum_topic_tag" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_user_id_idx" ON "forum_user_action_log" ("user_id");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_action_type_idx" ON "forum_user_action_log" ("action_type");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_target_type_target_id_idx" ON "forum_user_action_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_ip_address_idx" ON "forum_user_action_log" ("ip_address");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_created_at_idx" ON "forum_user_action_log" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_user_id_created_at_idx" ON "forum_user_action_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_conversation_last_message_at_idx" ON "chat_conversation" ("last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_conversation_last_message_id_idx" ON "chat_conversation" ("last_message_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_conversation_id_idx" ON "chat_conversation_member" ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_last_read_message_id_idx" ON "chat_conversation_member" ("last_read_message_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_user_id_unread_count_conversation__idx" ON "chat_conversation_member" ("user_id","unread_count","conversation_id");--> statement-breakpoint
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "chat_message" ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_message_sender_id_created_at_idx" ON "chat_message" ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_outbox_status_next_retry_at_id_idx" ON "message_outbox" ("status","next_retry_at","id");--> statement-breakpoint
CREATE INDEX "message_outbox_domain_status_created_at_idx" ON "message_outbox" ("domain","status","created_at");--> statement-breakpoint
CREATE INDEX "message_ws_metric_bucket_at_idx" ON "message_ws_metric" ("bucket_at");--> statement-breakpoint
CREATE INDEX "user_notification_user_id_is_read_created_at_idx" ON "user_notification" ("user_id","is_read","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_user_id_created_at_idx" ON "user_notification" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_type_created_at_idx" ON "user_notification" ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_user_id_aggregate_key_created_at_idx" ON "user_notification" ("user_id","aggregate_key","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_created_at_idx" ON "sys_request_log" ("created_at");--> statement-breakpoint
CREATE INDEX "sys_request_log_user_id_idx" ON "sys_request_log" ("user_id");--> statement-breakpoint
CREATE INDEX "sys_request_log_username_idx" ON "sys_request_log" ("username");--> statement-breakpoint
CREATE INDEX "sys_request_log_is_success_idx" ON "sys_request_log" ("is_success");--> statement-breakpoint
CREATE INDEX "sensitive_word_word_idx" ON "sensitive_word" ("word");--> statement-breakpoint
CREATE INDEX "sensitive_word_type_idx" ON "sensitive_word" ("type");--> statement-breakpoint
CREATE INDEX "sensitive_word_level_idx" ON "sensitive_word" ("level");--> statement-breakpoint
CREATE INDEX "sensitive_word_is_enabled_idx" ON "sensitive_word" ("is_enabled");--> statement-breakpoint
CREATE INDEX "sensitive_word_match_mode_idx" ON "sensitive_word" ("match_mode");--> statement-breakpoint
CREATE INDEX "sensitive_word_created_at_idx" ON "sensitive_word" ("created_at");--> statement-breakpoint
CREATE INDEX "sys_config_updated_by_id_idx" ON "sys_config" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "sys_config_created_at_idx" ON "sys_config" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_dictionary_item_dictionary_code_idx" ON "sys_dictionary_item" ("dictionary_code");--> statement-breakpoint
CREATE INDEX "sys_dictionary_item_sort_order_idx" ON "sys_dictionary_item" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_isPublished_publishAt_idx" ON "work" ("isPublished","publishAt");--> statement-breakpoint
CREATE INDEX "work_popularity_idx" ON "work" ("popularity");--> statement-breakpoint
CREATE INDEX "work_language_region_idx" ON "work" ("language","region");--> statement-breakpoint
CREATE INDEX "work_serialStatus_idx" ON "work" ("serialStatus");--> statement-breakpoint
CREATE INDEX "work_lastUpdated_idx" ON "work" ("lastUpdated");--> statement-breakpoint
CREATE INDEX "work_name_idx" ON "work" ("name");--> statement-breakpoint
CREATE INDEX "work_isRecommended_idx" ON "work" ("isRecommended");--> statement-breakpoint
CREATE INDEX "work_isHot_isNew_idx" ON "work" ("isHot","isNew");--> statement-breakpoint
CREATE INDEX "work_type_idx" ON "work" ("type");--> statement-breakpoint
CREATE INDEX "work_view_rule_idx" ON "work" ("view_rule");--> statement-breakpoint
CREATE INDEX "work_required_view_level_id_idx" ON "work" ("required_view_level_id");--> statement-breakpoint
CREATE INDEX "work_forum_section_id_idx" ON "work" ("forum_section_id");--> statement-breakpoint
CREATE INDEX "work_comment_count_idx" ON "work" ("comment_count");--> statement-breakpoint
CREATE INDEX "work_author_type_idx" ON "work_author" ("type");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_idx" ON "work_author" ("is_enabled");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_is_recommended_idx" ON "work_author" ("is_enabled","is_recommended");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_deleted_at_idx" ON "work_author" ("is_enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "work_author_nationality_idx" ON "work_author" ("nationality");--> statement-breakpoint
CREATE INDEX "work_author_gender_idx" ON "work_author" ("gender");--> statement-breakpoint
CREATE INDEX "work_author_is_recommended_work_count_idx" ON "work_author" ("is_recommended","work_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "work_author_created_at_idx" ON "work_author" ("created_at");--> statement-breakpoint
CREATE INDEX "work_author_relation_work_id_idx" ON "work_author_relation" ("work_id");--> statement-breakpoint
CREATE INDEX "work_author_relation_author_id_idx" ON "work_author_relation" ("author_id");--> statement-breakpoint
CREATE INDEX "work_category_sort_order_idx" ON "work_category" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_category_name_idx" ON "work_category" ("name");--> statement-breakpoint
CREATE INDEX "work_category_content_type_idx" ON "work_category" ("content_type");--> statement-breakpoint
CREATE INDEX "work_category_relation_category_id_idx" ON "work_category_relation" ("category_id");--> statement-breakpoint
CREATE INDEX "work_category_relation_sort_order_idx" ON "work_category_relation" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_category_relation_work_id_sort_order_idx" ON "work_category_relation" ("work_id","sort_order");--> statement-breakpoint
CREATE INDEX "work_chapter_work_id_idx" ON "work_chapter" ("work_id");--> statement-breakpoint
CREATE INDEX "work_chapter_work_id_sort_order_idx" ON "work_chapter" ("work_id","sort_order");--> statement-breakpoint
CREATE INDEX "work_chapter_is_published_publish_at_idx" ON "work_chapter" ("is_published","publish_at");--> statement-breakpoint
CREATE INDEX "work_chapter_view_rule_idx" ON "work_chapter" ("view_rule");--> statement-breakpoint
CREATE INDEX "work_chapter_is_preview_idx" ON "work_chapter" ("is_preview");--> statement-breakpoint
CREATE INDEX "work_chapter_view_count_idx" ON "work_chapter" ("view_count");--> statement-breakpoint
CREATE INDEX "work_chapter_like_count_idx" ON "work_chapter" ("like_count");--> statement-breakpoint
CREATE INDEX "work_chapter_created_at_idx" ON "work_chapter" ("created_at");--> statement-breakpoint
CREATE INDEX "work_chapter_publish_at_idx" ON "work_chapter" ("publish_at");--> statement-breakpoint
CREATE INDEX "work_chapter_required_read_level_id_idx" ON "work_chapter" ("required_read_level_id");--> statement-breakpoint
CREATE INDEX "work_chapter_work_type_idx" ON "work_chapter" ("work_type");--> statement-breakpoint
CREATE INDEX "work_tag_sort_order_idx" ON "work_tag" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_tag_name_idx" ON "work_tag" ("name");--> statement-breakpoint
CREATE INDEX "work_tag_is_enabled_idx" ON "work_tag" ("is_enabled");--> statement-breakpoint
CREATE INDEX "work_tag_relation_tag_id_idx" ON "work_tag_relation" ("tag_id");--> statement-breakpoint
CREATE INDEX "work_tag_relation_work_id_idx" ON "work_tag_relation" ("work_id");--> statement-breakpoint
CREATE INDEX "work_tag_relation_sort_order_idx" ON "work_tag_relation" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_tag_relation_work_id_sort_order_idx" ON "work_tag_relation" ("work_id","sort_order");