import type { PageDto } from '@libs/platform/dto'
import type {
  InboxLatestChatSummary,
  InboxLatestNotificationRow,
  InboxRawRowsResult,
  InboxTimelineRawRow,
} from './inbox.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { buildNotificationUnreadSummary } from '../notification/notification-unread.type'
import {
  getMessageNotificationCategoryLabel,
  MessageNotificationCategoryKey,
} from '../notification/notification.constant'
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

  // 从原生 SQL 查询结果中提取 rows。
  private extractRows<T>(result: InboxRawRowsResult<T>) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: T[] | null }).rows
    return Array.isArray(rows) ? rows : []
  }

  // 构造当前用户未过期通知的基础可见条件。
  private buildNotificationWhere(userId: number, now: Date) {
    return and(
      eq(this.notification.receiverUserId, userId),
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
    return latestNotification &&
      (!latestNotification.expiresAt || latestNotification.expiresAt > now)
      ? {
          id: latestNotification.id,
          categoryKey: latestNotification.categoryKey,
          categoryLabel: getMessageNotificationCategoryLabel(
            latestNotification.categoryKey as MessageNotificationCategoryKey,
          ),
          title: latestNotification.title,
          content: latestNotification.content,
          createdAt: latestNotification.createdAt,
        }
      : undefined
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

    let latestChat: InboxLatestChatSummary | undefined

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
            : undefined,
        lastMessageAt: latestConversation.lastMessageAt ?? undefined,
        lastMessageContent: lastMessage?.content,
        lastSenderId: latestConversation.lastSenderId ?? undefined,
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

  // 查询消息中心 timeline，保留原生 SQL UNION 语义。
  async getTimeline(userId: number, dto: PageDto) {
    const page = this.drizzle.buildPage(dto, {
      maxPageSize: 100,
    })
    const now = new Date()

    const notificationWhere = this.buildNotificationWhere(userId, now)

    const [notificationTotal, conversationTotalRows, timelineResult] =
      await Promise.all([
        this.db.$count(this.notification, notificationWhere),
        this.db
          .select({
            total: sql<number>`count(distinct ${this.conversation.id})`,
          })
          .from(this.conversation)
          .innerJoin(
            this.conversationMember,
            and(
              eq(this.conversationMember.conversationId, this.conversation.id),
              eq(this.conversationMember.userId, userId),
              isNull(this.conversationMember.leftAt),
            ),
          )
          .where(isNotNull(this.conversation.lastMessageAt)),
        this.db.execute(sql`
          SELECT *
          FROM (
            SELECT
              'notification'::text AS "sourceType",
              n.created_at AS "createdAt",
              n.title AS "title",
              n.content AS "content",
              ('n:' || n.id::text) AS "bizId"
            FROM user_notification n
            WHERE n.receiver_user_id = ${userId}
              AND (n.expires_at IS NULL OR n.expires_at > ${now})

            UNION ALL

            SELECT
              'chat'::text AS "sourceType",
              c.last_message_at AS "createdAt",
              '新聊天消息'::text AS "title",
              COALESCE(m.content, '') AS "content",
              ('c:' || c.id::text) AS "bizId"
            FROM chat_conversation c
            INNER JOIN chat_conversation_member cm
              ON cm.conversation_id = c.id
             AND cm.user_id = ${userId}
             AND cm.left_at IS NULL
            LEFT JOIN chat_message m
              ON m.id = c.last_message_id
            WHERE c.last_message_at IS NOT NULL
          ) timeline
          ORDER BY "createdAt" DESC, "bizId" DESC
          LIMIT ${page.pageSize}
          OFFSET ${page.offset}
        `),
      ])

    const timeline = this.extractRows<InboxTimelineRawRow>(timelineResult).map(
      (item) => ({
        sourceType: item.sourceType,
        createdAt: item.createdAt,
        title: item.title,
        content: item.content ?? '',
        bizId: item.bizId,
      }),
    )

    return {
      list: timeline,
      total: notificationTotal + Number(conversationTotalRows[0]?.total ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
