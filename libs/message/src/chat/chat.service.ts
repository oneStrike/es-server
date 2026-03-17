import type {
  MarkConversationReadDto,
  OpenDirectConversationDto,
  QueryChatConversationListDto,
  QueryChatConversationMessagesDto,
  SendChatMessageDto,
} from './dto/chat.dto'
import { DrizzleService } from '@db/core'
import { appUser, chatConversation, chatConversationMember, chatMessage } from '@db/schema'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'
import { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import {
  CHAT_MESSAGE_PAGE_LIMIT_DEFAULT,
  CHAT_MESSAGE_PAGE_LIMIT_MAX,
  ChatConversationMemberRoleEnum,
  ChatMessageStatusEnum,
  ChatMessageTypeEnum,
} from './chat.constant'

/** 数字字符串正则表达式（模块作用域，避免重复编译） */
const DIGIT_STRING_REGEX = /^\d+$/

/**
 * 私聊聊天服务
 *
 * 负责处理用户间的私信对话功能，包括：
 * - 创建/打开私聊会话
 * - 获取会话列表
 * - 获取会话消息记录
 * - 发送消息（支持幂等性）
 * - 标记消息已读
 *
 * 核心设计要点：
 * 1. 使用 bizKey 实现私聊会话的唯一性（基于两个用户ID生成）
 * 2. 消息序列号(messageSeq)用于消息排序和游标分页
 * 3. clientMessageId 支持消息幂等性，防止重复发送
 * 4. 使用 PostgreSQL 咨询锁(pg_advisory_xact_lock)保证消息序列号的并发安全
 */
@Injectable()
export class MessageChatService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
    private readonly messageInboxService: MessageInboxService,
    private readonly messageWsMonitorService: MessageWsMonitorService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 打开或创建私聊会话
   *
   * 业务逻辑：
   * 1. 校验目标用户存在且未被封禁
   * 2. 基于双方用户ID生成唯一的 bizKey
   * 3. 使用事务原子性地执行：
   *    - upsert 会话记录（已存在则不创建新的）
   *    - upsert 发起者成员记录（如果是已退出的会话，重置 leftAt 为 null）
   *    - upsert 目标用户成员记录（如果是已退出的会话，重置 leftAt 为 null）
   *
   * @param userId - 发起者用户ID
   * @param dto - 包含目标用户ID的请求参数
   * @returns 会话详情，包含成员信息和未读数
   */
  async openDirectConversation(userId: number, dto: OpenDirectConversationDto) {
    const targetUserId = this.parsePositiveInteger(dto.targetUserId, 'targetUserId')
    if (targetUserId === userId) {
      throw new BadRequestException('Cannot create direct conversation with yourself')
    }
    const targetUser = await this.db.query.appUser.findFirst({
      where: {
        id: targetUserId,
        deletedAt: { isNull: true },
        isEnabled: true,
      },
      columns: { id: true },
    })
    if (!targetUser) {
      throw new NotFoundException('Target user not found')
    }
    const bizKey = this.buildDirectBizKey(userId, targetUserId)
    const conversation = await this.db.transaction(async (tx) => {
      const insertedConversation = await tx
        .insert(chatConversation)
        .values({ bizKey })
        .onConflictDoUpdate({
          target: chatConversation.bizKey,
          set: { bizKey },
        })
        .returning({ id: chatConversation.id })
      const item = insertedConversation[0]
      if (!item) {
        throw new NotFoundException('Conversation not found')
      }

      await tx
        .insert(chatConversationMember)
        .values({
          conversationId: item.id,
          userId,
          role: ChatConversationMemberRoleEnum.OWNER,
          leftAt: null,
        })
        .onConflictDoUpdate({
          target: [chatConversationMember.conversationId, chatConversationMember.userId],
          set: {
            leftAt: null,
            role: ChatConversationMemberRoleEnum.OWNER,
          },
        })

      await tx
        .insert(chatConversationMember)
        .values({
          conversationId: item.id,
          userId: targetUserId,
          role: ChatConversationMemberRoleEnum.MEMBER,
          leftAt: null,
        })
        .onConflictDoUpdate({
          target: [chatConversationMember.conversationId, chatConversationMember.userId],
          set: {
            leftAt: null,
            role: ChatConversationMemberRoleEnum.MEMBER,
          },
        })

      return item
    })
    return this.getConversationDetailForUser(conversation.id, userId)
  }

  /**
   * 获取用户的会话列表
   *
   * 查询逻辑：
   * 1. 查询用户作为成员且未退出的会话
   * 2. 按最后消息时间倒序排列（最新消息的会话在最前）
   * 3. 批量查询最后一条消息内容
   *
   * @param userId - 用户ID
   * @param dto - 分页查询参数
   * @returns 分页的会话列表
   */
  async getConversationList(userId: number, dto: QueryChatConversationListDto) {
    const { pageIndex, pageSize, skip } = this.normalizePagination(dto)
    const [totalRows, conversationRows] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(chatConversationMember)
        .where(and(
          eq(chatConversationMember.userId, userId),
          isNull(chatConversationMember.leftAt),
        )),
      this.db
        .select({
          id: chatConversation.id,
          bizKey: chatConversation.bizKey,
          lastMessageId: chatConversation.lastMessageId,
          lastMessageAt: chatConversation.lastMessageAt,
          lastSenderId: chatConversation.lastSenderId,
        })
        .from(chatConversation)
        .innerJoin(
          chatConversationMember,
          and(
            eq(chatConversationMember.conversationId, chatConversation.id),
            eq(chatConversationMember.userId, userId),
            isNull(chatConversationMember.leftAt),
          ),
        )
        .orderBy(sql`${chatConversation.lastMessageAt} desc nulls last`, desc(chatConversation.id))
        .offset(skip)
        .limit(pageSize),
    ])

    if (conversationRows.length === 0) {
      return {
        list: [],
        total: Number(totalRows[0]?.total ?? 0),
        pageIndex,
        pageSize,
      }
    }

    const conversationIds = conversationRows.map((item) => item.id)
    const [members, lastMessageMap] = await Promise.all([
      this.db
        .select({
          conversationId: chatConversationMember.conversationId,
          userId: chatConversationMember.userId,
          unreadCount: chatConversationMember.unreadCount,
          lastReadAt: chatConversationMember.lastReadAt,
          lastReadMessageId: chatConversationMember.lastReadMessageId,
          userProfileId: appUser.id,
          userNickname: appUser.nickname,
          userAvatar: appUser.avatarUrl,
        })
        .from(chatConversationMember)
        .innerJoin(appUser, eq(appUser.id, chatConversationMember.userId))
        .where(and(
          inArray(chatConversationMember.conversationId, conversationIds),
          isNull(chatConversationMember.leftAt),
        )),
      this.getMessageMapByIds(
        conversationRows
          .map((item) => item.lastMessageId)
          .filter((item): item is bigint => typeof item === 'bigint'),
      ),
    ])

    const memberMap = new Map<number, Array<{
      userId: number
      unreadCount: number
      lastReadAt: Date | null
      lastReadMessageId: bigint | null
      user: { id: number, nickname: string | null, avatar: string | null }
    }>>()
    for (const member of members) {
      const list = memberMap.get(member.conversationId) ?? []
      list.push({
        userId: member.userId,
        unreadCount: member.unreadCount,
        lastReadAt: member.lastReadAt,
        lastReadMessageId: member.lastReadMessageId,
        user: {
          id: member.userProfileId,
          nickname: member.userNickname,
          avatar: member.userAvatar,
        },
      })
      memberMap.set(member.conversationId, list)
    }

    return {
      list: conversationRows.map((item) =>
        this.toConversationOutput(
          {
            id: item.id,
            bizKey: item.bizKey,
            lastMessageId: item.lastMessageId,
            lastMessageAt: item.lastMessageAt,
            lastSenderId: item.lastSenderId,
            members: memberMap.get(item.id) ?? [],
          },
          userId,
          item.lastMessageId
            ? lastMessageMap.get(item.lastMessageId.toString())?.content
            : undefined,
        )),
      total: Number(totalRows[0]?.total ?? 0),
      pageIndex,
      pageSize,
    }
  }

  /**
   * 获取会话的消息记录
   *
   * 支持两种分页模式：
   * 1. cursor 模式：基于消息序列号向前翻页（查看历史消息）
   * 2. afterSeq 模式：获取指定序列号之后的新消息（用于实时拉取）
   *
   * 注意：两种模式互斥，不能同时使用
   *
   * @param userId - 用户ID
   * @param dto - 查询参数，包含会话ID、游标或序列号
   * @returns 消息列表及分页信息
   */
  async getConversationMessages(
    userId: number,
    dto: QueryChatConversationMessagesDto,
  ) {
    const conversationId = this.parsePositiveInteger(dto.conversationId, 'conversationId')
    const cursor = this.parseBigintCursor(dto.cursor, 'cursor')
    const afterSeq = this.parseBigintCursor(dto.afterSeq, 'afterSeq')
    const limit = this.normalizeMessageLimit(dto.limit)
    if (cursor !== undefined && afterSeq !== undefined) {
      throw new BadRequestException('cursor and afterSeq cannot be used together')
    }
    await this.ensureConversationMember(conversationId, userId)
    if (afterSeq !== undefined) {
      this.recordResyncTriggeredMetric()
      const messages = await this.db
        .select()
        .from(chatMessage)
        .where(and(
          eq(chatMessage.conversationId, conversationId),
          ne(chatMessage.status, ChatMessageStatusEnum.DELETED),
          gt(chatMessage.messageSeq, afterSeq),
        ))
        .orderBy(asc(chatMessage.messageSeq))
        .limit(limit)
      const list = messages.map((item) => this.toMessageOutput(item))
      this.recordResyncSuccessMetric()
      return {
        list,
        nextCursor: list?.length ? list.at(-1)?.messageSeq : null,
        hasMore: list.length >= limit,
      }
    }
    const where = and(
      eq(chatMessage.conversationId, conversationId),
      ne(chatMessage.status, ChatMessageStatusEnum.DELETED),
      cursor !== undefined ? lt(chatMessage.messageSeq, cursor) : undefined,
    )
    const messages = await this.db
      .select()
      .from(chatMessage)
      .where(where)
      .orderBy(desc(chatMessage.messageSeq))
      .limit(limit)
    const list = messages.map((item) => this.toMessageOutput(item))
    return {
      list,
      nextCursor: list.length ? list.at(-1)?.messageSeq : null,
      hasMore: list.length >= limit,
    }
  }

  /**
   * 发送消息
   *
   * 核心功能：
   * 1. 消息幂等性：通过 clientMessageId 防止重复发送
   * 2. 消息序列号生成：使用 PostgreSQL 咨询锁保证并发安全
   * 3. 实时通知：发送成功后推送 WebSocket 事件
   *
   * @param userId - 发送者用户ID
   * @param dto - 消息内容参数
   * @returns 消息ID、序列号等信息
   */
  async sendMessage(userId: number, dto: SendChatMessageDto) {
    const conversationId = this.parsePositiveInteger(dto.conversationId, 'conversationId')
    const messageType = this.parseMessageType(dto.messageType)
    const content = dto.content?.trim()
    if (!content) {
      throw new BadRequestException('Message content cannot be empty')
    }
    const clientMessageId = this.normalizeClientMessageId(dto.clientMessageId)

    // 解析并规范化消息载荷
    const messagePayload = this.parseJsonPayload(dto.payload)
    const normalizedPayload = this.attachClientMessageId(
      messagePayload,
      clientMessageId,
    )
    const result = await this.createMessageWithRetry(
      conversationId,
      userId,
      messageType,
      content,
      normalizedPayload,
      clientMessageId,
    )

    const message = this.toMessageOutput(result.message)
    if (result.isNew) {
      const conversationStates = result.memberStates.map((member) => ({
        userId: member.userId,
        unreadCount: member.unreadCount,
        lastReadAt: member.lastReadAt ?? undefined,
        lastReadMessageId:
          typeof member.lastReadMessageId === 'bigint'
            ? member.lastReadMessageId.toString()
            : undefined,
      }))
      await Promise.all(
        conversationStates.map(async (member) => {
          this.messageNotificationRealtimeService.emitChatConversationUpdate(
            member.userId,
            {
              conversationId,
              unreadCount: member.unreadCount,
              lastReadAt: member.lastReadAt,
              lastReadMessageId: member.lastReadMessageId,
              lastMessageId: message.id,
              lastMessageAt: message.createdAt,
              lastSenderId: message.senderId,
              lastMessageContent: message.content,
            },
          )
          this.messageNotificationRealtimeService.emitChatMessageNew(member.userId, {
            conversationId,
            message,
          })
          const summary = await this.messageInboxService.getSummary(member.userId)
          this.messageNotificationRealtimeService.emitInboxSummaryUpdate(
            member.userId,
            summary,
          )
        }),
      )
    }

    return {
      id: message.id,
      conversationId,
      messageId: message.id,
      messageSeq: message.messageSeq,
      createdAt: message.createdAt,
      deduplicated: !result.isNew,
    }
  }

  /**
   * 标记会话已读
   *
   * 业务逻辑：
   * 1. 在事务中完成所有数据库操作
   * 2. 支持已读位置回退保护（不会因为旧消息标记而减少已读范围）
   * 3. 重新计算未读消息数
   *
   * 已读位置回退保护：
   * - 如果用户之前已读的消息序列号比当前标记的更大，则保留之前的已读位置
   * - 这样可以防止用户标记旧消息时导致已读位置后退
   *
   * @param userId - 用户ID
   * @param dto - 包含会话ID和已读消息ID的参数
   * @returns 已读标记结果
   */
  async markConversationRead(userId: number, dto: MarkConversationReadDto) {
    const conversationId = this.parsePositiveInteger(dto.conversationId, 'conversationId')
    const messageId = this.parseBigintId(dto.messageId, 'messageId')
    const result = await this.db.transaction(async (tx) => {
      const member = await tx.query.chatConversationMember.findFirst({
        where: {
          conversationId,
          userId,
        },
        columns: {
          conversationId: true,
          leftAt: true,
          lastReadMessageId: true,
        },
      })
      if (!member || member.leftAt) {
        throw new NotFoundException('Conversation not found')
      }
      const targetMessage = await tx.query.chatMessage.findFirst({
        where: {
          id: messageId,
          conversationId,
        },
        columns: {
          id: true,
          messageSeq: true,
        },
      })
      if (!targetMessage) {
        throw new NotFoundException('Message not found')
      }
      let finalReadMessageId = targetMessage.id
      let finalReadMessageSeq = targetMessage.messageSeq
      if (typeof member.lastReadMessageId === 'bigint') {
        const previousReadMessage = await tx.query.chatMessage.findFirst({
          where: {
            id: member.lastReadMessageId,
            conversationId,
          },
          columns: {
            id: true,
            messageSeq: true,
          },
        })
        if (
          previousReadMessage
          && previousReadMessage.messageSeq > finalReadMessageSeq
        ) {
          finalReadMessageId = previousReadMessage.id
          finalReadMessageSeq = previousReadMessage.messageSeq
        }
      }
      const unreadCount = await tx.$count(
        chatMessage,
        and(
          eq(chatMessage.conversationId, conversationId),
          ne(chatMessage.senderId, userId),
          ne(chatMessage.status, ChatMessageStatusEnum.DELETED),
          gt(chatMessage.messageSeq, finalReadMessageSeq),
        ),
      )
      const now = new Date()
      const updateResult = await tx
        .update(chatConversationMember)
        .set({
          lastReadMessageId: finalReadMessageId,
          lastReadAt: now,
          unreadCount,
        })
        .where(and(
          eq(chatConversationMember.conversationId, conversationId),
          eq(chatConversationMember.userId, userId),
        ))
      this.drizzle.assertAffectedRows(updateResult, 'Conversation not found')

      return {
        now,
        unreadCount,
        lastReadMessageId: finalReadMessageId,
      }
    })
    this.messageNotificationRealtimeService.emitChatConversationUpdate(userId, {
      conversationId,
      unreadCount: result.unreadCount,
      lastReadAt: result.now,
      lastReadMessageId: result.lastReadMessageId.toString(),
    })
    const summary = await this.messageInboxService.getSummary(userId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdate(
      userId,
      summary,
    )

    return {
      conversationId,
      messageId: result.lastReadMessageId.toString(),
      readUptoMessageId: result.lastReadMessageId.toString(),
    }
  }

  /**
   * 创建消息（带重试机制）
   *
   * 核心设计：
   * 1. 使用 PostgreSQL 咨询锁（pg_advisory_xact_lock）保证消息序列号的并发安全
   * 2. 支持幂等性：通过 clientMessageId 检查是否已发送过相同消息
   * 3. 重试机制：处理并发时的唯一约束冲突（P2002错误）
   *
   * 并发控制说明：
   * - 咨询锁在事务级别生效，事务结束后自动释放
   * - 同一会话的消息创建会串行执行，避免序列号冲突
   *
   * @param conversationId - 会话ID
   * @param userId - 发送者ID
   * @param messageType - 消息类型
   * @param content - 消息内容
   * @param payload - 消息载荷
   * @param clientMessageId - 客户端消息ID（用于幂等）
   * @returns 消息信息、成员状态、是否为新消息
   */
  private async createMessageWithRetry(
    conversationId: number,
    userId: number,
    messageType: number,
    content: string,
    payload?: Record<string, unknown>,
    clientMessageId?: string,
  ) {
    let lastError: unknown
    const maxRetry = 3

    // 重试循环：处理并发冲突
    for (let index = 0; index < maxRetry; index += 1) {
      try {
        return await this.db.transaction(async (tx) => {
          const member = await tx.query.chatConversationMember.findFirst({
            where: {
              conversationId,
              userId,
            },
            columns: {
              conversationId: true,
              leftAt: true,
            },
          })
          if (!member || member.leftAt) {
            throw new NotFoundException('Conversation not found')
          }
          const conversation = await tx.query.chatConversation.findFirst({
            where: { id: conversationId },
            columns: { id: true },
          })
          if (!conversation) {
            throw new NotFoundException('Conversation not found')
          }
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${conversationId})`)
          if (clientMessageId) {
            const existedMessage = await tx.query.chatMessage.findFirst({
              where: {
                conversationId,
                senderId: userId,
                clientMessageId,
              },
            })
            if (existedMessage) {
              return {
                message: existedMessage,
                memberStates: [],
                isNew: false,
              }
            }
          }
          const lastMessage = await tx.query.chatMessage.findFirst({
            where: { conversationId },
            orderBy: { messageSeq: 'desc' },
            columns: { messageSeq: true },
          })
          const nextMessageSeq = (lastMessage?.messageSeq ?? 0n) + 1n
          const insertedMessage = await tx
            .insert(chatMessage)
            .values({
              conversationId,
              messageSeq: nextMessageSeq,
              senderId: userId,
              clientMessageId,
              messageType,
              content,
              payload,
              status: ChatMessageStatusEnum.NORMAL,
            })
            .returning()
          const message = insertedMessage[0]
          if (!message) {
            throw new NotFoundException('Message not found')
          }

          const updateConversationResult = await tx
            .update(chatConversation)
            .set({
              lastMessageId: message.id,
              lastMessageAt: message.createdAt,
              lastSenderId: userId,
            })
            .where(eq(chatConversation.id, conversationId))
          this.drizzle.assertAffectedRows(updateConversationResult, 'Conversation not found')

          await tx
            .update(chatConversationMember)
            .set({
              unreadCount: sql`${chatConversationMember.unreadCount} + 1`,
            })
            .where(and(
              eq(chatConversationMember.conversationId, conversationId),
              ne(chatConversationMember.userId, userId),
              isNull(chatConversationMember.leftAt),
            ))

          const memberStates = await tx.query.chatConversationMember.findMany({
            where: {
              conversationId,
              leftAt: { isNull: true },
            },
            columns: {
              userId: true,
              unreadCount: true,
              lastReadAt: true,
              lastReadMessageId: true,
            },
          })

          return {
            message,
            memberStates,
            isNew: true,
          }
        })
      } catch (error) {
        lastError = error

        if (!this.drizzle.isUniqueViolation(error)) {
          throw error
        }

        if (clientMessageId) {
          const existedMessage = await this.findMessageByClientMessageId(
            conversationId,
            userId,
            clientMessageId,
          )
          if (existedMessage) {
            return {
              message: existedMessage,
              memberStates: [],
              isNew: false,
            }
          }
        }
      }
    }
    throw lastError
  }

  /**
   * 根据 clientMessageId 查找消息
   *
   * 用于幂等性检查，通过唯一约束字段匹配 clientMessageId
   *
   * @param conversationId - 会话ID
   * @param userId - 发送者ID
   * @param clientMessageId - 客户端消息ID
   * @returns 找到的消息或 null
   */
  private async findMessageByClientMessageId(
    conversationId: number,
    userId: number,
    clientMessageId: string,
  ) {
    return this.db.query.chatMessage.findFirst({
      where: {
        conversationId,
        senderId: userId,
        clientMessageId,
      },
    })
  }

  /**
   * 确保用户是会话成员
   *
   * 权限校验方法，检查用户是否为会话成员且未退出
   *
   * @param conversationId - 会话ID
   * @param userId - 用户ID
   * @throws NotFoundException 如果用户不是会话成员或已退出
   */
  private async ensureConversationMember(conversationId: number, userId: number) {
    const member = await this.db.query.chatConversationMember.findFirst({
      where: {
        conversationId,
        userId,
      },
      columns: {
        id: true,
        leftAt: true,
      },
    })
    if (!member || member.leftAt) {
      throw new NotFoundException('Conversation not found')
    }
  }

  /**
   * 获取用户视角的会话详情
   *
   * 查询会话信息并构建输出格式，包含：
   * - 会话基本信息
   * - 成员信息（包括对端用户信息）
   * - 当前用户的未读数和已读位置
   *
   * @param conversationId - 会话ID
   * @param userId - 用户ID
   * @returns 会话详情
   */
  private async getConversationDetailForUser(conversationId: number, userId: number) {
    const conversationRows = await this.db
      .select({
        id: chatConversation.id,
        bizKey: chatConversation.bizKey,
        lastMessageId: chatConversation.lastMessageId,
        lastMessageAt: chatConversation.lastMessageAt,
        lastSenderId: chatConversation.lastSenderId,
      })
      .from(chatConversation)
      .innerJoin(
        chatConversationMember,
        and(
          eq(chatConversationMember.conversationId, chatConversation.id),
          eq(chatConversationMember.userId, userId),
          isNull(chatConversationMember.leftAt),
        ),
      )
      .where(eq(chatConversation.id, conversationId))
      .limit(1)
    const conversation = conversationRows[0]
    if (!conversation) {
      throw new NotFoundException('Conversation not found')
    }
    const members = await this.db
      .select({
        userId: chatConversationMember.userId,
        unreadCount: chatConversationMember.unreadCount,
        lastReadAt: chatConversationMember.lastReadAt,
        lastReadMessageId: chatConversationMember.lastReadMessageId,
        userProfileId: appUser.id,
        userNickname: appUser.nickname,
        userAvatar: appUser.avatarUrl,
      })
      .from(chatConversationMember)
      .innerJoin(appUser, eq(appUser.id, chatConversationMember.userId))
      .where(and(
        eq(chatConversationMember.conversationId, conversationId),
        isNull(chatConversationMember.leftAt),
      ))

    const lastMessage = conversation.lastMessageId
      ? await this.db.query.chatMessage.findFirst({
        where: { id: conversation.lastMessageId },
        columns: {
          content: true,
        },
      })
      : null

    return this.toConversationOutput(
      {
        ...conversation,
        members: members.map((member) => ({
          userId: member.userId,
          unreadCount: member.unreadCount,
          lastReadAt: member.lastReadAt,
          lastReadMessageId: member.lastReadMessageId,
          user: {
            id: member.userProfileId,
            nickname: member.userNickname,
            avatar: member.userAvatar,
          },
        })),
      },
      userId,
      lastMessage?.content,
    )
  }

  /**
   * 转换会话数据为输出格式
   *
   * 输出字段说明：
   * - id: 会话ID
   * - bizKey: 会话业务标识
   * - unreadCount: 当前用户的未读消息数
   * - lastMessageId/lastMessageAt/lastSenderId: 最后消息信息
   * - lastReadAt/lastReadMessageId: 当前用户的已读位置
   * - peerUser: 对端用户信息（私聊场景）
   *
   * @param conversation - 会话数据
   * @param conversation.id - 会话ID
   * @param conversation.bizKey - 会话业务标识
   * @param conversation.lastMessageId - 最后消息ID
   * @param conversation.lastMessageAt - 最后消息时间
   * @param conversation.lastSenderId - 最后发送者ID
   * @param conversation.members - 会话成员列表
   * @param userId - 当前用户ID
   * @param lastMessageContent - 最后消息内容
   * @returns 格式化的会话输出
   */
  private toConversationOutput(
    conversation: {
      id: number
      bizKey: string
      lastMessageId: bigint | null
      lastMessageAt: Date | null
      lastSenderId: number | null
      members: Array<{
        userId: number
        unreadCount: number
        lastReadAt: Date | null
        lastReadMessageId: bigint | null
        user: {
          id: number
          nickname: string | null
          avatar: string | null
        }
      }>
    },
    userId: number,
    lastMessageContent?: string,
  ) {
    // 找到当前用户的成员记录
    const selfMember = conversation.members.find((member) => member.userId === userId)
    if (!selfMember) {
      throw new NotFoundException('Conversation not found')
    }
    // 找到对端用户（私聊场景下只有一个对端）
    const peerMember = conversation.members.find((member) => member.userId !== userId)

    return {
      id: conversation.id,
      bizKey: conversation.bizKey,
      unreadCount: selfMember.unreadCount,
      // bigint 转换为字符串，避免前端精度丢失
      lastMessageId:
        typeof conversation.lastMessageId === 'bigint'
          ? conversation.lastMessageId.toString()
          : undefined,
      lastMessageAt: conversation.lastMessageAt ?? undefined,
      lastSenderId: conversation.lastSenderId ?? undefined,
      lastMessageContent,
      lastReadAt: selfMember.lastReadAt ?? undefined,
      lastReadMessageId:
        typeof selfMember.lastReadMessageId === 'bigint'
          ? selfMember.lastReadMessageId.toString()
          : undefined,
      // 对端用户信息
      peerUser: peerMember
        ? {
          id: peerMember.user.id,
          nickname: peerMember.user.nickname ?? undefined,
          avatar: peerMember.user.avatar ?? undefined,
        }
        : undefined,
    }
  }

  /**
   * 批量获取消息内容映射
   *
   * 用于会话列表中批量查询最后消息内容，避免 N+1 查询问题
   *
   * @param ids - 消息ID数组
   * @returns 消息ID -> 消息内容的映射
   */
  private async getMessageMapByIds(ids: bigint[]) {
    if (!ids.length) {
      return new Map<string, { id: bigint, content: string }>()
    }
    const rows = await this.db
      .select({
        id: chatMessage.id,
        content: chatMessage.content,
      })
      .from(chatMessage)
      .where(inArray(chatMessage.id, ids))

    return new Map(rows.map((item) => [item.id.toString(), item]))
  }

  /**
   * 转换消息数据为输出格式
   *
   * 主要处理 bigint 类型转换为字符串，避免前端精度丢失
   *
   * @param item - 消息数据
   * @returns 格式化的消息输出
   */
  private toMessageOutput(item: typeof chatMessage.$inferSelect) {
    return {
      id: item.id.toString(),
      conversationId: item.conversationId,
      messageSeq: item.messageSeq.toString(),
      senderId: item.senderId,
      clientMessageId: item.clientMessageId ?? undefined,
      messageType: item.messageType,
      content: item.content,
      payload: item.payload ?? undefined,
      createdAt: item.createdAt,
    }
  }

  /**
   * 构建私聊会话的业务标识
   *
   * 使用两个用户ID的最小值和最大值组合，确保双向一致性
   * 例如：用户1和用户2的会话，无论谁发起，bizKey 都是 "direct:1:2"
   *
   * @param userId - 用户ID
   * @param targetUserId - 目标用户ID
   * @returns 业务标识字符串
   */
  private buildDirectBizKey(userId: number, targetUserId: number) {
    const minUserId = Math.min(userId, targetUserId)
    const maxUserId = Math.max(userId, targetUserId)
    return `direct:${minUserId}:${maxUserId}`
  }

  /**
   * 标准化分页参数
   *
   * 处理逻辑：
   * 1. 页码转换：支持从1开始计数，也兼容从0开始
   * 2. 页大小限制：最小1，最大100
   * 3. 计算跳过记录数
   *
   * @param dto - 分页参数
   * @returns 标准化的分页参数
   */
  private normalizePagination(dto: QueryChatConversationListDto) {
    // 页码处理：支持从1开始或从0开始
    const rawPageIndex = Number.isFinite(Number(dto.pageIndex))
      ? Math.floor(Number(dto.pageIndex))
      : 0
    // 如果页码>=1，则保持原值；否则使用0或负数本身
    const pageIndex = rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)

    // 页大小处理：默认15，范围 [1, 100]
    const rawPageSize = Number.isFinite(Number(dto.pageSize))
      ? Math.floor(Number(dto.pageSize))
      : 15
    const pageSize = Math.min(Math.max(1, rawPageSize), 100)

    // 计算跳过记录数
    // 页码从1开始时：(pageIndex - 1) * pageSize
    // 页码从0开始时：pageIndex * pageSize
    const skip = pageIndex >= 1 ? (pageIndex - 1) * pageSize : pageIndex * pageSize

    return { pageIndex, pageSize, skip }
  }

  /**
   * 标准化消息查询数量限制
   *
   * @param limit - 原始限制值
   * @returns 标准化后的限制值
   */
  private normalizeMessageLimit(limit?: number) {
    const value = Number.isFinite(Number(limit))
      ? Math.floor(Number(limit))
      : CHAT_MESSAGE_PAGE_LIMIT_DEFAULT
    return Math.min(Math.max(1, value), CHAT_MESSAGE_PAGE_LIMIT_MAX)
  }

  /**
   * 解析并校验正整数参数
   *
   * @param value - 原始值
   * @param fieldName - 字段名（用于错误消息）
   * @returns 解析后的正整数
   * @throws BadRequestException 如果值不是正整数
   */
  private parsePositiveInteger(value: unknown, fieldName: string) {
    const normalized = Number(value)
    if (!Number.isInteger(normalized) || normalized <= 0) {
      throw new BadRequestException(`${fieldName} must be a positive integer`)
    }
    return normalized
  }

  /**
   * 解析并校验 BigInt ID
   *
   * 要求值为数字字符串格式（如 "123456789"）
   *
   * @param value - 原始值
   * @param fieldName - 字段名
   * @returns BigInt 值
   * @throws BadRequestException 如果值格式无效
   */
  private parseBigintId(value: unknown, fieldName: string) {
    if (typeof value !== 'string' || !DIGIT_STRING_REGEX.test(value.trim())) {
      throw new BadRequestException(`${fieldName} must be a valid integer string`)
    }
    return BigInt(value.trim())
  }

  /**
   * 解析游标参数
   *
   * 游标为可选参数，空值返回 undefined
   *
   * @param cursor - 游标字符串
   * @param fieldName - 字段名
   * @returns BigInt 游标值或 undefined
   */
  private parseBigintCursor(cursor: string | undefined, fieldName: string) {
    if (!cursor || !cursor.trim()) {
      return undefined
    }
    if (!DIGIT_STRING_REGEX.test(cursor.trim())) {
      throw new BadRequestException(`${fieldName} must be a valid integer string`)
    }
    return BigInt(cursor.trim())
  }

  /**
   * 解析 JSON 载荷
   *
   * @param payload - JSON 字符串
   * @returns 解析后的 JSON 对象或 undefined
   * @throws BadRequestException 如果 JSON 格式无效
   */
  private parseJsonPayload(payload?: string): Record<string, unknown> | undefined {
    if (!payload || !payload.trim()) {
      return undefined
    }
    try {
      const data = JSON.parse(payload) as unknown
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new BadRequestException('payload must be a JSON object')
      }
      return data as Record<string, unknown>
    } catch {
      throw new BadRequestException('payload must be valid JSON')
    }
  }

  /**
   * 解析并校验消息类型
   *
   * 支持的消息类型：TEXT(文本)、IMAGE(图片)、SYSTEM(系统消息)
   *
   * @param value - 原始值
   * @returns 消息类型枚举值
   * @throws BadRequestException 如果消息类型无效
   */
  private parseMessageType(value: unknown) {
    const messageType = Number(value)
    if (!Number.isInteger(messageType)) {
      throw new BadRequestException('messageType is invalid')
    }
    if (
      messageType !== ChatMessageTypeEnum.TEXT
      && messageType !== ChatMessageTypeEnum.IMAGE
      && messageType !== ChatMessageTypeEnum.SYSTEM
    ) {
      throw new BadRequestException('messageType is invalid')
    }
    return messageType
  }

  /**
   * 标准化客户端消息ID
   *
   * 校验规则：
   * - 必须是非空字符串
   * - 最大长度64个字符
   *
   * @param clientMessageId - 原始客户端消息ID
   * @returns 标准化后的ID或 undefined
   * @throws BadRequestException 如果格式无效
   */
  private normalizeClientMessageId(clientMessageId?: string) {
    if (clientMessageId === undefined) {
      return undefined
    }
    if (typeof clientMessageId !== 'string' || !clientMessageId.trim()) {
      throw new BadRequestException('clientMessageId must be a non-empty string')
    }
    const normalized = clientMessageId.trim()
    if (normalized.length > 64) {
      throw new BadRequestException('clientMessageId must be at most 64 characters')
    }
    return normalized
  }

  /**
   * 将 clientMessageId 附加到消息载荷中
   *
   * 如果载荷不存在，创建新的载荷对象
   * 如果载荷已存在，合并 clientMessageId 字段
   *
   * @param payload - 原始载荷
   * @param clientMessageId - 客户端消息ID
   * @returns 合并后的载荷
   * @throws BadRequestException 如果原始载荷不是 JSON 对象
   */
  private attachClientMessageId(
    payload: Record<string, unknown> | undefined,
    clientMessageId?: string,
  ): Record<string, unknown> | undefined {
    if (!clientMessageId) {
      return payload
    }
    if (payload === undefined) {
      return {
        clientMessageId,
      }
    }
    return {
      ...payload,
      clientMessageId,
    }
  }

  private recordResyncTriggeredMetric() {
    void this.messageWsMonitorService.recordResyncTriggered().catch(() => {})
  }

  private recordResyncSuccessMetric() {
    void this.messageWsMonitorService.recordResyncSuccess().catch(() => {})
  }
}
