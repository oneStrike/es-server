import type { Db } from './db-client'
import process from 'node:process'
import { ForumUserActionTargetTypeEnum } from '@libs/forum/action-log/action-log.constant'
import { ForumModeratorActionTargetTypeEnum } from '@libs/forum/moderator/moderator-action-log.constant'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CouponRedemptionTargetTypeEnum } from '@libs/interaction/coupon/coupon.constant'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { PurchaseTargetTypeEnum } from '@libs/interaction/purchase/purchase.constant'
import { ReportTargetTypeEnum } from '@libs/interaction/report/report.constant'
import { SceneTypeEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { createDbClient, disconnectDbClient, getDatabaseUrl } from './db-client'
import { seedAdminDomain } from './modules/admin/domain'
import { seedAppCoreDomain } from './modules/app/domain'
import {
  seedForumActivityDomain,
  seedForumReferenceDomain,
} from './modules/forum/domain'
import {
  seedSystemOperationalData,
  seedSystemReferenceData,
} from './modules/system/domain'

async function runSeeds() {
  console.log('🌱 开始初始化 Drizzle 种子数据...\n')

  const db = createDbClient(getDatabaseUrl())

  try {
    await resetPublicIdentitySequences(db)
    await cleanupRetiredDemoDomains(db)
    await resetPublicIdentitySequences(db)

    console.log('📦 第一阶段：全局参考数据\n')
    await seedSystemReferenceData(db)
    await seedAdminDomain(db)
    await seedAppCoreDomain(db)
    await seedForumReferenceDomain(db)
    console.log('\n✅ 全局参考数据初始化完成\n')

    console.log('📦 第二阶段：论坛主体与互动数据\n')
    await seedForumActivityDomain(db)
    console.log('\n✅ 论坛主体与互动数据初始化完成\n')

    console.log('📦 第三阶段：系统运行数据\n')
    await seedSystemOperationalData(db)
    console.log('\n✅ 系统运行数据初始化完成\n')

    console.log('🎉 所有 Drizzle 种子数据初始化完成！')
  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error)
    throw error
  } finally {
    await disconnectDbClient(db)
  }
}

async function resetPublicIdentitySequences(db: Db) {
  await db.execute(sql`
    DO $$
    DECLARE
      row_record record;
      seq_name text;
      max_id bigint;
    BEGIN
      FOR row_record IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE column_name = 'id'
          AND table_schema = 'public'
      LOOP
        seq_name := pg_get_serial_sequence(
          format('%I.%I', row_record.table_schema, row_record.table_name),
          'id'
        );
        IF seq_name IS NOT NULL THEN
          EXECUTE format(
            'SELECT COALESCE(MAX(id), 0) FROM %I.%I',
            row_record.table_schema,
            row_record.table_name
          ) INTO max_id;
          EXECUTE format(
            'SELECT setval(%L, %s, false)',
            seq_name,
            max_id + 1
          );
        END IF;
      END LOOP;
    END $$;
  `)
}

// 跨历史 seed/压测表批量清理，Drizzle query builder 会拆得很碎；这里统一使用参数化 sql 模板。
async function cleanupRetiredDemoDomains(db: Db) {
  console.log('🧹 清理退役作品、聊天与旧压测数据...')

  await cleanupLegacyForumResidue(db)
  await cleanupRetiredAppUserDomain(db)
  await cleanupRetiredWorkDomain(db)
  await cleanupRetiredChatDomain(db)

  console.log('  ✓ 退役演示域清理完成')
}

async function cleanupLegacyForumResidue(db: Db) {
  await db.execute(sql`
    WITH target_forum_sections AS (
      SELECT id
      FROM forum_section
      WHERE name LIKE 'codex_perf_%'
        OR name LIKE 'cp260524%'
        OR name LIKE 'cpri24%'
        OR id IN (
          SELECT forum_section_id
          FROM work
          WHERE forum_section_id IS NOT NULL
        )
    ),
    target_forum_topics AS (
      SELECT id
      FROM forum_topic
      WHERE title LIKE 'codex_perf_%'
        OR title LIKE 'cp260524%'
        OR title LIKE 'cpri24%'
        OR section_id IN (SELECT id FROM target_forum_sections)
    ),
    target_forum_comments AS (
      SELECT id
      FROM user_comment
      WHERE target_type = ${CommentTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
    ),
    deleted_hashtag_refs AS (
      DELETE FROM forum_hashtag_reference
      WHERE topic_id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_comment_likes AS (
      DELETE FROM user_like
      WHERE target_type = ${LikeTargetTypeEnum.COMMENT}
        AND target_id IN (SELECT id FROM target_forum_comments)
      RETURNING id
    ),
    deleted_topic_likes AS (
      DELETE FROM user_like
      WHERE target_type = ${LikeTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_topic_favorites AS (
      DELETE FROM user_favorite
      WHERE target_type = ${FavoriteTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_topic_browses AS (
      DELETE FROM user_browse_log
      WHERE target_type = ${BrowseLogTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_topic_reports AS (
      DELETE FROM user_report
      WHERE target_type = ${ReportTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_comment_reports AS (
      DELETE FROM user_report
      WHERE target_type = ${ReportTargetTypeEnum.COMMENT}
        AND target_id IN (SELECT id FROM target_forum_comments)
      RETURNING id
    ),
    deleted_user_logs AS (
      DELETE FROM forum_user_action_log
      WHERE (target_type = ${ForumUserActionTargetTypeEnum.TOPIC}
          AND target_id IN (SELECT id FROM target_forum_topics))
        OR (target_type = ${ForumUserActionTargetTypeEnum.COMMENT}
          AND target_id IN (SELECT id FROM target_forum_comments))
      RETURNING id
    ),
    deleted_moderator_logs AS (
      DELETE FROM forum_moderator_action_log
      WHERE (target_type = ${ForumModeratorActionTargetTypeEnum.TOPIC}
          AND target_id IN (SELECT id FROM target_forum_topics))
        OR (target_type = ${ForumModeratorActionTargetTypeEnum.COMMENT}
          AND target_id IN (SELECT id FROM target_forum_comments))
      RETURNING id
    ),
    deleted_comments AS (
      DELETE FROM user_comment
      WHERE id IN (SELECT id FROM target_forum_comments)
      RETURNING id
    ),
    deleted_topics AS (
      DELETE FROM forum_topic
      WHERE id IN (SELECT id FROM target_forum_topics)
      RETURNING id
    ),
    deleted_moderator_sections AS (
      DELETE FROM forum_moderator_section
      WHERE section_id IN (SELECT id FROM target_forum_sections)
      RETURNING section_id
    ),
    deleted_moderator_applications AS (
      DELETE FROM forum_moderator_application
      WHERE section_id IN (SELECT id FROM target_forum_sections)
      RETURNING section_id
    ),
    deleted_sections AS (
      DELETE FROM forum_section
      WHERE id IN (SELECT id FROM target_forum_sections)
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_topics) AS topic_count,
      (SELECT COUNT(*) FROM deleted_sections) AS section_count,
      (SELECT COUNT(*) FROM deleted_hashtag_refs) AS hashtag_ref_count
  `)
}

async function cleanupRetiredAppUserDomain(db: Db) {
  await db.execute(sql`DELETE FROM notification_delivery`)
  await db.execute(sql`DELETE FROM notification_preference`)
  await db.execute(sql`DELETE FROM user_notification`)

  await db.execute(sql`DELETE FROM user_mention`)
  await db.execute(sql`DELETE FROM forum_hashtag_reference`)
  await db.execute(sql`DELETE FROM forum_user_action_log`)
  await db.execute(sql`DELETE FROM forum_moderator_action_log`)
  await db.execute(sql`DELETE FROM forum_moderator_section`)
  await db.execute(sql`DELETE FROM forum_moderator_application`)
  await db.execute(sql`DELETE FROM forum_moderator`)

  await db.execute(sql`DELETE FROM user_like`)
  await db.execute(sql`DELETE FROM user_favorite`)
  await db.execute(sql`DELETE FROM user_browse_log`)
  await db.execute(sql`DELETE FROM user_report`)
  await db.execute(sql`DELETE FROM user_comment`)
  await db.execute(sql`DELETE FROM forum_topic`)

  await db.execute(sql`DELETE FROM forum_hashtag`)
  await db.execute(sql`
    UPDATE forum_section
    SET topic_count = 0,
        comment_count = 0,
        last_topic_id = NULL,
        last_post_at = NULL
  `)

  await db.execute(sql`DELETE FROM app_announcement_read`)
  await db.execute(sql`DELETE FROM app_agreement_log`)
  await db.execute(sql`DELETE FROM ad_reward_record`)
  await db.execute(sql`DELETE FROM app_user_token`)
  await db.execute(sql`DELETE FROM app_user_count`)
  await db.execute(sql`DELETE FROM emoji_recent_usage`)
  await db.execute(sql`DELETE FROM user_asset_balance`)
  await db.execute(sql`DELETE FROM user_coupon_instance`)
  await db.execute(sql`DELETE FROM user_badge_assignment`)
  await db.execute(sql`DELETE FROM user_membership_subscription`)
  await db.execute(sql`DELETE FROM user_follow`)
  await db.execute(sql`DELETE FROM user_download_record`)
  await db.execute(sql`DELETE FROM user_purchase_record`)
  await db.execute(sql`DELETE FROM user_content_entitlement`)
  await db.execute(sql`DELETE FROM coupon_redemption_record`)
  await db.execute(sql`DELETE FROM coupon_admin_grant_item`)
  await db.execute(sql`DELETE FROM payment_order`)
  await db.execute(sql`DELETE FROM user_work_reading_state`)

  await db.execute(sql`DELETE FROM check_in_streak_grant_reward_item`)
  await db.execute(sql`DELETE FROM check_in_streak_grant`)
  await db.execute(sql`DELETE FROM check_in_streak_progress`)
  await db.execute(sql`DELETE FROM check_in_makeup_fact`)
  await db.execute(sql`DELETE FROM check_in_makeup_account`)
  await db.execute(sql`DELETE FROM check_in_record`)

  await db.execute(sql`DELETE FROM growth_audit_log`)
  await db.execute(sql`DELETE FROM growth_ledger_record`)
  await db.execute(sql`DELETE FROM growth_reward_settlement`)
  await db.execute(sql`DELETE FROM growth_rule_usage_counter`)

  await db.execute(sql`DELETE FROM task_event_log`)
  await db.execute(sql`DELETE FROM task_instance_step`)
  await db.execute(sql`DELETE FROM task_step_unique_fact`)
  await db.execute(sql`DELETE FROM task_instance`)

  await db.execute(sql`DELETE FROM chat_conversation_member`)
  await db.execute(sql`DELETE FROM chat_message`)
  await db.execute(sql`DELETE FROM chat_conversation`)

  await db.execute(sql`DELETE FROM app_user`)

  console.log('  ✓ 已清理旧用户、互动、提及与论坛主题数据')
}

async function cleanupRetiredWorkDomain(db: Db) {
  await db.execute(sql`
    WITH target_work_ids AS (
      SELECT id FROM work
    ),
    target_chapter_ids AS (
      SELECT id FROM work_chapter
    ),
    target_work_comments AS (
      SELECT id
      FROM user_comment
      WHERE (target_type IN (
          ${CommentTargetTypeEnum.COMIC},
          ${CommentTargetTypeEnum.NOVEL}
        ) AND target_id IN (SELECT id FROM target_work_ids))
        OR (target_type IN (
          ${CommentTargetTypeEnum.COMIC_CHAPTER},
          ${CommentTargetTypeEnum.NOVEL_CHAPTER}
        ) AND target_id IN (SELECT id FROM target_chapter_ids))
    ),
    deleted_comment_likes AS (
      DELETE FROM user_like
      WHERE target_type = ${LikeTargetTypeEnum.COMMENT}
        AND target_id IN (SELECT id FROM target_work_comments)
      RETURNING id
    ),
    deleted_work_likes AS (
      DELETE FROM user_like
      WHERE target_type IN (
          ${LikeTargetTypeEnum.WORK_COMIC},
          ${LikeTargetTypeEnum.WORK_NOVEL},
          ${LikeTargetTypeEnum.WORK_COMIC_CHAPTER},
          ${LikeTargetTypeEnum.WORK_NOVEL_CHAPTER}
        )
        OR (target_type <> ${LikeTargetTypeEnum.COMMENT}
          AND scene_type IN (
          ${SceneTypeEnum.COMIC_WORK},
          ${SceneTypeEnum.NOVEL_WORK},
          ${SceneTypeEnum.COMIC_CHAPTER},
          ${SceneTypeEnum.NOVEL_CHAPTER}
        ))
      RETURNING id
    ),
    deleted_work_favorites AS (
      DELETE FROM user_favorite
      WHERE target_type IN (
        ${FavoriteTargetTypeEnum.WORK_COMIC},
        ${FavoriteTargetTypeEnum.WORK_NOVEL}
      )
      RETURNING id
    ),
    deleted_work_browses AS (
      DELETE FROM user_browse_log
      WHERE target_type IN (
        ${BrowseLogTargetTypeEnum.COMIC},
        ${BrowseLogTargetTypeEnum.NOVEL},
        ${BrowseLogTargetTypeEnum.COMIC_CHAPTER},
        ${BrowseLogTargetTypeEnum.NOVEL_CHAPTER}
      )
      RETURNING id
    ),
    deleted_work_reports AS (
      DELETE FROM user_report
      WHERE target_type IN (
          ${ReportTargetTypeEnum.COMIC},
          ${ReportTargetTypeEnum.NOVEL},
          ${ReportTargetTypeEnum.COMIC_CHAPTER},
          ${ReportTargetTypeEnum.NOVEL_CHAPTER}
        )
        OR (target_type = ${ReportTargetTypeEnum.COMMENT}
          AND target_id IN (SELECT id FROM target_work_comments))
      RETURNING id
    ),
    deleted_work_comments AS (
      DELETE FROM user_comment
      WHERE id IN (SELECT id FROM target_work_comments)
      RETURNING id
    ),
    deleted_purchase_records AS (
      DELETE FROM user_purchase_record
      WHERE target_type IN (
        ${PurchaseTargetTypeEnum.COMIC_CHAPTER},
        ${PurchaseTargetTypeEnum.NOVEL_CHAPTER}
      )
      RETURNING id
    ),
    deleted_download_records AS (
      DELETE FROM user_download_record
      WHERE target_type IN (
        ${DownloadTargetTypeEnum.COMIC_CHAPTER},
        ${DownloadTargetTypeEnum.NOVEL_CHAPTER}
      )
      RETURNING id
    ),
    deleted_entitlements AS (
      DELETE FROM user_content_entitlement
      WHERE target_type IN (
        ${PurchaseTargetTypeEnum.COMIC_CHAPTER},
        ${PurchaseTargetTypeEnum.NOVEL_CHAPTER}
      )
      RETURNING id
    ),
    deleted_coupon_redemptions AS (
      DELETE FROM coupon_redemption_record
      WHERE target_type IN (
        ${CouponRedemptionTargetTypeEnum.COMIC_CHAPTER},
        ${CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER}
      )
      RETURNING id
    ),
    deleted_reading_states AS (
      DELETE FROM user_work_reading_state
      WHERE work_id IN (SELECT id FROM target_work_ids)
        OR last_read_chapter_id IN (SELECT id FROM target_chapter_ids)
      RETURNING work_id
    ),
    deleted_import_residue AS (
      DELETE FROM content_import_residue
      RETURNING id
    ),
    deleted_import_attempts AS (
      DELETE FROM content_import_item_attempt
      RETURNING id
    ),
    deleted_import_items AS (
      DELETE FROM content_import_item
      RETURNING id
    ),
    deleted_import_preview_items AS (
      DELETE FROM content_import_preview_item
      RETURNING id
    ),
    deleted_import_jobs AS (
      DELETE FROM content_import_job
      RETURNING id
    ),
    deleted_third_party_chapters AS (
      DELETE FROM work_third_party_chapter_binding
      WHERE chapter_id IN (SELECT id FROM target_chapter_ids)
      RETURNING id
    ),
    deleted_third_party_sources AS (
      DELETE FROM work_third_party_source_binding
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING id
    ),
    deleted_author_relations AS (
      DELETE FROM work_author_relation
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING work_id
    ),
    deleted_category_relations AS (
      DELETE FROM work_category_relation
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING work_id
    ),
    deleted_tag_relations AS (
      DELETE FROM work_tag_relation
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING work_id
    ),
    deleted_work_comics AS (
      DELETE FROM work_comic
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING id
    ),
    deleted_work_novels AS (
      DELETE FROM work_novel
      WHERE work_id IN (SELECT id FROM target_work_ids)
      RETURNING id
    ),
    deleted_chapters AS (
      DELETE FROM work_chapter
      WHERE id IN (SELECT id FROM target_chapter_ids)
      RETURNING id
    ),
    deleted_works AS (
      DELETE FROM work
      WHERE id IN (SELECT id FROM target_work_ids)
      RETURNING id
    ),
    deleted_authors AS (
      DELETE FROM work_author
      RETURNING id
    ),
    deleted_categories AS (
      DELETE FROM work_category
      RETURNING id
    ),
    deleted_tags AS (
      DELETE FROM work_tag
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_works) AS work_count,
      (SELECT COUNT(*) FROM deleted_chapters) AS chapter_count,
      (SELECT COUNT(*) FROM deleted_work_comments) AS comment_count
  `)
}

async function cleanupRetiredChatDomain(db: Db) {
  await db.execute(sql`
    WITH deleted_members AS (
      DELETE FROM chat_conversation_member
      RETURNING conversation_id
    ),
    deleted_messages AS (
      DELETE FROM chat_message
      RETURNING id
    ),
    deleted_conversations AS (
      DELETE FROM chat_conversation
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_conversations) AS conversation_count,
      (SELECT COUNT(*) FROM deleted_messages) AS message_count,
      (SELECT COUNT(*) FROM deleted_members) AS member_count
  `)
}

runSeeds()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
