import type {
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
  isNull,
  lt,
  ne,
  placeholder,
  sql,
} from 'drizzle-orm'
import { ChatMessageStatusEnum } from './chat.constant'

@Injectable()
export class MessageChatReadQueryService {
  private readonly conversationListQuery: ReturnType<
    MessageChatReadQueryService['buildConversationListQuery']
  >

  private readonly conversationMessagesInitialQuery: ReturnType<
    MessageChatReadQueryService['buildConversationMessagesInitialQuery']
  >

  private readonly conversationMessagesBeforeQuery: ReturnType<
    MessageChatReadQueryService['buildConversationMessagesBeforeQuery']
  >

  private readonly conversationMessagesAfterQuery: ReturnType<
    MessageChatReadQueryService['buildConversationMessagesAfterQuery']
  >

  constructor(private readonly drizzle: DrizzleService) {
    this.conversationListQuery = this.buildConversationListQuery()
    this.conversationMessagesInitialQuery =
      this.buildConversationMessagesInitialQuery()
    this.conversationMessagesBeforeQuery =
      this.buildConversationMessagesBeforeQuery()
    this.conversationMessagesAfterQuery =
      this.buildConversationMessagesAfterQuery()
  }

  // 构建当前用户会话列表 prepared query。
  private buildConversationListQuery() {
    return this.drizzle.db
      .select({
        id: this.drizzle.schema.chatConversation.id,
        bizKey: this.drizzle.schema.chatConversation.bizKey,
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
      .orderBy(
        sql`${this.drizzle.schema.chatConversation.lastMessageAt} desc nulls last`,
        desc(this.drizzle.schema.chatConversation.id),
      )
      .offset(placeholder('offset'))
      .limit(placeholder('limit'))
      .prepare('message_chat_conversation_list')
  }

  // 构建会话最新消息页 prepared query。
  private buildConversationMessagesInitialQuery() {
    return this.drizzle.db
      .select()
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            placeholder('conversationId'),
          ),
          ne(
            this.drizzle.schema.chatMessage.status,
            ChatMessageStatusEnum.DELETED,
          ),
        ),
      )
      .orderBy(desc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(placeholder('limit'))
      .prepare('message_chat_messages_initial')
  }

  // 构建会话游标之前历史消息 prepared query。
  private buildConversationMessagesBeforeQuery() {
    return this.drizzle.db
      .select()
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            placeholder('conversationId'),
          ),
          ne(
            this.drizzle.schema.chatMessage.status,
            ChatMessageStatusEnum.DELETED,
          ),
          lt(this.drizzle.schema.chatMessage.messageSeq, placeholder('cursor')),
        ),
      )
      .orderBy(desc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(placeholder('limit'))
      .prepare('message_chat_messages_before')
  }

  // 构建会话指定序号之后增量消息 prepared query。
  private buildConversationMessagesAfterQuery() {
    return this.drizzle.db
      .select()
      .from(this.drizzle.schema.chatMessage)
      .where(
        and(
          eq(
            this.drizzle.schema.chatMessage.conversationId,
            placeholder('conversationId'),
          ),
          ne(
            this.drizzle.schema.chatMessage.status,
            ChatMessageStatusEnum.DELETED,
          ),
          gt(
            this.drizzle.schema.chatMessage.messageSeq,
            placeholder('afterSeq'),
          ),
        ),
      )
      .orderBy(asc(this.drizzle.schema.chatMessage.messageSeq))
      .limit(placeholder('limit'))
      .prepare('message_chat_messages_after')
  }

  // 查询当前用户的会话列表页。
  async getConversationList(params: ChatConversationListQueryInput) {
    return this.conversationListQuery.execute(params)
  }

  // 查询会话最新一页消息。
  async getConversationMessages(params: ChatMessagePageQueryInput) {
    return this.conversationMessagesInitialQuery.execute(params)
  }

  // 查询会话游标之前的历史消息。
  async getConversationMessagesBefore(params: ChatMessageBeforeCursorQueryInput) {
    return this.conversationMessagesBeforeQuery.execute(params)
  }

  // 查询会话指定序号之后的增量消息。
  async getConversationMessagesAfter(params: ChatMessageAfterSeqQueryInput) {
    return this.conversationMessagesAfterQuery.execute(params)
  }
}
