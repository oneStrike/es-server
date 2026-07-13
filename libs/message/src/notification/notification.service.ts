import type { SQL } from 'drizzle-orm'
import type { QueryUserNotificationPageDto } from './dto/notification.dto'
import type { NotificationActorSource } from './notification-public.type'
import { DrizzleService, toPageResult } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, gte, inArray, isNull, lt, or } from 'drizzle-orm'
import { MessageInboxService } from '../inbox/inbox.service'
import { normalizeMessageNotificationCategoryKeysFilter } from './notification-category-key-filter.util'
import { mapUserNotificationToPublicView } from './notification-public.mapper'
import { MessageNotificationRealtimeService } from './notification-realtime.service'

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
    queryDto: QueryUserNotificationPageDto,
  ) {
    const pageParams = this.drizzle.buildPageParams(queryDto, {
      table: this.notification,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      maxPageSize: 100,
    })
    const { isRead, categoryKeys } = queryDto
    const conditions: Array<SQL | undefined> = [
      this.buildActiveNotificationWhere(receiverUserId),
    ]

    if (isRead !== undefined) {
      conditions.push(eq(this.notification.isRead, isRead))
    }
    const normalizedCategoryKeys =
      this.normalizeCategoryKeysFilter(categoryKeys)
    if (normalizedCategoryKeys && normalizedCategoryKeys.length > 0) {
      conditions.push(
        inArray(this.notification.categoryKey, normalizedCategoryKeys),
      )
    }
    if (pageParams.dateRange?.gte) {
      conditions.push(
        gte(this.notification.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.notification.createdAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: this.notification.id,
          categoryKey: this.notification.categoryKey,
          actorUserId: this.notification.actorUserId,
          title: this.notification.title,
          content: this.notification.content,
          payload: this.notification.payload,
          isRead: this.notification.isRead,
          readAt: this.notification.readAt,
          expiresAt: this.notification.expiresAt,
          createdAt: this.notification.createdAt,
          updatedAt: this.notification.updatedAt,
        })
        .from(this.notification)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.notification, where),
    ])
    const actorUserIds = [
      ...new Set(
        rows
          .map((item) => item.actorUserId)
          .filter((item): item is number => typeof item === 'number'),
      ),
    ]
    const actors =
      actorUserIds.length > 0
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
    const list = rows.map((item) =>
      mapUserNotificationToPublicView(
        item,
        this.resolveNotificationActor(actorMap, item.actorUserId),
      ),
    )

    return toPageResult(list, total, pageParams.page)
  }

  async getUnreadCount(receiverUserId: number) {
    return this.messageInboxService.getNotificationUnreadSummary(receiverUserId)
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
          .where(
            and(
              eq(this.notification.id, id),
              eq(this.notification.receiverUserId, receiverUserId),
              eq(this.notification.isHidden, false),
              eq(this.notification.isRead, false),
            ),
          ),
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
        .where(
          and(
            this.buildActiveNotificationWhere(receiverUserId),
            eq(this.notification.isRead, false),
          ),
        ),
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

  async hideNotification(receiverUserId: number, id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.notification)
        .set({
          isHidden: true,
        })
        .where(
          and(
            eq(this.notification.id, id),
            eq(this.notification.receiverUserId, receiverUserId),
            eq(this.notification.isHidden, false),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '通知不存在或已隐藏')
    this.messageNotificationRealtimeService.emitNotificationDeleted(
      receiverUserId,
      { id },
    )
    await this.emitInboxSummaryUpdated(receiverUserId)
    return true
  }

  buildActiveNotificationWhere(receiverUserId: number, now = new Date()) {
    return and(
      eq(this.notification.receiverUserId, receiverUserId),
      eq(this.notification.isHidden, false),
      or(
        isNull(this.notification.expiresAt),
        gt(this.notification.expiresAt, now),
      ),
    )
  }

  private normalizeCategoryKeysFilter(categoryKeys?: string) {
    return normalizeMessageNotificationCategoryKeysFilter(categoryKeys)
  }

  private async emitInboxSummaryUpdated(receiverUserId: number) {
    const summary =
      await this.messageInboxService.getNotificationSummary(receiverUserId)
    this.messageNotificationRealtimeService.emitInboxSummaryUpdated(
      receiverUserId,
      summary,
    )
  }

  private resolveNotificationActor(
    actorMap: Map<number, NotificationActorSource>,
    actorUserId?: number | null,
  ) {
    if (typeof actorUserId !== 'number') {
      return undefined
    }

    return actorMap.get(actorUserId)
  }
}
