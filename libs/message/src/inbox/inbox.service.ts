import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { QueryInboxTimelineDto } from './dto/inbox.dto'

/**
 * 消息收件箱服务
 * 提供收件箱摘要和时间线功能
 */
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

  /**
   * 获取用户收件箱摘要
   * 包含通知未读数、聊天未读数、最新通知和最新聊天
   */
  async getSummary(userId: number) {
    const [
      notificationUnreadCount,
      chatUnreadAgg,
      latestNotification,
      latestConversationRows,
    ] = await Promise.all([
      this.db.$count(this.notification, and(
        eq(this.notification.userId, userId),
        eq(this.notification.isRead, false),
      )),
      this.db
        .select({
          unreadCount: sql<number>`coalesce(sum(${this.conversationMember.unreadCount}), 0)`,
        })
        .from(this.conversationMember)
        .where(and(
          eq(this.conversationMember.userId, userId),
          isNull(this.conversationMember.leftAt),
        )),
      this.db.query.userNotification.findFirst({
        where: {
          userId,
        },
        orderBy: { createdAt: 'desc' },
        columns: {
          id: true,
          type: true,
          title: true,
          content: true,
          createdAt: true,
        },
      }),
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
        .orderBy(sql`${this.conversation.lastMessageAt} desc`, sql`${this.conversation.id} desc`)
        .limit(1),
    ])

    const chatUnreadCount = Number(chatUnreadAgg[0]?.unreadCount ?? 0)
    const totalUnreadCount = notificationUnreadCount + chatUnreadCount

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

    return {
      notificationUnreadCount,
      chatUnreadCount,
      totalUnreadCount,
      latestNotification: latestNotification ?? undefined,
      latestChat,
    }
  }

  /**
   * 获取用户收件箱时间线
   * 合并通知和聊天消息，按时间倒序排列
   */
  async getTimeline(userId: number, dto: QueryInboxTimelineDto) {
    const page = this.drizzle.buildPage(dto, {
      maxPageSize: 100,
    })
    const fetchTake = page.offset + page.pageSize + 20

    const [notificationTotal, conversationTotalRows, notifications, conversations] =
      await Promise.all([
        this.db.$count(this.notification, eq(this.notification.userId, userId)),
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
        this.db.query.userNotification.findMany({
          where: {
            userId,
          },
          orderBy: { createdAt: 'desc' },
          limit: fetchTake,
          columns: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
          },
        }),
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
          .orderBy(sql`${this.conversation.lastMessageAt} desc`, sql`${this.conversation.id} desc`)
          .limit(fetchTake),
      ])

    const lastMessageIds = conversations
      .map((item) => item.lastMessageId)
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
      lastMessages.map((item) => [item.id.toString(), item]),
    )

    const timeline = [
      ...notifications.map((item) => ({
        sourceType: 'notification' as const,
        createdAt: item.createdAt,
        title: item.title,
        content: item.content,
        bizId: `n:${item.id}`,
      })),
      ...conversations.map((item) => {
        const message =
          typeof item.lastMessageId === 'bigint'
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
