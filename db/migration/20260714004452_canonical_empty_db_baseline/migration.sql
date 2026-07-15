CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public VERSION '1.6';--> statement-breakpoint
CREATE TABLE "app_agreement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_agreement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(100) NOT NULL,
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
	"is_realtime" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"show_as_popup" boolean DEFAULT false NOT NULL,
	"popup_background_image" varchar(200),
	"popup_background_position" varchar(20) DEFAULT 'center' NOT NULL,
	"enable_platform" smallint[] DEFAULT ARRAY[1,2,3]::smallint[] NOT NULL,
	"publish_start_time" timestamp(6) with time zone,
	"publish_end_time" timestamp(6) with time zone,
	"notification_start_boundary_at" timestamp(6) with time zone,
	"notification_end_boundary_at" timestamp(6) with time zone,
	"notification_fanout_task_id" integer,
	"notification_fanout_desired_event_key" varchar(120),
	"notification_fanout_status" smallint,
	"notification_fanout_last_error" varchar(500),
	"notification_fanout_updated_at" timestamp(6) with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_announcement_type_valid_chk" CHECK ("announcement_type" in (0, 1, 2, 3, 4)),
	CONSTRAINT "app_announcement_priority_level_valid_chk" CHECK ("priority_level" in (0, 1, 2, 3)),
	CONSTRAINT "app_announcement_enable_platform_valid_chk" CHECK ("enable_platform" <@ ARRAY[1,2,3]::smallint[] and cardinality("enable_platform") > 0),
	CONSTRAINT "app_announcement_publish_window_valid_chk" CHECK ("publish_start_time" is null or "publish_end_time" is null or "publish_start_time" < "publish_end_time"),
	CONSTRAINT "app_announcement_popup_position_valid_chk" CHECK ("popup_background_position" in ('center', 'top center', 'top left', 'top right', 'bottom center', 'bottom left', 'bottom right', 'left center', 'right center')),
	CONSTRAINT "app_announcement_view_count_non_negative_chk" CHECK ("view_count" >= 0),
	CONSTRAINT "app_announcement_notification_fanout_status_valid_chk" CHECK ("notification_fanout_status" is null or "notification_fanout_status" in (0, 1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "app_announcement_notification_fanout_task" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_announcement_notification_fanout_task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"announcement_id" integer NOT NULL,
	"desired_event_key" varchar(120) NOT NULL,
	"event_boundary_key" varchar(160) NOT NULL,
	"fanout_key" varchar(320) NOT NULL CONSTRAINT "app_announcement_notification_fanout_task_fanout_key_key" UNIQUE,
	"status" smallint NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"cursor_user_id" integer,
	"last_error" varchar(500),
	"started_at" timestamp(6) with time zone,
	"processing_lease_expires_at" timestamp(6) with time zone,
	"next_attempt_at" timestamp(6) with time zone,
	"finished_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_ann_fanout_task_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
	CONSTRAINT "app_ann_fanout_task_attempt_count_chk" CHECK ("attempt_count" >= 0),
	CONSTRAINT "app_ann_fanout_task_fanout_key_not_blank_chk" CHECK (btrim("fanout_key") <> ''),
	CONSTRAINT "app_ann_fanout_task_boundary_key_not_blank_chk" CHECK (btrim("event_boundary_key") <> ''),
	CONSTRAINT "app_ann_fanout_task_manual_boundary_format_chk" CHECK ("event_boundary_key" !~ '^manual:legacy:')
);
--> statement-breakpoint
CREATE TABLE "app_announcement_read" (
	"announcement_id" integer,
	"user_id" integer,
	"read_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_announcement_read_pkey" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app_announcement_view" (
	"announcement_id" integer,
	"user_id" integer,
	"viewed_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_announcement_view_pkey" PRIMARY KEY("announcement_id","user_id")
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
	"enable_platform" smallint[] DEFAULT ARRAY[1,2,3]::smallint[],
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_page_access_level_valid_chk" CHECK ("access_level" in (0, 1, 2, 3)),
	CONSTRAINT "app_page_enable_platform_valid_chk" CHECK ("enable_platform" is null or "enable_platform" <@ ARRAY[1,2,3]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "app_update_release" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_update_release_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"platform" smallint NOT NULL,
	"version_name" varchar(50) NOT NULL,
	"build_code" integer NOT NULL,
	"release_notes" varchar(5000),
	"force_update" boolean DEFAULT false NOT NULL,
	"package_source_type" smallint,
	"package_url" varchar(1000),
	"package_original_name" varchar(255),
	"package_file_size" integer,
	"package_mime_type" varchar(100),
	"popup_background_image" varchar(255),
	"popup_background_position" varchar(20) DEFAULT 'center',
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp(6) with time zone,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_update_release_platform_build_code_key" UNIQUE("platform","build_code"),
	CONSTRAINT "app_update_release_build_code_positive_chk" CHECK ("build_code" > 0),
	CONSTRAINT "app_update_release_platform_valid_chk" CHECK ("platform" in (1, 2)),
	CONSTRAINT "app_update_release_package_source_type_valid_chk" CHECK ("package_source_type" is null or "package_source_type" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "coupon_admin_grant_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_admin_grant_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" varchar(36) NOT NULL CONSTRAINT "coupon_admin_grant_item_item_id_key" UNIQUE,
	"coupon_admin_grant_job_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" smallint NOT NULL,
	"grant_count" integer NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"current_attempt_no" integer,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" jsonb,
	"last_failed_at" timestamp(6) with time zone,
	"next_retry_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "coupon_admin_grant_item_job_user_key" UNIQUE("coupon_admin_grant_job_id","user_id"),
	CONSTRAINT "coupon_admin_grant_item_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "coupon_admin_grant_item_grant_count_positive_chk" CHECK ("grant_count" > 0),
	CONSTRAINT "coupon_admin_grant_item_created_count_non_negative_chk" CHECK ("created_count" >= 0),
	CONSTRAINT "coupon_admin_grant_item_failure_count_non_negative_chk" CHECK ("failure_count" >= 0),
	CONSTRAINT "coupon_admin_grant_item_current_attempt_no_positive_chk" CHECK ("current_attempt_no" is null or "current_attempt_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "coupon_admin_grant_job" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_admin_grant_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_job_id" bigint NOT NULL CONSTRAINT "coupon_admin_grant_job_workflow_job_id_key" UNIQUE,
	"coupon_definition_id" integer NOT NULL,
	"operation_id" varchar(120) NOT NULL CONSTRAINT "coupon_admin_grant_job_operation_id_key" UNIQUE,
	"operation_hash" varchar(64) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"operator_user_id" integer NOT NULL,
	"per_user_quantity" integer NOT NULL,
	"selected_user_count" integer NOT NULL,
	"requested_grant_count" integer NOT NULL,
	"remark" varchar(500),
	"coupon_snapshot" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "coupon_admin_grant_job_operation_id_nonblank_chk" CHECK (length(trim("operation_id")) > 0),
	CONSTRAINT "coupon_admin_grant_job_operation_hash_nonblank_chk" CHECK (length(trim("operation_hash")) > 0),
	CONSTRAINT "coupon_admin_grant_job_payload_hash_nonblank_chk" CHECK (length(trim("payload_hash")) > 0),
	CONSTRAINT "coupon_admin_grant_job_per_user_quantity_positive_chk" CHECK ("per_user_quantity" > 0),
	CONSTRAINT "coupon_admin_grant_job_selected_user_count_positive_chk" CHECK ("selected_user_count" > 0),
	CONSTRAINT "coupon_admin_grant_job_requested_grant_count_positive_chk" CHECK ("requested_grant_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "coupon_definition" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_definition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(80) NOT NULL,
	"coupon_type" smallint NOT NULL,
	"target_scope" smallint NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"discount_rate_bps" integer DEFAULT 10000 NOT NULL,
	"usage_limit" integer DEFAULT 1 NOT NULL,
	"valid_days" integer DEFAULT 7 NOT NULL,
	"benefit_days" integer DEFAULT 0 NOT NULL,
	"benefit_count" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "coupon_definition_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4)),
	CONSTRAINT "coupon_definition_target_scope_valid_chk" CHECK ("target_scope" in (1, 2, 3)),
	CONSTRAINT "coupon_definition_discount_amount_non_negative_chk" CHECK ("discount_amount" >= 0),
	CONSTRAINT "coupon_definition_discount_rate_range_chk" CHECK ("discount_rate_bps" >= 0 and "discount_rate_bps" <= 10000),
	CONSTRAINT "coupon_definition_usage_limit_positive_chk" CHECK ("usage_limit" >= 1),
	CONSTRAINT "coupon_definition_valid_days_non_negative_chk" CHECK ("valid_days" >= 0),
	CONSTRAINT "coupon_definition_benefit_days_non_negative_chk" CHECK ("benefit_days" >= 0),
	CONSTRAINT "coupon_definition_benefit_count_non_negative_chk" CHECK ("benefit_count" >= 0),
	CONSTRAINT "coupon_definition_reading_ability_chk" CHECK ("coupon_type" != 1 or ("target_scope" = 1 and "usage_limit" >= 1)),
	CONSTRAINT "coupon_definition_discount_ability_chk" CHECK ("coupon_type" != 2 or ("target_scope" = 1 and ("discount_amount" > 0 or "discount_rate_bps" < 10000))),
	CONSTRAINT "coupon_definition_vip_trial_ability_chk" CHECK ("coupon_type" != 3 or ("target_scope" = 2 and "benefit_days" >= 1)),
	CONSTRAINT "coupon_definition_check_in_makeup_ability_chk" CHECK ("coupon_type" != 4 or ("target_scope" = 3 and "benefit_count" >= 1))
);
--> statement-breakpoint
CREATE TABLE "coupon_redemption_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupon_redemption_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"coupon_instance_id" integer NOT NULL,
	"coupon_type" smallint NOT NULL,
	"target_type" smallint NOT NULL,
	"target_id" integer,
	"status" smallint DEFAULT 1 NOT NULL,
	"biz_key" varchar(120) NOT NULL,
	"redemption_snapshot" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "coupon_redemption_record_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "coupon_redemption_record_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4)),
	CONSTRAINT "coupon_redemption_record_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4)),
	CONSTRAINT "coupon_redemption_record_target_reference_shape_chk" CHECK (
        ("target_type" in (1, 2) and "target_id" is not null)
        or ("target_type" in (3, 4) and "target_id" is null)
      ),
	CONSTRAINT "coupon_redemption_record_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "currency_package" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "currency_package_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"package_key" varchar(64) NOT NULL CONSTRAINT "currency_package_package_key_key" UNIQUE,
	"name" varchar(80) NOT NULL,
	"price" integer NOT NULL,
	"currency_amount" integer NOT NULL,
	"bonus_amount" integer DEFAULT 0 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "currency_package_price_non_negative_chk" CHECK ("price" >= 0),
	CONSTRAINT "currency_package_currency_amount_positive_chk" CHECK ("currency_amount" > 0),
	CONSTRAINT "currency_package_bonus_amount_non_negative_chk" CHECK ("bonus_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_benefit_definition" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "membership_benefit_definition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(80) NOT NULL CONSTRAINT "membership_benefit_definition_code_key" UNIQUE,
	"name" varchar(80) NOT NULL,
	"icon" varchar(300) DEFAULT '' NOT NULL,
	"benefit_type" smallint NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "membership_benefit_definition_type_valid_chk" CHECK ("benefit_type" in (1, 2)),
	CONSTRAINT "membership_benefit_definition_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_page_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "membership_page_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"page_key" varchar(80) NOT NULL CONSTRAINT "membership_page_config_page_key_key" UNIQUE,
	"title" varchar(80) NOT NULL,
	"member_notice_items" jsonb,
	"checkout_agreement_text" text DEFAULT '' NOT NULL,
	"submit_button_template" varchar(120) DEFAULT '' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "membership_page_config_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_page_config_agreement" (
	"page_config_id" integer,
	"agreement_id" integer,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "membership_page_config_agreement_pkey" PRIMARY KEY("page_config_id","agreement_id"),
	CONSTRAINT "membership_page_config_agreement_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_page_config_plan" (
	"page_config_id" integer,
	"plan_id" integer,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "membership_page_config_plan_pkey" PRIMARY KEY("page_config_id","plan_id"),
	CONSTRAINT "membership_page_config_plan_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_plan" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "membership_plan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(80) NOT NULL,
	"plan_key" varchar(64) NOT NULL CONSTRAINT "membership_plan_plan_key_key" UNIQUE,
	"tier" smallint DEFAULT 1 NOT NULL,
	"price_amount" integer NOT NULL,
	"original_price_amount" integer DEFAULT 0 NOT NULL,
	"duration_days" integer NOT NULL,
	"display_tag" varchar(32) DEFAULT '' NOT NULL,
	"bonus_point_amount" integer DEFAULT 0 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "membership_plan_tier_valid_chk" CHECK ("tier" in (1, 2)),
	CONSTRAINT "membership_plan_price_amount_non_negative_chk" CHECK ("price_amount" >= 0),
	CONSTRAINT "membership_plan_original_price_amount_valid_chk" CHECK ("original_price_amount" >= "price_amount"),
	CONSTRAINT "membership_plan_duration_days_positive_chk" CHECK ("duration_days" > 0),
	CONSTRAINT "membership_plan_bonus_point_amount_non_negative_chk" CHECK ("bonus_point_amount" >= 0),
	CONSTRAINT "membership_plan_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_plan_benefit" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "membership_plan_benefit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plan_id" integer NOT NULL,
	"benefit_id" integer NOT NULL,
	"grant_policy" smallint NOT NULL,
	"benefit_value" jsonb,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "membership_plan_benefit_plan_benefit_key" UNIQUE("plan_id","benefit_id"),
	CONSTRAINT "membership_plan_benefit_grant_policy_valid_chk" CHECK ("grant_policy" in (1, 2)),
	CONSTRAINT "membership_plan_benefit_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_notify_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_notify_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel" smallint NOT NULL,
	"event_type" smallint DEFAULT 4 NOT NULL,
	"payment_order_id" integer,
	"order_no" varchar(80),
	"provider_trade_no" varchar(120),
	"provider_event_id" varchar(160),
	"payload_hash" varchar(128) NOT NULL,
	"headers" jsonb,
	"redacted_payload" jsonb,
	"verify_status" smallint DEFAULT 1 NOT NULL,
	"process_status" smallint DEFAULT 1 NOT NULL,
	"error_code" varchar(80),
	"error_message" varchar(500),
	"received_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '730 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "payment_notify_event_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_notify_event_type_valid_chk" CHECK ("event_type" in (1, 2, 3, 4)),
	CONSTRAINT "payment_notify_event_verify_status_valid_chk" CHECK ("verify_status" in (1, 2, 3)),
	CONSTRAINT "payment_notify_event_process_status_valid_chk" CHECK ("process_status" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE TABLE "payment_order" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_order_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_no" varchar(80) NOT NULL CONSTRAINT "payment_order_order_no_key" UNIQUE,
	"user_id" integer NOT NULL,
	"order_type" smallint NOT NULL,
	"channel" smallint NOT NULL,
	"payment_scene" smallint NOT NULL,
	"platform" smallint NOT NULL,
	"environment" smallint NOT NULL,
	"client_app_key" varchar(80) DEFAULT '' NOT NULL,
	"subscription_mode" smallint DEFAULT 1 NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"payable_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"target_id" integer NOT NULL,
	"provider_config_id" integer NOT NULL,
	"provider_config_version_id" integer,
	"provider_config_version" integer NOT NULL,
	"app_private_credential_id" integer,
	"alipay_public_credential_id" integer,
	"wechat_api_v3_credential_id" integer,
	"provider_certificate_ids" jsonb,
	"credential_version_ref" varchar(160) NOT NULL,
	"config_snapshot" jsonb,
	"client_context" jsonb,
	"client_pay_payload" jsonb,
	"provider_trade_no" varchar(120) CONSTRAINT "payment_order_provider_trade_no_key" UNIQUE,
	"notify_payload" jsonb,
	"paid_at" timestamp(6) with time zone,
	"closed_at" timestamp(6) with time zone,
	"refunded_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_order_type_valid_chk" CHECK ("order_type" in (1, 2)),
	CONSTRAINT "payment_order_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_order_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3)),
	CONSTRAINT "payment_order_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5)),
	CONSTRAINT "payment_order_environment_valid_chk" CHECK ("environment" in (1, 2)),
	CONSTRAINT "payment_order_subscription_mode_valid_chk" CHECK ("subscription_mode" in (1)),
	CONSTRAINT "payment_order_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5)),
	CONSTRAINT "payment_order_payable_amount_non_negative_chk" CHECK ("payable_amount" >= 0),
	CONSTRAINT "payment_order_paid_amount_non_negative_chk" CHECK ("paid_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_provider_certificate" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_provider_certificate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel" smallint NOT NULL,
	"certificate_type" smallint NOT NULL,
	"certificate_ref" varchar(180) NOT NULL,
	"serial_no" varchar(160) DEFAULT '' NOT NULL,
	"version_label" varchar(80) DEFAULT '' NOT NULL,
	"display_name" varchar(160) DEFAULT '' NOT NULL,
	"fingerprint" varchar(160) DEFAULT '' NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"expired_at" timestamp(6) with time zone,
	"metadata" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_provider_certificate_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_provider_certificate_type_valid_chk" CHECK ("certificate_type" in (1, 2, 3, 4)),
	CONSTRAINT "payment_provider_certificate_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "payment_provider_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_provider_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel" smallint NOT NULL,
	"payment_scene" smallint NOT NULL,
	"platform" smallint NOT NULL,
	"environment" smallint NOT NULL,
	"client_app_key" varchar(80) DEFAULT '' NOT NULL,
	"config_name" varchar(120) DEFAULT '' NOT NULL,
	"app_id" varchar(120) DEFAULT '' NOT NULL,
	"mch_id" varchar(120) DEFAULT '' NOT NULL,
	"notify_url" varchar(500),
	"return_url" varchar(500),
	"allowed_return_domains" jsonb,
	"cert_mode" smallint DEFAULT 1 NOT NULL,
	"public_key_ref" varchar(160),
	"private_key_ref" varchar(160),
	"api_v3_key_ref" varchar(160),
	"app_cert_ref" varchar(160),
	"platform_cert_ref" varchar(160),
	"root_cert_ref" varchar(160),
	"config_version" integer DEFAULT 1 NOT NULL,
	"credential_version_ref" varchar(160) NOT NULL,
	"config_metadata" jsonb,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_provider_config_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_provider_config_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3)),
	CONSTRAINT "payment_provider_config_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5)),
	CONSTRAINT "payment_provider_config_environment_valid_chk" CHECK ("environment" in (1, 2)),
	CONSTRAINT "payment_provider_config_cert_mode_valid_chk" CHECK ("cert_mode" in (1, 2)),
	CONSTRAINT "payment_provider_config_version_positive_chk" CHECK ("config_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_provider_config_version" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_provider_config_version_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider_config_id" integer NOT NULL,
	"config_version" integer NOT NULL,
	"channel" smallint NOT NULL,
	"payment_scene" smallint NOT NULL,
	"platform" smallint NOT NULL,
	"environment" smallint NOT NULL,
	"client_app_key" varchar(80) DEFAULT '' NOT NULL,
	"config_name" varchar(120) DEFAULT '' NOT NULL,
	"app_id" varchar(120) DEFAULT '' NOT NULL,
	"mch_id" varchar(120) DEFAULT '' NOT NULL,
	"notify_url" varchar(500),
	"return_url" varchar(500),
	"allowed_return_domains" jsonb,
	"cert_mode" smallint DEFAULT 1 NOT NULL,
	"app_private_credential_id" integer,
	"alipay_public_credential_id" integer,
	"wechat_api_v3_credential_id" integer,
	"app_certificate_id" integer,
	"platform_certificate_id" integer,
	"root_certificate_id" integer,
	"credential_snapshot" jsonb,
	"config_snapshot" jsonb,
	"status" smallint DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_provider_config_version_number_positive_chk" CHECK ("config_version" > 0),
	CONSTRAINT "payment_provider_config_version_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_provider_config_version_scene_valid_chk" CHECK ("payment_scene" in (1, 2, 3)),
	CONSTRAINT "payment_provider_config_version_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5)),
	CONSTRAINT "payment_provider_config_version_environment_valid_chk" CHECK ("environment" in (1, 2)),
	CONSTRAINT "payment_provider_config_version_cert_mode_valid_chk" CHECK ("cert_mode" in (1, 2)),
	CONSTRAINT "payment_provider_config_version_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "payment_provider_credential" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_provider_credential_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"channel" smallint NOT NULL,
	"credential_type" smallint NOT NULL,
	"credential_ref" varchar(180) NOT NULL,
	"version_label" varchar(80) DEFAULT '' NOT NULL,
	"display_name" varchar(160) DEFAULT '' NOT NULL,
	"masked_identifier" varchar(160) DEFAULT '' NOT NULL,
	"fingerprint" varchar(160) DEFAULT '' NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"expired_at" timestamp(6) with time zone,
	"metadata" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_provider_credential_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_provider_credential_type_valid_chk" CHECK ("credential_type" in (1, 2, 3, 4)),
	CONSTRAINT "payment_provider_credential_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliation_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_reconciliation_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_order_id" integer,
	"order_no" varchar(80) NOT NULL,
	"channel" smallint NOT NULL,
	"mismatch_type" smallint NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"local_status" smallint NOT NULL,
	"provider_status" varchar(80) DEFAULT '' NOT NULL,
	"provider_trade_no" varchar(120),
	"local_amount" integer NOT NULL,
	"provider_amount" integer,
	"currency" varchar(16) DEFAULT 'CNY' NOT NULL,
	"evidence" jsonb,
	"handled_remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "payment_reconciliation_record_channel_valid_chk" CHECK ("channel" in (1, 2)),
	CONSTRAINT "payment_reconciliation_record_mismatch_type_valid_chk" CHECK ("mismatch_type" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "payment_reconciliation_record_status_valid_chk" CHECK ("status" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE TABLE "user_asset_balance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_asset_balance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(64) DEFAULT '' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_asset_balance_user_id_asset_type_asset_key_key" UNIQUE("user_id","asset_type","asset_key"),
	CONSTRAINT "user_asset_balance_asset_type_valid_chk" CHECK ("asset_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "user_asset_balance_asset_key_not_blank_chk" CHECK ((
      ("asset_type" in (1, 2) and btrim("asset_key") = '')
      or ("asset_type" in (3, 4, 5) and btrim("asset_key") <> '')
    )),
	CONSTRAINT "user_asset_balance_balance_non_negative_chk" CHECK ("balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_coupon_instance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_coupon_instance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"coupon_definition_id" integer NOT NULL,
	"coupon_type" smallint NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"remaining_uses" integer NOT NULL,
	"source_type" smallint NOT NULL,
	"source_id" integer,
	"grant_key" varchar(180),
	"expires_at" timestamp(6) with time zone,
	"grant_snapshot" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_coupon_instance_coupon_type_valid_chk" CHECK ("coupon_type" in (1, 2, 3, 4)),
	CONSTRAINT "user_coupon_instance_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "user_coupon_instance_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "user_coupon_instance_remaining_uses_non_negative_chk" CHECK ("remaining_uses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_membership_subscription" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_membership_subscription_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"plan_id" integer,
	"source_type" smallint NOT NULL,
	"source_id" integer,
	"status" smallint DEFAULT 1 NOT NULL,
	"starts_at" timestamp(6) with time zone NOT NULL,
	"ends_at" timestamp(6) with time zone NOT NULL,
	"cancelled_at" timestamp(6) with time zone,
	"refunded_at" timestamp(6) with time zone,
	"source_snapshot" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_membership_subscription_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3)),
	CONSTRAINT "user_membership_subscription_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "user_membership_subscription_time_range_chk" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"config_key" varchar(32) DEFAULT 'global' NOT NULL CONSTRAINT "app_config_config_key_key" UNIQUE,
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
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_config_config_key_valid_chk" CHECK ("config_key" = 'global')
);
--> statement-breakpoint
CREATE TABLE "sys_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_by_id" integer,
	"aliyun_config" jsonb,
	"site_config" jsonb,
	"operation_config" jsonb,
	"security_config" jsonb,
	"third_party_resource_parse_config" jsonb,
	"wallet_currency_display_config" jsonb,
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
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_dictionary_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_dictionary_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dictionary_code" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cover" varchar(200),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"description" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "sys_dictionary_item_dictionary_code_code_key" UNIQUE("dictionary_code","code")
);
--> statement-breakpoint
CREATE TABLE "content_import_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_import_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" varchar(36) NOT NULL CONSTRAINT "content_import_item_item_id_key" UNIQUE,
	"content_import_job_id" bigint NOT NULL,
	"item_type" smallint NOT NULL,
	"provider_chapter_id" varchar(100),
	"target_chapter_id" integer,
	"local_chapter_id" integer,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" smallint NOT NULL,
	"stage" smallint NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(120),
	"last_error_domain" varchar(80),
	"last_error_stage" varchar(80),
	"last_error_severity" varchar(40),
	"last_error_retryable" boolean,
	"last_error_context" jsonb,
	"last_error_diagnostic" jsonb,
	"last_failed_at" timestamp(6) with time zone,
	"next_retry_at" timestamp(6) with time zone,
	"auto_retry_count" integer DEFAULT 0 NOT NULL,
	"max_auto_retries" integer DEFAULT 3 NOT NULL,
	"last_retry_code" varchar(120),
	"last_retry_context" jsonb,
	"last_retry_diagnostic" jsonb,
	"image_total" integer DEFAULT 0 NOT NULL,
	"image_success_count" integer DEFAULT 0 NOT NULL,
	"current_attempt_no" integer,
	"metadata" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "content_import_item_item_type_valid_chk" CHECK ("item_type" in (1)),
	CONSTRAINT "content_import_item_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "content_import_item_stage_valid_chk" CHECK ("stage" in (1, 2, 3, 4, 5, 6, 7, 8)),
	CONSTRAINT "content_import_item_title_nonblank_chk" CHECK (length(trim("title")) > 0),
	CONSTRAINT "content_import_item_failure_count_non_negative_chk" CHECK ("failure_count" >= 0),
	CONSTRAINT "content_import_item_auto_retry_count_non_negative_chk" CHECK ("auto_retry_count" >= 0),
	CONSTRAINT "content_import_item_max_auto_retries_non_negative_chk" CHECK ("max_auto_retries" >= 0),
	CONSTRAINT "content_import_item_image_total_non_negative_chk" CHECK ("image_total" >= 0),
	CONSTRAINT "content_import_item_image_success_count_non_negative_chk" CHECK ("image_success_count" >= 0),
	CONSTRAINT "content_import_item_current_attempt_no_positive_chk" CHECK ("current_attempt_no" is null or "current_attempt_no" > 0)
);
--> statement-breakpoint
CREATE TABLE "content_import_item_attempt" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_import_item_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_attempt_id" varchar(36) NOT NULL CONSTRAINT "content_import_item_attempt_item_attempt_id_key" UNIQUE,
	"workflow_attempt_id" bigint NOT NULL,
	"content_import_item_id" bigint NOT NULL,
	"attempt_no" integer NOT NULL,
	"status" smallint NOT NULL,
	"stage" smallint NOT NULL,
	"image_total" integer DEFAULT 0 NOT NULL,
	"image_success_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(120),
	"error_domain" varchar(80),
	"error_stage" varchar(80),
	"error_severity" varchar(40),
	"error_retryable" boolean,
	"error_context" jsonb,
	"error_diagnostic" jsonb,
	"started_at" timestamp(6) with time zone,
	"finished_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "content_import_item_attempt_item_attempt_no_key" UNIQUE("content_import_item_id","attempt_no"),
	CONSTRAINT "content_import_item_attempt_attempt_no_positive_chk" CHECK ("attempt_no" > 0),
	CONSTRAINT "content_import_item_attempt_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "content_import_item_attempt_stage_valid_chk" CHECK ("stage" in (1, 2, 3, 4, 5, 6, 7, 8)),
	CONSTRAINT "content_import_item_attempt_image_total_non_negative_chk" CHECK ("image_total" >= 0),
	CONSTRAINT "content_import_item_attempt_image_success_nonnegative_chk" CHECK ("image_success_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_import_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_import_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workflow_job_id" bigint NOT NULL CONSTRAINT "content_import_job_workflow_job_id_key" UNIQUE,
	"content_type" smallint NOT NULL,
	"source_type" smallint NOT NULL,
	"work_id" integer,
	"platform" varchar(30),
	"provider_comic_id" varchar(100),
	"provider_path_word" varchar(100),
	"provider_group_path_word" varchar(100),
	"archive_name" varchar(255),
	"archive_path" varchar(1000),
	"extract_path" varchar(1000),
	"preview_mode" smallint,
	"source_snapshot" jsonb,
	"publish_boundary_status" smallint DEFAULT 1 NOT NULL,
	"selected_item_count" integer DEFAULT 0 NOT NULL,
	"success_item_count" integer DEFAULT 0 NOT NULL,
	"failed_item_count" integer DEFAULT 0 NOT NULL,
	"skipped_item_count" integer DEFAULT 0 NOT NULL,
	"image_total" integer DEFAULT 0 NOT NULL,
	"image_success_count" integer DEFAULT 0 NOT NULL,
	"image_failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "content_import_job_content_type_valid_chk" CHECK ("content_type" in (1)),
	CONSTRAINT "content_import_job_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3)),
	CONSTRAINT "content_import_job_preview_mode_valid_chk" CHECK ("preview_mode" is null or "preview_mode" in (1, 2)),
	CONSTRAINT "content_import_job_publish_boundary_status_valid_chk" CHECK ("publish_boundary_status" in (1, 2)),
	CONSTRAINT "content_import_job_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
	CONSTRAINT "content_import_job_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
	CONSTRAINT "content_import_job_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
	CONSTRAINT "content_import_job_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0),
	CONSTRAINT "content_import_job_image_total_non_negative_chk" CHECK ("image_total" >= 0),
	CONSTRAINT "content_import_job_image_success_count_non_negative_chk" CHECK ("image_success_count" >= 0),
	CONSTRAINT "content_import_job_image_failed_count_non_negative_chk" CHECK ("image_failed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_import_preview_item" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_import_preview_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"preview_item_id" varchar(36) NOT NULL CONSTRAINT "content_import_preview_item_preview_item_id_key" UNIQUE,
	"content_import_job_id" bigint NOT NULL,
	"item_type" smallint NOT NULL,
	"source_path" varchar(1000),
	"provider_chapter_id" varchar(100),
	"target_chapter_id" integer,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_total" integer DEFAULT 0 NOT NULL,
	"status" smallint NOT NULL,
	"ignore_reason" varchar(300),
	"warning_message" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "content_import_preview_item_item_type_valid_chk" CHECK ("item_type" in (1)),
	CONSTRAINT "content_import_preview_item_status_valid_chk" CHECK ("status" in (1, 2, 3)),
	CONSTRAINT "content_import_preview_item_title_nonblank_chk" CHECK (length(trim("title")) > 0),
	CONSTRAINT "content_import_preview_item_image_total_non_negative_chk" CHECK ("image_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_import_residue" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_import_residue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"residue_id" varchar(36) NOT NULL CONSTRAINT "content_import_residue_residue_id_key" UNIQUE,
	"workflow_job_id" bigint NOT NULL,
	"workflow_attempt_id" bigint,
	"content_import_item_id" bigint,
	"content_import_item_attempt_id" bigint,
	"residue_type" smallint NOT NULL,
	"provider" varchar(60),
	"file_path" varchar(1000),
	"local_path" varchar(1000),
	"metadata" jsonb,
	"cleanup_status" smallint NOT NULL,
	"cleanup_error" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"cleaned_at" timestamp(6) with time zone,
	CONSTRAINT "content_import_residue_type_valid_chk" CHECK ("residue_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "content_import_residue_cleanup_status_valid_chk" CHECK ("cleanup_status" in (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE TABLE "user_content_entitlement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_content_entitlement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"grant_source" smallint NOT NULL,
	"source_id" integer,
	"source_key" varchar(120),
	"status" smallint DEFAULT 1 NOT NULL,
	"starts_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp(6) with time zone,
	"revoked_at" timestamp(6) with time zone,
	"grant_snapshot" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_content_entitlement_target_type_valid_chk" CHECK ("target_type" in (1, 2)),
	CONSTRAINT "user_content_entitlement_grant_source_valid_chk" CHECK ("grant_source" in (1, 2, 3, 4, 5)),
	CONSTRAINT "user_content_entitlement_grant_source_reference_shape_chk" CHECK (
        ("grant_source" in (1, 2, 3) and "source_id" is not null)
        or (
          "grant_source" in (4, 5)
          and "source_key" is not null
          and length(btrim("source_key")) > 0
        )
      ),
	CONSTRAINT "user_content_entitlement_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "user_download_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_download_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_download_record_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id"),
	CONSTRAINT "user_download_record_target_type_valid_chk" CHECK ("target_type" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "user_purchase_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_purchase_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"original_price" integer NOT NULL,
	"paid_price" integer NOT NULL,
	"payable_rate" numeric(3,2) DEFAULT '1.00' NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"coupon_instance_id" integer,
	"discount_source" smallint DEFAULT 0 NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"payment_method" smallint NOT NULL,
	"out_trade_no" varchar(100),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_purchase_record_target_type_valid_chk" CHECK ("target_type" in (1, 2)),
	CONSTRAINT "user_purchase_record_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "user_purchase_record_payment_method_valid_chk" CHECK ("payment_method" in (1, 2, 3)),
	CONSTRAINT "user_purchase_record_original_price_non_negative_chk" CHECK ("original_price" >= 0),
	CONSTRAINT "user_purchase_record_paid_price_non_negative_chk" CHECK ("paid_price" >= 0),
	CONSTRAINT "user_purchase_record_payable_rate_range_chk" CHECK ("payable_rate" >= 0 and "payable_rate" <= 1),
	CONSTRAINT "user_purchase_record_discount_amount_non_negative_chk" CHECK ("discount_amount" >= 0),
	CONSTRAINT "user_purchase_record_discount_source_valid_chk" CHECK ("discount_source" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "user_work_reading_state" (
	"user_id" integer,
	"work_id" integer,
	"work_type" smallint NOT NULL,
	"last_read_at" timestamp(6) with time zone NOT NULL,
	"last_read_chapter_id" integer,
	CONSTRAINT "user_work_reading_state_pkey" PRIMARY KEY("user_id","work_id"),
	CONSTRAINT "user_work_reading_state_work_type_valid_chk" CHECK ("work_type" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "work" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" smallint NOT NULL,
	"name" varchar(80) NOT NULL,
	"alias" varchar(200),
	"cover" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"language" varchar(10) NOT NULL,
	"region" varchar(10) NOT NULL,
	"age_rating" varchar(10),
	"serial_status" smallint DEFAULT 0 NOT NULL,
	"publisher" varchar(100),
	"original_source" varchar(100),
	"copyright" varchar(500),
	"disclaimer" text,
	"remark" varchar(1000),
	"is_published" boolean DEFAULT true NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"is_hot" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"publish_at" date,
	"last_updated" timestamp(6) with time zone,
	"view_rule" smallint DEFAULT 0 NOT NULL,
	"required_view_level_id" integer,
	"forum_section_id" integer CONSTRAINT "work_forum_section_id_key" UNIQUE,
	"chapter_price" integer DEFAULT 0 NOT NULL,
	"can_comment" boolean DEFAULT true NOT NULL,
	"recommend_weight" double precision DEFAULT 1 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"rating" double precision,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_type_valid_chk" CHECK ("type" in (1, 2)),
	CONSTRAINT "work_serial_status_valid_chk" CHECK ("serial_status" in (0, 1, 2, 3, 4)),
	CONSTRAINT "work_view_rule_valid_chk" CHECK ("view_rule" in (0, 1, 2, 3)),
	CONSTRAINT "work_view_count_non_negative_chk" CHECK ("view_count" >= 0),
	CONSTRAINT "work_favorite_count_non_negative_chk" CHECK ("favorite_count" >= 0),
	CONSTRAINT "work_like_count_non_negative_chk" CHECK ("like_count" >= 0),
	CONSTRAINT "work_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
	CONSTRAINT "work_download_count_non_negative_chk" CHECK ("download_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_author" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_author_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
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
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_author_gender_valid_chk" CHECK ("gender" in (0, 1, 2, 3, 4)),
	CONSTRAINT "work_author_type_valid_chk" CHECK ("type" is null or "type" <@ '{1,2}'::smallint[])
);
--> statement-breakpoint
CREATE TABLE "work_author_relation" (
	"work_id" integer,
	"author_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "work_author_relation_pkey" PRIMARY KEY("work_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "work_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "work_category_name_key" UNIQUE,
	"description" varchar(200),
	"icon" varchar(255),
	"content_type" smallint[],
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "work_category_content_type_valid_chk" CHECK ("content_type" is null or "content_type" <@ '{1,2,3}'::smallint[])
);
--> statement-breakpoint
CREATE TABLE "work_category_relation" (
	"work_id" integer,
	"category_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
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
	"novel_content_path" varchar(1000),
	"comic_content_manifest" jsonb,
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
	CONSTRAINT "work_chapter_work_type_valid_chk" CHECK ("work_type" in (1, 2)),
	CONSTRAINT "work_chapter_view_rule_valid_chk" CHECK ("view_rule" in (-1, 0, 1, 2, 3)),
	CONSTRAINT "work_chapter_content_type_valid_chk" CHECK (("work_type" = 1 and "novel_content_path" is null) or ("work_type" = 2 and "comic_content_manifest" is null)),
	CONSTRAINT "work_chapter_novel_content_path_non_blank_chk" CHECK ("novel_content_path" is null or btrim("novel_content_path") <> ''),
	CONSTRAINT "work_chapter_comic_manifest_array_chk" CHECK ("comic_content_manifest" is null or jsonb_typeof("comic_content_manifest") = 'array'),
	CONSTRAINT "work_chapter_view_count_non_negative_chk" CHECK ("view_count" >= 0),
	CONSTRAINT "work_chapter_like_count_non_negative_chk" CHECK ("like_count" >= 0),
	CONSTRAINT "work_chapter_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
	CONSTRAINT "work_chapter_purchase_count_non_negative_chk" CHECK ("purchase_count" >= 0),
	CONSTRAINT "work_chapter_download_count_non_negative_chk" CHECK ("download_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "work_comic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_comic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL CONSTRAINT "work_comic_work_id_key" UNIQUE,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_novel" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_novel_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL CONSTRAINT "work_novel_work_id_key" UNIQUE,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
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
	CONSTRAINT "work_tag_relation_pkey" PRIMARY KEY("work_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "work_third_party_chapter_binding" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_third_party_chapter_binding_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_third_party_source_binding_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"provider_chapter_id" varchar(100) NOT NULL,
	"remote_sort_order" integer,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_tp_chapter_binding_provider_chapter_nonblank_chk" CHECK (length(trim("provider_chapter_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "work_third_party_source_binding" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_third_party_source_binding_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"work_id" integer NOT NULL,
	"platform" varchar(30) NOT NULL,
	"provider_comic_id" varchar(100) NOT NULL,
	"provider_path_word" varchar(100) NOT NULL,
	"provider_group_path_word" varchar(100) NOT NULL,
	"provider_uuid" varchar(100),
	"source_snapshot" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "work_third_party_source_binding_platform_nonblank_chk" CHECK (length(trim("platform")) > 0),
	CONSTRAINT "work_third_party_source_binding_provider_comic_id_nonblank_chk" CHECK (length(trim("provider_comic_id")) > 0),
	CONSTRAINT "work_third_party_source_binding_provider_path_word_nonblank_chk" CHECK (length(trim("provider_path_word")) > 0),
	CONSTRAINT "work_tp_source_binding_group_path_nonblank_chk" CHECK (length(trim("provider_group_path_word")) > 0)
);
--> statement-breakpoint
CREATE TABLE "domain_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "domain_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_key" varchar(120) NOT NULL,
	"domain" varchar(40) NOT NULL,
	"idempotency_key" varchar(180),
	"subject_type" varchar(40) NOT NULL,
	"subject_id" integer NOT NULL,
	"target_type" varchar(40) NOT NULL,
	"target_id" integer NOT NULL,
	"operator_id" integer,
	"occurred_at" timestamp(6) with time zone NOT NULL,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_event_domain_idempotency_key_key" UNIQUE("domain","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "domain_event_dispatch" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "domain_event_dispatch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"consumer" varchar(40) NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp(6) with time zone,
	"last_error" varchar(500),
	"processed_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '90 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "domain_event_dispatch_event_id_consumer_key" UNIQUE("event_id","consumer"),
	CONSTRAINT "domain_event_dispatch_status_valid_chk" CHECK ("status" in (0, 1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "forum_hashtag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_hashtag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(64) NOT NULL CONSTRAINT "forum_hashtag_slug_key" UNIQUE,
	"display_name" varchar(64) NOT NULL,
	"description" varchar(200),
	"manual_boost" smallint DEFAULT 0 NOT NULL,
	"audit_status" smallint DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"audit_by_id" integer,
	"audit_role" smallint,
	"audit_reason" varchar(500),
	"audit_at" timestamp(6) with time zone,
	"create_source_type" smallint NOT NULL,
	"created_by_user_id" integer,
	"sensitive_word_hits" jsonb,
	"topic_ref_count" integer DEFAULT 0 NOT NULL,
	"comment_ref_count" integer DEFAULT 0 NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"last_referenced_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_hashtag_audit_status_valid_chk" CHECK ("audit_status" in (0, 1, 2)),
	CONSTRAINT "forum_hashtag_audit_role_valid_chk" CHECK ("audit_role" is null or "audit_role" in (0, 1)),
	CONSTRAINT "forum_hashtag_audit_actor_pair_chk" CHECK (("audit_role" is null) = ("audit_by_id" is null)),
	CONSTRAINT "forum_hashtag_create_source_type_valid_chk" CHECK ("create_source_type" in (1, 2, 3)),
	CONSTRAINT "forum_hashtag_manual_boost_non_negative_chk" CHECK ("manual_boost" >= 0),
	CONSTRAINT "forum_hashtag_topic_ref_count_non_negative_chk" CHECK ("topic_ref_count" >= 0),
	CONSTRAINT "forum_hashtag_comment_ref_count_non_negative_chk" CHECK ("comment_ref_count" >= 0),
	CONSTRAINT "forum_hashtag_follower_count_non_negative_chk" CHECK ("follower_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "forum_hashtag_reference" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_hashtag_reference_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hashtag_id" integer NOT NULL,
	"source_type" smallint NOT NULL,
	"source_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"occurrence_count" smallint DEFAULT 1 NOT NULL,
	"source_audit_status" smallint NOT NULL,
	"source_is_hidden" boolean DEFAULT false NOT NULL,
	"is_source_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "forum_hashtag_reference_unique_key" UNIQUE("hashtag_id","source_type","source_id"),
	CONSTRAINT "forum_hashtag_reference_source_type_valid_chk" CHECK ("source_type" in (1, 2)),
	CONSTRAINT "forum_hashtag_reference_source_audit_status_valid_chk" CHECK ("source_audit_status" in (0, 1, 2)),
	CONSTRAINT "forum_hashtag_reference_occurrence_count_positive_chk" CHECK ("occurrence_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "forum_moderator" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL CONSTRAINT "forum_moderator_user_id_key" UNIQUE,
	"group_id" integer,
	"role_type" smallint DEFAULT 3 NOT NULL,
	"permissions" smallint[] DEFAULT ARRAY[]::smallint[],
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_moderator_role_type_valid_chk" CHECK ("role_type" in (1, 2, 3)),
	CONSTRAINT "forum_moderator_permissions_valid_chk" CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_action_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_action_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"moderator_id" integer,
	"actor_type" smallint DEFAULT 1 NOT NULL,
	"actor_user_id" integer,
	"target_id" integer NOT NULL,
	"action_type" smallint NOT NULL,
	"target_type" smallint NOT NULL,
	"action_description" varchar(200) NOT NULL,
	"before_data" text,
	"after_data" text,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_moderator_action_log_action_type_valid_chk" CHECK ("action_type" in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17)),
	CONSTRAINT "forum_governance_action_log_actor_type_valid_chk" CHECK ("actor_type" in (1, 2)),
	CONSTRAINT "forum_governance_action_log_actor_user_present_chk" CHECK ("actor_user_id" is not null),
	CONSTRAINT "forum_governance_action_log_moderator_presence_chk" CHECK (("actor_type" = 1 and "moderator_id" is not null) or ("actor_type" = 2 and "moderator_id" is null)),
	CONSTRAINT "forum_moderator_action_log_target_type_valid_chk" CHECK ("target_type" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_application" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"applicant_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"audit_by_id" integer,
	"status" smallint DEFAULT 0 NOT NULL,
	"permissions" smallint[] DEFAULT ARRAY[]::smallint[],
	"reason" varchar(500) NOT NULL,
	"audit_reason" varchar(500),
	"remark" varchar(500),
	"audit_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_moderator_application_applicant_id_section_id_key" UNIQUE("applicant_id","section_id"),
	CONSTRAINT "forum_moderator_application_status_valid_chk" CHECK ("status" in (0, 1, 2)),
	CONSTRAINT "forum_moderator_application_permissions_valid_chk" CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_lifecycle_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_moderator_lifecycle_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_type" smallint NOT NULL,
	"moderator_id" integer,
	"application_id" integer,
	"actor_admin_user_id" integer NOT NULL,
	"reason" varchar(500),
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_moderator_lifecycle_log_event_type_valid_chk" CHECK ("event_type" in (1,2,3,4,5,6,7,8,9)),
	CONSTRAINT "forum_moderator_lifecycle_log_actor_admin_user_id_positive_chk" CHECK ("actor_admin_user_id" > 0),
	CONSTRAINT "forum_moderator_lifecycle_log_moderator_id_positive_chk" CHECK ("moderator_id" is null or "moderator_id" > 0),
	CONSTRAINT "forum_moderator_lifecycle_log_application_id_positive_chk" CHECK ("application_id" is null or "application_id" > 0),
	CONSTRAINT "forum_moderator_lifecycle_log_subject_present_chk" CHECK ("moderator_id" is not null or "application_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "forum_moderator_section" (
	"moderator_id" integer,
	"section_id" integer,
	"permissions" smallint[] DEFAULT ARRAY[]::smallint[],
	CONSTRAINT "forum_moderator_section_pkey" PRIMARY KEY("moderator_id","section_id"),
	CONSTRAINT "forum_moderator_section_permissions_valid_chk" CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "forum_section" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_section_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"group_id" integer,
	"user_level_rule_id" integer,
	"last_topic_id" integer,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"icon" varchar(500) NOT NULL,
	"cover" varchar(500) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"topic_review_policy" smallint DEFAULT 1 NOT NULL,
	"remark" varchar(500),
	"topic_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_section_topic_review_policy_valid_chk" CHECK ("topic_review_policy" in (0, 1, 2, 3, 4))
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
CREATE TABLE "forum_topic" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_topic_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"section_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"last_comment_user_id" integer,
	"audit_by_id" integer,
	"title" varchar(200) NOT NULL,
	"html" text NOT NULL,
	"content" text NOT NULL,
	"content_preview" jsonb NOT NULL,
	"body" jsonb NOT NULL,
	"body_version" smallint DEFAULT 1 NOT NULL,
	"images" varchar(500)[] DEFAULT ARRAY[]::varchar(500)[] NOT NULL,
	"videos" jsonb DEFAULT '[]' NOT NULL,
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
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"last_comment_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "forum_topic_view_count_non_negative_chk" CHECK ("view_count" >= 0),
	CONSTRAINT "forum_topic_like_count_non_negative_chk" CHECK ("like_count" >= 0),
	CONSTRAINT "forum_topic_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
	CONSTRAINT "forum_topic_favorite_count_non_negative_chk" CHECK ("favorite_count" >= 0),
	CONSTRAINT "forum_topic_body_version_valid_chk" CHECK ("body_version" in (1)),
	CONSTRAINT "forum_topic_audit_status_valid_chk" CHECK ("audit_status" in (0, 1, 2)),
	CONSTRAINT "forum_topic_audit_role_valid_chk" CHECK ("audit_role" is null or "audit_role" in (0, 1)),
	CONSTRAINT "forum_topic_audit_actor_pair_chk" CHECK (("audit_role" is null) = ("audit_by_id" is null))
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
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "forum_user_action_log_action_type_valid_chk" CHECK ("action_type" in (1,2,3,4,5,6,7,8,9,10,11,12)),
	CONSTRAINT "forum_user_action_log_target_type_valid_chk" CHECK ("target_type" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "check_in_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"config_key" varchar(32) DEFAULT 'global' NOT NULL CONSTRAINT "check_in_config_config_key_key" UNIQUE,
	"is_enabled" smallint DEFAULT 1 NOT NULL,
	"makeup_period_type" smallint NOT NULL,
	"periodic_allowance" integer DEFAULT 0 NOT NULL,
	"makeup_icon_url" varchar(500),
	"reward_overview_icon_url" varchar(500),
	"base_reward_items" jsonb,
	"date_reward_rules" jsonb DEFAULT '[]' NOT NULL,
	"pattern_reward_rules" jsonb DEFAULT '[]' NOT NULL,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_config_config_key_valid_chk" CHECK ("config_key" = 'global'),
	CONSTRAINT "check_in_config_is_enabled_valid_chk" CHECK ("is_enabled" in (0, 1)),
	CONSTRAINT "check_in_config_makeup_period_type_valid_chk" CHECK ("makeup_period_type" in (1, 2)),
	CONSTRAINT "check_in_config_periodic_allowance_non_negative_chk" CHECK ("periodic_allowance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_makeup_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_makeup_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"period_type" smallint NOT NULL,
	"period_key" varchar(32) NOT NULL,
	"periodic_granted" integer DEFAULT 0 NOT NULL,
	"periodic_used" integer DEFAULT 0 NOT NULL,
	"event_available" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"last_synced_fact_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_makeup_account_user_period_key_key" UNIQUE("user_id","period_type","period_key"),
	CONSTRAINT "check_in_makeup_account_period_type_valid_chk" CHECK ("period_type" in (1, 2)),
	CONSTRAINT "check_in_makeup_account_period_key_not_blank_chk" CHECK (btrim("period_key") <> ''),
	CONSTRAINT "check_in_makeup_account_periodic_granted_non_negative_chk" CHECK ("periodic_granted" >= 0),
	CONSTRAINT "check_in_makeup_account_periodic_used_non_negative_chk" CHECK ("periodic_used" >= 0),
	CONSTRAINT "check_in_makeup_account_event_available_non_negative_chk" CHECK ("event_available" >= 0),
	CONSTRAINT "check_in_makeup_account_periodic_used_not_gt_granted_chk" CHECK ("periodic_used" <= "periodic_granted"),
	CONSTRAINT "check_in_makeup_account_version_non_negative_chk" CHECK ("version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_makeup_fact" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_makeup_fact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"fact_type" smallint NOT NULL,
	"source_type" smallint NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"consumed_amount" integer DEFAULT 0 NOT NULL,
	"effective_at" timestamp(6) with time zone NOT NULL,
	"expires_at" timestamp(6) with time zone,
	"period_type" smallint,
	"period_key" varchar(32),
	"source_ref" varchar(64),
	"biz_key" varchar(180) NOT NULL,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_makeup_fact_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "check_in_makeup_fact_type_valid_chk" CHECK ("fact_type" in (1, 2, 3)),
	CONSTRAINT "check_in_makeup_fact_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3)),
	CONSTRAINT "check_in_makeup_fact_period_type_valid_chk" CHECK ("period_type" is null or "period_type" in (1, 2)),
	CONSTRAINT "check_in_makeup_fact_amount_non_negative_chk" CHECK ("amount" >= 0),
	CONSTRAINT "check_in_makeup_fact_consumed_amount_non_negative_chk" CHECK ("consumed_amount" >= 0),
	CONSTRAINT "check_in_makeup_fact_biz_key_not_blank_chk" CHECK (btrim("biz_key") <> ''),
	CONSTRAINT "check_in_makeup_fact_source_ref_not_blank_chk" CHECK ("source_ref" is null or btrim("source_ref") <> '')
);
--> statement-breakpoint
CREATE TABLE "check_in_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"sign_date" date NOT NULL,
	"record_type" smallint NOT NULL,
	"resolved_reward_source_type" smallint,
	"resolved_reward_rule_key" varchar(32),
	"resolved_reward_items" jsonb,
	"resolved_reward_overview_icon_url" varchar(500),
	"resolved_makeup_icon_url" varchar(500),
	"reward_settlement_id" integer,
	"biz_key" varchar(180) NOT NULL,
	"operator_type" smallint NOT NULL,
	"remark" varchar(500),
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_record_user_sign_date_key" UNIQUE("user_id","sign_date"),
	CONSTRAINT "check_in_record_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "check_in_record_record_type_valid_chk" CHECK ("record_type" in (1, 2)),
	CONSTRAINT "check_in_record_operator_type_valid_chk" CHECK ("operator_type" in (1, 2, 3)),
	CONSTRAINT "check_in_record_reward_source_type_valid_chk" CHECK ("resolved_reward_source_type" is null or "resolved_reward_source_type" in (1, 2, 3)),
	CONSTRAINT "check_in_record_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0),
	CONSTRAINT "check_in_record_reward_resolution_consistent_chk" CHECK ((
      "resolved_reward_items" is null
      and "resolved_reward_source_type" is null
      and "resolved_reward_rule_key" is null
    ) or (
      "resolved_reward_items" is not null
      and "resolved_reward_source_type" in (1, 2, 3)
    ))
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_grant" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_grant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_code" varchar(50) NOT NULL,
	"streak_days" integer NOT NULL,
	"repeatable" boolean DEFAULT false NOT NULL,
	"reward_overview_icon_url" varchar(500),
	"trigger_sign_date" date NOT NULL,
	"reward_settlement_id" integer,
	"biz_key" varchar(200) NOT NULL,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_streak_grant_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "check_in_streak_grant_rule_id_positive_chk" CHECK ("rule_id" > 0),
	CONSTRAINT "check_in_streak_grant_streak_days_positive_chk" CHECK ("streak_days" > 0),
	CONSTRAINT "check_in_streak_grant_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_grant_reward_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_grant_reward_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grant_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(50) DEFAULT '' NOT NULL,
	"amount" integer NOT NULL,
	"icon_url" varchar(500),
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "check_in_streak_grant_reward_item_grant_id_positive_chk" CHECK ("grant_id" > 0),
	CONSTRAINT "check_in_streak_grant_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
	CONSTRAINT "check_in_streak_grant_reward_item_amount_positive_chk" CHECK ("amount" > 0),
	CONSTRAINT "check_in_streak_grant_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL CONSTRAINT "check_in_streak_progress_user_id_key" UNIQUE,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"streak_started_at" date,
	"last_signed_date" date,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_streak_progress_current_streak_non_negative_chk" CHECK ("current_streak" >= 0),
	CONSTRAINT "check_in_streak_progress_version_non_negative_chk" CHECK ("version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rule_code" varchar(50) NOT NULL,
	"streak_days" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"publish_strategy" smallint NOT NULL,
	"effective_from" timestamp(6) with time zone NOT NULL,
	"effective_to" timestamp(6) with time zone,
	"repeatable" boolean DEFAULT false NOT NULL,
	"reward_overview_icon_url" varchar(500),
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "check_in_streak_rule_rule_code_version_key" UNIQUE("rule_code","version"),
	CONSTRAINT "check_in_streak_rule_rule_code_effective_from_key" UNIQUE("rule_code","effective_from"),
	CONSTRAINT "check_in_streak_rule_streak_days_positive_chk" CHECK ("streak_days" > 0),
	CONSTRAINT "check_in_streak_rule_version_positive_chk" CHECK ("version" > 0),
	CONSTRAINT "check_in_streak_rule_status_valid_chk" CHECK ("status" in (0, 1, 2, 3, 4)),
	CONSTRAINT "check_in_streak_rule_publish_strategy_valid_chk" CHECK ("publish_strategy" in (1, 2, 3)),
	CONSTRAINT "check_in_streak_rule_effective_window_valid_chk" CHECK ("effective_to" is null or "effective_to" > "effective_from"),
	CONSTRAINT "check_in_streak_rule_rule_code_not_blank_chk" CHECK (btrim("rule_code") <> '')
);
--> statement-breakpoint
CREATE TABLE "check_in_streak_rule_reward_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_in_streak_rule_reward_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rule_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(50) DEFAULT '' NOT NULL,
	"amount" integer NOT NULL,
	"icon_url" varchar(500),
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "check_in_streak_rule_reward_item_rule_id_positive_chk" CHECK ("rule_id" > 0),
	CONSTRAINT "check_in_streak_rule_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
	CONSTRAINT "check_in_streak_rule_reward_item_amount_positive_chk" CHECK ("amount" > 0),
	CONSTRAINT "check_in_streak_rule_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "growth_audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" varchar(80),
	"user_id" integer NOT NULL,
	"biz_key" varchar(120) NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(64) DEFAULT '' NOT NULL,
	"action" smallint NOT NULL,
	"rule_type" smallint,
	"decision" smallint NOT NULL,
	"reason" varchar(80),
	"delta_requested" integer,
	"delta_applied" integer,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '365 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "growth_audit_log_asset_type_valid_chk" CHECK ("asset_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "growth_audit_log_action_valid_chk" CHECK ("action" in (1, 2, 3, 4)),
	CONSTRAINT "growth_audit_log_decision_valid_chk" CHECK ("decision" in (1, 2)),
	CONSTRAINT "growth_audit_log_rule_type_valid_chk" CHECK ("rule_type" is null or "rule_type" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801))
);
--> statement-breakpoint
CREATE TABLE "growth_ledger_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_ledger_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(64) DEFAULT '' NOT NULL,
	"delta" integer NOT NULL,
	"before_value" integer NOT NULL,
	"after_value" integer NOT NULL,
	"biz_key" varchar(120) NOT NULL,
	"source" varchar(40) NOT NULL,
	"rule_type" smallint,
	"rule_id" integer,
	"target_type" smallint,
	"target_id" integer,
	"remark" varchar(500),
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '730 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "growth_ledger_record_user_id_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "growth_ledger_record_rule_type_valid_chk" CHECK ("rule_type" is null or "rule_type" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801))
);
--> statement-breakpoint
CREATE TABLE "growth_reward_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_reward_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" smallint NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(64) DEFAULT '' NOT NULL,
	"delta" integer NOT NULL,
	"daily_limit" integer DEFAULT 0 NOT NULL,
	"total_limit" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"archived_at" timestamp(6) with time zone,
	"archived_by" integer,
	"archive_reason_code" varchar(80),
	"archive_reason" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "growth_reward_rule_asset_type_valid_chk" CHECK ("asset_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "growth_reward_rule_type_valid_chk" CHECK ("type" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "growth_reward_rule_asset_key_not_blank_chk" CHECK ((
      ("asset_type" in (1, 2) and btrim("asset_key") = '')
      or ("asset_type" in (3, 4, 5) and btrim("asset_key") <> '')
    )),
	CONSTRAINT "growth_reward_rule_daily_limit_non_negative_chk" CHECK ("daily_limit" >= 0),
	CONSTRAINT "growth_reward_rule_total_limit_non_negative_chk" CHECK ("total_limit" >= 0),
	CONSTRAINT "growth_reward_rule_delta_positive_chk" CHECK ("delta" > 0)
);
--> statement-breakpoint
CREATE TABLE "growth_reward_settlement" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_reward_settlement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"biz_key" varchar(160) NOT NULL,
	"settlement_type" smallint NOT NULL,
	"source" varchar(40) NOT NULL,
	"source_record_id" integer,
	"event_code" smallint,
	"event_key" varchar(80),
	"target_type" smallint,
	"target_id" integer,
	"event_occurred_at" timestamp(6) with time zone NOT NULL,
	"settlement_status" smallint DEFAULT 0 NOT NULL,
	"settlement_result_type" smallint,
	"ledger_record_ids" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp(6) with time zone,
	"processing_token" varchar(64),
	"processing_started_at" timestamp(6) with time zone,
	"settled_at" timestamp(6) with time zone,
	"last_error" varchar(500),
	"request_payload" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "growth_reward_settlement_user_biz_key_key" UNIQUE("user_id","biz_key"),
	CONSTRAINT "growth_reward_settlement_user_id_positive_chk" CHECK ("user_id" > 0),
	CONSTRAINT "growth_reward_settlement_event_code_valid_chk" CHECK ("event_code" is null or "event_code" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "growth_reward_settlement_biz_key_not_blank_chk" CHECK (btrim("biz_key") <> ''),
	CONSTRAINT "growth_reward_settlement_type_valid_chk" CHECK ("settlement_type" in (1, 2, 3, 4)),
	CONSTRAINT "growth_reward_settlement_event_key_not_blank_chk" CHECK ("event_key" is null or btrim("event_key") <> ''),
	CONSTRAINT "growth_reward_settlement_source_not_blank_chk" CHECK (btrim("source") <> ''),
	CONSTRAINT "growth_reward_settlement_source_record_id_positive_chk" CHECK ("source_record_id" is null or "source_record_id" > 0),
	CONSTRAINT "growth_reward_settlement_status_valid_chk" CHECK ("settlement_status" in (0, 1, 2)),
	CONSTRAINT "growth_reward_settlement_result_type_valid_chk" CHECK ("settlement_result_type" is null or "settlement_result_type" in (1, 2, 3)),
	CONSTRAINT "growth_reward_settlement_retry_count_non_negative_chk" CHECK ("retry_count" >= 0),
	CONSTRAINT "growth_reward_settlement_processing_token_not_blank_chk" CHECK ("processing_token" is null or btrim("processing_token") <> ''),
	CONSTRAINT "growth_reward_settlement_processing_lease_pair_chk" CHECK (("processing_token" is null and "processing_started_at" is null) or ("processing_token" is not null and "processing_started_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "growth_rule_usage_counter" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "growth_rule_usage_counter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"asset_type" smallint NOT NULL,
	"asset_key" varchar(64) DEFAULT '' NOT NULL,
	"rule_key" varchar(80) NOT NULL,
	"scope_type" smallint NOT NULL,
	"scope_key" varchar(60) NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "growth_rule_usage_counter_user_id_asset_type_asset_key_rul_key" UNIQUE("user_id","asset_type","asset_key","rule_key","scope_type","scope_key"),
	CONSTRAINT "growth_rule_usage_counter_asset_type_valid_chk" CHECK ("asset_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "growth_rule_usage_counter_scope_type_valid_chk" CHECK ("scope_type" in (1, 2, 3)),
	CONSTRAINT "growth_rule_usage_counter_used_count_positive_chk" CHECK ("used_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_definition" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_definition_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(50) NOT NULL CONSTRAINT "task_definition_code_key" UNIQUE,
	"title" varchar(200) NOT NULL,
	"description" varchar(1000),
	"cover" varchar(255),
	"scene_type" smallint NOT NULL,
	"status" smallint NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"claim_mode" smallint NOT NULL,
	"completion_policy" smallint DEFAULT 1 NOT NULL,
	"repeat_type" smallint DEFAULT 0 NOT NULL,
	"start_at" timestamp(6) with time zone,
	"end_at" timestamp(6) with time zone,
	"reward_items" jsonb,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "task_definition_scene_type_valid_chk" CHECK ("scene_type" in (1, 2, 4)),
	CONSTRAINT "task_definition_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
	CONSTRAINT "task_definition_sort_order_non_negative_chk" CHECK ("sort_order" >= 0),
	CONSTRAINT "task_definition_claim_mode_valid_chk" CHECK ("claim_mode" in (1, 2)),
	CONSTRAINT "task_definition_completion_policy_valid_chk" CHECK ("completion_policy" in (1)),
	CONSTRAINT "task_definition_repeat_type_valid_chk" CHECK ("repeat_type" in (0, 1, 2, 3)),
	CONSTRAINT "task_definition_code_not_blank_chk" CHECK (btrim("code") <> ''),
	CONSTRAINT "task_definition_title_not_blank_chk" CHECK (btrim("title") <> ''),
	CONSTRAINT "task_definition_publish_window_valid_chk" CHECK ("start_at" is null or "end_at" is null or "start_at" <= "end_at")
);
--> statement-breakpoint
CREATE TABLE "task_event_failure" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_event_failure_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"idempotency_key" varchar(255) NOT NULL CONSTRAINT "task_event_failure_idempotency_key_key" UNIQUE,
	"event_key" varchar(80) NOT NULL,
	"event_biz_key" varchar(180) NOT NULL,
	"event_code" smallint NOT NULL,
	"template_key" varchar(80),
	"user_id" integer NOT NULL,
	"target_type" varchar(80),
	"target_id" integer,
	"status" smallint DEFAULT 1 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp(6) with time zone,
	"last_error_message" varchar(1000),
	"resolved_at" timestamp(6) with time zone,
	"terminal_error_at" timestamp(6) with time zone,
	"terminal_reason" varchar(500),
	"processing_token" varchar(64),
	"processing_started_at" timestamp(6) with time zone,
	"processing_expired_at" timestamp(6) with time zone,
	"request_payload" jsonb NOT NULL,
	"occurred_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "task_event_failure_idempotency_key_not_blank_chk" CHECK (btrim("idempotency_key") <> ''),
	CONSTRAINT "task_event_failure_event_key_not_blank_chk" CHECK (btrim("event_key") <> ''),
	CONSTRAINT "task_event_failure_event_biz_key_not_blank_chk" CHECK (btrim("event_biz_key") <> ''),
	CONSTRAINT "task_event_failure_event_code_valid_chk" CHECK ("event_code" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "task_event_failure_template_key_not_blank_chk" CHECK ("template_key" is null or btrim("template_key") <> ''),
	CONSTRAINT "task_event_failure_user_id_positive_chk" CHECK ("user_id" > 0),
	CONSTRAINT "task_event_failure_target_type_not_blank_chk" CHECK ("target_type" is null or btrim("target_type") <> ''),
	CONSTRAINT "task_event_failure_target_id_positive_chk" CHECK ("target_id" is null or "target_id" > 0),
	CONSTRAINT "task_event_failure_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "task_event_failure_retry_count_non_negative_chk" CHECK ("retry_count" >= 0),
	CONSTRAINT "task_event_failure_processing_token_not_blank_chk" CHECK ("processing_token" is null or btrim("processing_token") <> ''),
	CONSTRAINT "task_event_failure_processing_lease_pair_chk" CHECK (("processing_token" is null and "processing_started_at" is null and "processing_expired_at" is null) or ("processing_token" is not null and "processing_started_at" is not null and "processing_expired_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "task_event_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_event_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"step_id" integer,
	"instance_id" integer,
	"instance_step_id" integer,
	"user_id" integer NOT NULL,
	"event_code" smallint,
	"event_biz_key" varchar(180),
	"action_type" smallint NOT NULL,
	"progress_source" smallint DEFAULT 1 NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"reject_reason" varchar(120),
	"delta" integer DEFAULT 0 NOT NULL,
	"before_value" integer DEFAULT 0 NOT NULL,
	"after_value" integer DEFAULT 0 NOT NULL,
	"target_type" varchar(80),
	"target_id" integer,
	"dimension_key" varchar(80),
	"dimension_value" varchar(255),
	"occurred_at" timestamp(6) with time zone,
	"context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "task_event_log_action_type_valid_chk" CHECK ("action_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "task_event_log_progress_source_valid_chk" CHECK ("progress_source" in (1, 2, 3)),
	CONSTRAINT "task_event_log_delta_non_negative_chk" CHECK ("delta" >= 0),
	CONSTRAINT "task_event_log_before_value_non_negative_chk" CHECK ("before_value" >= 0),
	CONSTRAINT "task_event_log_after_value_non_negative_chk" CHECK ("after_value" >= 0),
	CONSTRAINT "task_event_log_event_code_valid_chk" CHECK ("event_code" is null or "event_code" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "task_event_log_event_biz_key_not_blank_chk" CHECK ("event_biz_key" is null or btrim("event_biz_key") <> ''),
	CONSTRAINT "task_event_log_reject_reason_not_blank_chk" CHECK ("reject_reason" is null or btrim("reject_reason") <> ''),
	CONSTRAINT "task_event_log_target_type_not_blank_chk" CHECK ("target_type" is null or btrim("target_type") <> ''),
	CONSTRAINT "task_event_log_target_id_positive_chk" CHECK ("target_id" is null or "target_id" > 0),
	CONSTRAINT "task_event_log_dimension_key_not_blank_chk" CHECK ("dimension_key" is null or btrim("dimension_key") <> ''),
	CONSTRAINT "task_event_log_dimension_value_not_blank_chk" CHECK ("dimension_value" is null or btrim("dimension_value") <> '')
);
--> statement-breakpoint
CREATE TABLE "task_instance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_instance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"cycle_key" varchar(64) NOT NULL,
	"status" smallint NOT NULL,
	"reward_applicable" smallint DEFAULT 0 NOT NULL,
	"reward_settlement_id" integer,
	"snapshot_payload" jsonb,
	"context" jsonb,
	"version" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp(6) with time zone,
	"completed_at" timestamp(6) with time zone,
	"expired_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "task_instance_task_id_user_id_cycle_key_key" UNIQUE("task_id","user_id","cycle_key"),
	CONSTRAINT "task_instance_cycle_key_not_blank_chk" CHECK (btrim("cycle_key") <> ''),
	CONSTRAINT "task_instance_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
	CONSTRAINT "task_instance_reward_applicable_valid_chk" CHECK ("reward_applicable" in (0, 1)),
	CONSTRAINT "task_instance_version_non_negative_chk" CHECK ("version" >= 0),
	CONSTRAINT "task_instance_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "task_instance_step" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_instance_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"instance_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"status" smallint NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"target_value" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp(6) with time zone,
	"context" jsonb,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "task_instance_step_instance_id_step_id_key" UNIQUE("instance_id","step_id"),
	CONSTRAINT "task_instance_step_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
	CONSTRAINT "task_instance_step_current_value_non_negative_chk" CHECK ("current_value" >= 0),
	CONSTRAINT "task_instance_step_target_value_positive_chk" CHECK ("target_value" > 0),
	CONSTRAINT "task_instance_step_version_non_negative_chk" CHECK ("version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_step" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"step_key" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(1000),
	"step_no" smallint NOT NULL,
	"trigger_mode" smallint NOT NULL,
	"event_code" smallint,
	"target_value" integer DEFAULT 1 NOT NULL,
	"template_key" varchar(80),
	"filter_payload" jsonb,
	"dedupe_scope" smallint,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "task_step_task_id_step_key_key" UNIQUE("task_id","step_key"),
	CONSTRAINT "task_step_task_id_step_no_key" UNIQUE("task_id","step_no"),
	CONSTRAINT "task_step_step_no_positive_chk" CHECK ("step_no" > 0),
	CONSTRAINT "task_step_trigger_mode_valid_chk" CHECK ("trigger_mode" in (1, 2)),
	CONSTRAINT "task_step_target_value_positive_chk" CHECK ("target_value" > 0),
	CONSTRAINT "task_step_event_code_valid_chk" CHECK ("event_code" is null or "event_code" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "task_step_step_key_not_blank_chk" CHECK (btrim("step_key") <> ''),
	CONSTRAINT "task_step_title_not_blank_chk" CHECK (btrim("title") <> ''),
	CONSTRAINT "task_step_template_key_not_blank_chk" CHECK ("template_key" is null or btrim("template_key") <> ''),
	CONSTRAINT "task_step_dedupe_scope_valid_chk" CHECK ("dedupe_scope" is null or "dedupe_scope" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "task_step_unique_fact" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_step_unique_fact_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"cycle_key" varchar(64),
	"dedupe_scope" smallint NOT NULL,
	"scope_key" varchar(64) NOT NULL,
	"dimension_key" varchar(80) NOT NULL,
	"dimension_value" varchar(255) NOT NULL,
	"dimension_hash" varchar(120) NOT NULL,
	"first_event_code" smallint,
	"first_event_biz_key" varchar(180),
	"first_target_type" varchar(80),
	"first_target_id" integer,
	"first_occurred_at" timestamp(6) with time zone NOT NULL,
	"first_context" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_step_unique_fact_step_user_scope_dim_key" UNIQUE("step_id","user_id","scope_key","dimension_hash"),
	CONSTRAINT "task_step_unique_fact_dedupe_scope_valid_chk" CHECK ("dedupe_scope" in (1, 2)),
	CONSTRAINT "task_step_unique_fact_scope_key_not_blank_chk" CHECK (btrim("scope_key") <> ''),
	CONSTRAINT "task_step_unique_fact_dimension_key_not_blank_chk" CHECK (btrim("dimension_key") <> ''),
	CONSTRAINT "task_step_unique_fact_dimension_value_not_blank_chk" CHECK (btrim("dimension_value") <> ''),
	CONSTRAINT "task_step_unique_fact_dimension_hash_not_blank_chk" CHECK (btrim("dimension_hash") <> ''),
	CONSTRAINT "task_step_unique_fact_cycle_key_not_blank_chk" CHECK ("cycle_key" is null or btrim("cycle_key") <> ''),
	CONSTRAINT "task_step_unique_fact_event_code_valid_chk" CHECK ("first_event_code" is null or "first_event_code" in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 16, 100, 101, 102, 104, 200, 201, 202, 204, 300, 301, 302, 303, 304, 306, 400, 401, 402, 403, 404, 406, 600, 601, 602, 700, 701, 702, 703, 800, 801)),
	CONSTRAINT "task_step_unique_fact_event_biz_key_not_blank_chk" CHECK ("first_event_biz_key" is null or btrim("first_event_biz_key") <> ''),
	CONSTRAINT "task_step_unique_fact_target_type_not_blank_chk" CHECK ("first_target_type" is null or btrim("first_target_type") <> ''),
	CONSTRAINT "task_step_unique_fact_target_id_positive_chk" CHECK ("first_target_id" is null or "first_target_id" > 0)
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
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_badge_type_valid_chk" CHECK ("type" in (1, 2, 3)),
	CONSTRAINT "user_badge_sort_order_non_negative_chk" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_badge_assignment" (
	"user_id" integer,
	"badge_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badge_assignment_pkey" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "user_level_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_level_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL CONSTRAINT "user_level_rule_name_key" UNIQUE,
	"required_experience" integer NOT NULL,
	"description" varchar(200),
	"icon" varchar(255),
	"color" varchar(20),
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"business" varchar(20),
	"daily_topic_limit" smallint DEFAULT 0 NOT NULL,
	"daily_reply_comment_limit" smallint DEFAULT 0 NOT NULL,
	"post_interval" smallint DEFAULT 0 NOT NULL,
	"daily_like_limit" smallint DEFAULT 0 NOT NULL,
	"daily_favorite_limit" smallint DEFAULT 0 NOT NULL,
	"purchase_payable_rate" numeric(3,2) DEFAULT '1.00' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_level_rule_required_experience_non_negative_chk" CHECK ("required_experience" >= 0),
	CONSTRAINT "user_level_rule_sort_order_non_negative_chk" CHECK ("sort_order" >= 0),
	CONSTRAINT "user_level_rule_daily_topic_limit_non_negative_chk" CHECK ("daily_topic_limit" >= 0),
	CONSTRAINT "user_level_rule_daily_reply_comment_limit_non_negative_chk" CHECK ("daily_reply_comment_limit" >= 0),
	CONSTRAINT "user_level_rule_post_interval_non_negative_chk" CHECK ("post_interval" >= 0),
	CONSTRAINT "user_level_rule_daily_like_limit_non_negative_chk" CHECK ("daily_like_limit" >= 0),
	CONSTRAINT "user_level_rule_daily_favorite_limit_non_negative_chk" CHECK ("daily_favorite_limit" >= 0),
	CONSTRAINT "user_level_rule_purchase_payable_rate_range_chk" CHECK ("purchase_payable_rate" >= 0 and "purchase_payable_rate" <= 1),
	CONSTRAINT "user_level_rule_business_trimmed_not_blank_chk" CHECK ("business" is null or ("business" = btrim("business") and "business" <> ''))
);
--> statement-breakpoint
CREATE TABLE "admin_menu" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_menu_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(120) NOT NULL CONSTRAINT "admin_menu_code_key" UNIQUE,
	"parent_id" integer,
	"type" smallint DEFAULT 2 NOT NULL,
	"title" varchar(80) NOT NULL,
	"path" varchar(200) NOT NULL,
	"name" varchar(120),
	"component" varchar(240),
	"redirect" varchar(200),
	"icon" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"keep_alive" boolean DEFAULT false NOT NULL,
	"external_link" varchar(300),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "admin_menu_type_chk" CHECK ("type" in (1, 2)),
	CONSTRAINT "admin_menu_code_not_blank_chk" CHECK (length(trim("code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "admin_permission" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_permission_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(160) NOT NULL CONSTRAINT "admin_permission_code_key" UNIQUE,
	"name" varchar(120) NOT NULL,
	"group_code" varchar(120) NOT NULL,
	"description" varchar(300),
	"source" smallint DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "admin_permission_code_not_blank_chk" CHECK (length(trim("code")) > 0),
	CONSTRAINT "admin_permission_source_chk" CHECK ("source" in (1))
);
--> statement-breakpoint
CREATE TABLE "admin_rbac_revision" (
	"code" varchar(30) PRIMARY KEY,
	"revision" integer DEFAULT 1 NOT NULL,
	"menu_seeded_at" timestamp(6) with time zone,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_role_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(80) NOT NULL CONSTRAINT "admin_role_code_key" UNIQUE,
	"name" varchar(80) NOT NULL,
	"description" varchar(300),
	"is_system" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "admin_role_code_not_blank_chk" CHECK (length(trim("code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "admin_role_menu" (
	"role_id" integer,
	"menu_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_role_menu_pkey" PRIMARY KEY("role_id","menu_id")
);
--> statement-breakpoint
CREATE TABLE "admin_role_permission" (
	"role_id" integer,
	"permission_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_role_permission_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "admin_user_role" (
	"admin_user_id" integer,
	"role_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_user_role_pkey" PRIMARY KEY("admin_user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" varchar(20) NOT NULL CONSTRAINT "admin_user_username_key" UNIQUE,
	"password" varchar(500) NOT NULL,
	"mobile" varchar(11) CONSTRAINT "admin_user_mobile_key" UNIQUE,
	"avatar" varchar(200),
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
	"token_type" smallint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" smallint,
	"device_info" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_user_token_token_type_valid_chk" CHECK ("token_type" in (1, 2)),
	CONSTRAINT "admin_user_token_revoke_reason_valid_chk" CHECK ("revoke_reason" is null or "revoke_reason" in (1, 2, 3, 4, 5, 6))
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
	"profile_background_image_url" varchar(500),
	"signature" varchar(200),
	"bio" varchar(500),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"gender_type" smallint DEFAULT 0 NOT NULL,
	"birth_date" date,
	"status" smallint DEFAULT 1 NOT NULL,
	"ban_reason" varchar(500),
	"ban_until" timestamp(6) with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"last_login_geo_country" varchar(100),
	"last_login_geo_province" varchar(100),
	"last_login_geo_city" varchar(100),
	"last_login_geo_isp" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "app_user_gender_type_valid_chk" CHECK ("gender_type" in (0, 1, 2, 3, 4)),
	CONSTRAINT "app_user_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5))
);
--> statement-breakpoint
CREATE TABLE "app_user_count" (
	"user_id" integer PRIMARY KEY,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"following_user_count" integer DEFAULT 0 NOT NULL,
	"following_author_count" integer DEFAULT 0 NOT NULL,
	"following_section_count" integer DEFAULT 0 NOT NULL,
	"following_hashtag_count" integer DEFAULT 0 NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_count" integer DEFAULT 0 NOT NULL,
	"comment_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_favorite_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "app_user_count_comment_count_non_negative_chk" CHECK ("comment_count" >= 0),
	CONSTRAINT "app_user_count_like_count_non_negative_chk" CHECK ("like_count" >= 0),
	CONSTRAINT "app_user_count_favorite_count_non_negative_chk" CHECK ("favorite_count" >= 0),
	CONSTRAINT "app_user_count_following_user_count_non_negative_chk" CHECK ("following_user_count" >= 0),
	CONSTRAINT "app_user_count_following_author_count_non_negative_chk" CHECK ("following_author_count" >= 0),
	CONSTRAINT "app_user_count_following_section_count_non_negative_chk" CHECK ("following_section_count" >= 0),
	CONSTRAINT "app_user_count_following_hashtag_count_non_negative_chk" CHECK ("following_hashtag_count" >= 0),
	CONSTRAINT "app_user_count_followers_count_non_negative_chk" CHECK ("followers_count" >= 0),
	CONSTRAINT "app_user_count_forum_topic_count_non_negative_chk" CHECK ("forum_topic_count" >= 0),
	CONSTRAINT "app_user_count_comment_received_like_count_non_negative_chk" CHECK ("comment_received_like_count" >= 0),
	CONSTRAINT "app_user_count_forum_topic_received_like_count_non_negative_chk" CHECK ("forum_topic_received_like_count" >= 0),
	CONSTRAINT "app_user_count_forum_topic_received_fav_nonnegative_chk" CHECK ("forum_topic_received_favorite_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app_user_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"jti" varchar(255) NOT NULL CONSTRAINT "app_user_token_jti_key" UNIQUE,
	"user_id" integer NOT NULL,
	"token_type" smallint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" smallint,
	"device_info" jsonb,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "app_user_token_token_type_valid_chk" CHECK ("token_type" in (1, 2)),
	CONSTRAINT "app_user_token_revoke_reason_valid_chk" CHECK ("revoke_reason" is null or "revoke_reason" in (1, 2, 3, 4, 5, 6))
);
--> statement-breakpoint
CREATE TABLE "ad_provider_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ad_provider_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" smallint NOT NULL,
	"platform" smallint NOT NULL,
	"environment" smallint NOT NULL,
	"client_app_key" varchar(80) DEFAULT '' NOT NULL,
	"app_id" varchar(120) DEFAULT '' NOT NULL,
	"placement_key" varchar(120) NOT NULL,
	"target_scope" smallint NOT NULL,
	"daily_limit" smallint DEFAULT 0 NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"credential_version_ref" varchar(160) NOT NULL,
	"callback_url" varchar(500),
	"config_metadata" jsonb,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "ad_provider_config_provider_valid_chk" CHECK ("provider" in (1, 2)),
	CONSTRAINT "ad_provider_config_platform_valid_chk" CHECK ("platform" in (1, 2, 3, 4, 5)),
	CONSTRAINT "ad_provider_config_environment_valid_chk" CHECK ("environment" in (1, 2)),
	CONSTRAINT "ad_provider_config_target_scope_valid_chk" CHECK ("target_scope" in (1, 2, 3)),
	CONSTRAINT "ad_provider_config_daily_limit_chk" CHECK ("daily_limit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ad_reward_record" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ad_reward_record_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"ad_provider_config_id" integer NOT NULL,
	"ad_provider_config_version" integer NOT NULL,
	"credential_version_ref" varchar(160) NOT NULL,
	"provider_reward_id" varchar(160) NOT NULL,
	"placement_key" varchar(120) NOT NULL,
	"target_scope" smallint NOT NULL,
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"status" smallint DEFAULT 1 NOT NULL,
	"client_context" jsonb,
	"raw_notify_payload" jsonb,
	"verify_payload" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "ad_reward_record_config_reward_key" UNIQUE("ad_provider_config_id","provider_reward_id"),
	CONSTRAINT "ad_reward_record_target_scope_valid_chk" CHECK ("target_scope" in (1, 2, 3)),
	CONSTRAINT "ad_reward_record_target_type_valid_chk" CHECK ("target_type" in (1, 2)),
	CONSTRAINT "ad_reward_record_status_valid_chk" CHECK ("status" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "emoji_asset" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emoji_asset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pack_id" integer NOT NULL,
	"kind" smallint NOT NULL,
	"shortcode" varchar(32),
	"unicode_sequence" varchar(191),
	"image_url" varchar(500),
	"static_url" varchar(500),
	"is_animated" boolean DEFAULT false NOT NULL,
	"category" varchar(32),
	"keywords" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "emoji_asset_kind_chk" CHECK ("kind" in (1, 2)),
	CONSTRAINT "emoji_asset_kind_unicode_required_chk" CHECK (("kind" <> 1) or ("unicode_sequence" is not null)),
	CONSTRAINT "emoji_asset_kind_custom_required_chk" CHECK (("kind" <> 2) or ("shortcode" is not null and "image_url" is not null)),
	CONSTRAINT "emoji_asset_shortcode_format_chk" CHECK ("shortcode" is null or "shortcode" ~ '^[a-z0-9_]{2,32}$')
);
--> statement-breakpoint
CREATE TABLE "emoji_pack" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "emoji_pack_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL CONSTRAINT "emoji_pack_code_key" UNIQUE,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"icon_url" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"visible_in_picker" boolean DEFAULT true NOT NULL,
	"scene_type" smallint[] DEFAULT ARRAY[1,2,3]::smallint[] NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	CONSTRAINT "emoji_pack_scene_type_valid_chk" CHECK ("scene_type" <@ ARRAY[1,2,3]::smallint[]),
	CONSTRAINT "emoji_pack_scene_type_non_empty_chk" CHECK (cardinality("scene_type") > 0)
);
--> statement-breakpoint
CREATE TABLE "emoji_recent_usage" (
	"user_id" integer,
	"scene" smallint,
	"emoji_asset_id" integer,
	"use_count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "emoji_recent_usage_pkey" PRIMARY KEY("user_id","scene","emoji_asset_id"),
	CONSTRAINT "emoji_recent_usage_scene_chk" CHECK ("scene" in (1, 2, 3)),
	CONSTRAINT "emoji_recent_usage_use_count_chk" CHECK ("use_count" >= 0)
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
	"viewed_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "user_browse_log_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4, 5))
);
--> statement-breakpoint
CREATE TABLE "user_comment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_comment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"html" text NOT NULL,
	"content" text NOT NULL,
	"body" jsonb NOT NULL,
	"body_version" smallint DEFAULT 1 NOT NULL,
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
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"deleted_at" timestamp(6) with time zone,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '365 days',
	"archived_at" timestamp(6) with time zone,
	"topic_delete_cascade_id" varchar(80),
	CONSTRAINT "user_comment_body_version_valid_chk" CHECK ("body_version" in (1)),
	CONSTRAINT "user_comment_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "user_comment_audit_role_valid_chk" CHECK ("audit_role" is null or "audit_role" in (0, 1)),
	CONSTRAINT "user_comment_audit_actor_pair_chk" CHECK (("audit_role" is null) = ("audit_by_id" is null)),
	CONSTRAINT "user_comment_like_count_non_negative_chk" CHECK ("like_count" >= 0),
	CONSTRAINT "user_comment_root_floor_required_chk" CHECK ("reply_to_id" is not null or "floor" is not null)
);
--> statement-breakpoint
CREATE TABLE "user_comment_floor_counter" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_comment_floor_counter_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"next_floor" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_comment_floor_counter_target_key" UNIQUE("target_type","target_id"),
	CONSTRAINT "user_comment_floor_counter_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "user_comment_floor_counter_target_id_positive_chk" CHECK ("target_id" > 0),
	CONSTRAINT "user_comment_floor_counter_next_floor_positive_chk" CHECK ("next_floor" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_favorite" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_favorite_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorite_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id"),
	CONSTRAINT "user_favorite_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "user_follow" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_follow_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follow_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id"),
	CONSTRAINT "user_follow_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4))
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
	CONSTRAINT "user_like_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id"),
	CONSTRAINT "user_like_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "user_like_scene_type_valid_chk" CHECK ("scene_type" in (1, 2, 3, 10, 11, 12)),
	CONSTRAINT "user_like_comment_level_valid_chk" CHECK ("comment_level" is null or "comment_level" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "user_mention" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_mention_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_type" smallint NOT NULL,
	"source_id" integer NOT NULL,
	"mentioned_user_id" integer NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"notified_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_mention_source_user_offset_key" UNIQUE("source_type","source_id","mentioned_user_id","start_offset","end_offset"),
	CONSTRAINT "user_mention_source_type_valid_chk" CHECK ("source_type" in (1, 2))
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
	"target_action" smallint DEFAULT 1 NOT NULL,
	"target_action_reason" varchar(500),
	"target_action_status" smallint DEFAULT 1 NOT NULL,
	"target_action_result" jsonb,
	"target_action_applied_at" timestamp(6) with time zone,
	"handled_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "user_report_reporter_id_target_type_target_id_key" UNIQUE("reporter_id","target_type","target_id"),
	CONSTRAINT "user_report_target_type_valid_chk" CHECK ("target_type" in (1, 2, 3, 4, 5, 6, 7)),
	CONSTRAINT "user_report_scene_type_valid_chk" CHECK ("scene_type" in (1, 2, 3, 10, 11, 12)),
	CONSTRAINT "user_report_comment_level_valid_chk" CHECK ("comment_level" is null or "comment_level" in (1, 2)),
	CONSTRAINT "user_report_reason_type_valid_chk" CHECK ("reason_type" in (1, 2, 3, 4, 99)),
	CONSTRAINT "user_report_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "user_report_target_action_valid_chk" CHECK ("target_action" in (1, 2, 3, 4, 5, 6, 7)),
	CONSTRAINT "user_report_target_action_status_valid_chk" CHECK ("target_action_status" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "user_report_disposition_attempt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_report_disposition_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"report_id" integer NOT NULL,
	"target_action" smallint NOT NULL,
	"attempt_status" smallint NOT NULL,
	"failure_code" varchar(120),
	"failure_message" varchar(500),
	"retryable" boolean DEFAULT true NOT NULL,
	"actor_user_id" integer NOT NULL,
	"attempted_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp(6) with time zone,
	"result" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_report_disposition_attempt_action_valid_chk" CHECK ("target_action" in (1, 2, 3, 4, 5, 6, 7)),
	CONSTRAINT "user_report_disposition_attempt_status_valid_chk" CHECK ("attempt_status" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "chat_conversation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_conversation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"biz_key" varchar(100) NOT NULL CONSTRAINT "chat_conversation_biz_key_key" UNIQUE,
	"last_message_id" bigint,
	"last_message_at" timestamp(6) with time zone,
	"last_sender_id" integer,
	"has_messages" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '365 days',
	"archived_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_conversation_member" (
	"conversation_id" integer,
	"user_id" integer,
	"role" smallint NOT NULL,
	"joined_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp(6) with time zone,
	"hidden_at" timestamp(6) with time zone,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_read_message_id" bigint,
	"last_read_at" timestamp(6) with time zone,
	"unread_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_conversation_member_pkey" PRIMARY KEY("conversation_id","user_id"),
	CONSTRAINT "chat_conversation_member_role_valid_chk" CHECK ("role" in (1, 2))
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
	"body_tokens" jsonb,
	"payload" jsonb,
	"status" smallint NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp(6) with time zone,
	"revoked_at" timestamp(6) with time zone,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '365 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "chat_message_conversation_id_message_seq_key" UNIQUE("conversation_id","message_seq"),
	CONSTRAINT "chat_message_conversation_id_sender_id_client_message_id_key" UNIQUE("conversation_id","sender_id","client_message_id"),
	CONSTRAINT "chat_message_message_type_valid_chk" CHECK ("message_type" in (1, 2, 3, 4, 99)),
	CONSTRAINT "chat_message_status_valid_chk" CHECK ("status" in (1, 2, 3))
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
	"fanout_skipped_count" integer DEFAULT 0 NOT NULL,
	"fanout_publish_error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_delivery_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"dispatch_id" bigint NOT NULL CONSTRAINT "notification_delivery_dispatch_id_key" UNIQUE,
	"event_key" varchar(120) NOT NULL,
	"receiver_user_id" integer,
	"projection_key" varchar(180),
	"category_key" varchar(80),
	"task_id" integer,
	"assignment_id" integer,
	"reminder_kind" varchar(40),
	"notification_id" integer,
	"status" smallint NOT NULL,
	"template_id" integer,
	"used_template" boolean DEFAULT false NOT NULL,
	"fallback_reason" varchar(64),
	"failure_reason" varchar(500),
	"last_attempt_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "notification_delivery_status_valid_chk" CHECK ("status" in (1, 2, 3, 4)),
	CONSTRAINT "notification_delivery_task_reminder_lookup_required_chk" CHECK ("category_key" <> 'task_reminder' OR ("task_id" IS NOT NULL AND "assignment_id" IS NOT NULL AND "reminder_kind" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_preference_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"category_key" varchar(80) NOT NULL,
	"is_enabled" boolean NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "notification_preference_user_id_category_key_key" UNIQUE("user_id","category_key")
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_key" varchar(80) NOT NULL CONSTRAINT "notification_template_category_key_key" UNIQUE,
	"title_template" varchar(200) NOT NULL,
	"content_template" varchar(1000) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_notification_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_key" varchar(80) NOT NULL,
	"projection_key" varchar(180) NOT NULL,
	"receiver_user_id" integer NOT NULL,
	"actor_user_id" integer,
	"title" varchar(200) NOT NULL,
	"content" varchar(1000) NOT NULL,
	"payload" jsonb,
	"announcement_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"read_at" timestamp(6) with time zone,
	"expires_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "user_notification_receiver_user_id_projection_key_key" UNIQUE("receiver_user_id","projection_key"),
	CONSTRAINT "user_notification_system_announcement_requires_id_chk" CHECK ("category_key" <> 'system_announcement' OR "announcement_id" IS NOT NULL)
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
	"remark" varchar(500),
	"created_by" integer,
	"updated_by" integer,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "sensitive_word_level_valid_chk" CHECK ("level" in (1, 2, 3)),
	CONSTRAINT "sensitive_word_type_valid_chk" CHECK ("type" in (1, 2, 3, 4, 5)),
	CONSTRAINT "sensitive_word_match_mode_valid_chk" CHECK ("match_mode" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "sensitive_word_hit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sensitive_word_hit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sensitive_word_id" integer NOT NULL,
	"entity_type" smallint NOT NULL,
	"entity_id" integer NOT NULL,
	"operation_type" smallint NOT NULL,
	"matched_word" varchar(100) NOT NULL,
	"level" smallint NOT NULL,
	"type" smallint NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "sensitive_word_hit_log_entity_type_valid_chk" CHECK ("entity_type" in (1, 2)),
	CONSTRAINT "sensitive_word_hit_log_operation_type_valid_chk" CHECK ("operation_type" in (1, 2)),
	CONSTRAINT "sensitive_word_hit_log_level_valid_chk" CHECK ("level" in (1, 2, 3)),
	CONSTRAINT "sensitive_word_hit_log_type_valid_chk" CHECK ("type" in (1, 2, 3, 4, 5))
);
--> statement-breakpoint
CREATE TABLE "migration_audit" (
	"migration_key" varchar(160),
	"metric" varchar(160),
	"value" bigint NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migration_audit_pkey" PRIMARY KEY("migration_key","metric")
);
--> statement-breakpoint
CREATE TABLE "sys_request_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sys_request_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"username" text,
	"api_type" smallint,
	"method" varchar(10) NOT NULL,
	"path" varchar(255) NOT NULL,
	"params" jsonb,
	"ip" varchar(45),
	"user_agent" varchar(255),
	"device" jsonb,
	"geo_country" varchar(100),
	"geo_province" varchar(100),
	"geo_city" varchar(100),
	"geo_isp" varchar(100),
	"geo_source" varchar(50),
	"action_type" smallint,
	"is_success" boolean NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"retention_until" timestamp(6) with time zone DEFAULT now() + interval '180 days',
	"archived_at" timestamp(6) with time zone,
	CONSTRAINT "sys_request_log_api_type_valid_chk" CHECK ("api_type" is null or "api_type" in (1, 2, 3, 4)),
	CONSTRAINT "sys_request_log_action_type_valid_chk" CHECK ("action_type" is null or "action_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9))
);
--> statement-breakpoint
CREATE TABLE "workflow_attempt" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_attempt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"attempt_id" varchar(36) NOT NULL CONSTRAINT "workflow_attempt_attempt_id_key" UNIQUE,
	"workflow_job_id" bigint NOT NULL,
	"attempt_no" integer NOT NULL,
	"trigger_type" smallint NOT NULL,
	"status" smallint NOT NULL,
	"not_before_at" timestamp(6) with time zone,
	"selected_item_count" integer DEFAULT 0 NOT NULL,
	"success_item_count" integer DEFAULT 0 NOT NULL,
	"failed_item_count" integer DEFAULT 0 NOT NULL,
	"skipped_item_count" integer DEFAULT 0 NOT NULL,
	"claimed_by" varchar(120),
	"claim_expires_at" timestamp(6) with time zone,
	"heartbeat_at" timestamp(6) with time zone,
	"error_code" varchar(120),
	"error_domain" varchar(80),
	"error_stage" varchar(80),
	"error_severity" varchar(40),
	"error_retryable" boolean,
	"error_context" jsonb,
	"error_diagnostic" jsonb,
	"started_at" timestamp(6) with time zone,
	"finished_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "workflow_attempt_job_attempt_no_key" UNIQUE("workflow_job_id","attempt_no"),
	CONSTRAINT "workflow_attempt_attempt_no_positive_chk" CHECK ("attempt_no" > 0),
	CONSTRAINT "workflow_attempt_trigger_type_valid_chk" CHECK ("trigger_type" in (1, 2, 3)),
	CONSTRAINT "workflow_attempt_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
	CONSTRAINT "workflow_attempt_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
	CONSTRAINT "workflow_attempt_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
	CONSTRAINT "workflow_attempt_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
	CONSTRAINT "workflow_attempt_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workflow_conflict_key" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_conflict_key_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workflow_job_id" bigint NOT NULL,
	"workflow_type" varchar(120) NOT NULL,
	"conflict_key" varchar(300) NOT NULL,
	"released_at" timestamp(6) with time zone,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "workflow_conflict_key_workflow_type_nonblank_chk" CHECK (length(trim("workflow_type")) > 0),
	CONSTRAINT "workflow_conflict_key_nonblank_chk" CHECK (length(trim("conflict_key")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workflow_event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workflow_job_id" bigint NOT NULL,
	"workflow_attempt_id" bigint,
	"event_type" smallint NOT NULL,
	"event_code" varchar(120) NOT NULL,
	"detail" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_event_type_valid_chk" CHECK ("event_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)),
	CONSTRAINT "workflow_event_code_nonblank_chk" CHECK (length(trim("event_code")) > 0)
);
--> statement-breakpoint
CREATE TABLE "workflow_job" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_job_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" varchar(36) NOT NULL CONSTRAINT "workflow_job_job_id_key" UNIQUE,
	"workflow_type" varchar(120) NOT NULL,
	"display_name" varchar(180) NOT NULL,
	"operator_type" smallint NOT NULL,
	"operator_user_id" integer,
	"status" smallint NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"progress_code" varchar(120),
	"progress_context" jsonb,
	"progress_detail" jsonb,
	"current_attempt_fk" bigint,
	"selected_item_count" integer DEFAULT 0 NOT NULL,
	"success_item_count" integer DEFAULT 0 NOT NULL,
	"failed_item_count" integer DEFAULT 0 NOT NULL,
	"skipped_item_count" integer DEFAULT 0 NOT NULL,
	"cancel_requested_at" timestamp(6) with time zone,
	"started_at" timestamp(6) with time zone,
	"finished_at" timestamp(6) with time zone,
	"expires_at" timestamp(6) with time zone,
	"archived_at" timestamp(6) with time zone,
	"summary" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "workflow_job_workflow_type_nonblank_chk" CHECK (length(trim("workflow_type")) > 0),
	CONSTRAINT "workflow_job_display_name_nonblank_chk" CHECK (length(trim("display_name")) > 0),
	CONSTRAINT "workflow_job_operator_type_valid_chk" CHECK ("operator_type" in (1, 2)),
	CONSTRAINT "workflow_job_operator_user_id_scope_chk" CHECK (("operator_type" = 1 and "operator_user_id" is not null) or ("operator_type" = 2 and "operator_user_id" is null)),
	CONSTRAINT "workflow_job_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6, 7, 8)),
	CONSTRAINT "workflow_job_progress_percent_range_chk" CHECK ("progress_percent" between 0 and 100),
	CONSTRAINT "workflow_job_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
	CONSTRAINT "workflow_job_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
	CONSTRAINT "workflow_job_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
	CONSTRAINT "workflow_job_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "app_agreement_title_is_published_idx" ON "app_agreement" ("title","is_published");--> statement-breakpoint
CREATE INDEX "app_agreement_log_user_id_agreement_id_idx" ON "app_agreement_log" ("user_id","agreement_id");--> statement-breakpoint
CREATE INDEX "app_agreement_log_agreement_id_idx" ON "app_agreement_log" ("agreement_id");--> statement-breakpoint
CREATE INDEX "app_agreement_log_agreed_at_idx" ON "app_agreement_log" ("agreed_at");--> statement-breakpoint
CREATE INDEX "app_announcement_is_published_publish_start_time_publish_en_idx" ON "app_announcement" ("is_published","publish_start_time","publish_end_time");--> statement-breakpoint
CREATE INDEX "app_announcement_app_visible_window_idx" ON "app_announcement" ("is_published","publish_start_time","publish_end_time","is_pinned" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_announcement_enable_platform_gin_idx" ON "app_announcement" USING gin ("enable_platform");--> statement-breakpoint
CREATE INDEX "app_announcement_announcement_type_is_published_idx" ON "app_announcement" ("announcement_type","is_published");--> statement-breakpoint
CREATE INDEX "app_announcement_is_realtime_is_published_idx" ON "app_announcement" ("is_realtime","is_published");--> statement-breakpoint
CREATE INDEX "app_announcement_realtime_publish_start_pending_idx" ON "app_announcement" ("publish_start_time","id") WHERE "is_realtime" = true and "is_published" = true and "enable_platform" && ARRAY[2]::smallint[] and "publish_start_time" is not null and "notification_start_boundary_at" is distinct from "publish_start_time";--> statement-breakpoint
CREATE INDEX "app_announcement_realtime_publish_end_pending_idx" ON "app_announcement" ("publish_end_time","id") WHERE "is_realtime" = true and "is_published" = true and "enable_platform" && ARRAY[2]::smallint[] and "publish_end_time" is not null and "notification_end_boundary_at" is distinct from "publish_end_time";--> statement-breakpoint
CREATE INDEX "app_announcement_notification_fanout_status_idx" ON "app_announcement" ("notification_fanout_status","notification_fanout_updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_announcement_priority_level_is_pinned_idx" ON "app_announcement" ("priority_level","is_pinned");--> statement-breakpoint
CREATE INDEX "app_announcement_created_at_idx" ON "app_announcement" ("created_at");--> statement-breakpoint
CREATE INDEX "app_announcement_page_id_idx" ON "app_announcement" ("page_id");--> statement-breakpoint
CREATE INDEX "app_announcement_show_as_popup_is_published_idx" ON "app_announcement" ("show_as_popup","is_published");--> statement-breakpoint
CREATE INDEX "app_announcement_fanout_pending_idx" ON "app_announcement_notification_fanout_task" ("status","updated_at","id") WHERE "status" = 0;--> statement-breakpoint
CREATE INDEX "app_announcement_fanout_failed_retry_idx" ON "app_announcement_notification_fanout_task" ("status","next_attempt_at","attempt_count","updated_at","id") WHERE "status" = 3;--> statement-breakpoint
CREATE INDEX "app_announcement_fanout_lease_expired_idx" ON "app_announcement_notification_fanout_task" ("status","processing_lease_expires_at","updated_at","id") WHERE "status" = 1;--> statement-breakpoint
CREATE INDEX "app_announcement_notification_fanout_task_announcement_idx" ON "app_announcement_notification_fanout_task" ("announcement_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_announcement_read_user_id_read_at_idx" ON "app_announcement_read" ("user_id","read_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_announcement_view_user_id_viewed_at_idx" ON "app_announcement_view" ("user_id","viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_page_access_level_is_enabled_idx" ON "app_page" ("access_level","is_enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "app_update_release_platform_published_live_key" ON "app_update_release" ("platform") WHERE "is_published" = true;--> statement-breakpoint
CREATE INDEX "app_update_release_platform_is_published_build_code_idx" ON "app_update_release" ("platform","is_published","build_code");--> statement-breakpoint
CREATE INDEX "app_update_release_published_at_idx" ON "app_update_release" ("published_at");--> statement-breakpoint
CREATE INDEX "app_update_release_created_by_id_idx" ON "app_update_release" ("created_by_id");--> statement-breakpoint
CREATE INDEX "app_update_release_updated_by_id_idx" ON "app_update_release" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_item_job_status_updated_id_idx" ON "coupon_admin_grant_item" ("coupon_admin_grant_job_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_item_user_created_at_idx" ON "coupon_admin_grant_item" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_job_coupon_definition_created_at_idx" ON "coupon_admin_grant_job" ("coupon_definition_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "coupon_definition_type_enabled_idx" ON "coupon_definition" ("coupon_type","is_enabled");--> statement-breakpoint
CREATE INDEX "coupon_definition_created_at_idx" ON "coupon_definition" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "coupon_redemption_record_instance_status_idx" ON "coupon_redemption_record" ("coupon_instance_id","status");--> statement-breakpoint
CREATE INDEX "coupon_redemption_record_target_idx" ON "coupon_redemption_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "currency_package_enabled_sort_order_idx" ON "currency_package" ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "membership_benefit_definition_enabled_sort_order_idx" ON "membership_benefit_definition" ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "membership_page_config_enabled_sort_order_idx" ON "membership_page_config" ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "membership_page_config_agreement_page_sort_idx" ON "membership_page_config_agreement" ("page_config_id","sort_order");--> statement-breakpoint
CREATE INDEX "membership_page_config_agreement_agreement_id_idx" ON "membership_page_config_agreement" ("agreement_id");--> statement-breakpoint
CREATE INDEX "membership_page_config_plan_page_sort_idx" ON "membership_page_config_plan" ("page_config_id","sort_order");--> statement-breakpoint
CREATE INDEX "membership_page_config_plan_plan_id_idx" ON "membership_page_config_plan" ("plan_id");--> statement-breakpoint
CREATE INDEX "membership_plan_enabled_sort_order_idx" ON "membership_plan" ("is_enabled","tier","sort_order");--> statement-breakpoint
CREATE INDEX "membership_plan_benefit_plan_enabled_sort_order_idx" ON "membership_plan_benefit" ("plan_id","is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "membership_plan_benefit_benefit_id_idx" ON "membership_plan_benefit" ("benefit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_notify_event_provider_event_key" ON "payment_notify_event" ("channel","provider_event_id") WHERE "provider_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_notify_event_payload_hash_key" ON "payment_notify_event" ("channel","payload_hash");--> statement-breakpoint
CREATE INDEX "payment_notify_event_order_idx" ON "payment_notify_event" ("order_no","created_at");--> statement-breakpoint
CREATE INDEX "payment_notify_event_trade_idx" ON "payment_notify_event" ("provider_trade_no","created_at");--> statement-breakpoint
CREATE INDEX "payment_notify_event_status_idx" ON "payment_notify_event" ("verify_status","process_status","created_at");--> statement-breakpoint
CREATE INDEX "payment_notify_event_channel_process_created_id_idx" ON "payment_notify_event" ("channel","process_status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payment_notify_event_retention_until_id_idx" ON "payment_notify_event" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "payment_notify_event_payment_order_id_idx" ON "payment_notify_event" ("payment_order_id");--> statement-breakpoint
CREATE INDEX "payment_order_user_status_created_at_idx" ON "payment_order" ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_provider_config_status_idx" ON "payment_order" ("provider_config_id","status");--> statement-breakpoint
CREATE INDEX "payment_order_status_created_at_id_idx" ON "payment_order" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "payment_order_channel_status_created_at_idx" ON "payment_order" ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_provider_config_status_created_at_idx" ON "payment_order" ("provider_config_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_provider_config_version_id_idx" ON "payment_order" ("provider_config_version_id");--> statement-breakpoint
CREATE INDEX "payment_order_user_created_at_idx" ON "payment_order" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_certificate_ref_key" ON "payment_provider_certificate" ("certificate_ref");--> statement-breakpoint
CREATE INDEX "payment_provider_certificate_option_idx" ON "payment_provider_certificate" ("channel","certificate_type","status","expired_at");--> statement-breakpoint
CREATE INDEX "payment_provider_certificate_serial_idx" ON "payment_provider_certificate" ("channel","serial_no");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_config_enabled_unique_idx" ON "payment_provider_config" ("channel","payment_scene","platform","client_app_key","app_id","mch_id","environment") WHERE "is_enabled" = true;--> statement-breakpoint
CREATE INDEX "payment_provider_config_selection_idx" ON "payment_provider_config" ("channel","payment_scene","platform","client_app_key","environment","is_enabled","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_config_version_key" ON "payment_provider_config_version" ("provider_config_id","config_version");--> statement-breakpoint
CREATE INDEX "payment_provider_config_version_active_idx" ON "payment_provider_config_version" ("provider_config_id","is_active","config_version");--> statement-breakpoint
CREATE INDEX "payment_provider_config_version_selection_idx" ON "payment_provider_config_version" ("channel","payment_scene","platform","client_app_key","environment","status","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_credential_ref_key" ON "payment_provider_credential" ("credential_ref");--> statement-breakpoint
CREATE INDEX "payment_provider_credential_option_idx" ON "payment_provider_credential" ("channel","credential_type","status","expired_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_record_status_created_at_idx" ON "payment_reconciliation_record" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_record_order_idx" ON "payment_reconciliation_record" ("order_no","created_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_record_payment_order_id_idx" ON "payment_reconciliation_record" ("payment_order_id");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_record_channel_status_idx" ON "payment_reconciliation_record" ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_record_mismatch_status_idx" ON "payment_reconciliation_record" ("mismatch_type","status","created_at");--> statement-breakpoint
CREATE INDEX "user_asset_balance_user_id_asset_type_idx" ON "user_asset_balance" ("user_id","asset_type");--> statement-breakpoint
CREATE INDEX "user_coupon_instance_user_status_expires_at_idx" ON "user_coupon_instance" ("user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "user_coupon_instance_user_available_type_created_idx" ON "user_coupon_instance" ("user_id","status","coupon_type","created_at" DESC NULLS LAST) WHERE "remaining_uses" > 0;--> statement-breakpoint
CREATE INDEX "user_coupon_instance_source_idx" ON "user_coupon_instance" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "user_coupon_instance_coupon_definition_id_idx" ON "user_coupon_instance" ("coupon_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_coupon_instance_user_grant_key_unique_idx" ON "user_coupon_instance" ("user_id","grant_key") WHERE "grant_key" is not null;--> statement-breakpoint
CREATE INDEX "user_membership_subscription_user_status_ends_at_idx" ON "user_membership_subscription" ("user_id","status","ends_at");--> statement-breakpoint
CREATE INDEX "user_membership_subscription_plan_id_idx" ON "user_membership_subscription" ("plan_id");--> statement-breakpoint
CREATE INDEX "user_membership_subscription_source_idx" ON "user_membership_subscription" ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_membership_subscription_payment_order_source_key" ON "user_membership_subscription" ("source_type","source_id") WHERE "source_type" = 1 AND "source_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_membership_subscription_vip_trial_coupon_source_key" ON "user_membership_subscription" ("source_type","source_id") WHERE "source_type" = 2 AND "source_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "app_config_updated_by_id_idx" ON "app_config" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "sys_config_updated_by_id_idx" ON "sys_config" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "sys_config_created_at_idx" ON "sys_config" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_dictionary_item_dictionary_code_sort_order_id_idx" ON "sys_dictionary_item" ("dictionary_code","sort_order","id");--> statement-breakpoint
CREATE INDEX "content_import_item_job_status_sort_idx" ON "content_import_item" ("content_import_job_id","status","sort_order","id");--> statement-breakpoint
CREATE INDEX "content_import_item_job_status_next_retry_idx" ON "content_import_item" ("content_import_job_id","status","next_retry_at","id");--> statement-breakpoint
CREATE INDEX "content_import_item_job_provider_chapter_idx" ON "content_import_item" ("content_import_job_id","provider_chapter_id");--> statement-breakpoint
CREATE INDEX "content_import_item_job_local_chapter_idx" ON "content_import_item" ("content_import_job_id","local_chapter_id");--> statement-breakpoint
CREATE INDEX "content_import_item_attempt_workflow_attempt_status_idx" ON "content_import_item_attempt" ("workflow_attempt_id","status");--> statement-breakpoint
CREATE INDEX "content_import_item_attempt_item_id_idx" ON "content_import_item_attempt" ("content_import_item_id");--> statement-breakpoint
CREATE INDEX "content_import_job_source_type_work_id_idx" ON "content_import_job" ("source_type","work_id");--> statement-breakpoint
CREATE INDEX "content_import_job_work_id_idx" ON "content_import_job" ("work_id");--> statement-breakpoint
CREATE INDEX "content_import_job_platform_source_idx" ON "content_import_job" ("platform","provider_comic_id","provider_group_path_word");--> statement-breakpoint
CREATE INDEX "content_import_preview_item_job_status_sort_idx" ON "content_import_preview_item" ("content_import_job_id","status","sort_order","id");--> statement-breakpoint
CREATE INDEX "content_import_residue_job_cleanup_status_idx" ON "content_import_residue" ("workflow_job_id","cleanup_status");--> statement-breakpoint
CREATE INDEX "content_import_residue_attempt_idx" ON "content_import_residue" ("workflow_attempt_id");--> statement-breakpoint
CREATE INDEX "content_import_residue_item_idx" ON "content_import_residue" ("content_import_item_id");--> statement-breakpoint
CREATE INDEX "content_import_residue_item_attempt_idx" ON "content_import_residue" ("content_import_item_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_content_entitlement_purchase_active_unique_idx" ON "user_content_entitlement" ("user_id","target_type","target_id") WHERE "grant_source" = 1 and "status" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "user_content_entitlement_coupon_source_unique_idx" ON "user_content_entitlement" ("grant_source","source_id") WHERE "grant_source" = 2 and "source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_content_entitlement_ad_source_unique_idx" ON "user_content_entitlement" ("grant_source","source_id") WHERE "grant_source" = 3 and "source_id" is not null;--> statement-breakpoint
CREATE INDEX "user_content_entitlement_user_target_status_idx" ON "user_content_entitlement" ("user_id","target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "user_content_entitlement_source_idx" ON "user_content_entitlement" ("grant_source","source_id");--> statement-breakpoint
CREATE INDEX "user_content_entitlement_target_status_idx" ON "user_content_entitlement" ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "user_download_record_target_type_target_id_idx" ON "user_download_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_download_record_user_id_idx" ON "user_download_record" ("user_id");--> statement-breakpoint
CREATE INDEX "user_download_record_created_at_idx" ON "user_download_record" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_purchase_record_success_unique_idx" ON "user_purchase_record" ("target_type","target_id","user_id") WHERE "status" = 1;--> statement-breakpoint
CREATE INDEX "user_purchase_record_target_type_target_id_idx" ON "user_purchase_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_purchase_record_user_id_idx" ON "user_purchase_record" ("user_id");--> statement-breakpoint
CREATE INDEX "user_purchase_record_status_idx" ON "user_purchase_record" ("status");--> statement-breakpoint
CREATE INDEX "user_purchase_record_created_at_idx" ON "user_purchase_record" ("created_at");--> statement-breakpoint
CREATE INDEX "user_purchase_record_user_id_status_target_type_created_at__idx" ON "user_purchase_record" ("user_id","status","target_type","created_at","target_id");--> statement-breakpoint
CREATE INDEX "user_work_reading_state_user_id_work_type_last_read_at_idx" ON "user_work_reading_state" ("user_id","work_type","last_read_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_work_reading_state_user_id_last_read_at_idx" ON "user_work_reading_state" ("user_id","last_read_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_work_reading_state_work_id_idx" ON "user_work_reading_state" ("work_id");--> statement-breakpoint
CREATE INDEX "user_work_reading_state_last_read_chapter_id_idx" ON "user_work_reading_state" ("last_read_chapter_id");--> statement-breakpoint
CREATE INDEX "work_is_published_publish_at_idx" ON "work" ("is_published","publish_at");--> statement-breakpoint
CREATE INDEX "work_popularity_idx" ON "work" ("popularity");--> statement-breakpoint
CREATE INDEX "work_language_region_idx" ON "work" ("language","region");--> statement-breakpoint
CREATE INDEX "work_serial_status_idx" ON "work" ("serial_status");--> statement-breakpoint
CREATE INDEX "work_last_updated_idx" ON "work" ("last_updated");--> statement-breakpoint
CREATE INDEX "work_name_idx" ON "work" ("name");--> statement-breakpoint
CREATE INDEX "work_is_recommended_idx" ON "work" ("is_recommended");--> statement-breakpoint
CREATE INDEX "work_is_hot_is_new_idx" ON "work" ("is_hot","is_new");--> statement-breakpoint
CREATE INDEX "work_type_idx" ON "work" ("type");--> statement-breakpoint
CREATE INDEX "work_view_rule_idx" ON "work" ("view_rule");--> statement-breakpoint
CREATE INDEX "work_required_view_level_id_idx" ON "work" ("required_view_level_id");--> statement-breakpoint
CREATE INDEX "work_comment_count_idx" ON "work" ("comment_count");--> statement-breakpoint
CREATE INDEX "work_deleted_at_idx" ON "work" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_author_active_name_key" ON "work_author" ("name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_author_type_idx" ON "work_author" USING gin ("type");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_idx" ON "work_author" ("is_enabled");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_is_recommended_idx" ON "work_author" ("is_enabled","is_recommended");--> statement-breakpoint
CREATE INDEX "work_author_is_enabled_deleted_at_idx" ON "work_author" ("is_enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "work_author_deleted_at_idx" ON "work_author" ("deleted_at");--> statement-breakpoint
CREATE INDEX "work_author_nationality_idx" ON "work_author" ("nationality");--> statement-breakpoint
CREATE INDEX "work_author_gender_idx" ON "work_author" ("gender");--> statement-breakpoint
CREATE INDEX "work_author_is_recommended_work_count_idx" ON "work_author" ("is_recommended","work_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "work_author_created_at_idx" ON "work_author" ("created_at");--> statement-breakpoint
CREATE INDEX "work_author_relation_author_id_idx" ON "work_author_relation" ("author_id");--> statement-breakpoint
CREATE INDEX "work_author_relation_work_id_sort_order_idx" ON "work_author_relation" ("work_id","sort_order");--> statement-breakpoint
CREATE INDEX "work_category_sort_order_idx" ON "work_category" ("sort_order");--> statement-breakpoint
CREATE INDEX "work_category_content_type_idx" ON "work_category" USING gin ("content_type");--> statement-breakpoint
CREATE INDEX "work_category_relation_category_id_idx" ON "work_category_relation" ("category_id");--> statement-breakpoint
CREATE INDEX "work_category_relation_work_id_sort_order_idx" ON "work_category_relation" ("work_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "work_chapter_work_id_sort_order_live_idx" ON "work_chapter" ("work_id","sort_order") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_chapter_deleted_at_idx" ON "work_chapter" ("deleted_at");--> statement-breakpoint
CREATE INDEX "work_chapter_work_id_idx" ON "work_chapter" ("work_id");--> statement-breakpoint
CREATE INDEX "work_chapter_work_id_sort_order_idx" ON "work_chapter" ("work_id","sort_order");--> statement-breakpoint
CREATE INDEX "work_chapter_work_published_publish_sort_idx" ON "work_chapter" ("work_id","is_published","publish_at","deleted_at","sort_order","id");--> statement-breakpoint
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
CREATE INDEX "work_tag_is_enabled_idx" ON "work_tag" ("is_enabled");--> statement-breakpoint
CREATE INDEX "work_tag_relation_tag_id_idx" ON "work_tag_relation" ("tag_id");--> statement-breakpoint
CREATE INDEX "work_tag_relation_work_id_sort_order_idx" ON "work_tag_relation" ("work_id","sort_order","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_tp_chapter_binding_source_provider_chapter_live_uidx" ON "work_third_party_chapter_binding" ("work_third_party_source_binding_id","provider_chapter_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_chapter_binding_chapter_id_live_idx" ON "work_third_party_chapter_binding" ("chapter_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_third_party_chapter_binding_source_created_at_idx" ON "work_third_party_chapter_binding" ("work_third_party_source_binding_id","created_at");--> statement-breakpoint
CREATE INDEX "work_third_party_chapter_binding_deleted_at_idx" ON "work_third_party_chapter_binding" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_source_binding_work_id_live_idx" ON "work_third_party_source_binding" ("work_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_third_party_source_binding_platform_comic_group_live_idx" ON "work_third_party_source_binding" ("platform","provider_comic_id","provider_group_path_word") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_third_party_source_binding_platform_path_group_idx" ON "work_third_party_source_binding" ("platform","provider_path_word","provider_group_path_word");--> statement-breakpoint
CREATE INDEX "work_third_party_source_binding_deleted_at_idx" ON "work_third_party_source_binding" ("deleted_at");--> statement-breakpoint
CREATE INDEX "domain_event_event_key_created_at_idx" ON "domain_event" ("event_key","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "domain_event_domain_occurred_at_idx" ON "domain_event" ("domain","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "domain_event_subject_type_subject_id_idx" ON "domain_event" ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "domain_event_target_type_target_id_idx" ON "domain_event" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_consumer_status_next_retry_at_id_idx" ON "domain_event_dispatch" ("consumer","status","next_retry_at","id");--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_status_next_retry_id_idx" ON "domain_event_dispatch" ("status","next_retry_at","id");--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_retention_until_id_idx" ON "domain_event_dispatch" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_event_id_idx" ON "domain_event_dispatch" ("event_id");--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_updated_at_id_idx" ON "domain_event_dispatch" ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "domain_event_dispatch_consumer_status_updated_at_id_idx" ON "domain_event_dispatch" ("consumer","status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_hashtag_audit_hidden_last_ref_idx" ON "forum_hashtag" ("audit_status","is_hidden","last_referenced_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_follower_last_ref_idx" ON "forum_hashtag" ("follower_count","last_referenced_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_created_at_idx" ON "forum_hashtag" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_deleted_at_idx" ON "forum_hashtag" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_slug_lower_trgm_idx" ON "forum_hashtag" USING gin (lower("slug") gin_trgm_ops) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_hashtag_display_name_lower_trgm_idx" ON "forum_hashtag" USING gin (lower("display_name") gin_trgm_ops) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_hashtag_reference_hashtag_visible_created_idx" ON "forum_hashtag_reference" ("hashtag_id","is_source_visible","created_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_reference_source_idx" ON "forum_hashtag_reference" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "forum_hashtag_reference_topic_created_idx" ON "forum_hashtag_reference" ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_reference_section_created_idx" ON "forum_hashtag_reference" ("section_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_hashtag_ref_visible_topic_feed_idx" ON "forum_hashtag_reference" ("hashtag_id","section_id","topic_id") WHERE "source_type" = 1 and "is_source_visible" = true;--> statement-breakpoint
CREATE INDEX "forum_hashtag_ref_comment_topic_cleanup_idx" ON "forum_hashtag_reference" ("topic_id","source_id") WHERE "source_type" = 2;--> statement-breakpoint
CREATE INDEX "forum_moderator_group_id_idx" ON "forum_moderator" ("group_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_role_type_idx" ON "forum_moderator" ("role_type");--> statement-breakpoint
CREATE INDEX "forum_moderator_is_enabled_idx" ON "forum_moderator" ("is_enabled");--> statement-breakpoint
CREATE INDEX "forum_moderator_created_at_idx" ON "forum_moderator" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_deleted_at_idx" ON "forum_moderator" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_moderator_id_idx" ON "forum_moderator_action_log" ("moderator_id");--> statement-breakpoint
CREATE INDEX "forum_governance_action_log_actor_created_at_idx" ON "forum_moderator_action_log" ("actor_type","actor_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_moderator_created_at_idx" ON "forum_moderator_action_log" ("moderator_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log" ("action_type");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_action_type_created_at_idx" ON "forum_moderator_action_log" ("action_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_target_created_at_idx" ON "forum_moderator_action_log" ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_created_at_idx" ON "forum_moderator_action_log" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_application_applicant_id_idx" ON "forum_moderator_application" ("applicant_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_section_id_idx" ON "forum_moderator_application" ("section_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_status_idx" ON "forum_moderator_application" ("status");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_audit_by_id_idx" ON "forum_moderator_application" ("audit_by_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_created_at_idx" ON "forum_moderator_application" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_application_deleted_at_idx" ON "forum_moderator_application" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_moderator_lifecycle_log_moderator_created_at_idx" ON "forum_moderator_lifecycle_log" ("moderator_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_lifecycle_log_application_created_at_idx" ON "forum_moderator_lifecycle_log" ("application_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_lifecycle_log_event_type_created_at_idx" ON "forum_moderator_lifecycle_log" ("event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_lifecycle_log_actor_admin_user_id_idx" ON "forum_moderator_lifecycle_log" ("actor_admin_user_id");--> statement-breakpoint
CREATE INDEX "forum_moderator_lifecycle_log_created_at_idx" ON "forum_moderator_lifecycle_log" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_moderator_section_section_id_idx" ON "forum_moderator_section" ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_section_name_live_key" ON "forum_section" ("name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_section_group_id_idx" ON "forum_section" ("group_id");--> statement-breakpoint
CREATE INDEX "forum_section_user_level_rule_id_idx" ON "forum_section" ("user_level_rule_id");--> statement-breakpoint
CREATE INDEX "forum_section_last_topic_id_idx" ON "forum_section" ("last_topic_id");--> statement-breakpoint
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
CREATE INDEX "forum_topic_section_id_idx" ON "forum_topic" ("section_id");--> statement-breakpoint
CREATE INDEX "forum_topic_user_id_idx" ON "forum_topic" ("user_id");--> statement-breakpoint
CREATE INDEX "forum_topic_last_comment_user_id_idx" ON "forum_topic" ("last_comment_user_id");--> statement-breakpoint
CREATE INDEX "forum_topic_user_id_created_at_live_idx" ON "forum_topic" ("user_id","created_at" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_user_id_section_id_created_at_live_idx" ON "forum_topic" ("user_id","section_id","created_at" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_is_pinned_created_at_idx" ON "forum_topic" ("is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_is_featured_created_at_idx" ON "forum_topic" ("is_featured","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_is_locked_idx" ON "forum_topic" ("is_locked");--> statement-breakpoint
CREATE INDEX "forum_topic_is_hidden_idx" ON "forum_topic" ("is_hidden");--> statement-breakpoint
CREATE INDEX "forum_topic_audit_status_idx" ON "forum_topic" ("audit_status");--> statement-breakpoint
CREATE INDEX "forum_topic_view_count_idx" ON "forum_topic" ("view_count");--> statement-breakpoint
CREATE INDEX "forum_topic_like_count_idx" ON "forum_topic" ("like_count");--> statement-breakpoint
CREATE INDEX "forum_topic_comment_count_idx" ON "forum_topic" ("comment_count");--> statement-breakpoint
CREATE INDEX "forum_topic_favorite_count_idx" ON "forum_topic" ("favorite_count");--> statement-breakpoint
CREATE INDEX "forum_topic_last_comment_at_idx" ON "forum_topic" ("last_comment_at");--> statement-breakpoint
CREATE INDEX "forum_topic_created_at_idx" ON "forum_topic" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_updated_at_idx" ON "forum_topic" ("updated_at");--> statement-breakpoint
CREATE INDEX "forum_topic_deleted_at_idx" ON "forum_topic" ("deleted_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_is_pinned_created_at_idx" ON "forum_topic" ("section_id","is_pinned","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_is_featured_created_at_idx" ON "forum_topic" ("section_id","is_featured","created_at");--> statement-breakpoint
CREATE INDEX "forum_topic_section_id_last_comment_at_idx" ON "forum_topic" ("section_id","last_comment_at");--> statement-breakpoint
CREATE INDEX "forum_topic_visible_default_feed_idx" ON "forum_topic" ("section_id","is_pinned" DESC NULLS LAST,"last_comment_at" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null and "audit_status" = 1 and "is_hidden" = false;--> statement-breakpoint
CREATE INDEX "forum_topic_visible_global_default_feed_idx" ON "forum_topic" ("is_pinned" DESC NULLS LAST,"last_comment_at" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null and "audit_status" = 1 and "is_hidden" = false;--> statement-breakpoint
CREATE INDEX "forum_topic_visible_section_count_idx" ON "forum_topic" ("section_id") WHERE "deleted_at" is null and "audit_status" = 1 and "is_hidden" = false;--> statement-breakpoint
CREATE INDEX "forum_topic_visible_hot_feed_idx" ON "forum_topic" ("section_id","comment_count" DESC NULLS LAST,"like_count" DESC NULLS LAST,"view_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null and "audit_status" = 1 and "is_hidden" = false;--> statement-breakpoint
CREATE INDEX "forum_topic_section_visible_activity_idx" ON "forum_topic" ("section_id",coalesce("last_comment_at", "created_at") desc,"id" DESC NULLS LAST) WHERE "deleted_at" is null and "audit_status" = 1 and "is_hidden" = false;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_updated_idx" ON "forum_topic" ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_audit_updated_idx" ON "forum_topic" ("audit_status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_section_updated_idx" ON "forum_topic" ("section_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_section_audit_updated_idx" ON "forum_topic" ("section_id","audit_status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_user_updated_idx" ON "forum_topic" ("user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_created_updated_idx" ON "forum_topic" ("created_at","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_deleted_review_idx" ON "forum_topic" ("deleted_at" DESC NULLS LAST,"updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "forum_topic_admin_deleted_updated_idx" ON "forum_topic" ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "forum_topic_title_trgm_idx" ON "forum_topic" USING gin ("title" gin_trgm_ops) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topic_content_trgm_idx" ON "forum_topic" USING gin ("content" gin_trgm_ops) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_user_action_log_user_id_idx" ON "forum_user_action_log" ("user_id");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_action_type_idx" ON "forum_user_action_log" ("action_type");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_target_type_target_id_idx" ON "forum_user_action_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_ip_address_idx" ON "forum_user_action_log" ("ip_address");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_created_at_idx" ON "forum_user_action_log" ("created_at");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_retention_until_id_idx" ON "forum_user_action_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "forum_user_action_log_user_created_id_idx" ON "forum_user_action_log" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_user_action_log_target_created_id_idx" ON "forum_user_action_log" ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "forum_user_action_log_user_id_created_at_idx" ON "forum_user_action_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "check_in_config_updated_by_id_idx" ON "check_in_config" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "check_in_makeup_account_user_id_idx" ON "check_in_makeup_account" ("user_id");--> statement-breakpoint
CREATE INDEX "check_in_makeup_fact_user_id_created_at_idx" ON "check_in_makeup_fact" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "check_in_makeup_fact_user_period_idx" ON "check_in_makeup_fact" ("user_id","period_type","period_key");--> statement-breakpoint
CREATE INDEX "check_in_record_reward_settlement_id_idx" ON "check_in_record" ("reward_settlement_id");--> statement-breakpoint
CREATE INDEX "check_in_record_sign_date_idx" ON "check_in_record" ("sign_date");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_rule_id_idx" ON "check_in_streak_grant" ("rule_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_user_trigger_sign_date_idx" ON "check_in_streak_grant" ("user_id","trigger_sign_date");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_trigger_sign_date_idx" ON "check_in_streak_grant" ("trigger_sign_date");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_reward_settlement_id_idx" ON "check_in_streak_grant" ("reward_settlement_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_grant_reward_item_grant_id_idx" ON "check_in_streak_grant_reward_item" ("grant_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_progress_active_leaderboard_idx" ON "check_in_streak_progress" ("current_streak" DESC NULLS LAST,"last_signed_date" DESC NULLS LAST,"id") WHERE "current_streak" > 0;--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_rule_code_idx" ON "check_in_streak_rule" ("rule_code");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_streak_days_idx" ON "check_in_streak_rule" ("streak_days");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_status_idx" ON "check_in_streak_rule" ("status");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_effective_from_idx" ON "check_in_streak_rule" ("effective_from");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_effective_to_idx" ON "check_in_streak_rule" ("effective_to");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_updated_by_id_idx" ON "check_in_streak_rule" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "check_in_streak_rule_reward_item_rule_id_idx" ON "check_in_streak_rule_reward_item" ("rule_id");--> statement-breakpoint
CREATE INDEX "growth_audit_log_user_id_biz_key_idx" ON "growth_audit_log" ("user_id","biz_key");--> statement-breakpoint
CREATE INDEX "growth_audit_log_asset_type_action_decision_created_at_idx" ON "growth_audit_log" ("asset_type","action","decision","created_at");--> statement-breakpoint
CREATE INDEX "growth_audit_log_request_id_idx" ON "growth_audit_log" ("request_id");--> statement-breakpoint
CREATE INDEX "growth_audit_log_user_created_id_idx" ON "growth_audit_log" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_audit_log_asset_type_created_id_idx" ON "growth_audit_log" ("asset_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_audit_log_retention_until_id_idx" ON "growth_audit_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_user_id_asset_type_created_at_idx" ON "growth_ledger_record" ("user_id","asset_type","created_at");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_user_id_asset_type_asset_key_created_idx" ON "growth_ledger_record" ("user_id","asset_type","asset_key","created_at");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_wallet_user_asset_created_id_idx" ON "growth_ledger_record" ("user_id","asset_type","asset_key","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_ledger_record_user_created_id_idx" ON "growth_ledger_record" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_ledger_record_user_asset_id_desc_idx" ON "growth_ledger_record" ("user_id","asset_type","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_ledger_record_retention_until_id_idx" ON "growth_ledger_record" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_asset_type_created_id_idx" ON "growth_ledger_record" ("asset_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "growth_ledger_record_target_type_target_id_idx" ON "growth_ledger_record" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "growth_ledger_record_rule_type_asset_type_created_at_idx" ON "growth_ledger_record" ("rule_type","asset_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_reward_rule_type_asset_type_asset_key_active_key" ON "growth_reward_rule" ("type","asset_type","asset_key") WHERE "archived_at" is null;--> statement-breakpoint
CREATE INDEX "growth_reward_rule_type_idx" ON "growth_reward_rule" ("type");--> statement-breakpoint
CREATE INDEX "growth_reward_rule_asset_type_idx" ON "growth_reward_rule" ("asset_type");--> statement-breakpoint
CREATE INDEX "growth_reward_rule_is_enabled_idx" ON "growth_reward_rule" ("is_enabled");--> statement-breakpoint
CREATE INDEX "growth_reward_rule_archived_at_idx" ON "growth_reward_rule" ("archived_at");--> statement-breakpoint
CREATE INDEX "growth_reward_settlement_status_created_at_idx" ON "growth_reward_settlement" ("settlement_status","created_at");--> statement-breakpoint
CREATE INDEX "growth_reward_settlement_type_status_created_at_idx" ON "growth_reward_settlement" ("settlement_type","settlement_status","created_at");--> statement-breakpoint
CREATE INDEX "growth_reward_settlement_user_id_status_created_at_idx" ON "growth_reward_settlement" ("user_id","settlement_status","created_at");--> statement-breakpoint
CREATE INDEX "growth_reward_settlement_source_record_id_idx" ON "growth_reward_settlement" ("source_record_id");--> statement-breakpoint
CREATE INDEX "growth_reward_settlement_event_code_created_at_idx" ON "growth_reward_settlement" ("event_code","created_at");--> statement-breakpoint
CREATE INDEX "growth_rule_usage_counter_user_id_asset_type_rule_key_idx" ON "growth_rule_usage_counter" ("user_id","asset_type","rule_key","updated_at");--> statement-breakpoint
CREATE INDEX "task_definition_status_idx" ON "task_definition" ("status");--> statement-breakpoint
CREATE INDEX "task_definition_scene_type_idx" ON "task_definition" ("scene_type");--> statement-breakpoint
CREATE INDEX "task_definition_sort_order_idx" ON "task_definition" ("sort_order");--> statement-breakpoint
CREATE INDEX "task_definition_created_at_idx" ON "task_definition" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_definition_created_by_id_idx" ON "task_definition" ("created_by_id");--> statement-breakpoint
CREATE INDEX "task_definition_updated_by_id_idx" ON "task_definition" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "task_definition_active_manual_lookup_idx" ON "task_definition" ("scene_type","sort_order","id") WHERE "deleted_at" is null and "status" = 1 and "claim_mode" = 2;--> statement-breakpoint
CREATE INDEX "task_definition_start_at_idx" ON "task_definition" ("start_at");--> statement-breakpoint
CREATE INDEX "task_definition_end_at_idx" ON "task_definition" ("end_at");--> statement-breakpoint
CREATE INDEX "task_definition_deleted_at_idx" ON "task_definition" ("deleted_at");--> statement-breakpoint
CREATE INDEX "task_event_failure_status_created_at_idx" ON "task_event_failure" ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_event_failure_event_status_created_at_idx" ON "task_event_failure" ("event_key","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_event_failure_event_key_biz_key_idx" ON "task_event_failure" ("event_key","event_biz_key");--> statement-breakpoint
CREATE INDEX "task_event_failure_user_created_at_idx" ON "task_event_failure" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_event_log_task_id_created_at_idx" ON "task_event_log" ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_event_log_step_id_idx" ON "task_event_log" ("step_id");--> statement-breakpoint
CREATE INDEX "task_event_log_instance_id_idx" ON "task_event_log" ("instance_id");--> statement-breakpoint
CREATE INDEX "task_event_log_instance_created_at_id_idx" ON "task_event_log" ("instance_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_event_log_retention_until_id_idx" ON "task_event_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "task_event_log_instance_latest_idx" ON "task_event_log" ("instance_id","occurred_at" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "instance_id" is not null;--> statement-breakpoint
CREATE INDEX "task_event_log_instance_step_id_idx" ON "task_event_log" ("instance_step_id");--> statement-breakpoint
CREATE INDEX "task_event_log_user_id_created_at_idx" ON "task_event_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "task_event_log_event_code_created_at_idx" ON "task_event_log" ("event_code","created_at");--> statement-breakpoint
CREATE INDEX "task_instance_user_id_status_idx" ON "task_instance" ("user_id","status");--> statement-breakpoint
CREATE INDEX "task_instance_user_task_cycle_live_idx" ON "task_instance" ("user_id","task_id","cycle_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_instance_task_id_idx" ON "task_instance" ("task_id");--> statement-breakpoint
CREATE INDEX "task_instance_live_task_created_idx" ON "task_instance" ("task_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_instance_live_created_at_idx" ON "task_instance" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_instance_live_user_status_created_idx" ON "task_instance" ("user_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_instance_reward_retry_scan_idx" ON "task_instance" ("status","reward_applicable","id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "task_instance_completed_at_idx" ON "task_instance" ("completed_at");--> statement-breakpoint
CREATE INDEX "task_instance_expired_at_idx" ON "task_instance" ("expired_at");--> statement-breakpoint
CREATE INDEX "task_instance_reward_settlement_id_idx" ON "task_instance" ("reward_settlement_id");--> statement-breakpoint
CREATE INDEX "task_instance_deleted_at_idx" ON "task_instance" ("deleted_at");--> statement-breakpoint
CREATE INDEX "task_instance_step_instance_id_idx" ON "task_instance_step" ("instance_id");--> statement-breakpoint
CREATE INDEX "task_instance_step_step_id_idx" ON "task_instance_step" ("step_id");--> statement-breakpoint
CREATE INDEX "task_instance_step_completed_at_idx" ON "task_instance_step" ("completed_at");--> statement-breakpoint
CREATE INDEX "task_step_task_id_idx" ON "task_step" ("task_id");--> statement-breakpoint
CREATE INDEX "task_step_template_key_idx" ON "task_step" ("template_key");--> statement-breakpoint
CREATE INDEX "task_step_event_code_idx" ON "task_step" ("event_code");--> statement-breakpoint
CREATE INDEX "task_step_unique_fact_user_id_step_id_idx" ON "task_step_unique_fact" ("user_id","step_id");--> statement-breakpoint
CREATE INDEX "task_step_unique_fact_task_id_idx" ON "task_step_unique_fact" ("task_id");--> statement-breakpoint
CREATE INDEX "task_step_unique_fact_reconcile_summary_idx" ON "task_step_unique_fact" ("task_id","user_id","scope_key","step_id","first_occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_step_unique_fact_first_event_biz_key_idx" ON "task_step_unique_fact" ("first_event_biz_key");--> statement-breakpoint
CREATE INDEX "user_badge_type_idx" ON "user_badge" ("type");--> statement-breakpoint
CREATE INDEX "user_badge_business_event_key_idx" ON "user_badge" ("business","event_key");--> statement-breakpoint
CREATE INDEX "user_badge_sort_order_idx" ON "user_badge" ("sort_order");--> statement-breakpoint
CREATE INDEX "user_badge_is_enabled_idx" ON "user_badge" ("is_enabled");--> statement-breakpoint
CREATE INDEX "user_badge_created_at_idx" ON "user_badge" ("created_at");--> statement-breakpoint
CREATE INDEX "user_badge_assignment_badge_id_created_at_idx" ON "user_badge_assignment" ("badge_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_badge_assignment_user_id_created_at_idx" ON "user_badge_assignment" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_badge_assignment_user_created_badge_idx" ON "user_badge_assignment" ("user_id","created_at" DESC NULLS LAST,"badge_id");--> statement-breakpoint
CREATE INDEX "user_level_rule_is_enabled_sort_order_idx" ON "user_level_rule" ("is_enabled","sort_order");--> statement-breakpoint
CREATE INDEX "user_level_rule_business_enabled_exp_id_idx" ON "user_level_rule" ("business","is_enabled","required_experience" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_level_rule_enabled_business_exp_unique_idx" ON "user_level_rule" (COALESCE("business", ''),"required_experience") WHERE "is_enabled" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_level_rule_enabled_business_base_unique_idx" ON "user_level_rule" (COALESCE("business", '')) WHERE "is_enabled" = true and "required_experience" = 0;--> statement-breakpoint
CREATE INDEX "admin_menu_parent_sort_idx" ON "admin_menu" ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "admin_menu_is_enabled_idx" ON "admin_menu" ("is_enabled");--> statement-breakpoint
CREATE INDEX "admin_permission_group_code_idx" ON "admin_permission" ("group_code");--> statement-breakpoint
CREATE INDEX "admin_permission_is_enabled_idx" ON "admin_permission" ("is_enabled");--> statement-breakpoint
CREATE INDEX "admin_role_is_enabled_idx" ON "admin_role" ("is_enabled");--> statement-breakpoint
CREATE INDEX "admin_role_sort_order_idx" ON "admin_role" ("sort_order");--> statement-breakpoint
CREATE INDEX "admin_role_menu_role_id_idx" ON "admin_role_menu" ("role_id");--> statement-breakpoint
CREATE INDEX "admin_role_menu_menu_id_idx" ON "admin_role_menu" ("menu_id");--> statement-breakpoint
CREATE INDEX "admin_role_permission_role_id_idx" ON "admin_role_permission" ("role_id");--> statement-breakpoint
CREATE INDEX "admin_role_permission_permission_id_idx" ON "admin_role_permission" ("permission_id");--> statement-breakpoint
CREATE INDEX "admin_user_role_admin_user_id_idx" ON "admin_user_role" ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_user_role_role_id_idx" ON "admin_user_role" ("role_id");--> statement-breakpoint
CREATE INDEX "admin_user_is_enabled_idx" ON "admin_user" ("is_enabled");--> statement-breakpoint
CREATE INDEX "admin_user_created_at_idx" ON "admin_user" ("created_at");--> statement-breakpoint
CREATE INDEX "admin_user_last_login_at_idx" ON "admin_user" ("last_login_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_user_id_idx" ON "admin_user_token" ("user_id");--> statement-breakpoint
CREATE INDEX "admin_user_token_token_type_idx" ON "admin_user_token" ("token_type");--> statement-breakpoint
CREATE INDEX "admin_user_token_expires_at_idx" ON "admin_user_token" ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_revoked_at_idx" ON "admin_user_token" ("revoked_at");--> statement-breakpoint
CREATE INDEX "admin_user_token_user_id_token_type_idx" ON "admin_user_token" ("user_id","token_type");--> statement-breakpoint
CREATE INDEX "app_user_is_enabled_idx" ON "app_user" ("is_enabled");--> statement-breakpoint
CREATE INDEX "app_user_gender_type_idx" ON "app_user" ("gender_type");--> statement-breakpoint
CREATE INDEX "app_user_created_at_idx" ON "app_user" ("created_at");--> statement-breakpoint
CREATE INDEX "app_user_last_login_at_idx" ON "app_user" ("last_login_at");--> statement-breakpoint
CREATE INDEX "app_user_status_idx" ON "app_user" ("status");--> statement-breakpoint
CREATE INDEX "app_user_level_id_idx" ON "app_user" ("level_id");--> statement-breakpoint
CREATE INDEX "app_user_deleted_at_idx" ON "app_user" ("deleted_at");--> statement-breakpoint
CREATE INDEX "app_user_active_fanout_scan_idx" ON "app_user" ("id") WHERE "is_enabled" = true and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "app_user_active_page_id_idx" ON "app_user" ("id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "app_user_token_user_id_idx" ON "app_user_token" ("user_id");--> statement-breakpoint
CREATE INDEX "app_user_token_token_type_idx" ON "app_user_token" ("token_type");--> statement-breakpoint
CREATE INDEX "app_user_token_expires_at_idx" ON "app_user_token" ("expires_at");--> statement-breakpoint
CREATE INDEX "app_user_token_revoked_at_idx" ON "app_user_token" ("revoked_at");--> statement-breakpoint
CREATE INDEX "app_user_token_user_id_token_type_idx" ON "app_user_token" ("user_id","token_type");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_provider_config_enabled_unique_idx" ON "ad_provider_config" ("provider","platform","client_app_key","app_id","placement_key","environment","target_scope") WHERE "is_enabled" = true;--> statement-breakpoint
CREATE INDEX "ad_provider_config_selection_idx" ON "ad_provider_config" ("provider","platform","client_app_key","app_id","placement_key","environment","target_scope","is_enabled","sort_order","id");--> statement-breakpoint
CREATE INDEX "ad_reward_record_user_target_status_idx" ON "ad_reward_record" ("user_id","target_scope","target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "ad_reward_record_config_scope_status_idx" ON "ad_reward_record" ("ad_provider_config_id","target_scope","status");--> statement-breakpoint
CREATE INDEX "ad_reward_record_user_config_status_created_at_idx" ON "ad_reward_record" ("user_id","ad_provider_config_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ad_reward_record_status_created_at_id_idx" ON "ad_reward_record" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "ad_reward_record_target_scope_status_created_at_idx" ON "ad_reward_record" ("target_scope","status","created_at");--> statement-breakpoint
CREATE INDEX "ad_reward_record_target_status_idx" ON "ad_reward_record" ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "ad_reward_record_user_created_at_idx" ON "ad_reward_record" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ad_reward_record_config_created_at_idx" ON "ad_reward_record" ("ad_provider_config_id","created_at");--> statement-breakpoint
CREATE INDEX "ad_reward_record_created_at_idx" ON "ad_reward_record" ("created_at");--> statement-breakpoint
CREATE INDEX "emoji_asset_pack_id_sort_order_idx" ON "emoji_asset" ("pack_id","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_asset_pack_id_is_enabled_deleted_at_sort_order_idx" ON "emoji_asset" ("pack_id","is_enabled","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_asset_kind_idx" ON "emoji_asset" ("kind");--> statement-breakpoint
CREATE INDEX "emoji_asset_category_idx" ON "emoji_asset" ("category");--> statement-breakpoint
CREATE INDEX "emoji_asset_unicode_sequence_idx" ON "emoji_asset" ("unicode_sequence");--> statement-breakpoint
CREATE INDEX "emoji_asset_deleted_at_idx" ON "emoji_asset" ("deleted_at");--> statement-breakpoint
CREATE INDEX "emoji_asset_created_by_id_idx" ON "emoji_asset" ("created_by_id");--> statement-breakpoint
CREATE INDEX "emoji_asset_updated_by_id_idx" ON "emoji_asset" ("updated_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emoji_asset_shortcode_live_key" ON "emoji_asset" ("shortcode") WHERE "shortcode" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_idx" ON "emoji_pack" ("is_enabled");--> statement-breakpoint
CREATE INDEX "emoji_pack_sort_order_idx" ON "emoji_pack" ("sort_order");--> statement-breakpoint
CREATE INDEX "emoji_pack_deleted_at_idx" ON "emoji_pack" ("deleted_at");--> statement-breakpoint
CREATE INDEX "emoji_pack_created_by_id_idx" ON "emoji_pack" ("created_by_id");--> statement-breakpoint
CREATE INDEX "emoji_pack_updated_by_id_idx" ON "emoji_pack" ("updated_by_id");--> statement-breakpoint
CREATE INDEX "emoji_pack_scene_type_idx" ON "emoji_pack" USING gin ("scene_type");--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_deleted_at_idx" ON "emoji_pack" ("is_enabled","deleted_at");--> statement-breakpoint
CREATE INDEX "emoji_pack_is_enabled_deleted_at_sort_order_idx" ON "emoji_pack" ("is_enabled","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "emoji_recent_usage_user_id_scene_last_used_at_idx" ON "emoji_recent_usage" ("user_id","scene","last_used_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "emoji_recent_usage_emoji_asset_id_idx" ON "emoji_recent_usage" ("emoji_asset_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_target_type_target_id_idx" ON "user_browse_log" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_user_id_idx" ON "user_browse_log" ("user_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_viewed_at_idx" ON "user_browse_log" ("viewed_at");--> statement-breakpoint
CREATE INDEX "user_browse_log_target_type_target_id_user_id_idx" ON "user_browse_log" ("target_type","target_id","user_id");--> statement-breakpoint
CREATE INDEX "user_browse_log_user_id_viewed_at_idx" ON "user_browse_log" ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "user_browse_log_user_viewed_at_id_idx" ON "user_browse_log" ("user_id","viewed_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_browse_log_target_viewed_at_id_idx" ON "user_browse_log" ("target_type","target_id","viewed_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_browse_log_retention_until_id_idx" ON "user_browse_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_created_at_idx" ON "user_comment" ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_reply_to_id_floor_idx" ON "user_comment" ("target_type","target_id","reply_to_id","floor");--> statement-breakpoint
CREATE INDEX "user_comment_target_root_floor_id_idx" ON "user_comment" ("target_type","target_id","floor","id") WHERE "reply_to_id" is null and "audit_status" = 1 and "is_hidden" = false and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_target_visible_created_id_idx" ON "user_comment" ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "audit_status" = 1 and "is_hidden" = false and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_target_visible_like_id_idx" ON "user_comment" ("target_type","target_id","like_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "audit_status" = 1 and "is_hidden" = false and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_retention_until_id_idx" ON "user_comment" ("retention_until","id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_comment_root_floor_live_key" ON "user_comment" ("target_type","target_id","floor") WHERE "reply_to_id" is null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_audit_status_is_hidden_d_idx" ON "user_comment" ("target_type","target_id","audit_status","is_hidden","deleted_at");--> statement-breakpoint
CREATE INDEX "user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx" ON "user_comment" ("actual_reply_to_id","audit_status","is_hidden","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_target_type_target_id_deleted_at_created_at_idx" ON "user_comment" ("target_type","target_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "user_comment_user_id_idx" ON "user_comment" ("user_id");--> statement-breakpoint
CREATE INDEX "user_comment_user_id_created_at_desc_idx" ON "user_comment" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_comment_user_id_deleted_at_created_at_desc_idx" ON "user_comment" ("user_id","deleted_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_comment_created_at_idx" ON "user_comment" ("created_at");--> statement-breakpoint
CREATE INDEX "user_comment_admin_live_created_id_idx" ON "user_comment" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_admin_live_user_created_id_idx" ON "user_comment" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_admin_live_audit_created_id_idx" ON "user_comment" ("audit_status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_audit_status_idx" ON "user_comment" ("audit_status");--> statement-breakpoint
CREATE INDEX "user_comment_is_hidden_idx" ON "user_comment" ("is_hidden");--> statement-breakpoint
CREATE INDEX "user_comment_reply_to_id_idx" ON "user_comment" ("reply_to_id");--> statement-breakpoint
CREATE INDEX "user_comment_actual_reply_to_id_idx" ON "user_comment" ("actual_reply_to_id");--> statement-breakpoint
CREATE INDEX "user_comment_deleted_at_idx" ON "user_comment" ("deleted_at");--> statement-breakpoint
CREATE INDEX "user_comment_topic_delete_cascade_id_idx" ON "user_comment" ("topic_delete_cascade_id");--> statement-breakpoint
CREATE INDEX "user_comment_forum_topic_restore_batch_idx" ON "user_comment" ("target_id","topic_delete_cascade_id","deleted_at") WHERE "target_type" = 5 and "topic_delete_cascade_id" is not null;--> statement-breakpoint
CREATE INDEX "user_comment_body_version_idx" ON "user_comment" ("body_version");--> statement-breakpoint
CREATE INDEX "user_comment_forum_topic_visible_latest_idx" ON "user_comment" ("target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "target_type" = 5 and "audit_status" = 1 and "is_hidden" = false and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_forum_topic_live_user_agg_idx" ON "user_comment" ("target_id","user_id") WHERE "target_type" = 5 and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_forum_topic_content_trgm_idx" ON "user_comment" USING gin ("content" gin_trgm_ops) WHERE "target_type" = 5 and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_comment_floor_counter_target_next_floor_idx" ON "user_comment_floor_counter" ("target_type","target_id","next_floor");--> statement-breakpoint
CREATE INDEX "user_favorite_target_type_target_id_idx" ON "user_favorite" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_favorite_user_id_idx" ON "user_favorite" ("user_id");--> statement-breakpoint
CREATE INDEX "user_favorite_user_id_created_at_idx" ON "user_favorite" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_favorite_created_at_idx" ON "user_favorite" ("created_at");--> statement-breakpoint
CREATE INDEX "user_follow_user_id_target_type_created_at_idx" ON "user_follow" ("user_id","target_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_follow_target_type_target_id_created_at_idx" ON "user_follow" ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_follow_target_type_target_id_idx" ON "user_follow" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_like_target_type_target_id_idx" ON "user_like" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_like_scene_type_scene_id_idx" ON "user_like" ("scene_type","scene_id");--> statement-breakpoint
CREATE INDEX "user_like_user_id_scene_type_created_at_idx" ON "user_like" ("user_id","scene_type","created_at");--> statement-breakpoint
CREATE INDEX "user_like_user_id_created_at_idx" ON "user_like" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_like_created_at_idx" ON "user_like" ("created_at");--> statement-breakpoint
CREATE INDEX "user_mention_source_idx" ON "user_mention" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "user_mention_receiver_created_at_idx" ON "user_mention" ("mentioned_user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_mention_notified_at_idx" ON "user_mention" ("notified_at");--> statement-breakpoint
CREATE INDEX "user_report_target_type_target_id_idx" ON "user_report" ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "user_report_target_created_at_id_idx" ON "user_report" ("target_type","target_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_scene_type_scene_id_status_idx" ON "user_report" ("scene_type","scene_id","status");--> statement-breakpoint
CREATE INDEX "user_report_scene_type_status_created_at_idx" ON "user_report" ("scene_type","status","created_at");--> statement-breakpoint
CREATE INDEX "user_report_reason_type_status_created_at_idx" ON "user_report" ("reason_type","status","created_at");--> statement-breakpoint
CREATE INDEX "user_report_handler_id_status_handled_at_idx" ON "user_report" ("handler_id","status","handled_at");--> statement-breakpoint
CREATE INDEX "user_report_status_created_at_id_idx" ON "user_report" ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_reporter_created_at_id_idx" ON "user_report" ("reporter_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_handler_status_created_at_id_idx" ON "user_report" ("handler_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_disposition_status_created_at_id_idx" ON "user_report" ("target_action_status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_created_at_idx" ON "user_report" ("created_at");--> statement-breakpoint
CREATE INDEX "user_report_disposition_attempt_report_created_at_idx" ON "user_report_disposition_attempt" ("report_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_disposition_attempt_status_created_at_idx" ON "user_report_disposition_attempt" ("attempt_status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_report_disposition_attempt_actor_user_id_idx" ON "user_report_disposition_attempt" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "user_report_disposition_attempt_failed_latest_idx" ON "user_report_disposition_attempt" ("report_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "attempt_status" = 1 and "resolved_at" is null;--> statement-breakpoint
CREATE INDEX "chat_conversation_last_message_at_idx" ON "chat_conversation" ("last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_conversation_last_message_at_id_idx" ON "chat_conversation" ("last_message_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_conversation_retention_until_id_idx" ON "chat_conversation" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "chat_conversation_last_message_id_idx" ON "chat_conversation" ("last_message_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_last_sender_id_idx" ON "chat_conversation" ("last_sender_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_last_read_message_id_idx" ON "chat_conversation_member" ("last_read_message_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_user_id_joined_at_idx" ON "chat_conversation_member" ("user_id","is_pinned" DESC NULLS LAST,"joined_at","conversation_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_user_id_unread_count_conversation__idx" ON "chat_conversation_member" ("user_id","unread_count","conversation_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_member_active_user_idx" ON "chat_conversation_member" ("user_id","is_pinned" DESC NULLS LAST,"conversation_id") WHERE "left_at" is null and "hidden_at" is null;--> statement-breakpoint
CREATE INDEX "chat_conversation_member_active_unread_idx" ON "chat_conversation_member" ("user_id","unread_count","conversation_id") WHERE "left_at" is null and "hidden_at" is null;--> statement-breakpoint
CREATE INDEX "chat_conversation_member_hidden_user_idx" ON "chat_conversation_member" ("user_id","hidden_at" DESC NULLS LAST,"conversation_id") WHERE "left_at" is null and "hidden_at" is not null;--> statement-breakpoint
CREATE INDEX "chat_message_conversation_id_created_at_idx" ON "chat_message" ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_message_conversation_created_at_id_idx" ON "chat_message" ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_message_conversation_live_seq_idx" ON "chat_message" ("conversation_id","message_seq") WHERE "status" in (1, 2);--> statement-breakpoint
CREATE INDEX "chat_message_conversation_seq_desc_idx" ON "chat_message" ("conversation_id","message_seq" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_message_retention_until_id_idx" ON "chat_message" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "chat_message_sender_id_created_at_idx" ON "chat_message" ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_status_updated_at_idx" ON "notification_delivery" ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_status_updated_at_id_idx" ON "notification_delivery" ("status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_updated_at_id_idx" ON "notification_delivery" ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_event_key_updated_at_idx" ON "notification_delivery" ("event_key","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_receiver_user_id_updated_at_idx" ON "notification_delivery" ("receiver_user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_receiver_updated_at_id_idx" ON "notification_delivery" ("receiver_user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_receiver_created_at_id_idx" ON "notification_delivery" ("receiver_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_retention_until_id_idx" ON "notification_delivery" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "notification_delivery_projection_key_idx" ON "notification_delivery" ("projection_key");--> statement-breakpoint
CREATE INDEX "notification_delivery_notification_id_idx" ON "notification_delivery" ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_category_key_status_updated_at_idx" ON "notification_delivery" ("category_key","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_category_status_updated_at_id_idx" ON "notification_delivery" ("category_key","status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_event_category_status_updated_id_idx" ON "notification_delivery" ("event_key","category_key","status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_task_lookup_idx" ON "notification_delivery" ("category_key","task_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_assignment_kind_idx" ON "notification_delivery" ("category_key","assignment_id","reminder_kind","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_kind_status_assignment_idx" ON "notification_delivery" ("category_key","reminder_kind","status","assignment_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_event_id_idx" ON "notification_delivery" ("event_id");--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference" ("user_id");--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_is_enabled_idx" ON "notification_preference" ("user_id","is_enabled");--> statement-breakpoint
CREATE INDEX "notification_template_is_enabled_idx" ON "notification_template" ("is_enabled");--> statement-breakpoint
CREATE INDEX "notification_template_updated_at_idx" ON "notification_template" ("updated_at");--> statement-breakpoint
CREATE INDEX "notification_template_enabled_updated_at_id_idx" ON "notification_template" ("is_enabled","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_template_category_updated_at_id_idx" ON "notification_template" ("category_key","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_is_read_created_at_idx" ON "user_notification" ("receiver_user_id","is_hidden","is_read","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_category_key_created_at_idx" ON "user_notification" ("receiver_user_id","is_hidden","category_key","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_created_at_idx" ON "user_notification" ("receiver_user_id","is_hidden","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_receiver_read_category_created_id_idx" ON "user_notification" ("receiver_user_id","is_hidden","is_read","category_key","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_receiver_created_at_id_idx" ON "user_notification" ("receiver_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notification_retention_until_id_idx" ON "user_notification" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_expires_at_idx" ON "user_notification" ("receiver_user_id","expires_at");--> statement-breakpoint
CREATE INDEX "user_notification_category_announcement_receiver_idx" ON "user_notification" ("category_key","announcement_id","receiver_user_id");--> statement-breakpoint
CREATE INDEX "user_notification_actor_user_id_idx" ON "user_notification" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "sensitive_word_type_idx" ON "sensitive_word" ("type");--> statement-breakpoint
CREATE INDEX "sensitive_word_level_idx" ON "sensitive_word" ("level");--> statement-breakpoint
CREATE INDEX "sensitive_word_is_enabled_idx" ON "sensitive_word" ("is_enabled");--> statement-breakpoint
CREATE INDEX "sensitive_word_match_mode_idx" ON "sensitive_word" ("match_mode");--> statement-breakpoint
CREATE INDEX "sensitive_word_created_at_idx" ON "sensitive_word" ("created_at");--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_count_desc_idx" ON "sensitive_word" ("hit_count" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_last_hit_at_desc_idx" ON "sensitive_word" ("last_hit_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_sensitive_word_id_created_at_idx" ON "sensitive_word_hit_log" ("sensitive_word_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_entity_type_entity_id_created_at_idx" ON "sensitive_word_hit_log" ("entity_type","entity_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_created_at_id_desc_idx" ON "sensitive_word_hit_log" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_level_created_at_id_idx" ON "sensitive_word_hit_log" ("level","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_type_created_at_id_idx" ON "sensitive_word_hit_log" ("type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_created_at_idx" ON "sensitive_word_hit_log" ("created_at");--> statement-breakpoint
CREATE INDEX "sensitive_word_hit_log_retention_until_id_idx" ON "sensitive_word_hit_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "sys_request_log_created_at_idx" ON "sys_request_log" ("created_at");--> statement-breakpoint
CREATE INDEX "sys_request_log_created_at_id_idx" ON "sys_request_log" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_retention_until_id_idx" ON "sys_request_log" ("retention_until","id");--> statement-breakpoint
CREATE INDEX "sys_request_log_api_action_created_id_idx" ON "sys_request_log" ("api_type","action_type","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_api_action_id_idx" ON "sys_request_log" ("api_type","action_type","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_user_created_id_idx" ON "sys_request_log" ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_success_created_id_idx" ON "sys_request_log" ("is_success","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sys_request_log_user_id_idx" ON "sys_request_log" ("user_id");--> statement-breakpoint
CREATE INDEX "sys_request_log_username_idx" ON "sys_request_log" ("username");--> statement-breakpoint
CREATE INDEX "sys_request_log_is_success_idx" ON "sys_request_log" ("is_success");--> statement-breakpoint
CREATE INDEX "workflow_attempt_status_created_at_id_idx" ON "workflow_attempt" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_attempt_status_not_before_created_at_id_idx" ON "workflow_attempt" ("status","not_before_at","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_attempt_status_claim_expires_at_idx" ON "workflow_attempt" ("status","claim_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_conflict_key_workflow_type_active_key_uidx" ON "workflow_conflict_key" ("workflow_type","conflict_key") WHERE "released_at" is null;--> statement-breakpoint
CREATE INDEX "workflow_conflict_key_job_id_idx" ON "workflow_conflict_key" ("workflow_job_id");--> statement-breakpoint
CREATE INDEX "workflow_conflict_key_workflow_type_key_idx" ON "workflow_conflict_key" ("workflow_type","conflict_key");--> statement-breakpoint
CREATE INDEX "workflow_conflict_key_released_created_at_idx" ON "workflow_conflict_key" ("released_at","created_at");--> statement-breakpoint
CREATE INDEX "workflow_event_job_created_at_id_idx" ON "workflow_event" ("workflow_job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_event_attempt_created_at_id_idx" ON "workflow_event" ("workflow_attempt_id","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_event_notification_created_at_id_idx" ON "workflow_event" ("created_at","id") WHERE "event_type" in (8, 10);--> statement-breakpoint
CREATE INDEX "workflow_job_workflow_type_status_updated_at_id_idx" ON "workflow_job" ("workflow_type","status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_job_status_updated_at_id_idx" ON "workflow_job" ("status","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_job_operator_updated_at_id_idx" ON "workflow_job" ("operator_type","operator_user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflow_job_status_created_at_id_idx" ON "workflow_job" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "workflow_job_archived_updated_at_id_idx" ON "workflow_job" ("archived_at","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);
