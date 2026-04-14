import type { PageDto } from '@libs/platform/dto/page.dto'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { getMessageNotificationCategoryLabel, MessageNotificationCategoryKey } from '../notification/notification.constant'

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

  async getSummary(userId: number) {
    const now = new Date()
    const notificationWhere = and(
      eq(this.notification.receiverUserId, userId),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
    const [
      notificationUnreadCount,
      chatUnreadAgg,
      latestNotificationRows,
      latestConversationRows,
    ] = await Promise.all([
      this.db.$count(
        this.notification,
        and(notificationWhere, eq(this.notification.isRead, false)),
      ),
      this.db
        .select({
          unreadCount: sql<number>`coalesce(sum(${this.conversationMember.unreadCount}), 0)`,
        })
        .from(this.conversationMember)
        .where(and(
          eq(this.conversationMember.userId, userId),
          isNull(this.conversationMember.leftAt),
        )),
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
    const totalUnreadCount = notificationUnreadCount + chatUnreadCount
    const latestNotification = latestNotificationRows[0]

    let latestChat:
      | {
          conversationId: number
          lastMessageId?: string
          lastMessageAt?: Date
          lastMessageContent?: string
          lastSenderId?: number
        }
        | undefined

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

    const activeLatestNotification
      = latestNotification
        && (!latestNotification.expiresAt
          || latestNotification.expiresAt > now)
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

    return {
      notificationUnreadCount,
      chatUnreadCount,
      totalUnreadCount,
      latestNotification: activeLatestNotification,
      latestChat,
    }
  }

  async getTimeline(userId: number, dto: PageDto) {
    const page = this.drizzle.buildPage(dto, {
      maxPageSize: 100,
    })
    const fetchTake = page.offset + page.pageSize + 20
    const now = new Date()

    const notificationWhere = and(
      eq(this.notification.receiverUserId, userId),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )

    const [notificationTotal, conversationTotalRows, notifications, conversations]
      = await Promise.all([
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
          .limit(fetchTake),
        this.db
          .select({
            id: this.conversation.id,
            lastMessageId: this.conversation.lastMessageId,
            lastMessageAt: this.conversation.lastMessageAt,
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
          .limit(fetchTake),
      ])

    const lastMessageIds = conversations
      .map(item => item.lastMessageId)
      .filter((item): item is bigint => typeof item === 'bigint')

    const lastMessages = lastMessageIds.length
      ? await this.db.query.chatMessage.findMany({
          where: {
            id: {
              in: lastMessageIds,
            },
          },
          columns: {
            id: true,
            content: true,
          },
        })
      : []

    const lastMessageMap = new Map(
      lastMessages.map(item => [item.id.toString(), item]),
    )

    const timeline = [
      ...notifications
        .filter(item => !item.expiresAt || item.expiresAt > now)
        .map(item => ({
          sourceType: 'notification' as const,
          createdAt: item.createdAt,
          title: item.title,
          content: item.content,
          bizId: `n:${item.id}`,
          categoryKey: item.categoryKey,
          categoryLabel: getMessageNotificationCategoryLabel(
            item.categoryKey as MessageNotificationCategoryKey,
          ),
        })),
      ...conversations.map(item => {
        const message
          = typeof item.lastMessageId === 'bigint'
            ? lastMessageMap.get(item.lastMessageId.toString())
            : undefined

        return {
          sourceType: 'chat' as const,
          createdAt: item.lastMessageAt ?? new Date(0),
          title: '新聊天消息',
          content: message?.content ?? '',
          bizId: `c:${item.id}`,
        }
      }),
    ].sort((prev, next) => next.createdAt.getTime() - prev.createdAt.getTime())

    return {
      list: timeline.slice(
        page.offset,
        page.offset + page.pageSize,
      ),
      total: notificationTotal + Number(conversationTotalRows[0]?.total ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
