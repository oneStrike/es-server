import type { PageDto } from '@libs/platform/dto/page.dto'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { buildNotificationUnreadSummary } from '../notification/notification-unread.type'
import {
  getMessageNotificationCategoryLabel,
  MessageNotificationCategoryKey,
} from '../notification/notification.constant'

export interface InboxLatestChatSummary {
  conversationId: number
  lastMessageId?: string
  lastMessageAt?: Date
  lastMessageContent?: string
  lastSenderId?: number
}

@Injectable()
export class MessageInboxService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notification() {
    return this.drizzle.schema.userNotification
  }

  private get conversation() {
    return this.drizzle.schema.chatConversation
  }

  private get conversationMember() {
    return this.drizzle.schema.chatConversationMember
  }

  private get chatMessage() {
    return this.drizzle.schema.chatMessage
  }

  private extractRows<T>(
    result: { rows?: T[] | null } | object | null | undefined,
  ) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: T[] | null }).rows
    return Array.isArray(rows) ? rows : []
  }

  private buildNotificationWhere(userId: number, now: Date) {
    return and(
      eq(this.notification.receiverUserId, userId),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
  }

  private buildLatestNotificationOutput(
    latestNotification?: {
      id: number
      categoryKey: string
      title: string
      content: string
      createdAt: Date
      expiresAt: Date | null
    },
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

  async getNotificationUnreadSummary(userId: number, now = new Date()) {
    const rows = await this.db
      .select({
        categoryKey: this.notification.categoryKey,
        count: sql<number>`count(*)::int`,
      })
      .from(this.notification)
      .where(
        and(
          this.buildNotificationWhere(userId, now),
          eq(this.notification.isRead, false),
        ),
      )
      .groupBy(this.notification.categoryKey)

    return buildNotificationUnreadSummary(rows)
  }

  async getNotificationSummary(userId: number) {
    const now = new Date()
    const notificationWhere = this.buildNotificationWhere(userId, now)
    const [notificationUnread, chatUnreadAgg, latestNotificationRows] =
      await Promise.all([
        this.getNotificationUnreadSummary(userId, now),
        this.db
          .select({
            unreadCount: sql<number>`coalesce(sum(${this.conversationMember.unreadCount}), 0)`,
          })
          .from(this.conversationMember)
          .where(
            and(
              eq(this.conversationMember.userId, userId),
              isNull(this.conversationMember.leftAt),
            ),
          ),
        this.db
          .select({
            id: this.notification.id,
            categoryKey: this.notification.categoryKey,
            title: this.notification.title,
            content: this.notification.content,
            createdAt: this.notification.createdAt,
            expiresAt: this.notification.expiresAt,
          })
          .from(this.notification)
          .where(notificationWhere)
          .orderBy(
            sql`${this.notification.createdAt} desc`,
            sql`${this.notification.id} desc`,
          )
          .limit(1),
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

  async getSummary(userId: number) {
    const now = new Date()
    const notificationWhere = this.buildNotificationWhere(userId, now)
    const [
      notificationUnread,
      chatUnreadAgg,
      latestNotificationRows,
      latestConversationRows,
    ] = await Promise.all([
      this.getNotificationUnreadSummary(userId, now),
      this.db
        .select({
          unreadCount: sql<number>`coalesce(sum(${this.conversationMember.unreadCount}), 0)`,
        })
        .from(this.conversationMember)
        .where(
          and(
            eq(this.conversationMember.userId, userId),
            isNull(this.conversationMember.leftAt),
          ),
        ),
      this.db
        .select({
          id: this.notification.id,
          categoryKey: this.notification.categoryKey,
          title: this.notification.title,
          content: this.notification.content,
          createdAt: this.notification.createdAt,
          expiresAt: this.notification.expiresAt,
        })
        .from(this.notification)
        .where(notificationWhere)
        .orderBy(
          sql`${this.notification.createdAt} desc`,
          sql`${this.notification.id} desc`,
        )
        .limit(1),
      this.db
        .select({
          id: this.conversation.id,
          lastMessageId: this.conversation.lastMessageId,
          lastMessageAt: this.conversation.lastMessageAt,
          lastSenderId: this.conversation.lastSenderId,
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
        .where(isNotNull(this.conversation.lastMessageAt))
        .orderBy(
          sql`${this.conversation.lastMessageAt} desc`,
          sql`${this.conversation.id} desc`,
        )
        .limit(1),
    ])

    const chatUnreadCount = Number(chatUnreadAgg[0]?.unreadCount ?? 0)
    const totalUnreadCount = notificationUnread.total + chatUnreadCount
    const latestNotification = latestNotificationRows[0]

    let latestChat: InboxLatestChatSummary | undefined

    const latestConversation = latestConversationRows[0]

    if (latestConversation) {
      const lastMessage = latestConversation.lastMessageId
        ? await this.db.query.chatMessage.findFirst({
            where: { id: latestConversation.lastMessageId },
            columns: {
              content: true,
            },
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

    const timeline = this.extractRows<{
      sourceType: 'notification' | 'chat'
      createdAt: Date
      title: string
      content: string | null
      bizId: string
    }>(timelineResult).map((item) => ({
      sourceType: item.sourceType,
      createdAt: item.createdAt,
      title: item.title,
      content: item.content ?? '',
      bizId: item.bizId,
    }))

    return {
      list: timeline,
      total: notificationTotal + Number(conversationTotalRows[0]?.total ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
