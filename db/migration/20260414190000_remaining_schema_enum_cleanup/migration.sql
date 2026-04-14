BEGIN;

ALTER TABLE "admin_user"
  ADD CONSTRAINT "admin_user_role_valid_chk"
  CHECK ("role" in (0, 1));

ALTER TABLE "admin_user_token"
  ALTER COLUMN "revoke_reason" TYPE smallint
  USING CASE
    WHEN "revoke_reason" IS NULL THEN NULL
    WHEN "revoke_reason" IN ('1', 'PASSWORD_CHANGE', 'password_change') THEN 1
    WHEN "revoke_reason" IN ('2', 'TOKEN_REFRESH', 'token_refresh') THEN 2
    WHEN "revoke_reason" IN ('3', 'USER_LOGOUT', 'user_logout') THEN 3
    WHEN "revoke_reason" IN ('4', 'ADMIN_REVOKE', 'admin_revoke') THEN 4
    WHEN "revoke_reason" IN ('5', 'SECURITY', 'security') THEN 5
    WHEN "revoke_reason" IN ('6', 'TOKEN_EXPIRED', 'token_expired') THEN 6
    ELSE NULL
  END;

ALTER TABLE "admin_user_token"
  ADD CONSTRAINT "admin_user_token_revoke_reason_valid_chk"
  CHECK ("revoke_reason" is null or "revoke_reason" in (1, 2, 3, 4, 5, 6));

ALTER TABLE "app_user_token"
  ALTER COLUMN "revoke_reason" TYPE smallint
  USING CASE
    WHEN "revoke_reason" IS NULL THEN NULL
    WHEN "revoke_reason" IN ('1', 'PASSWORD_CHANGE', 'password_change') THEN 1
    WHEN "revoke_reason" IN ('2', 'TOKEN_REFRESH', 'token_refresh') THEN 2
    WHEN "revoke_reason" IN ('3', 'USER_LOGOUT', 'user_logout') THEN 3
    WHEN "revoke_reason" IN ('4', 'ADMIN_REVOKE', 'admin_revoke') THEN 4
    WHEN "revoke_reason" IN ('5', 'SECURITY', 'security') THEN 5
    WHEN "revoke_reason" IN ('6', 'TOKEN_EXPIRED', 'token_expired') THEN 6
    ELSE NULL
  END;

ALTER TABLE "app_user_token"
  ADD CONSTRAINT "app_user_token_revoke_reason_valid_chk"
  CHECK ("revoke_reason" is null or "revoke_reason" in (1, 2, 3, 4, 5, 6));

ALTER TABLE "app_page"
  ALTER COLUMN "enable_platform" DROP DEFAULT;

ALTER TABLE "app_page"
  ALTER COLUMN "enable_platform" TYPE smallint[]
  USING CASE
    WHEN "enable_platform" IS NULL THEN NULL
    ELSE "enable_platform"::smallint[]
  END;

ALTER TABLE "app_page"
  ALTER COLUMN "enable_platform" SET DEFAULT ARRAY[1,2,3]::smallint[];

ALTER TABLE "app_page"
  ADD CONSTRAINT "app_page_access_level_valid_chk"
  CHECK ("access_level" in (0, 1, 2, 3));

ALTER TABLE "app_page"
  ADD CONSTRAINT "app_page_enable_platform_valid_chk"
  CHECK ("enable_platform" is null or "enable_platform" <@ ARRAY[1,2,3]::smallint[]);

UPDATE "check_in_plan"
SET "reward_definition" = jsonb_set(
  "reward_definition",
  '{patternRewardRules}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN item->>'patternType' IN ('1', 'WEEKDAY') THEN
          jsonb_set(item, '{patternType}', '1'::jsonb, false)
        WHEN item->>'patternType' IN ('2', 'MONTH_DAY') THEN
          jsonb_set(item, '{patternType}', '2'::jsonb, false)
        WHEN item->>'patternType' IN ('3', 'MONTH_LAST_DAY') THEN
          jsonb_set(item, '{patternType}', '3'::jsonb, false)
        ELSE item
      END
    )
    FROM jsonb_array_elements(COALESCE("reward_definition"->'patternRewardRules', '[]'::jsonb)) AS item
  ), '[]'::jsonb),
  true
)
WHERE jsonb_typeof("reward_definition") = 'object';

ALTER TABLE "forum_moderator_application"
  ALTER COLUMN "permissions" TYPE smallint[]
  USING CASE
    WHEN "permissions" IS NULL THEN NULL
    ELSE "permissions"::smallint[]
  END;

ALTER TABLE "forum_moderator_application"
  ADD CONSTRAINT "forum_moderator_application_status_valid_chk"
  CHECK ("status" in (0, 1, 2));

ALTER TABLE "forum_moderator_application"
  ADD CONSTRAINT "forum_moderator_application_permissions_valid_chk"
  CHECK ("permissions" is null or "permissions" <@ ARRAY[1,2,3,4,5,6]::smallint[]);

ALTER TABLE "growth_audit_log"
  ALTER COLUMN "action" TYPE smallint
  USING CASE
    WHEN "action" IN ('1', 'GRANT', 'grant') THEN 1
    WHEN "action" IN ('2', 'CONSUME', 'consume') THEN 2
    WHEN "action" IN ('3', 'APPLY_RULE', 'apply_rule') THEN 3
    WHEN "action" IN ('4', 'ASSIGN_BADGE', 'assign_badge') THEN 4
    ELSE NULL
  END;

ALTER TABLE "growth_audit_log"
  ALTER COLUMN "decision" TYPE smallint
  USING CASE
    WHEN "decision" IN ('1', 'allow', 'ALLOW') THEN 1
    WHEN "decision" IN ('2', 'deny', 'DENY') THEN 2
    ELSE NULL
  END;

ALTER TABLE "growth_audit_log"
  ADD CONSTRAINT "growth_audit_log_action_valid_chk"
  CHECK ("action" in (1, 2, 3, 4));

ALTER TABLE "growth_audit_log"
  ADD CONSTRAINT "growth_audit_log_decision_valid_chk"
  CHECK ("decision" in (1, 2));

ALTER TABLE "task"
  ADD CONSTRAINT "task_type_valid_chk"
  CHECK ("type" in (1, 2, 4));

ALTER TABLE "task"
  ADD CONSTRAINT "task_status_valid_chk"
  CHECK ("status" in (0, 1, 2));

ALTER TABLE "task"
  ADD CONSTRAINT "task_priority_non_negative_chk"
  CHECK ("priority" >= 0);

ALTER TABLE "task"
  ADD CONSTRAINT "task_claim_mode_valid_chk"
  CHECK ("claim_mode" in (1, 2));

ALTER TABLE "task"
  ADD CONSTRAINT "task_complete_mode_valid_chk"
  CHECK ("complete_mode" in (1, 2));

ALTER TABLE "task"
  ADD CONSTRAINT "task_objective_type_valid_chk"
  CHECK ("objective_type" in (1, 2));

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_status_valid_chk"
  CHECK ("status" in (0, 1, 2, 3));

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_reward_status_valid_chk"
  CHECK ("reward_status" in (0, 1, 2));

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_reward_result_type_valid_chk"
  CHECK ("reward_result_type" is null or "reward_result_type" in (1, 2, 3));

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_progress_non_negative_chk"
  CHECK ("progress" >= 0);

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_version_non_negative_chk"
  CHECK ("version" >= 0);

ALTER TABLE "task_progress_log"
  ADD CONSTRAINT "task_progress_log_action_type_valid_chk"
  CHECK ("action_type" in (1, 2, 3, 4));

ALTER TABLE "task_progress_log"
  ADD CONSTRAINT "task_progress_log_progress_source_valid_chk"
  CHECK ("progress_source" in (1, 2, 3));

COMMIT;
