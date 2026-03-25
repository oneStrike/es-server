import type { NotificationOutboxPayload } from '../outbox/outbox.type'
import type { QueryUserNotificationListInput } from './notification.type'
import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageNotificationTypeEnum } from './notification.constant'

/**
 * 消息通知服务
 * 提供用户通知的查询、标记已读和创建功能
 */
@Injectable()
export class MessageNotificationService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationRealtimeService: MessageNotificationRealtimeService,
    private readonly messageInboxService: MessageInboxService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get notification() {
    return this.drizzle.schema.userNotification
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 查询用户通知列表
   * 支持按已读状态和类型筛选
   */
  async queryUserNotificationList(
    userId: number,
    queryDto: QueryUserNotificationListInput,
  ) {
    const { isRead, type, ...pagination } = queryDto
    const conditions: SQL[] = [eq(this.notification.userId, userId)]

    if (isRead !== undefined) {
      conditions.push(eq(this.notification.isRead, isRead))
    }
    if (type !== undefined) {
      conditions.push(eq(this.notification.type, type))
    }

    const where = and(...conditions)
    const page = await this.drizzle.ext.findPagination(this.notification, {
      where,
      ...pagination,
    })
    const actorUserIds = [
      ...new Set(
        page.list
          .map((item) => item.actorUserId)
          .filter((item): item is number => typeof item === 'number'),
      ),
    ]
    const actors = actorUserIds.length > 0
      ? await this.db.query.appUser.findMany({
          where: {
            id: {
              in: actorUserIds,
            },
          },
          columns: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        })
      : []
    const actorMap = new Map(actors.map((item) => [item.id, item]))
    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        actorUser: item.actorUserId ? actorMap.get(item.actorUserId) : undefined,
      })),
    }
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: number) {
    return {
      count: await this.db.$count(this.notification, and(
        eq(this.notification.userId, userId),
        eq(this.notification.isRead, false),
      )),
    }
  }

  /**
   * 标记单条通知已读
   * 同时推送实时更新给客户端
   */
  async markRead(userId: number, id: number) {
    const now = new Date()
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notification)
        .set({
          isRead: true,
          readAt: now,
        })
        .where(and(
          eq(this.notification.id, id),
          eq(this.notification.userId, userId),
          eq(this.notification.isRead, false),
        ))
    )
    this.drizzle.assertAffectedRows(result, '通知不存在或已读')

    this.messageNotificationRealtimeService.emitNotificationReadSync(userId, {
      id,
      readAt: now,
    })
    await this.emitInboxSummaryUpdate(userId)
    return true
  }

  /**
   * 标记所有通知已读
   * 同时推送实时更新给客户端
   */
  async markAllRead(userId: number) {
    const now = new Date()
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notification)
        .set({
          isRead: true,
          readAt: now,
        })
        .where(and(
          eq(this.notification.userId, userId),
          eq(this.notification.isRead, false),
        ))
    )
    const affectedRows = result.rowCount ?? 0
    if (affectedRows > 0) {
      this.messageNotificationRealtimeService.emitNotificationReadSync(userId, {
        readAt: now,
      })
      await this.emitInboxSummaryUpdate(userId)
    }
    return true
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
  ): Promise<typeof this.notification.$inferSelect | null> {
    const receiverUserId = Number(payload.receiverUserId)
    const actorUserId =
      payload.actorUserId === undefined ? undefined : Number(payload.actorUserId)
    const notificationType = this.parseRequiredNotificationType(payload.type)

    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      throw new BadRequestException('通知接收用户ID非法')
    }
    if (!payload.title || !payload.content) {
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

    const inserted = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.notification)
        .values({
          userId: receiverUserId,
          type: notificationType,
          bizKey,
          actorUserId:
            actorUserId !== undefined && Number.isInteger(actorUserId)
              ? actorUserId
              : undefined,
          targetType: this.parseOptionalSmallInt(payload.targetType, 'targetType'),
          targetId:
            payload.targetId !== undefined ? Number(payload.targetId) : undefined,
          subjectType: this.parseOptionalSmallInt(payload.subjectType, 'subjectType'),
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
        })
        .onConflictDoNothing({
          target: [this.notification.userId, this.notification.bizKey],
        })
        .returning(),
    )
    const notification = inserted[0]
    if (!notification) {
      return null
    }

    this.messageNotificationRealtimeService.emitNotificationNew(notification)
    await this.emitInboxSummaryUpdate(receiverUserId)
    return notification
  }

  /** 推送收件箱摘要更新 */
  private async emitInboxSummaryUpdate(userId: number) {
    const summary = await this.messageInboxService.getSummary(userId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdate(userId, summary)
  }

  private parseRequiredNotificationType(value: unknown) {
    const type = Number(value)
    if (
      !Number.isInteger(type)
      || type < MessageNotificationTypeEnum.COMMENT_REPLY
      || type > MessageNotificationTypeEnum.CHAT_MESSAGE
    ) {
      throw new BadRequestException('通知类型非法')
    }
    return type
  }

  private parseOptionalSmallInt(value: unknown, fieldName: string) {
    if (value === undefined || value === null) {
      return undefined
    }
    const normalized = Number(value)
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > 32767) {
      throw new BadRequestException(`${fieldName} must be a valid smallint`)
    }
    return normalized
  }
}
