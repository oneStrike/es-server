import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { QueryUserNotificationListDto } from './dto/notification.dto'
import { MessageNotificationRealtimeService } from './notification-realtime.service'
import {
  getMessageNotificationCategoryLabel,
  isMessageNotificationCategoryKey,
  MessageNotificationCategoryKey,
} from './notification.constant'

/**
 * 用户通知读模型服务。
 * 只负责用户侧读取与已读状态变更，不再承接业务侧通知创建入口。
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

  async queryUserNotificationList(
    receiverUserId: number,
    queryDto: QueryUserNotificationListDto,
  ) {
    const { isRead, categoryKeys, ...pagination } = queryDto
    const conditions: Array<SQL | undefined> = [
      this.buildActiveNotificationWhere(receiverUserId),
    ]

    if (isRead !== undefined) {
      conditions.push(eq(this.notification.isRead, isRead))
    }
    const normalizedCategoryKeys = this.normalizeCategoryKeysFilter(categoryKeys)
    if (normalizedCategoryKeys && normalizedCategoryKeys.length > 0) {
      conditions.push(
        inArray(
          this.notification.categoryKey,
          normalizedCategoryKeys,
        ),
      )
    }

    const page = await this.drizzle.ext.findPagination(this.notification, {
      where: and(...conditions),
      ...pagination,
    })
    const actorUserIds = [
      ...new Set(
        page.list
          .map(item => item.actorUserId)
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
    const actorMap = new Map(actors.map(item => [item.id, item]))

    return {
      ...page,
      list: page.list.map(item => ({
        ...item,
        categoryLabel: getMessageNotificationCategoryLabel(
          item.categoryKey as MessageNotificationCategoryKey,
        ),
        actorUser: item.actorUserId
          ? actorMap.get(item.actorUserId)
          : undefined,
      })),
    }
  }

  async getUnreadCount(receiverUserId: number) {
    return {
      count: await this.db.$count(
        this.notification,
        and(
          this.buildActiveNotificationWhere(receiverUserId),
          eq(this.notification.isRead, false),
        ),
      ),
    }
  }

  async markRead(receiverUserId: number, id: number) {
    const now = new Date()
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.notification)
          .set({
            isRead: true,
            readAt: now,
          })
          .where(and(
            eq(this.notification.id, id),
            eq(this.notification.receiverUserId, receiverUserId),
            eq(this.notification.isRead, false),
          )),
      { notFound: '通知不存在或已读' },
    )

    this.messageNotificationRealtimeService.emitNotificationReadSync(
      receiverUserId,
      {
        id,
        readAt: now,
      },
    )
    await this.emitInboxSummaryUpdated(receiverUserId)
    return true
  }

  async markAllRead(receiverUserId: number) {
    const now = new Date()
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notification)
        .set({
          isRead: true,
          readAt: now,
        })
        .where(and(
          this.buildActiveNotificationWhere(receiverUserId),
          eq(this.notification.isRead, false),
        )),
    )

    if ((result.rowCount ?? 0) > 0) {
      this.messageNotificationRealtimeService.emitNotificationReadSync(
        receiverUserId,
        { readAt: now },
      )
      await this.emitInboxSummaryUpdated(receiverUserId)
    }
    return true
  }

  buildActiveNotificationWhere(receiverUserId: number, now = new Date()) {
    return and(
      eq(this.notification.receiverUserId, receiverUserId),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
  }

  private normalizeCategoryKeysFilter(
    categoryKeys?: MessageNotificationCategoryKey[],
  ) {
    if (!Array.isArray(categoryKeys) || categoryKeys.length === 0) {
      return undefined
    }

    const normalized = [
      ...new Set(
        categoryKeys
          .map(item => item.trim())
          .filter(isMessageNotificationCategoryKey),
      ),
    ]

    return normalized.length > 0 ? normalized : undefined
  }

  private async emitInboxSummaryUpdated(receiverUserId: number) {
    const summary = await this.messageInboxService.getSummary(receiverUserId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdated(
      receiverUserId,
      summary,
    )
  }
}
