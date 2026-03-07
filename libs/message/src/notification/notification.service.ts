import type { UserNotification } from '@libs/base/database'
import type { NotificationOutboxPayload } from '../outbox/dto/outbox-event.dto'
import type { QueryUserNotificationListDto } from './dto/notification.dto'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageNotificationRealtimeService } from './notification-realtime.service'

/**
 * 消息通知服务
 * 提供用户通知的查询、标记已读和创建功能
 */
@Injectable()
export class MessageNotificationService extends BaseService {
  constructor(
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
    private readonly messageInboxService: MessageInboxService,
  ) {
    super()
  }

  private get notification() {
    return this.prisma.userNotification
  }

  /**
   * 查询用户通知列表
   * 支持按已读状态和类型筛选
   */
  async queryUserNotificationList(
    userId: number,
    queryDto: QueryUserNotificationListDto,
  ) {
    const { isRead, type, ...pagination } = queryDto
    return this.notification.findPagination({
      where: {
        userId,
        ...(isRead !== undefined ? { isRead } : {}),
        ...(type ? { type } : {}),
        ...pagination,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: number) {
    return {
      count: await this.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    }
  }

  /**
   * 标记单条通知已读
   * 同时推送实时更新给客户端
   */
  async markRead(userId: number, id: number) {
    const now = new Date()
    const result = await this.notification.updateMany({
      where: {
        id,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    })
    if (!result.count) {
      throw new BadRequestException('通知不存在或已读')
    }

    this.messageNotificationRealtimeService.emitNotificationReadSync(userId, {
      id,
      readAt: now,
    })
    await this.emitInboxSummaryUpdate(userId)
    return { id }
  }

  /**
   * 标记所有通知已读
   * 同时推送实时更新给客户端
   */
  async markAllRead(userId: number) {
    const now = new Date()
    const result = await this.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    })
    if (result.count > 0) {
      this.messageNotificationRealtimeService.emitNotificationReadSync(userId, {
        readAt: now,
      })
      await this.emitInboxSummaryUpdate(userId)
    }
    return result
  }

  /**
   * 从发件箱创建通知
   * 处理发件箱事件，创建用户通知记录
   * @param bizKey 业务幂等键
   * @param payload 通知载荷
   * @returns 创建的通知记录，如果重复或自己通知自己则返回 null
   */
  async createFromOutbox(
    bizKey: string,
    payload: NotificationOutboxPayload,
  ): Promise<UserNotification | null> {
    const receiverUserId = Number(payload.receiverUserId)
    const actorUserId =
      payload.actorUserId === undefined ? undefined : Number(payload.actorUserId)

    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      throw new BadRequestException('通知接收用户ID非法')
    }
    if (!payload.type || !payload.title || !payload.content) {
      throw new BadRequestException('通知事件缺少必要字段')
    }
    // 自己不能通知自己
    if (
      actorUserId !== undefined
      && Number.isInteger(actorUserId)
      && actorUserId === receiverUserId
    ) {
      return null
    }

    // 解析过期时间
    let expiredAt: Date | undefined
    if (payload.expiredAt) {
      const value = new Date(payload.expiredAt)
      if (!Number.isNaN(value.getTime())) {
        expiredAt = value
      }
    }

    try {
      const notification = await this.notification.create({
        data: {
          userId: receiverUserId,
          type: payload.type,
          bizKey,
          actorUserId:
            actorUserId !== undefined && Number.isInteger(actorUserId)
              ? actorUserId
              : undefined,
          targetType:
            payload.targetType !== undefined
              ? Number(payload.targetType)
              : undefined,
          targetId:
            payload.targetId !== undefined ? Number(payload.targetId) : undefined,
          subjectType: payload.subjectType,
          subjectId:
            payload.subjectId !== undefined
              ? Number(payload.subjectId)
              : undefined,
          title: payload.title,
          content: payload.content,
          payload:
            payload.payload === undefined
              ? undefined
              : payload.payload,
          aggregateKey: payload.aggregateKey,
          aggregateCount:
            payload.aggregateCount && payload.aggregateCount > 0
              ? payload.aggregateCount
              : 1,
          expiredAt,
        },
      })

      this.messageNotificationRealtimeService.emitNotificationNew(notification)
      await this.emitInboxSummaryUpdate(receiverUserId)
      return notification
    } catch (error) {
      // 唯一约束冲突（重复通知），静默处理
      if (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error as { code?: string }).code === 'P2002'
      ) {
        return null
      }
      throw error
    }
  }

  /** 推送收件箱摘要更新 */
  private async emitInboxSummaryUpdate(userId: number) {
    const summary = await this.messageInboxService.getSummary(userId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdate(userId, summary)
  }
}
