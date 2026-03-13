import type { QueryInboxTimelineDto } from './dto/inbox.dto'
import { PlatformService } from '@libs/platform/database'
import { Injectable } from '@nestjs/common'

/**
 * 消息收件箱服务
 * 提供收件箱摘要和时间线功能
 */
@Injectable()
export class MessageInboxService extends PlatformService {
  /**
   * 获取用户收件箱摘要
   * 包含通知未读数、聊天未读数、最新通知和最新聊天
   */
  async getSummary(userId: number) {
    const [
      notificationUnreadCount,
      chatUnreadAgg,
      latestNotification,
      latestConversation,
    ] = await Promise.all([
      this.prisma.userNotification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
      this.prisma.chatConversationMember.aggregate({
        where: {
          userId,
          leftAt: null,
        },
        _sum: {
          unreadCount: true,
        },
      }),
      this.prisma.userNotification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          createdAt: true,
        },
      }),
      this.prisma.chatConversation.findFirst({
        where: {
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
          lastMessageAt: { not: null },
        },
        orderBy: [
          { lastMessageAt: 'desc' },
          { id: 'desc' },
        ],
        select: {
          id: true,
          lastMessageId: true,
          lastMessageAt: true,
          lastSenderId: true,
        },
      }),
    ])

    const chatUnreadCount = Number(chatUnreadAgg._sum.unreadCount ?? 0)
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

    if (latestConversation) {
      const lastMessage = latestConversation.lastMessageId
        ? await this.prisma.chatMessage.findUnique({
            where: { id: latestConversation.lastMessageId },
            select: {
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
    const { pageIndex, pageSize, offset } = this.normalizePagination(dto)
    const fetchTake = offset + pageSize + 20

    const [notificationTotal, conversationTotal, notifications, conversations] =
      await Promise.all([
        this.prisma.userNotification.count({
          where: {
            userId,
          },
        }),
        this.prisma.chatConversation.count({
          where: {
            members: {
              some: {
                userId,
                leftAt: null,
              },
            },
            lastMessageAt: { not: null },
          },
        }),
        this.prisma.userNotification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
          },
        }),
        this.prisma.chatConversation.findMany({
          where: {
            members: {
              some: {
                userId,
                leftAt: null,
              },
            },
            lastMessageAt: { not: null },
          },
          orderBy: [
            { lastMessageAt: 'desc' },
            { id: 'desc' },
          ],
          take: fetchTake,
          select: {
            id: true,
            lastMessageId: true,
            lastMessageAt: true,
          },
        }),
      ])

    const lastMessageIds = conversations
      .map((item) => item.lastMessageId)
      .filter((item): item is bigint => typeof item === 'bigint')

    const lastMessages = await this.prisma.chatMessage.findMany({
      where: {
        id: {
          in: lastMessageIds,
        },
      },
      select: {
        id: true,
        content: true,
      },
    })

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
      list: timeline.slice(offset, offset + pageSize),
      total: notificationTotal + conversationTotal,
      pageIndex,
      pageSize,
    }
  }

  /** 标准化分页参数 */
  private normalizePagination(dto: QueryInboxTimelineDto) {
    const rawPageIndex = Number.isFinite(Number(dto.pageIndex))
      ? Math.floor(Number(dto.pageIndex))
      : 0
    const pageIndex = rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)

    const rawPageSize = Number.isFinite(Number(dto.pageSize))
      ? Math.floor(Number(dto.pageSize))
      : 15
    const pageSize = Math.min(Math.max(1, rawPageSize), 100)
    const offset = pageIndex >= 1 ? (pageIndex - 1) * pageSize : pageIndex * pageSize

    return {
      pageIndex,
      pageSize,
      offset,
    }
  }
}
