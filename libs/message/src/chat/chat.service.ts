import type { ChatMessage, Prisma } from '@libs/platform/database'
import type {
  MarkConversationReadDto,
  OpenDirectConversationDto,
  QueryChatConversationListDto,
  QueryChatConversationMessagesDto,
  SendChatMessageDto,
} from './dto/chat.dto'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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
export class MessageChatService extends PlatformService {
  constructor(
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
    private readonly messageInboxService: MessageInboxService,
    private readonly messageWsMonitorService: MessageWsMonitorService,
  ) {
    super()
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
    // 参数校验：确保目标用户ID为正整数
    const targetUserId = this.parsePositiveInteger(dto.targetUserId, 'targetUserId')

    // 业务规则：不允许与自己创建会话
    if (targetUserId === userId) {
      throw new BadRequestException('Cannot create direct conversation with yourself')
    }

    // 校验目标用户存在且状态正常
    const targetUser = await this.prisma.appUser.findFirst({
      where: {
        id: targetUserId,
        deletedAt: null, // 未被软删除
        isEnabled: true, // 账号状态正常
      },
      select: { id: true },
    })
    if (!targetUser) {
      throw new NotFoundException('Target user not found')
    }

    // 生成会话唯一标识：使用较小和较大的用户ID保证双向一致性
    // 例如：用户1和用户2的会话，无论谁发起，bizKey 都是 "direct:1:2"
    const bizKey = this.buildDirectBizKey(userId, targetUserId)

    // 事务：原子性地创建/更新会话及成员关系
    const conversation = await this.prisma.$transaction(async (tx) => {
      // upsert 会话：如果已存在则不做任何更新，否则创建新会话
      const item = await tx.chatConversation.upsert({
        where: { bizKey },
        update: {}, // 已存在时不更新任何字段
        create: { bizKey },
      })

      // upsert 发起者成员记录
      // 如果用户之前退出过会话（leftAt 不为 null），则重新加入（leftAt 置为 null）
      await tx.chatConversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: item.id,
            userId,
          },
        },
        update: {
          leftAt: null, // 重置退出时间，表示重新加入
          role: ChatConversationMemberRoleEnum.OWNER, // 发起者为会话所有者
        },
        create: {
          conversationId: item.id,
          userId,
          role: ChatConversationMemberRoleEnum.OWNER,
        },
      })

      // upsert 目标用户成员记录
      await tx.chatConversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: item.id,
            userId: targetUserId,
          },
        },
        update: {
          leftAt: null, // 重置退出时间
          role: ChatConversationMemberRoleEnum.MEMBER, // 目标用户为普通成员
        },
        create: {
          conversationId: item.id,
          userId: targetUserId,
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
    // 标准化分页参数
    const { pageIndex, pageSize, skip } = this.normalizePagination(dto)

    // 查询条件：用户是会话成员且未退出
    const where: Prisma.ChatConversationWhereInput = {
      members: {
        some: {
          userId,
          leftAt: null, // 未退出的会话
        },
      },
    }

    // 并行查询总数和列表数据
    const [total, conversations] = await Promise.all([
      this.prisma.chatConversation.count({ where }),
      this.prisma.chatConversation.findMany({
        where,
        orderBy: [
          { lastMessageAt: 'desc' }, // 按最后消息时间倒序
          { id: 'desc' }, // 时间相同时按ID倒序
        ],
        skip,
        take: pageSize,
        include: {
          members: {
            where: { leftAt: null }, // 只包含未退出的成员
            select: {
              userId: true,
              unreadCount: true,
              lastReadAt: true,
              lastReadMessageId: true,
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
    ])

    // 提取所有最后消息ID，过滤掉无效值
    const lastMessageIds = conversations
      .map((item) => item.lastMessageId)
      .filter((item): item is bigint => typeof item === 'bigint')

    // 批量查询最后消息内容（避免N+1查询问题）
    const lastMessageMap = await this.getMessageMapByIds(lastMessageIds)

    return {
      list: conversations.map((item) =>
        this.toConversationOutput(
          item,
          userId,
          item.lastMessageId
            ? lastMessageMap.get(item.lastMessageId.toString())?.content
            : undefined,
        ),
      ),
      total,
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
    // 参数解析和校验
    const conversationId = this.parsePositiveInteger(dto.conversationId, 'conversationId')
    const cursor = this.parseBigintCursor(dto.cursor, 'cursor')
    const afterSeq = this.parseBigintCursor(dto.afterSeq, 'afterSeq')
    const limit = this.normalizeMessageLimit(dto.limit)

    // 互斥校验：cursor 和 afterSeq 不能同时使用
    if (cursor !== undefined && afterSeq !== undefined) {
      throw new BadRequestException('cursor and afterSeq cannot be used together')
    }

    // 权限校验：确保用户是会话成员
    await this.ensureConversationMember(conversationId, userId)

    // afterSeq 模式：获取指定序列号之后的新消息（用于实时拉取）
    if (afterSeq !== undefined) {
      this.recordResyncTriggeredMetric()
      const messages = await this.prisma.chatMessage.findMany({
        where: {
          conversationId,
          status: {
            not: ChatMessageStatusEnum.DELETED, // 排除已删除的消息
          },
          messageSeq: {
            gt: afterSeq, // 序列号大于指定值
          },
        },
        orderBy: { messageSeq: 'asc' }, // 按序列号升序
        take: limit,
      })

      const list = messages.map((item) => this.toMessageOutput(item))
      this.recordResyncSuccessMetric()
      return {
        list,
        // 返回最后一条消息的序列号作为下次拉取的起点
        nextCursor: list?.length ? list.at(-1)?.messageSeq : null,
        hasMore: list.length >= limit,
      }
    }

    // cursor 模式：向前翻页查看历史消息
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        status: {
          not: ChatMessageStatusEnum.DELETED,
        },
        // 如果有游标，则查询序列号小于游标的消息
        ...(cursor !== undefined ? { messageSeq: { lt: cursor } } : {}),
      },
        orderBy: { messageSeq: 'desc' }, // 按序列号倒序
      take: limit,
    })

    const list = messages.map((item) => this.toMessageOutput(item))
    return {
      list,
      // 返回最后一条消息的序列号作为下次翻页的游标
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
    // 参数解析和校验
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

    // 核心逻辑：创建消息（带重试机制）
    // 重试是为了处理并发时的唯一约束冲突
    const result = await this.createMessageWithRetry(
      conversationId,
      userId,
      messageType,
      content,
      normalizedPayload,
      clientMessageId,
    )

    const message = this.toMessageOutput(result.message)

    // 如果是新消息（非幂等命中），发送实时通知
    if (result.isNew) {
      // 构建成员状态快照
      const conversationStates = result.memberStates.map((member) => ({
        userId: member.userId,
        unreadCount: member.unreadCount,
        lastReadAt: member.lastReadAt ?? undefined,
        lastReadMessageId:
          typeof member.lastReadMessageId === 'bigint'
            ? member.lastReadMessageId.toString()
            : undefined,
      }))

      // 并行向所有会话成员推送通知
      await Promise.all(
        conversationStates.map(async (member) => {
          // 推送会话更新事件（更新未读数、最后消息等）
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

          // 推送新消息事件
          this.messageNotificationRealtimeService.emitChatMessageNew(member.userId, {
            conversationId,
            message,
          })

          // 更新收件箱摘要并推送
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
      deduplicated: !result.isNew, // 标识是否为幂等命中的重复消息
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

    // 事务：原子性地完成已读标记
    const result = await this.prisma.$transaction(async (tx) => {
      // 校验用户是会话成员且未退出
      const member = await tx.chatConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        select: {
          conversationId: true,
          leftAt: true,
          lastReadMessageId: true,
        },
      })
      if (!member || member.leftAt) {
        throw new NotFoundException('Conversation not found')
      }

      // 校验目标消息存在且属于该会话
      const targetMessage = await tx.chatMessage.findFirst({
        where: {
          id: messageId,
          conversationId,
        },
        select: {
          id: true,
          messageSeq: true,
        },
      })
      if (!targetMessage) {
        throw new NotFoundException('Message not found')
      }

      // 确定最终的已读位置
      // 关键逻辑：已读位置只能前进，不能后退
      let finalReadMessageId = targetMessage.id
      let finalReadMessageSeq = targetMessage.messageSeq

      // 如果之前有已读消息，检查是否需要保留之前的已读位置
      if (typeof member.lastReadMessageId === 'bigint') {
        const previousReadMessage = await tx.chatMessage.findFirst({
          where: {
            id: member.lastReadMessageId,
            conversationId,
          },
          select: {
            id: true,
            messageSeq: true,
          },
        })

        // 已读位置回退保护：如果之前的已读序列号更大，则保留之前的已读位置
        if (
          previousReadMessage
          && previousReadMessage.messageSeq > finalReadMessageSeq
        ) {
          finalReadMessageId = previousReadMessage.id
          finalReadMessageSeq = previousReadMessage.messageSeq
        }
      }

      // 计算未读消息数：统计序列号大于已读位置且非自己发送的消息
      const unreadCount = await tx.chatMessage.count({
        where: {
          conversationId,
          senderId: { not: userId }, // 排除自己发送的消息
          status: {
            not: ChatMessageStatusEnum.DELETED,
          },
          messageSeq: {
            gt: finalReadMessageSeq, // 序列号大于已读位置
          },
        },
      })

      // 更新成员的已读状态
      const now = new Date()
      await tx.chatConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: {
          lastReadMessageId: finalReadMessageId,
          lastReadAt: now,
          unreadCount,
        },
      })

      return {
        now,
        unreadCount,
        lastReadMessageId: finalReadMessageId,
      }
    })

    // 推送实时通知：会话更新
    this.messageNotificationRealtimeService.emitChatConversationUpdate(userId, {
      conversationId,
      unreadCount: result.unreadCount,
      lastReadAt: result.now,
      lastReadMessageId: result.lastReadMessageId.toString(),
    })

    // 推送实时通知：收件箱摘要更新
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
    payload?: Prisma.InputJsonValue,
    clientMessageId?: string,
  ) {
    let lastError: unknown
    const maxRetry = 3

    // 重试循环：处理并发冲突
    for (let index = 0; index < maxRetry; index += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 校验用户是会话成员且未退出
          const member = await tx.chatConversationMember.findUnique({
            where: {
              conversationId_userId: {
                conversationId,
                userId,
              },
            },
            select: {
              conversationId: true,
              leftAt: true,
            },
          })
          if (!member || member.leftAt) {
            throw new NotFoundException('Conversation not found')
          }

          // 校验会话存在
          const conversation = await tx.chatConversation.findUnique({
            where: { id: conversationId },
            select: {
              id: true,
            },
          })
          if (!conversation) {
            throw new NotFoundException('Conversation not found')
          }

          // 【关键】获取会话级别的咨询锁
          // 作用：同一会话的消息创建会串行执行，保证序列号生成的原子性
          // 锁类型：事务级咨询锁，事务结束自动释放
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${conversationId})`

          // 幂等性检查：如果提供了 clientMessageId，检查是否已存在相同消息
          if (clientMessageId) {
            const existedMessage = await tx.chatMessage.findUnique({
              where: {
                conversationId_senderId_clientMessageId: {
                  conversationId,
                  senderId: userId,
                  clientMessageId,
                },
              },
            })
            // 命中幂等：返回已存在的消息，不创建新消息
            if (existedMessage) {
              return {
                message: existedMessage,
                memberStates: [],
                isNew: false,
              }
            }
          }

          // 获取当前会话的最大消息序列号
          const lastMessage = await tx.chatMessage.findFirst({
            where: { conversationId },
            orderBy: { messageSeq: 'desc' },
            select: { messageSeq: true },
          })
          // 计算新消息的序列号（递增1）
          const nextMessageSeq = (lastMessage?.messageSeq ?? 0n) + 1n

          // 创建消息记录
          const message = await tx.chatMessage.create({
            data: {
              conversationId,
              messageSeq: nextMessageSeq,
              senderId: userId,
              clientMessageId,
              messageType,
              content,
              payload,
              status: ChatMessageStatusEnum.NORMAL,
            },
          })

          // 更新会话的最后消息信息
          await tx.chatConversation.update({
            where: { id: conversationId },
            data: {
              lastMessageId: message.id,
              lastMessageAt: message.createdAt,
              lastSenderId: userId,
            },
          })

          // 更新其他成员的未读数（发送者不计入未读）
          await tx.chatConversationMember.updateMany({
            where: {
              conversationId,
              userId: { not: userId }, // 排除发送者
              leftAt: null, // 只更新未退出的成员
            },
            data: {
              unreadCount: { increment: 1 }, // 未读数+1
            },
          })

          // 获取所有成员的最新状态（用于推送通知）
          const memberStates = await tx.chatConversationMember.findMany({
            where: {
              conversationId,
              leftAt: null,
            },
            select: {
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

        // 只处理唯一约束冲突错误（P2002），其他错误直接抛出
        if (!this.isUniqueConstraintError(error)) {
          throw error
        }

        // 重试前的幂等检查：
        // 如果是因为序列号冲突导致的重试，需要再次检查 clientMessageId
        // 因为可能在当前事务失败时，另一个事务已经成功创建了相同 clientMessageId 的消息
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

    // 重试次数用尽，抛出最后一次错误
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
    return this.prisma.chatMessage.findUnique({
      where: {
        conversationId_senderId_clientMessageId: {
          conversationId,
          senderId: userId,
          clientMessageId,
        },
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
    const member = await this.prisma.chatConversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { id: true, leftAt: true },
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
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        members: {
          some: {
            userId,
            leftAt: null,
          },
        },
      },
      include: {
        members: {
          where: { leftAt: null },
          select: {
            userId: true,
            unreadCount: true,
            lastReadAt: true,
            lastReadMessageId: true,
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
      },
    })
    if (!conversation) {
      throw new NotFoundException('Conversation not found')
    }

    // 查询最后一条消息内容
    const lastMessage = conversation.lastMessageId
      ? await this.prisma.chatMessage.findUnique({
        where: { id: conversation.lastMessageId },
        select: {
          content: true,
        },
      })
      : null

    return this.toConversationOutput(
      conversation,
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

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        content: true,
      },
    })

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
  private toMessageOutput(item: ChatMessage) {
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
  private parseJsonPayload(payload?: string) {
    if (!payload || !payload.trim()) {
      return undefined
    }
    try {
      return JSON.parse(payload) as Prisma.InputJsonValue
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
    payload: Prisma.InputJsonValue | undefined,
    clientMessageId?: string,
  ) {
    if (!clientMessageId) {
      return payload
    }
    // 没有原始载荷，创建新的
    if (payload === undefined) {
      return {
        clientMessageId,
      } as Prisma.InputJsonValue
    }
    // 原始载荷必须是对象类型（不能是数组或原始值）
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new BadRequestException('payload must be a JSON object when clientMessageId is provided')
    }
    // 合并 clientMessageId 到现有载荷
    return {
      ...(payload as Prisma.JsonObject),
      clientMessageId,
    } as Prisma.InputJsonValue
  }

  private recordResyncTriggeredMetric() {
    void this.messageWsMonitorService.recordResyncTriggered().catch(() => {})
  }

  private recordResyncSuccessMetric() {
    void this.messageWsMonitorService.recordResyncSuccess().catch(() => {})
  }
}
