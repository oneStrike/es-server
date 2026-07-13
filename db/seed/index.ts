import type { Db } from './db-client'
import type { DemoSeedRunOptions } from './seed.type'
import { acquireIntegrityLocks, jobIntegrityLock } from '@db/core'
import * as schema from '@db/schema'
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
import { assertSafeDemoSeedEnvironment } from '../runtime-guard'
import { createDbClient, disconnectDbClient } from './db-client'
import { acquirePublicSchemaMaintenanceTableLocks } from './maintenance-table-lock'
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

const DATABASE_INITIALIZATION_JOB_LOCK = 'reference-data-bootstrap'

/**
 * 在通过环境和连接身份校验后写入本地 demo 数据。
 */
export async function runDemoSeed(options: DemoSeedRunOptions) {
  const environment = assertSafeDemoSeedEnvironment(options.environment)
  console.log('🌱 开始初始化 Drizzle 种子数据...\n')

  const client = createDbClient(environment.databaseUrl)
  const { db } = client

  try {
    const sessionIdentity = await client.pool.query<{ database_name: string }>(
      'SELECT current_database() AS database_name',
    )
    if (sessionIdentity.rows[0]?.database_name !== environment.databaseName) {
      throw new Error('Demo seed connected to an unexpected database')
    }
    await db.transaction(async (tx) => {
      await acquireIntegrityLocks(tx, [
        jobIntegrityLock(DATABASE_INITIALIZATION_JOB_LOCK),
      ])

      // advisory job lock 只串行化 seed 任务；应用写入由下面的表锁隔离。
      await acquirePublicSchemaMaintenanceTableLocks(tx)

      await resetPublicIdentitySequences(tx)
      await cleanupRetiredDemoDomains(tx)
      await resetPublicIdentitySequences(tx)

      console.log('📦 第一阶段：全局参考数据\n')
      await seedSystemReferenceData(tx)
      await seedAdminDomain(tx)
      await seedAppCoreDomain(tx)
      await seedForumReferenceDomain(tx)
      console.log('\n✅ 全局参考数据初始化完成\n')

      console.log('📦 第二阶段：论坛主体与互动数据\n')
      await seedForumActivityDomain(tx)
      console.log('\n✅ 论坛主体与互动数据初始化完成\n')

      console.log('📦 第三阶段：系统运行数据\n')
      await seedSystemOperationalData(tx)
      console.log('\n✅ 系统运行数据初始化完成\n')
    })

    console.log('🎉 所有 Drizzle 种子数据初始化完成！')
  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error)
    throw error
  } finally {
    await disconnectDbClient(client)
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
            'ALTER SEQUENCE %s RESTART WITH %s',
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
        OR name IN ('斗破苍穹', '仙逆', '日语')
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
    deleted_comment_floor_counters AS (
      DELETE FROM user_comment_floor_counter
      WHERE target_type = ${CommentTargetTypeEnum.FORUM_TOPIC}
        AND target_id IN (SELECT id FROM target_forum_topics)
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
    ),
    deleted_empty_groups AS (
      DELETE FROM forum_section_group g
      WHERE g.name IN ('美图图集', '音乐音声')
        AND NOT EXISTS (
          SELECT 1
          FROM forum_section s
          WHERE s.group_id = g.id
        )
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_topics) AS topic_count,
      (SELECT COUNT(*) FROM deleted_sections) AS section_count,
      (SELECT COUNT(*) FROM deleted_empty_groups) AS group_count,
      (SELECT COUNT(*) FROM deleted_hashtag_refs) AS hashtag_ref_count,
      (SELECT COUNT(*) FROM deleted_comment_floor_counters)
        AS comment_floor_counter_count
  `)
}

async function cleanupRetiredAppUserDomain(db: Db) {
  await db.delete(schema.notificationDelivery)
  await db.delete(schema.notificationPreference)
  await db.delete(schema.userNotification)

  await db.delete(schema.userMention)
  await db.delete(schema.forumHashtagReference)
  await db.delete(schema.forumUserActionLog)
  await db.delete(schema.forumModeratorActionLog)
  await db.delete(schema.forumModeratorSection)
  await db.delete(schema.forumModeratorApplication)
  await db.delete(schema.forumModerator)

  await db.delete(schema.userLike)
  await db.delete(schema.userFavorite)
  await db.delete(schema.userBrowseLog)
  await db.delete(schema.userReport)
  await db.delete(schema.userCommentFloorCounter)
  await db.delete(schema.userComment)
  await db.delete(schema.forumTopic)

  await db.delete(schema.forumHashtag)
  await db.update(schema.forumSection).set({
    commentCount: 0,
    lastPostAt: null,
    lastTopicId: null,
    topicCount: 0,
  })

  await db.delete(schema.appAnnouncementRead)
  await db.delete(schema.appAgreementLog)
  await db.delete(schema.userContentEntitlement)
  await db.delete(schema.adRewardRecord)
  await db.delete(schema.appUserToken)
  await db.delete(schema.appUserCount)
  await db.delete(schema.emojiRecentUsage)
  await db.delete(schema.userAssetBalance)
  await db.delete(schema.userCouponInstance)
  await db.delete(schema.userBadgeAssignment)
  await db.delete(schema.userMembershipSubscription)
  await db.delete(schema.userFollow)
  await db.delete(schema.userDownloadRecord)
  await db.delete(schema.userPurchaseRecord)
  await db.delete(schema.couponRedemptionRecord)
  await db.delete(schema.couponAdminGrantItem)
  await db.delete(schema.paymentOrder)
  await db.delete(schema.userWorkReadingState)

  await db.delete(schema.checkInStreakGrantRewardItem)
  await db.delete(schema.checkInStreakGrant)
  await db.delete(schema.checkInStreakProgress)
  await db.delete(schema.checkInMakeupFact)
  await db.delete(schema.checkInMakeupAccount)
  await db.delete(schema.checkInRecord)

  await db.delete(schema.growthAuditLog)
  await db.delete(schema.growthLedgerRecord)
  await db.delete(schema.growthRewardSettlement)
  await db.delete(schema.growthRuleUsageCounter)

  await db.delete(schema.taskEventLog)
  await db.delete(schema.taskInstanceStep)
  await db.delete(schema.taskStepUniqueFact)
  await db.delete(schema.taskInstance)

  await db.delete(schema.chatConversationMember)
  await db.delete(schema.chatMessage)
  await db.delete(schema.chatConversation)

  await db.delete(schema.appUser)

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
    deleted_work_comment_floor_counters AS (
      DELETE FROM user_comment_floor_counter
      WHERE (
          target_type IN (
            ${CommentTargetTypeEnum.COMIC},
            ${CommentTargetTypeEnum.NOVEL}
          )
          AND target_id IN (SELECT id FROM target_work_ids)
        )
        OR (
          target_type IN (
            ${CommentTargetTypeEnum.COMIC_CHAPTER},
            ${CommentTargetTypeEnum.NOVEL_CHAPTER}
          )
          AND target_id IN (SELECT id FROM target_chapter_ids)
        )
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
