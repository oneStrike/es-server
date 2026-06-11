import type { SQL } from 'drizzle-orm'
import type { QueryUserNotificationCursorDto } from './dto/notification.dto'
import type { NotificationActorSource } from './notification-public.mapper'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
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
    queryDto: QueryUserNotificationCursorDto,
  ) {
    this.assertCursorPageQuery(queryDto)
    const { isRead, categoryKeys } = queryDto
    const pageSize = this.normalizeCursorPageSize(queryDto.pageSize, 15, 100)
    const cursor = this.parseTimelineCursor(queryDto.cursor)
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
    if (cursor) {
      conditions.push(
        sql`(${this.notification.createdAt} < ${cursor.createdAt} OR (${this.notification.createdAt} = ${cursor.createdAt} AND ${this.notification.id} < ${cursor.id}))`,
      )
    }

    const where = and(...conditions)
    const rows = await this.db
      .select()
      .from(this.notification)
      .where(where)
      .orderBy(desc(this.notification.createdAt), desc(this.notification.id))
      .limit(pageSize + 1)
    const hasMore = rows.length > pageSize
    const pageRows = rows.slice(0, pageSize)
    const actorUserIds = [
      ...new Set(
        pageRows
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
    const list = pageRows.map((item) =>
      mapUserNotificationToPublicView(
        item,
        this.resolveNotificationActor(actorMap, item.actorUserId),
      ),
    )

    return {
      list,
      pageSize,
      hasMore,
      nextCursor: hasMore
        ? this.encodeTimelineCursor(pageRows[pageRows.length - 1])
        : null,
    }
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

  private encodeTimelineCursor(item: { createdAt: Date; id: number }) {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toISOString(),
        id: item.id,
      }),
    ).toString('base64url')
  }

  private parseTimelineCursor(cursor?: string | null) {
    if (!cursor?.trim()) {
      return undefined
    }

    try {
      const payload = JSON.parse(
        Buffer.from(cursor.trim(), 'base64url').toString('utf8'),
      ) as Partial<{ createdAt: unknown; id: unknown }>
      if (
        typeof payload.createdAt !== 'string' ||
        !Number.isInteger(payload.id) ||
        Number(payload.id) <= 0
      ) {
        throw new TypeError('invalid cursor payload')
      }
      const createdAt = new Date(payload.createdAt)
      if (Number.isNaN(createdAt.getTime())) {
        throw new TypeError('invalid cursor payload')
      }
      return { createdAt, id: Number(payload.id) }
    } catch {
      throw new BadRequestException('cursor 格式无效')
    }
  }

  private assertCursorPageQuery(dto: object) {
    const unsupportedFields = ['pageIndex', 'orderBy', 'startDate', 'endDate']
      .filter((field) => Object.prototype.hasOwnProperty.call(dto, field))

    if (unsupportedFields.length > 0) {
      throw new BadRequestException(
        `通知列表仅支持 pageSize 和 cursor 查询，不支持 ${unsupportedFields.join(', ')}`,
      )
    }
  }

  private normalizeCursorPageSize(
    pageSize: number | undefined,
    defaultPageSize: number,
    maxPageSize: number,
  ) {
    const value = Number.isFinite(Number(pageSize))
      ? Math.floor(Number(pageSize))
      : defaultPageSize
    return Math.min(Math.max(1, value), maxPageSize)
  }
}
