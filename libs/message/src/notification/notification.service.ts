import type { SQL } from 'drizzle-orm'
import type {
  NotificationOutboxPayload,
  NotificationSyncAction,
} from '../outbox/outbox.type'
import type { CreateNotificationFromOutboxOutput } from './notification.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { QueryUserNotificationListDto } from './dto/notification.dto'
import { MessageNotificationPreferenceService } from './notification-preference.service'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import { MessageNotificationTemplateService } from './notification-template.service'
import {
  MESSAGE_NOTIFICATION_TYPE_VALUES,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

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
    private readonly messageNotificationPreferenceService: MessageNotificationPreferenceService,
    private readonly messageNotificationTemplateService: MessageNotificationTemplateService,
  ) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** user_notification 表访问入口。 */
  private get notification() {
    return this.drizzle.schema.userNotification
  }

  /** app_user 表访问入口，用于补齐通知触发者简要信息。 */
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 查询用户通知列表
   * 支持按已读状态和类型筛选
   */
  async queryUserNotificationList(userId: number, queryDto: QueryUserNotificationListDto) {
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
    await this.drizzle.withErrorHandling(() =>
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
        )), { notFound: '通知不存在或已读' },)

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
  ): Promise<CreateNotificationFromOutboxOutput> {
    const receiverUserId = Number(payload.receiverUserId)
    const actorUserId =
      payload.actorUserId === undefined ? undefined : Number(payload.actorUserId)
    const notificationType = this.parseRequiredNotificationType(payload.type)

    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      throw new BadRequestException('通知接收用户ID非法')
    }
    const syncAction = this.parseOptionalSyncAction(payload.syncAction)
    if (syncAction === 'DELETE') {
      return this.deleteSyncedNotification(receiverUserId, bizKey)
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
      return {
        status: MessageNotificationDispatchStatusEnum.SKIPPED_SELF,
      }
    }

    const preference
      = await this.messageNotificationPreferenceService.getEffectiveNotificationPreference(
        receiverUserId,
        notificationType,
      )
    if (!preference.isEnabled) {
      return {
        status: MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE,
        preference,
      }
    }

    const renderedContent
      = await this.messageNotificationTemplateService.renderNotificationTemplate({
        receiverUserId,
        actorUserId,
        type: notificationType,
        targetType: payload.targetType,
        targetId: payload.targetId,
        subjectType: payload.subjectType,
        subjectId: payload.subjectId,
        title: payload.title,
        content: payload.content,
        payload: payload.payload,
        aggregateKey: payload.aggregateKey,
        aggregateCount: payload.aggregateCount,
        expiredAt: payload.expiredAt,
      })

    /**
     * 解析过期时间
     * outbox payload 允许字符串或 Date，这里统一标准化为可入库的 Date
     */
    let expiredAt: Date | undefined
    if (payload.expiredAt) {
      const value = new Date(payload.expiredAt)
      if (!Number.isNaN(value.getTime())) {
        expiredAt = value
      }
    }

    if (syncAction === 'UPSERT') {
      return this.replaceNotificationByBizKey({
        bizKey,
        receiverUserId,
        actorUserId,
        notificationType,
        payload,
        renderedContent: {
          title: renderedContent.title,
          content: renderedContent.content,
        },
        expiredAt,
      })
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
          title: renderedContent.title,
          content: renderedContent.content,
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
      return {
        status: MessageNotificationDispatchStatusEnum.SKIPPED_DUPLICATE,
      }
    }

    this.messageNotificationRealtimeService.emitNotificationNew(notification)
    await this.emitInboxSummaryUpdate(receiverUserId)
    return {
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      notification,
    }
  }

  /**
   * 按稳定业务键替换通知。
   * 先删除旧通知，再插入最新快照，确保公告更新后用户侧只保留当前版本。
   */
  private async replaceNotificationByBizKey(input: {
    bizKey: string
    receiverUserId: number
    actorUserId?: number
    notificationType: MessageNotificationTypeEnum
    payload: NotificationOutboxPayload
    renderedContent: {
      title: string
      content: string
    }
    expiredAt?: Date
  }): Promise<CreateNotificationFromOutboxOutput> {
    const inserted = await this.drizzle.withTransaction(async (tx) => {
      await tx
        .delete(this.notification)
        .where(and(
          eq(this.notification.userId, input.receiverUserId),
          eq(this.notification.bizKey, input.bizKey),
        ))

      return tx
        .insert(this.notification)
        .values({
          userId: input.receiverUserId,
          type: input.notificationType,
          bizKey: input.bizKey,
          actorUserId:
            input.actorUserId !== undefined && Number.isInteger(input.actorUserId)
              ? input.actorUserId
              : undefined,
          targetType: this.parseOptionalSmallInt(input.payload.targetType, 'targetType'),
          targetId:
            input.payload.targetId !== undefined
              ? Number(input.payload.targetId)
              : undefined,
          subjectType: this.parseOptionalSmallInt(input.payload.subjectType, 'subjectType'),
          subjectId:
            input.payload.subjectId !== undefined
              ? Number(input.payload.subjectId)
              : undefined,
          title: input.renderedContent.title,
          content: input.renderedContent.content,
          payload:
            input.payload.payload === undefined
              ? undefined
              : input.payload.payload,
          aggregateKey: input.payload.aggregateKey,
          aggregateCount:
            input.payload.aggregateCount && input.payload.aggregateCount > 0
              ? input.payload.aggregateCount
              : 1,
          expiredAt: input.expiredAt,
        })
        .returning()
    })

    const notification = inserted[0]
    if (!notification) {
      throw new Error('通知替换失败')
    }

    this.messageNotificationRealtimeService.emitNotificationNew(notification)
    await this.emitInboxSummaryUpdate(input.receiverUserId)
    return {
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      notification,
    }
  }

  /**
   * 删除同步型通知。
   * 用于公告下线或失效后清理同 bizKey 的历史通知，避免用户继续看到过期内容。
   */
  private async deleteSyncedNotification(
    receiverUserId: number,
    bizKey: string,
  ): Promise<CreateNotificationFromOutboxOutput> {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.notification)
        .where(and(
          eq(this.notification.userId, receiverUserId),
          eq(this.notification.bizKey, bizKey),
        ))
    )

    await this.emitInboxSummaryUpdate(receiverUserId)
    return {
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
    }
  }

  /**
   * 推送收件箱摘要更新
   * 通知读状态和新通知创建都需要同步刷新首页摘要，避免客户端额外轮询
   */
  private async emitInboxSummaryUpdate(userId: number) {
    const summary = await this.messageInboxService.getSummary(userId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdate(userId, summary)
  }

  /**
   * 解析并校验通知类型
   * 使用已注册类型值集合判断，避免后续扩展时依赖枚举连续区间
   */
  private parseRequiredNotificationType(value: unknown) {
    const type = Number(value)
    if (!Number.isInteger(type) || !MESSAGE_NOTIFICATION_TYPE_VALUES.includes(type)) {
      throw new BadRequestException('通知类型非法')
    }
    return type as MessageNotificationTypeEnum
  }

  /**
   * 解析可选 smallint 字段
   * 目标类型、主体类型这类上下文字段保持最小校验，不在通知层扩展业务语义
   */
  private parseOptionalSmallInt(value: unknown, fieldName: string) {
    if (value === undefined || value === null) {
      return undefined
    }
    const normalized = Number(value)
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > 32767) {
      throw new BadRequestException(`${fieldName} 必须是合法的 smallint`)
    }
    return normalized
  }

  /**
   * 解析通知同步动作。
   * 未传时保持旧的“只插入不替换”语义；非法值直接拦成 400。
   */
  private parseOptionalSyncAction(value: unknown) {
    if (value === undefined || value === null) {
      return undefined
    }
    if (value === 'UPSERT' || value === 'DELETE') {
      return value as NotificationSyncAction
    }
    throw new BadRequestException('通知同步动作非法')
  }
}
