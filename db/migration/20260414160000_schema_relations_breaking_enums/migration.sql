BEGIN;

ALTER TABLE "app_update_release"
  ALTER COLUMN "platform" DROP DEFAULT;

ALTER TABLE "app_update_release"
  ALTER COLUMN "platform" TYPE smallint
  USING CASE "platform"
    WHEN 'ios' THEN 1
    WHEN 'android' THEN 2
    ELSE NULL
  END;

ALTER TABLE "app_update_release"
  ALTER COLUMN "package_source_type" TYPE smallint
  USING CASE
    WHEN "package_source_type" IS NULL THEN NULL
    WHEN "package_source_type" = 'upload' THEN 1
    WHEN "package_source_type" = 'url' THEN 2
    ELSE NULL
  END;

ALTER TABLE "app_update_release"
  ADD CONSTRAINT "app_update_release_platform_valid_chk"
  CHECK ("platform" in (1, 2));

ALTER TABLE "app_update_release"
  ADD CONSTRAINT "app_update_release_package_source_type_valid_chk"
  CHECK ("package_source_type" is null or "package_source_type" in (1, 2));

ALTER TABLE "app_user"
  ALTER COLUMN "status" TYPE smallint
  USING "status"::smallint;

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_gender_type_valid_chk"
  CHECK ("gender_type" in (0, 1, 2, 3, 4));

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_status_valid_chk"
  CHECK ("status" in (1, 2, 3, 4, 5));

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_points_non_negative_chk"
  CHECK ("points" >= 0);

ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_experience_non_negative_chk"
  CHECK ("experience" >= 0);

ALTER TABLE "app_announcement"
  ALTER COLUMN "enable_platform" TYPE smallint[]
  USING CASE
    WHEN "enable_platform" IS NULL THEN NULL
    ELSE "enable_platform"::smallint[]
  END;

ALTER TABLE "app_announcement"
  ADD CONSTRAINT "app_announcement_priority_level_valid_chk"
  CHECK ("priority_level" in (0, 1, 2, 3));

ALTER TABLE "app_announcement"
  ADD CONSTRAINT "app_announcement_enable_platform_valid_chk"
  CHECK ("enable_platform" is null or "enable_platform" <@ ARRAY[1,2,3]::smallint[]);

ALTER TABLE "app_announcement"
  ADD CONSTRAINT "app_announcement_view_count_non_negative_chk"
  CHECK ("view_count" >= 0);

ALTER TABLE "admin_user_token"
  ALTER COLUMN "token_type" TYPE smallint
  USING CASE "token_type"
    WHEN 'ACCESS' THEN 1
    WHEN 'REFRESH' THEN 2
    ELSE NULL
  END;

ALTER TABLE "admin_user_token"
  ADD CONSTRAINT "admin_user_token_token_type_valid_chk"
  CHECK ("token_type" in (1, 2));

ALTER TABLE "app_user_token"
  ALTER COLUMN "token_type" TYPE smallint
  USING CASE "token_type"
    WHEN 'ACCESS' THEN 1
    WHEN 'REFRESH' THEN 2
    ELSE NULL
  END;

ALTER TABLE "app_user_token"
  ADD CONSTRAINT "app_user_token_token_type_valid_chk"
  CHECK ("token_type" in (1, 2));

ALTER TABLE "check_in_plan"
  DROP CONSTRAINT IF EXISTS "check_in_plan_cycle_type_valid_chk";

ALTER TABLE "check_in_plan"
  ALTER COLUMN "cycle_type" TYPE smallint
  USING CASE "cycle_type"
    WHEN 'weekly' THEN 1
    WHEN 'monthly' THEN 2
    ELSE NULL
  END;

ALTER TABLE "check_in_plan"
  ADD CONSTRAINT "check_in_plan_cycle_type_valid_chk"
  CHECK ("cycle_type" in (1, 2));

ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_source_type_valid_chk";

ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_resolution_consistent_chk";

ALTER TABLE "check_in_record"
  ALTER COLUMN "resolved_reward_source_type" TYPE smallint
  USING CASE
    WHEN "resolved_reward_source_type" IS NULL THEN NULL
    WHEN "resolved_reward_source_type" = 'BASE_REWARD' THEN 1
    WHEN "resolved_reward_source_type" = 'DATE_RULE' THEN 2
    WHEN "resolved_reward_source_type" = 'PATTERN_RULE' THEN 3
    ELSE NULL
  END;

ALTER TABLE "check_in_record"
  ADD CONSTRAINT "check_in_record_reward_source_type_valid_chk"
  CHECK ("resolved_reward_source_type" is null or "resolved_reward_source_type" in (1, 2, 3));

ALTER TABLE "check_in_record"
  ADD CONSTRAINT "check_in_record_reward_resolution_consistent_chk"
  CHECK ((
      "reward_status" is null
      and "resolved_reward_source_type" is null
      and "resolved_reward_rule_key" is null
      and "resolved_reward_config" is null
    ) or (
      "reward_status" in (0, 1, 2)
      and "resolved_reward_source_type" in (1, 2, 3)
      and "resolved_reward_config" is not null
    ));

ALTER TABLE "domain_event_dispatch"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "domain_event_dispatch"
  ALTER COLUMN "status" TYPE smallint
  USING CASE "status"
    WHEN 'pending' THEN 0
    WHEN 'processing' THEN 1
    WHEN 'success' THEN 2
    WHEN 'failed' THEN 3
    ELSE NULL
  END;

ALTER TABLE "domain_event_dispatch"
  ALTER COLUMN "status" SET DEFAULT 0;

ALTER TABLE "domain_event_dispatch"
  ADD CONSTRAINT "domain_event_dispatch_status_valid_chk"
  CHECK ("status" in (0, 1, 2, 3));

ALTER TABLE "notification_delivery"
  ALTER COLUMN "status" TYPE smallint
  USING CASE "status"
    WHEN 'DELIVERED' THEN 1
    WHEN 'FAILED' THEN 2
    WHEN 'RETRYING' THEN 3
    WHEN 'SKIPPED_PREFERENCE' THEN 4
    ELSE NULL
  END;

ALTER TABLE "notification_delivery"
  ADD CONSTRAINT "notification_delivery_status_valid_chk"
  CHECK ("status" in (1, 2, 3, 4));

UPDATE "work_comic_archive_import_task"
SET "result_items" = COALESCE((
  SELECT jsonb_agg(
    jsonb_set(
      item,
      '{status}',
      to_jsonb(
        CASE item->>'status'
          WHEN 'pending' THEN 0
          WHEN 'success' THEN 1
          WHEN 'failed' THEN 2
          ELSE NULL
        END
      ),
      false
    )
  )
  FROM jsonb_array_elements("result_items") AS item
), '[]'::jsonb)
WHERE jsonb_typeof("result_items") = 'array';

ALTER TABLE "work_comic_archive_import_task"
  ALTER COLUMN "mode" TYPE smallint
  USING CASE "mode"
    WHEN 'single_chapter' THEN 1
    WHEN 'multi_chapter' THEN 2
    ELSE NULL
  END;

ALTER TABLE "work_comic_archive_import_task"
  ALTER COLUMN "status" TYPE smallint
  USING CASE "status"
    WHEN 'draft' THEN 0
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'success' THEN 3
    WHEN 'partial_failed' THEN 4
    WHEN 'failed' THEN 5
    WHEN 'expired' THEN 6
    WHEN 'cancelled' THEN 7
    ELSE NULL
  END;

ALTER TABLE "work_comic_archive_import_task"
  ADD CONSTRAINT "work_comic_archive_import_task_mode_valid_chk"
  CHECK ("mode" in (1, 2));

ALTER TABLE "work_comic_archive_import_task"
  ADD CONSTRAINT "work_comic_archive_import_task_status_valid_chk"
  CHECK ("status" in (0, 1, 2, 3, 4, 5, 6, 7));

ALTER TABLE "app_announcement_notification_fanout_task"
  ALTER COLUMN "status" TYPE smallint
  USING CASE "status"
    WHEN 'pending' THEN 0
    WHEN 'processing' THEN 1
    WHEN 'success' THEN 2
    WHEN 'failed' THEN 3
    ELSE NULL
  END;

ALTER TABLE "app_announcement_notification_fanout_task"
  ADD CONSTRAINT "app_announcement_notification_fanout_task_status_valid_chk"
  CHECK ("status" in (0, 1, 2, 3));

ALTER TABLE "forum_moderator"
  ALTER COLUMN "role_type" TYPE smallint
  USING "role_type"::smallint;

ALTER TABLE "forum_moderator"
  ALTER COLUMN "permissions" TYPE smallint[]
  USING CASE
    WHEN "permissions" IS NULL THEN NULL
    ELSE "permissions"::smallint[]
  END;

ALTER TABLE "forum_moderator"
  ADD CONSTRAINT "forum_moderator_role_type_valid_chk"
  CHECK ("role_type" in (1, 2, 3));

ALTER TABLE "forum_moderator"
  ADD CONSTRAINT "forum_moderator_permissions_valid_chk"
  CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[]);

ALTER TABLE "forum_moderator_section"
  ALTER COLUMN "permissions" TYPE smallint[]
  USING CASE
    WHEN "permissions" IS NULL THEN NULL
    ELSE "permissions"::smallint[]
  END;

ALTER TABLE "forum_moderator_section"
  ADD CONSTRAINT "forum_moderator_section_permissions_valid_chk"
  CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[]);

ALTER TABLE "growth_audit_log"
  ALTER COLUMN "asset_type" TYPE smallint
  USING CASE "asset_type"
    WHEN '1' THEN 1
    WHEN '2' THEN 2
    WHEN '3' THEN 3
    WHEN 'POINTS' THEN 1
    WHEN 'EXPERIENCE' THEN 2
    WHEN 'BADGE' THEN 3
    ELSE NULL
  END;

ALTER TABLE "growth_audit_log"
  ADD CONSTRAINT "growth_audit_log_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2, 3));

ALTER TABLE "growth_rule_usage_slot"
  ALTER COLUMN "asset_type" TYPE smallint
  USING CASE "asset_type"
    WHEN '1' THEN 1
    WHEN '2' THEN 2
    WHEN 'POINTS' THEN 1
    WHEN 'EXPERIENCE' THEN 2
    ELSE NULL
  END;

ALTER TABLE "growth_rule_usage_slot"
  ALTER COLUMN "slot_type" TYPE smallint
  USING CASE "slot_type"
    WHEN 'DAILY' THEN 1
    WHEN 'TOTAL' THEN 2
    WHEN 'COOLDOWN' THEN 3
    ELSE NULL
  END;

ALTER TABLE "growth_rule_usage_slot"
  ADD CONSTRAINT "growth_rule_usage_slot_asset_type_valid_chk"
  CHECK ("asset_type" in (1, 2));

ALTER TABLE "growth_rule_usage_slot"
  ADD CONSTRAINT "growth_rule_usage_slot_slot_type_valid_chk"
  CHECK ("slot_type" in (1, 2, 3));

UPDATE "task"
SET "type" = CASE
  WHEN "type" = 3 THEN 2
  WHEN "type" = 5 THEN 4
  ELSE "type"
END
WHERE "type" in (3, 5);

ALTER TABLE "sys_request_log"
  ALTER COLUMN "api_type" TYPE smallint
  USING CASE
    WHEN "api_type" IS NULL THEN NULL
    WHEN "api_type" = 'admin' THEN 1
    WHEN "api_type" = 'app' THEN 2
    WHEN "api_type" = 'system' THEN 3
    WHEN "api_type" = 'public' THEN 4
    ELSE NULL
  END;

ALTER TABLE "sys_request_log"
  ALTER COLUMN "action_type" TYPE smallint
  USING CASE
    WHEN "action_type" IS NULL THEN NULL
    WHEN "action_type" = '1' THEN 1
    WHEN "action_type" = '2' THEN 2
    WHEN "action_type" = '3' THEN 3
    WHEN "action_type" = '4' THEN 4
    WHEN "action_type" = '5' THEN 5
    WHEN "action_type" = '6' THEN 6
    WHEN "action_type" = '7' THEN 7
    WHEN "action_type" = '8' THEN 8
    WHEN "action_type" = '9' THEN 9
    WHEN "action_type" = 'LOGIN' THEN 1
    WHEN "action_type" = 'LOGOUT' THEN 2
    WHEN "action_type" = 'CREATE' THEN 3
    WHEN "action_type" = 'TASK_CREATE' THEN 3
    WHEN "action_type" = 'UPDATE' THEN 4
    WHEN "action_type" = 'DELETE' THEN 5
    WHEN "action_type" = 'UPLOAD' THEN 6
    WHEN "action_type" = 'DOWNLOAD' THEN 7
    WHEN "action_type" = 'EXPORT' THEN 8
    WHEN "action_type" = 'IMPORT' THEN 9
    WHEN "action_type" = 'SEND_MESSAGE' THEN 3
    WHEN "action_type" = '用户登录' THEN 1
    WHEN "action_type" = '用户登出' THEN 2
    WHEN "action_type" = '创建数据' THEN 3
    WHEN "action_type" = '更新数据' THEN 4
    WHEN "action_type" = '删除数据' THEN 5
    WHEN "action_type" = '文件上传' THEN 6
    WHEN "action_type" = '文件下载' THEN 7
    WHEN "action_type" = '数据导出' THEN 8
    WHEN "action_type" = '数据导入' THEN 9
    ELSE NULL
  END;

ALTER TABLE "sys_request_log"
  ADD CONSTRAINT "sys_request_log_api_type_valid_chk"
  CHECK ("api_type" is null or "api_type" in (1, 2, 3, 4));

ALTER TABLE "sys_request_log"
  ADD CONSTRAINT "sys_request_log_action_type_valid_chk"
  CHECK ("action_type" is null or "action_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9));

COMMIT;
