import type {
  QueryAdminChatConversationPageDto,
  QueryAdminChatMessagePageDto,
} from '@libs/message/monitor/dto/message-monitor.dto'
import type { SQL } from 'drizzle-orm'
import type { ChatUserSummary } from './message-chat-investigation.type'
import { DrizzleService, toPageResult } from '@db/core'

import { buildDateOnlyRangeInAppTimeZone, jsonParse } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from 'drizzle-orm'

@Injectable()
export class MessageChatInvestigationService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
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

  async getConversationPage(
    adminUserId: number,
    query: QueryAdminChatConversationPageDto,
  ) {
    const page = this.drizzle.buildPage(query, { maxPageSize: 100 })
    const conditions = this.buildConversationConditions(query)
    const whereClause = and(...conditions)
    const orderBySql = this.buildConversationOrderBy(query.orderBy)

    const [total, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`COUNT(*)::int`.mapWith(Number) })
        .from(this.conversation)
        .innerJoin(
          this.conversationMember,
          and(
            eq(this.conversationMember.conversationId, this.conversation.id),
            eq(this.conversationMember.userId, query.userId),
            isNull(this.conversationMember.leftAt),
          ),
        )
        .where(whereClause)
        .then((result) => Number(result[0]?.count ?? 0)),
      this.db
        .select({
          conversationId: this.conversation.id,
          lastMessageId: this.conversation.lastMessageId,
          lastMessageAt: this.conversation.lastMessageAt,
          lastSenderId: this.conversation.lastSenderId,
          userId: this.conversationMember.userId,
          isPinned: this.conversationMember.isPinned,
          hiddenAt: this.conversationMember.hiddenAt,
          unreadCount: this.conversationMember.unreadCount,
          lastReadMessageId: this.conversationMember.lastReadMessageId,
          lastReadAt: this.conversationMember.lastReadAt,
        })
        .from(this.conversation)
        .innerJoin(
          this.conversationMember,
          and(
            eq(this.conversationMember.conversationId, this.conversation.id),
            eq(this.conversationMember.userId, query.userId),
            isNull(this.conversationMember.leftAt),
          ),
        )
        .where(whereClause)
        .orderBy(...orderBySql)
        .limit(page.pageSize)
        .offset(page.offset),
    ])

    const conversationIds = rows.map((item) => item.conversationId)
    const memberRows = conversationIds.length
      ? await this.db
          .select({
            conversationId: this.conversationMember.conversationId,
            userId: this.conversationMember.userId,
          })
          .from(this.conversationMember)
          .where(
            inArray(this.conversationMember.conversationId, conversationIds),
          )
      : []
    const userIds = Array.from(
      new Set([
        ...rows.map((item) => item.userId),
        ...memberRows.map((item) => item.userId),
      ]),
    )
    const usersById = await this.getUserSummaryMap(userIds)
    const lastMessageIds = rows
      .map((item) => item.lastMessageId)
      .filter((value): value is bigint => typeof value === 'bigint')
    const lastMessagesById = await this.getMessagePreviewMap(lastMessageIds)
    const membersByConversationId = new Map<number, number[]>()
    for (const member of memberRows) {
      const members = membersByConversationId.get(member.conversationId) ?? []
      members.push(member.userId)
      membersByConversationId.set(member.conversationId, members)
    }

    return toPageResult(
      rows.map((item) => {
        const peerUserId =
          membersByConversationId
            .get(item.conversationId)
            ?.find((memberUserId) => memberUserId !== item.userId) ??
            query.peerUserId ??
            item.userId
        const lastMessagePreview =
          item.lastMessageId && lastMessagesById.get(item.lastMessageId)

        return {
          conversationId: item.conversationId,
          isPinned: item.isPinned,
          isHiddenForUser: item.hiddenAt !== null,
          hiddenAt: item.hiddenAt,
          unreadCount: item.unreadCount,
          lastReadMessageId: item.lastReadMessageId?.toString() ?? null,
          lastReadAt: item.lastReadAt,
          lastMessageId: item.lastMessageId?.toString() ?? null,
          lastMessageAt: item.lastMessageAt,
          lastSenderId: item.lastSenderId,
          lastMessagePreview: lastMessagePreview || null,
          user: this.getUserSummary(usersById, item.userId),
          peerUser: this.getUserSummary(usersById, peerUserId),
        }
      }),
      total,
      page,
    )
  }

  async getMessagePage(
    adminUserId: number,
    query: QueryAdminChatMessagePageDto,
  ) {
    const page = this.drizzle.buildPage(query, { maxPageSize: 100 })
    const conditions = this.buildMessageConditions(query)
    const whereClause = and(...conditions)
    const orderBySql = this.buildMessageOrderBy(query.orderBy)

    const [total, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`COUNT(*)::int`.mapWith(Number) })
        .from(this.chatMessage)
        .innerJoin(
          this.conversationMember,
          and(
            eq(
              this.conversationMember.conversationId,
              this.chatMessage.conversationId,
            ),
            eq(this.conversationMember.userId, query.userId),
            isNull(this.conversationMember.leftAt),
          ),
        )
        .where(whereClause)
        .then((result) => Number(result[0]?.count ?? 0)),
      this.db
        .select({
          id: this.chatMessage.id,
          conversationId: this.chatMessage.conversationId,
          messageSeq: this.chatMessage.messageSeq,
          senderId: this.chatMessage.senderId,
          messageType: this.chatMessage.messageType,
          content: this.chatMessage.content,
          hasBodyTokens: sql<boolean>`${this.chatMessage.bodyTokens} IS NOT NULL`,
          hasPayload: sql<boolean>`${this.chatMessage.payload} IS NOT NULL`,
          status: this.chatMessage.status,
          createdAt: this.chatMessage.createdAt,
        })
        .from(this.chatMessage)
        .innerJoin(
          this.conversationMember,
          and(
            eq(
              this.conversationMember.conversationId,
              this.chatMessage.conversationId,
            ),
            eq(this.conversationMember.userId, query.userId),
            isNull(this.conversationMember.leftAt),
          ),
        )
        .where(whereClause)
        .orderBy(...orderBySql)
        .limit(page.pageSize)
        .offset(page.offset),
    ])

    return toPageResult(
      rows.map((item) => ({
        messageId: item.id.toString(),
        conversationId: item.conversationId,
        messageSeq: item.messageSeq.toString(),
        senderId: item.senderId,
        messageType: item.messageType,
        status: item.status,
        contentPreview: this.sanitizeMessagePreview(item.content),
        hasPayload: item.hasPayload,
        hasBodyTokens: item.hasBodyTokens,
        createdAt: item.createdAt,
      })),
      total,
      page,
    )
  }

  private buildConversationConditions(
    query: QueryAdminChatConversationPageDto,
  ): SQL[] {
    const conditions: SQL[] = [
      eq(this.conversationMember.userId, query.userId),
      isNull(this.conversationMember.leftAt),
    ]
    if (query.conversationId !== undefined) {
      conditions.push(eq(this.conversation.id, query.conversationId))
    }
    if (query.unreadOnly === true) {
      conditions.push(gt(this.conversationMember.unreadCount, 0))
    }
    if (query.hiddenOnly === true) {
      conditions.push(isNotNull(this.conversationMember.hiddenAt))
    } else if (query.hiddenOnly === false) {
      conditions.push(isNull(this.conversationMember.hiddenAt))
    }
    if (query.peerUserId !== undefined) {
      conditions.push(
        sql`exists (
          select 1
          from chat_conversation_member peer_member
          where peer_member.conversation_id = ${this.conversation.id}
            and peer_member.user_id = ${query.peerUserId}
            and peer_member.left_at is null
        )`,
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.conversation.lastMessageAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.conversation.lastMessageAt, dateRange.lt))
    }
    return conditions
  }

  private buildMessageConditions(query: QueryAdminChatMessagePageDto): SQL[] {
    const conditions: SQL[] = [
      eq(this.chatMessage.conversationId, query.conversationId),
    ]
    if (query.senderUserId !== undefined) {
      conditions.push(eq(this.chatMessage.senderId, query.senderUserId))
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.chatMessage.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.chatMessage.createdAt, dateRange.lt))
    }
    return conditions
  }

  private buildConversationOrderBy(orderBy?: string) {
    const records = this.normalizeOrderByRecords(orderBy, {
      lastMessageAt: 'desc',
    })
    const columns = {
      lastMessageAt: this.conversation.lastMessageAt,
      id: this.conversation.id,
    } as const
    const orderBySql = records.map((record) => {
      const [field, direction] = Object.entries(record)[0] ?? []
      const column = columns[field as keyof typeof columns]
      if (!column) {
        throw new BadRequestException(`排序字段 "${field}" 不支持`)
      }
      return direction === 'asc' ? asc(column) : desc(column)
    })
    return records.some((record) => Object.hasOwn(record, 'id'))
      ? orderBySql
      : [...orderBySql, desc(this.conversation.id)]
  }

  private buildMessageOrderBy(orderBy?: string) {
    const records = this.normalizeOrderByRecords(orderBy, {
      messageSeq: 'desc',
    })
    const columns = {
      messageSeq: this.chatMessage.messageSeq,
      createdAt: this.chatMessage.createdAt,
    } as const
    const orderBySql = records.map((record) => {
      const [field, direction] = Object.entries(record)[0] ?? []
      const column = columns[field as keyof typeof columns]
      if (!column) {
        throw new BadRequestException(`排序字段 "${field}" 不支持`)
      }
      return direction === 'asc' ? asc(column) : desc(column)
    })
    return records.some((record) => Object.hasOwn(record, 'messageSeq'))
      ? orderBySql
      : [...orderBySql, desc(this.chatMessage.messageSeq)]
  }

  private normalizeOrderByRecords(
    orderBy: string | undefined,
    defaultRecord: Record<string, 'asc' | 'desc'>,
  ) {
    const normalized = orderBy?.trim()
    if (!normalized) {
      return [defaultRecord]
    }

    const parsed =
      normalized.startsWith('[') || normalized.startsWith('{')
        ? jsonParse<Record<string, string>[]>(normalized)
        : this.parseLegacyOrderBy(normalized)
    const records = Array.isArray(parsed) ? parsed : [parsed]
    return records.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new BadRequestException('orderBy 参数格式不合法')
      }
      const entries = Object.entries(record as Record<string, unknown>)
      if (entries.length !== 1) {
        throw new BadRequestException('orderBy 每项只能包含一个排序字段')
      }
      const [field, direction] = entries[0]
      if (direction !== 'asc' && direction !== 'desc') {
        throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
      }
      return { [field]: direction } as Record<string, 'asc' | 'desc'>
    })
  }

  private parseLegacyOrderBy(input: string): Record<string, 'asc' | 'desc'> {
    const [field, direction] = input.split(':')
    if (direction !== 'asc' && direction !== 'desc') {
      throw new BadRequestException('orderBy 仅支持 field:asc 或 field:desc')
    }
    return { [field]: direction }
  }

  private async getUserSummaryMap(userIds: number[]) {
    const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean)
    if (!uniqueUserIds.length) {
      return new Map<number, ChatUserSummary>()
    }
    const rows = await this.db
      .select({
        id: this.appUser.id,
        nickname: this.appUser.nickname,
        avatarUrl: this.appUser.avatarUrl,
      })
      .from(this.appUser)
      .where(inArray(this.appUser.id, uniqueUserIds))

    return new Map(
      rows.map((item) => [
        item.id,
        {
          userId: item.id,
          nickname: item.nickname,
          avatarUrl: item.avatarUrl,
        },
      ]),
    )
  }

  private getUserSummary(
    usersById: Map<number, ChatUserSummary>,
    userId: number,
  ): ChatUserSummary {
    return (
      usersById.get(userId) ?? {
        userId,
        nickname: null,
        avatarUrl: null,
      }
    )
  }

  private async getMessagePreviewMap(messageIds: bigint[]) {
    const uniqueIds = Array.from(new Set(messageIds))
    if (!uniqueIds.length) {
      return new Map<bigint, string>()
    }
    const rows = await this.db
      .select({
        id: this.chatMessage.id,
        content: this.chatMessage.content,
      })
      .from(this.chatMessage)
      .where(inArray(this.chatMessage.id, uniqueIds))

    return new Map(
      rows.map((item) => [item.id, this.sanitizeMessagePreview(item.content)]),
    )
  }

  private sanitizeMessagePreview(content: string) {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return ''
    }
    return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized
  }
}
