import type {
  InboxLatestChatMessageQueryInput,
  InboxUserQueryInput,
  InboxUserTimeQueryInput,
} from './inbox.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import {
  and,
  eq,
  gt,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'

@Injectable()
export class MessageInboxSummaryQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 构建通知未读分类汇总查询。
  private buildNotificationUnreadSummaryQuery(
    params: InboxUserTimeQueryInput,
  ) {
    return this.drizzle.db
      .select({
        categoryKey: this.drizzle.schema.userNotification.categoryKey,
        count: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(this.drizzle.schema.userNotification)
      .where(
        and(
          eq(
            this.drizzle.schema.userNotification.receiverUserId,
            params.userId,
          ),
          eq(this.drizzle.schema.userNotification.isHidden, false),
          or(
            isNull(this.drizzle.schema.userNotification.expiresAt),
            gt(
              this.drizzle.schema.userNotification.expiresAt,
              params.now,
            ),
          ),
          eq(this.drizzle.schema.userNotification.isRead, false),
        ),
      )
      .groupBy(this.drizzle.schema.userNotification.categoryKey)
  }

  // 构建聊天未读总数查询。
  private buildChatUnreadAggregateQuery(params: InboxUserQueryInput) {
    return this.drizzle.db
      .select({
        unreadCount: sql<number>`coalesce(sum(${this.drizzle.schema.chatConversationMember.unreadCount}), 0)`.mapWith(Number),
      })
      .from(this.drizzle.schema.chatConversationMember)
      .where(
        and(
          eq(
            this.drizzle.schema.chatConversationMember.userId,
            params.userId,
          ),
          isNull(this.drizzle.schema.chatConversationMember.leftAt),
          isNull(this.drizzle.schema.chatConversationMember.hiddenAt),
        ),
      )
  }

  // 构建最新未过期通知查询。
  private buildLatestNotificationQuery(params: InboxUserTimeQueryInput) {
    return this.drizzle.db
      .select({
        id: this.drizzle.schema.userNotification.id,
        categoryKey: this.drizzle.schema.userNotification.categoryKey,
        title: this.drizzle.schema.userNotification.title,
        content: this.drizzle.schema.userNotification.content,
        createdAt: this.drizzle.schema.userNotification.createdAt,
        expiresAt: this.drizzle.schema.userNotification.expiresAt,
      })
      .from(this.drizzle.schema.userNotification)
      .where(
        and(
          eq(
            this.drizzle.schema.userNotification.receiverUserId,
            params.userId,
          ),
          eq(this.drizzle.schema.userNotification.isHidden, false),
          or(
            isNull(this.drizzle.schema.userNotification.expiresAt),
            gt(
              this.drizzle.schema.userNotification.expiresAt,
              params.now,
            ),
          ),
        ),
      )
      .orderBy(
        sql`${this.drizzle.schema.userNotification.createdAt} desc`,
        sql`${this.drizzle.schema.userNotification.id} desc`,
      )
      .limit(1)
  }

  // 构建最新活跃聊天会话查询。
  private buildLatestConversationQuery(params: InboxUserQueryInput) {
    return this.drizzle.db
      .select({
        id: this.drizzle.schema.chatConversation.id,
        lastMessageId: this.drizzle.schema.chatConversation.lastMessageId,
        lastMessageAt: this.drizzle.schema.chatConversation.lastMessageAt,
        lastSenderId: this.drizzle.schema.chatConversation.lastSenderId,
      })
      .from(this.drizzle.schema.chatConversation)
      .innerJoin(
        this.drizzle.schema.chatConversationMember,
        and(
          eq(
            this.drizzle.schema.chatConversationMember.conversationId,
            this.drizzle.schema.chatConversation.id,
          ),
          eq(
            this.drizzle.schema.chatConversationMember.userId,
            params.userId,
          ),
          isNull(this.drizzle.schema.chatConversationMember.leftAt),
          isNull(this.drizzle.schema.chatConversationMember.hiddenAt),
        ),
      )
      .where(isNotNull(this.drizzle.schema.chatConversation.lastMessageAt))
      .orderBy(
        sql`${this.drizzle.schema.chatConversation.lastMessageAt} desc`,
        sql`${this.drizzle.schema.chatConversation.id} desc`,
      )
      .limit(1)
  }

  // 构建最新聊天消息正文查询。
  private buildLatestChatMessageQuery(
    params: InboxLatestChatMessageQueryInput,
  ) {
    return this.drizzle.db.query.chatMessage
      .findFirst({
        where: {
          id: params.messageId,
        },
        columns: {
          content: true,
        },
      })
  }

  // 查询通知中心未读分类汇总。
  async getNotificationUnreadSummary(params: InboxUserTimeQueryInput) {
    return this.buildNotificationUnreadSummaryQuery(params)
  }

  // 查询当前用户所有活跃会话的聊天未读总数。
  async getChatUnreadAggregate(params: InboxUserQueryInput) {
    return this.buildChatUnreadAggregateQuery(params)
  }

  // 查询当前用户最新一条未过期通知。
  async getLatestNotification(params: InboxUserTimeQueryInput) {
    return this.buildLatestNotificationQuery(params)
  }

  // 查询当前用户最新一条活跃聊天会话。
  async getLatestConversation(params: InboxUserQueryInput) {
    return this.buildLatestConversationQuery(params)
  }

  // 查询最新聊天会话对应的最后消息正文。
  async getLatestChatMessage(params: InboxLatestChatMessageQueryInput) {
    return this.buildLatestChatMessageQuery(params)
  }
}
