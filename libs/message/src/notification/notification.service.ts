import type { NotificationOutboxPayload } from '../outbox/dto/outbox-event.dto'
import type { QueryUserNotificationListDto } from './dto/notification.dto'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 消息通知服务
 * 提供用户通知的查询、标记已读、从发件箱创建通知等功能
 */
@Injectable()
export class MessageNotificationService extends BaseService {
  private get notification() {
    return this.prisma.userNotification
  }

  /**
   * 分页查询用户通知列表
   * @param userId 用户ID
   * @param queryDto 查询条件
   * @returns 分页的通知列表
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
   * 获取用户未读通知数量
   * @param userId 用户ID
   * @returns 未读通知数量
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
   * 标记单条通知为已读
   * @param userId 用户ID
   * @param id 通知ID
   * @returns 标记结果
   */
  async markRead(userId: number, id: number) {
    const result = await this.notification.updateMany({
      where: {
        id,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
    if (!result.count) {
      throw new BadRequestException('通知不存在或已读')
    }
    return { id }
  }

  /**
   * 标记用户所有通知为已读
   * @param userId 用户ID
   * @returns 更新结果
   */
  async markAllRead(userId: number) {
    return this.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * 从发件箱事件创建通知
   * @param bizKey 业务幂等键
   * @param payload 通知载荷数据
   */
  async createFromOutbox(bizKey: string, payload: NotificationOutboxPayload) {
    const receiverUserId = Number(payload.receiverUserId)
    const actorUserId =
      payload.actorUserId === undefined ? undefined : Number(payload.actorUserId)

    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      throw new BadRequestException('通知接收用户ID非法')
    }
    if (!payload.type || !payload.title || !payload.content) {
      throw new BadRequestException('通知事件缺少必要字段')
    }
    if (
      actorUserId !== undefined &&
      Number.isInteger(actorUserId) &&
      actorUserId === receiverUserId
    ) {
      return
    }

    let expiredAt: Date | undefined
    if (payload.expiredAt) {
      const value = new Date(payload.expiredAt)
      if (!Number.isNaN(value.getTime())) {
        expiredAt = value
      }
    }

    try {
      await this.notification.create({
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
              : (payload.payload),
          aggregateKey: payload.aggregateKey,
          aggregateCount:
            payload.aggregateCount && payload.aggregateCount > 0
              ? payload.aggregateCount
              : 1,
          expiredAt,
        },
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return
      }
      throw error
    }
  }
}
