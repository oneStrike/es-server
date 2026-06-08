import type { SQL, SQLWrapper } from 'drizzle-orm'
import type {
  InboxLatestChatSummary,
  InboxLatestNotificationRow,
} from './inbox.type'
import { Buffer } from 'node:buffer'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { buildNotificationUnreadSummary } from '../notification/notification-unread.type'
import {
  getMessageNotificationCategoryLabel,
  MessageNotificationCategoryKey,
} from '../notification/notification.constant'
import { QueryInboxTimelineDto } from './dto/inbox.dto'
import { MessageInboxSummaryQueryService } from './inbox-summary-query.service'

interface InboxTimelineCursor {
  createdAt: Date
  bizId: string
}

interface InboxTimelineCandidate {
  sourceType: 'notification' | 'chat'
  createdAt: Date
  title: string
  content: string | null
  bizId: string
}

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

  // 查询消息中心 timeline。两侧各取有界候选后在服务层归并，避免深页跳页扫描。
  async getTimeline(userId: number, dto: QueryInboxTimelineDto) {
    this.rejectUnsupportedTimelineQuery(dto)
    const pageSize = this.normalizeTimelinePageSize(dto.pageSize)
    const now = new Date()
    const cursor = this.parseTimelineCursor(dto.cursor)
    const notificationWhere = this.buildNotificationWhere(userId, now)
    const candidateLimit = pageSize + 1
    const [notificationRows, chatRows] = await Promise.all([
      this.getNotificationTimelineCandidates(
        notificationWhere,
        cursor,
        candidateLimit,
      ),
      this.getChatTimelineCandidates(userId, cursor, candidateLimit),
    ])

    const mergedCandidates = [...notificationRows, ...chatRows]
      .flatMap((item): InboxTimelineCandidate[] =>
        item.createdAt
          ? [
              {
                sourceType: item.sourceType,
                createdAt: item.createdAt,
                title: item.title,
                content: item.content ?? '',
                bizId: item.bizId,
              },
            ]
          : [],
      )
      .sort((left, right) => this.compareTimelineCandidates(left, right))
    const pageItems = mergedCandidates.slice(0, pageSize)
    const hasMore = mergedCandidates.length > pageSize
    const nextCursor =
      hasMore && pageItems.length
        ? this.encodeTimelineCursor(pageItems[pageItems.length - 1])
        : null

    return {
      list: pageItems,
      hasMore,
      nextCursor,
      pageSize,
    }
  }

  private getNotificationTimelineCandidates(
    baseWhere: SQL | undefined,
    cursor: InboxTimelineCursor | undefined,
    limit: number,
  ) {
    const bizId = sql<string>`('n:' || ${this.notification.id}::text)`
    const cursorWhere = this.buildTimelineCursorWhere(
      this.notification.createdAt,
      bizId,
      cursor,
    )

    return this.db
      .select({
        sourceType: sql<'notification'>`'notification'::text`,
        createdAt: this.notification.createdAt,
        title: this.notification.title,
        content: this.notification.content,
        bizId,
      })
      .from(this.notification)
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(sql`${this.notification.createdAt} desc`, sql`${bizId} desc`)
      .limit(limit)
  }

  private getChatTimelineCandidates(
    userId: number,
    cursor: InboxTimelineCursor | undefined,
    limit: number,
  ) {
    const bizId = sql<string>`('c:' || ${this.conversation.id}::text)`
    const cursorWhere = this.buildTimelineCursorWhere(
      this.conversation.lastMessageAt,
      bizId,
      cursor,
    )

    return this.db
      .select({
        sourceType: sql<'chat'>`'chat'::text`,
        createdAt: this.conversation.lastMessageAt,
        title: sql<string>`'新聊天消息'::text`,
        content: sql<string>`COALESCE(${this.drizzle.schema.chatMessage.content}, '')`,
        bizId,
      })
      .from(this.conversation)
      .innerJoin(
        this.conversationMember,
        and(
          eq(this.conversationMember.conversationId, this.conversation.id),
          eq(this.conversationMember.userId, userId),
          isNull(this.conversationMember.leftAt),
          isNull(this.conversationMember.hiddenAt),
        ),
      )
      .leftJoin(
        this.drizzle.schema.chatMessage,
        eq(this.drizzle.schema.chatMessage.id, this.conversation.lastMessageId),
      )
      .where(
        cursorWhere
          ? and(isNotNull(this.conversation.lastMessageAt), cursorWhere)
          : isNotNull(this.conversation.lastMessageAt),
      )
      .orderBy(sql`${this.conversation.lastMessageAt} desc`, sql`${bizId} desc`)
      .limit(limit)
  }

  private buildTimelineCursorWhere(
    createdAtSql: SQLWrapper,
    bizIdSql: SQLWrapper,
    cursor?: InboxTimelineCursor,
  ): SQL | undefined {
    if (!cursor) {
      return undefined
    }

    return sql`(${createdAtSql} < ${cursor.createdAt} OR (${createdAtSql} = ${cursor.createdAt} AND ${bizIdSql} < ${cursor.bizId}))`
  }

  private compareTimelineCandidates(
    left: InboxTimelineCandidate,
    right: InboxTimelineCandidate,
  ) {
    const timeDiff = right.createdAt.getTime() - left.createdAt.getTime()
    return timeDiff || right.bizId.localeCompare(left.bizId)
  }

  private encodeTimelineCursor(
    item: Pick<InboxTimelineCandidate, 'bizId' | 'createdAt'>,
  ) {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toISOString(),
        bizId: item.bizId,
      }),
    ).toString('base64url')
  }

  private parseTimelineCursor(
    cursor?: string | null,
  ): InboxTimelineCursor | undefined {
    if (!cursor?.trim()) {
      return undefined
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      ) as { bizId?: unknown, createdAt?: unknown }
      const createdAt = new Date(String(parsed.createdAt))
      if (
        Number.isNaN(createdAt.getTime()) ||
        typeof parsed.bizId !== 'string' ||
        !/^[cn]:\d+$/.test(parsed.bizId)
      ) {
        throw new TypeError('invalid cursor payload')
      }

      return {
        createdAt,
        bizId: parsed.bizId,
      }
    } catch {
      throw new BadRequestException('消息时间线游标非法')
    }
  }

  private normalizeTimelinePageSize(pageSize?: number) {
    const parsed = Number(pageSize ?? 15)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 15
    }
    return Math.min(parsed, 100)
  }

  private rejectUnsupportedTimelineQuery(dto: QueryInboxTimelineDto) {
    const query = dto as Record<string, unknown>
    const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate']
      .filter((field) => query[field] !== undefined && query[field] !== null)

    if (unsupportedFields.length) {
      throw new BadRequestException(
        `消息时间线仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
      )
    }
  }
}
