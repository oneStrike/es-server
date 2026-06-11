import type {
  ChatConversationListCursor,
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
  placeholder,
  sql,
} from 'drizzle-orm'
import { CHAT_READABLE_MESSAGE_STATUSES } from './chat.constant'

@Injectable()
export class MessageChatReadQueryService {
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
    this.conversationMessagesInitialQuery =
      this.buildConversationMessagesInitialQuery()
    this.conversationMessagesBeforeQuery =
      this.buildConversationMessagesBeforeQuery()
    this.conversationMessagesAfterQuery =
      this.buildConversationMessagesAfterQuery()
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
          sql`${this.drizzle.schema.chatMessage.status} in (${sql.raw(
            CHAT_READABLE_MESSAGE_STATUSES.join(', '),
          )})`,
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
          sql`${this.drizzle.schema.chatMessage.status} in (${sql.raw(
            CHAT_READABLE_MESSAGE_STATUSES.join(', '),
          )})`,
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
          sql`${this.drizzle.schema.chatMessage.status} in (${sql.raw(
            CHAT_READABLE_MESSAGE_STATUSES.join(', '),
          )})`,
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
    const baseWhere = eq(this.drizzle.schema.chatConversation.hasMessages, true)
    const cursorWhere = this.buildConversationListCursorWhere(params.cursor)

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
          eq(this.drizzle.schema.chatConversationMember.userId, params.userId),
          isNull(this.drizzle.schema.chatConversationMember.leftAt),
          isNull(this.drizzle.schema.chatConversationMember.hiddenAt),
        ),
      )
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(
        desc(this.drizzle.schema.chatConversationMember.isPinned),
        sql`${this.drizzle.schema.chatConversation.lastMessageAt} desc nulls last`,
        desc(this.drizzle.schema.chatConversation.id),
      )
      .limit(params.limit)
  }

  // 查询会话最新一页消息。
  async getConversationMessages(params: ChatMessagePageQueryInput) {
    return this.conversationMessagesInitialQuery.execute(params)
  }

  // 查询会话游标之前的历史消息。
  async getConversationMessagesBefore(
    params: ChatMessageBeforeCursorQueryInput,
  ) {
    return this.conversationMessagesBeforeQuery.execute(params)
  }

  // 查询会话指定序号之后的增量消息。
  async getConversationMessagesAfter(params: ChatMessageAfterSeqQueryInput) {
    return this.conversationMessagesAfterQuery.execute(params)
  }

  private buildConversationListCursorWhere(
    cursor?: ChatConversationListCursor,
  ) {
    if (!cursor) {
      return undefined
    }

    const isPinned = this.drizzle.schema.chatConversationMember.isPinned
    const lastMessageAt = this.drizzle.schema.chatConversation.lastMessageAt
    const id = this.drizzle.schema.chatConversation.id

    if (cursor.lastMessageAt === null) {
      return sql`(${isPinned} < ${cursor.isPinned} OR (${isPinned} = ${cursor.isPinned} AND ${lastMessageAt} is null AND ${id} < ${cursor.id}))`
    }

    return sql`(${isPinned} < ${cursor.isPinned} OR (${isPinned} = ${cursor.isPinned} AND (${lastMessageAt} < ${cursor.lastMessageAt} OR ${lastMessageAt} is null OR (${lastMessageAt} = ${cursor.lastMessageAt} AND ${id} < ${cursor.id}))))`
  }
}
