import type { SQL } from 'drizzle-orm'
import type {
  ChatConversationListCountInput,
  ChatConversationListQueryInput,
  ChatMessageAfterSeqQueryInput,
  ChatMessageBeforeCursorQueryInput,
  ChatMessagePageQueryInput,
} from './chat-read-query.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  sql,
} from 'drizzle-orm'
import { CHAT_READABLE_MESSAGE_STATUSES } from './chat.constant'

@Injectable()
export class MessageChatReadQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 构建会话最新消息页查询。
  private buildConversationMessagesInitialQuery(
    params: ChatMessagePageQueryInput,
  ) {
    return this.drizzle.db
      .select(this.buildMessageOutputColumns())
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            params.conversationId,
          ),
          inArray(
            this.drizzle.schema.chatMessage.status,
            CHAT_READABLE_MESSAGE_STATUSES,
          ),
        ),
      )
      .orderBy(desc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(params.limit)
  }

  // 构建会话游标之前历史消息查询。
  private buildConversationMessagesBeforeQuery(
    params: ChatMessageBeforeCursorQueryInput,
  ) {
    return this.drizzle.db
      .select(this.buildMessageOutputColumns())
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            params.conversationId,
          ),
          inArray(
            this.drizzle.schema.chatMessage.status,
            CHAT_READABLE_MESSAGE_STATUSES,
          ),
          lt(this.drizzle.schema.chatMessage.messageSeq, params.cursor),
        ),
      )
      .orderBy(desc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(params.limit)
  }

  // 构建会话指定序号之后增量消息查询。
  private buildConversationMessagesAfterQuery(
    params: ChatMessageAfterSeqQueryInput,
  ) {
    return this.drizzle.db
      .select(this.buildMessageOutputColumns())
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            params.conversationId,
          ),
          inArray(
            this.drizzle.schema.chatMessage.status,
            CHAT_READABLE_MESSAGE_STATUSES,
          ),
          gt(this.drizzle.schema.chatMessage.messageSeq, params.afterSeq),
        ),
      )
      .orderBy(asc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(params.limit)
  }

  // 查询当前用户的会话列表页。
  async getConversationList(params: ChatConversationListQueryInput) {
    return this.drizzle.db
      .select({
        id: this.drizzle.schema.chatConversation.id,
        bizKey: this.drizzle.schema.chatConversation.bizKey,
        isPinned: this.drizzle.schema.chatConversationMember.isPinned,
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
        ),
      )
      .where(this.buildConversationListWhere(params))
      .orderBy(...params.orderBySql)
      .limit(params.limit)
      .offset(params.offset)
  }

  // 统计当前用户可见的会话列表总数。
  async countConversationList(params: ChatConversationListCountInput) {
    const [row] = await this.drizzle.db
      .select({
        total: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(this.drizzle.schema.chatConversation)
      .innerJoin(
        this.drizzle.schema.chatConversationMember,
        eq(
          this.drizzle.schema.chatConversationMember.conversationId,
          this.drizzle.schema.chatConversation.id,
        ),
      )
      .where(this.buildConversationListWhere(params))

    return Number(row?.total ?? 0)
  }

  // 查询会话最新一页消息。
  async getConversationMessages(params: ChatMessagePageQueryInput) {
    return this.buildConversationMessagesInitialQuery(params)
  }

  // 查询会话游标之前的历史消息。
  async getConversationMessagesBefore(
    params: ChatMessageBeforeCursorQueryInput,
  ) {
    return this.buildConversationMessagesBeforeQuery(params)
  }

  // 查询会话指定序号之后的增量消息。
  async getConversationMessagesAfter(params: ChatMessageAfterSeqQueryInput) {
    return this.buildConversationMessagesAfterQuery(params)
  }

  // 会话消息列表的稳定输出投影，避免历史分页读取撤回/审计等未参与响应的宽列。
  private buildMessageOutputColumns() {
    const { chatMessage } = this.drizzle.schema

    return {
      id: chatMessage.id,
      conversationId: chatMessage.conversationId,
      messageSeq: chatMessage.messageSeq,
      senderId: chatMessage.senderId,
      clientMessageId: chatMessage.clientMessageId,
      messageType: chatMessage.messageType,
      content: chatMessage.content,
      bodyTokens: chatMessage.bodyTokens,
      payload: chatMessage.payload,
      createdAt: chatMessage.createdAt,
    }
  }

  private buildConversationListWhere(params: ChatConversationListCountInput) {
    const conditions: SQL[] = [
      eq(this.drizzle.schema.chatConversation.hasMessages, true),
      eq(this.drizzle.schema.chatConversationMember.userId, params.userId),
      isNull(this.drizzle.schema.chatConversationMember.leftAt),
      isNull(this.drizzle.schema.chatConversationMember.hiddenAt),
    ]
    if (params.startDate) {
      conditions.push(
        gte(
          this.drizzle.schema.chatConversation.lastMessageAt,
          params.startDate,
        ),
      )
    }
    if (params.endDate) {
      conditions.push(
        lt(this.drizzle.schema.chatConversation.lastMessageAt, params.endDate),
      )
    }

    return and(...conditions)
  }
}
