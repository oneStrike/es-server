import type { MessageNotificationCategoryKey } from '../notification/notification.type'
import type {
  InboxLatestChatSummary,
  InboxLatestNotificationRow,
  InboxTimelineCandidate,
} from './inbox.type'
import { DrizzleService, extractRows, toPageResult } from '@db/core'
import { PageDto } from '@libs/platform/dto'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { buildNotificationUnreadSummary } from '../notification/notification-unread.type'
import { getMessageNotificationCategoryLabel } from '../notification/notification.constant'
import { MessageInboxSummaryQueryService } from './inbox-summary-query.service'

@Injectable()
export class MessageInboxService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly summaryQueryService: MessageInboxSummaryQueryService,
  ) {}

  // 获取统一 Drizzle 数据库入口。
  private get db() {
    return this.drizzle.db
  }

  // 获取用户通知读模型表。
  private get notification() {
    return this.drizzle.schema.userNotification
  }

  // 获取聊天会话读模型表。
  private get conversation() {
    return this.drizzle.schema.chatConversation
  }

  // 获取聊天会话成员表。
  private get conversationMember() {
    return this.drizzle.schema.chatConversationMember
  }

  // 构造当前用户未过期通知的基础可见条件。
  private buildNotificationWhere(userId: number, now: Date) {
    return and(
      eq(this.notification.receiverUserId, userId),
      eq(this.notification.isHidden, false),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
  }

  // 将最新通知行裁剪为 inbox 对外摘要结构。
  private buildLatestNotificationOutput(
    latestNotification?: InboxLatestNotificationRow,
    now = new Date(),
  ) {
    if (
      !latestNotification ||
      (latestNotification.expiresAt && latestNotification.expiresAt <= now)
    ) {
      return null
    }

    return {
      id: latestNotification.id,
      categoryKey: latestNotification.categoryKey,
      categoryLabel: getMessageNotificationCategoryLabel(
        latestNotification.categoryKey as MessageNotificationCategoryKey,
      ),
      title: latestNotification.title,
      content: latestNotification.content ?? null,
      createdAt: latestNotification.createdAt,
    }
  }

  // 查询通知中心未读分类汇总。
  async getNotificationUnreadSummary(userId: number, now = new Date()) {
    const rows = await this.summaryQueryService.getNotificationUnreadSummary({
      userId,
      now,
    })

    return buildNotificationUnreadSummary(rows)
  }

  // 查询通知中心摘要，不包含最新聊天摘要。
  async getNotificationSummary(userId: number) {
    const now = new Date()
    const [notificationUnread, chatUnreadAgg, latestNotificationRows] =
      await Promise.all([
        this.getNotificationUnreadSummary(userId, now),
        this.summaryQueryService.getChatUnreadAggregate({ userId }),
        this.summaryQueryService.getLatestNotification({ userId, now }),
      ])

    const chatUnreadCount = Number(chatUnreadAgg[0]?.unreadCount ?? 0)

    return {
      notificationUnread,
      chatUnreadCount,
      totalUnreadCount: notificationUnread.total + chatUnreadCount,
      latestNotification: this.buildLatestNotificationOutput(
        latestNotificationRows[0],
        now,
      ),
    }
  }

  // 查询用户中心所需的未读摘要，不读取最新通知或最新会话。
  async getUnreadSummary(userId: number) {
    const now = new Date()
    const [notificationUnread, chatUnreadAgg] = await Promise.all([
      this.getNotificationUnreadSummary(userId, now),
      this.summaryQueryService.getChatUnreadAggregate({ userId }),
    ])

    const chatUnreadCount = Number(chatUnreadAgg[0]?.unreadCount ?? 0)

    return {
      notificationUnread,
      chatUnreadCount,
      totalUnreadCount: notificationUnread.total + chatUnreadCount,
    }
  }

  // 查询消息中心聚合摘要，包含通知和最新聊天。
  async getSummary(userId: number) {
    const now = new Date()
    const [
      notificationUnread,
      chatUnreadAgg,
      latestNotificationRows,
      latestConversationRows,
    ] = await Promise.all([
      this.getNotificationUnreadSummary(userId, now),
      this.summaryQueryService.getChatUnreadAggregate({ userId }),
      this.summaryQueryService.getLatestNotification({ userId, now }),
      this.summaryQueryService.getLatestConversation({ userId }),
    ])

    const chatUnreadCount = Number(chatUnreadAgg[0]?.unreadCount ?? 0)
    const totalUnreadCount = notificationUnread.total + chatUnreadCount
    const latestNotification = latestNotificationRows[0]

    let latestChat: InboxLatestChatSummary | null = null

    const latestConversation = latestConversationRows[0]

    if (latestConversation) {
      const lastMessage = latestConversation.lastMessageId
        ? await this.summaryQueryService.getLatestChatMessage({
            messageId: latestConversation.lastMessageId,
          })
        : null

      latestChat = {
        conversationId: latestConversation.id,
        lastMessageId:
          typeof latestConversation.lastMessageId === 'bigint'
            ? latestConversation.lastMessageId.toString()
            : null,
        lastMessageAt: latestConversation.lastMessageAt ?? null,
        lastMessageContent: lastMessage?.content ?? null,
        lastSenderId: latestConversation.lastSenderId ?? null,
      }
    }

    return {
      notificationUnread,
      chatUnreadCount,
      totalUnreadCount,
      latestNotification: this.buildLatestNotificationOutput(
        latestNotification,
        now,
      ),
      latestChat,
    }
  }

  // 查询消息中心 timeline。使用同一 union 查询完成排序、页深和总数语义。
  async getTimeline(userId: number, dto: PageDto) {
    const pageParams = this.drizzle.buildPageParams(dto, {
      defaultPageSize: 15,
      maxPageSize: 100,
      allowlistedOrderBy: {
        columns: {
          createdAt: sql.raw('"createdAt"'),
          bizId: sql.raw('"bizId"'),
          id: sql.raw('"bizId"'),
        },
        fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    })
    const now = new Date()
    const notificationStartDateFilter = pageParams.dateRange?.gte
      ? sql` AND un.created_at >= ${pageParams.dateRange.gte}`
      : sql.empty()
    const notificationEndDateFilter = pageParams.dateRange?.lt
      ? sql` AND un.created_at < ${pageParams.dateRange.lt}`
      : sql.empty()
    const chatStartDateFilter = pageParams.dateRange?.gte
      ? sql` AND cc.last_message_at >= ${pageParams.dateRange.gte}`
      : sql.empty()
    const chatEndDateFilter = pageParams.dateRange?.lt
      ? sql` AND cc.last_message_at < ${pageParams.dateRange.lt}`
      : sql.empty()

    const timelineSourceSql = sql`
      SELECT
        'notification'::text AS "sourceType",
        un.created_at AS "createdAt",
        un.title AS "title",
        un.content AS "content",
        ('n:' || un.id::text) AS "bizId"
      FROM user_notification un
      WHERE un.receiver_user_id = ${userId}
        AND un.is_hidden = false
        AND (un.expires_at IS NULL OR un.expires_at > ${now})
        ${notificationStartDateFilter}
        ${notificationEndDateFilter}
      UNION ALL
      SELECT
        'chat'::text AS "sourceType",
        cc.last_message_at AS "createdAt",
        '新聊天消息'::text AS "title",
        COALESCE(cm.content, '') AS "content",
        ('c:' || cc.id::text) AS "bizId"
      FROM chat_conversation cc
      INNER JOIN chat_conversation_member ccm
        ON ccm.conversation_id = cc.id
        AND ccm.user_id = ${userId}
        AND ccm.left_at IS NULL
        AND ccm.hidden_at IS NULL
      LEFT JOIN chat_message cm ON cm.id = cc.last_message_id
      WHERE cc.has_messages = true
        AND cc.last_message_at IS NOT NULL
        ${chatStartDateFilter}
        ${chatEndDateFilter}
    `
    const [rowsResult, totalResult] = await Promise.all([
      this.db.execute(sql`
        SELECT *
        FROM (${timelineSourceSql}) timeline
        ORDER BY ${pageParams.order.orderByClause}
        LIMIT ${pageParams.page.limit}
        OFFSET ${pageParams.page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM (${timelineSourceSql}) timeline
      `),
    ])
    const rows = extractRows<InboxTimelineCandidate>(rowsResult)
    const [totalRow] = extractRows<{
      total?: bigint | number | string | null
    }>(totalResult)

    return toPageResult(rows, Number(totalRow?.total ?? 0), pageParams.page)
  }
}
