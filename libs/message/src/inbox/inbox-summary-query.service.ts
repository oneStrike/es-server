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
  placeholder,
  sql,
} from 'drizzle-orm'

@Injectable()
export class MessageInboxSummaryQueryService {
  private readonly notificationUnreadSummaryQuery: ReturnType<
    MessageInboxSummaryQueryService['buildNotificationUnreadSummaryQuery']
  >

  private readonly chatUnreadAggregateQuery: ReturnType<
    MessageInboxSummaryQueryService['buildChatUnreadAggregateQuery']
  >

  private readonly latestNotificationQuery: ReturnType<
    MessageInboxSummaryQueryService['buildLatestNotificationQuery']
  >

  private readonly latestConversationQuery: ReturnType<
    MessageInboxSummaryQueryService['buildLatestConversationQuery']
  >

  private readonly latestChatMessageQuery: ReturnType<
    MessageInboxSummaryQueryService['buildLatestChatMessageQuery']
  >

  constructor(private readonly drizzle: DrizzleService) {
    this.notificationUnreadSummaryQuery =
      this.buildNotificationUnreadSummaryQuery()
    this.chatUnreadAggregateQuery = this.buildChatUnreadAggregateQuery()
    this.latestNotificationQuery = this.buildLatestNotificationQuery()
    this.latestConversationQuery = this.buildLatestConversationQuery()
    this.latestChatMessageQuery = this.buildLatestChatMessageQuery()
  }

  // 构建通知未读分类汇总 prepared query。
  private buildNotificationUnreadSummaryQuery() {
    return this.drizzle.db
      .select({
        categoryKey: this.drizzle.schema.userNotification.categoryKey,
        count: sql<number>`count(*)::int`,
      })
      .from(this.drizzle.schema.userNotification)
      .where(
        and(
          eq(
            this.drizzle.schema.userNotification.receiverUserId,
            placeholder('userId'),
          ),
          or(
            isNull(this.drizzle.schema.userNotification.expiresAt),
            gt(
              this.drizzle.schema.userNotification.expiresAt,
              placeholder('now'),
            ),
          ),
          eq(this.drizzle.schema.userNotification.isRead, false),
        ),
      )
      .groupBy(this.drizzle.schema.userNotification.categoryKey)
      .prepare('message_inbox_notification_unread_summary')
  }

  // 构建聊天未读总数 prepared query。
  private buildChatUnreadAggregateQuery() {
    return this.drizzle.db
      .select({
        unreadCount: sql<number>`coalesce(sum(${this.drizzle.schema.chatConversationMember.unreadCount}), 0)`,
      })
      .from(this.drizzle.schema.chatConversationMember)
      .where(
        and(
          eq(
            this.drizzle.schema.chatConversationMember.userId,
            placeholder('userId'),
          ),
          isNull(this.drizzle.schema.chatConversationMember.leftAt),
        ),
      )
      .prepare('message_inbox_chat_unread_aggregate')
  }

  // 构建最新未过期通知 prepared query。
  private buildLatestNotificationQuery() {
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
            placeholder('userId'),
          ),
          or(
            isNull(this.drizzle.schema.userNotification.expiresAt),
            gt(
              this.drizzle.schema.userNotification.expiresAt,
              placeholder('now'),
            ),
          ),
        ),
      )
      .orderBy(
        sql`${this.drizzle.schema.userNotification.createdAt} desc`,
        sql`${this.drizzle.schema.userNotification.id} desc`,
      )
      .limit(1)
      .prepare('message_inbox_latest_notification')
  }

  // 构建最新活跃聊天会话 prepared query。
  private buildLatestConversationQuery() {
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
            placeholder('userId'),
          ),
          isNull(this.drizzle.schema.chatConversationMember.leftAt),
        ),
      )
      .where(isNotNull(this.drizzle.schema.chatConversation.lastMessageAt))
      .orderBy(
        sql`${this.drizzle.schema.chatConversation.lastMessageAt} desc`,
        sql`${this.drizzle.schema.chatConversation.id} desc`,
      )
      .limit(1)
      .prepare('message_inbox_latest_conversation')
  }

  // 构建最新聊天消息正文 prepared query。
  private buildLatestChatMessageQuery() {
    return this.drizzle.db.query.chatMessage
      .findFirst({
        where: {
          id: placeholder('messageId'),
        },
        columns: {
          content: true,
        },
      })
      .prepare('message_inbox_latest_chat_message')
  }

  // 查询通知中心未读分类汇总。
  async getNotificationUnreadSummary(params: InboxUserTimeQueryInput) {
    return this.notificationUnreadSummaryQuery.execute(params)
  }

  // 查询当前用户所有活跃会话的聊天未读总数。
  async getChatUnreadAggregate(params: InboxUserQueryInput) {
    return this.chatUnreadAggregateQuery.execute(params)
  }

  // 查询当前用户最新一条未过期通知。
  async getLatestNotification(params: InboxUserTimeQueryInput) {
    return this.latestNotificationQuery.execute(params)
  }

  // 查询当前用户最新一条活跃聊天会话。
  async getLatestConversation(params: InboxUserQueryInput) {
    return this.latestConversationQuery.execute(params)
  }

  // 查询最新聊天会话对应的最后消息正文。
  async getLatestChatMessage(params: InboxLatestChatMessageQueryInput) {
    return this.latestChatMessageQuery.execute(params)
  }
}
