import type { NotificationOutboxPayload } from '../outbox/dto/outbox-event.dto'
import type { QueryUserNotificationListDto } from './dto/notification.dto'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class MessageNotificationService extends BaseService {
  private get notification() {
    return this.prisma.userNotification
  }

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
