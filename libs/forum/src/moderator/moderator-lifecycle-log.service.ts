import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { QueryForumModeratorLifecycleLogDto } from './dto/moderator-lifecycle-log.dto'
import type { ForumModeratorLifecycleEventTypeEnum } from './moderator-lifecycle-log.constant'
import { DrizzleService, toPageResult } from '@db/core'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, lt } from 'drizzle-orm'

export interface CreateForumModeratorLifecycleLogInput {
  eventType: ForumModeratorLifecycleEventTypeEnum
  moderatorId?: number | null
  applicationId?: number | null
  actorAdminUserId: number
  reason?: string | null
  beforeData?: unknown | null
  afterData?: unknown | null
}

@Injectable()
export class ForumModeratorLifecycleLogService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get forumModeratorLifecycleLog() {
    return this.drizzle.schema.forumModeratorLifecycleLog
  }

  async createLifecycleLogInTx(
    tx: Db,
    input: CreateForumModeratorLifecycleLogInput,
  ) {
    await this.drizzle.withErrorHandling(() =>
      tx.insert(this.forumModeratorLifecycleLog).values({
        eventType: input.eventType,
        moderatorId: input.moderatorId ?? null,
        applicationId: input.applicationId ?? null,
        actorAdminUserId: input.actorAdminUserId,
        reason: input.reason ?? null,
        beforeData: input.beforeData ?? null,
        afterData: input.afterData ?? null,
      }),
    )
    return true
  }

  async getAdminLifecycleLogPage(query: QueryForumModeratorLifecycleLogDto) {
    const { orderBy: _clientOrderBy, ...pageDto } = query
    const conditions: SQL[] = []
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      pageDto.startDate,
      pageDto.endDate,
    )

    if (pageDto.eventType !== undefined) {
      conditions.push(
        eq(this.forumModeratorLifecycleLog.eventType, pageDto.eventType),
      )
    }
    if (pageDto.moderatorId !== undefined && pageDto.moderatorId !== null) {
      conditions.push(
        eq(this.forumModeratorLifecycleLog.moderatorId, pageDto.moderatorId),
      )
    }
    if (pageDto.applicationId !== undefined && pageDto.applicationId !== null) {
      conditions.push(
        eq(
          this.forumModeratorLifecycleLog.applicationId,
          pageDto.applicationId,
        ),
      )
    }
    if (pageDto.actorAdminUserId !== undefined) {
      conditions.push(
        eq(
          this.forumModeratorLifecycleLog.actorAdminUserId,
          pageDto.actorAdminUserId,
        ),
      )
    }
    if (dateRange?.gte) {
      conditions.push(
        gte(this.forumModeratorLifecycleLog.createdAt, dateRange.gte),
      )
    }
    if (dateRange?.lt) {
      conditions.push(
        lt(this.forumModeratorLifecycleLog.createdAt, dateRange.lt),
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy(
      [{ createdAt: 'desc' }, { id: 'desc' }],
      { table: this.forumModeratorLifecycleLog },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.forumModeratorLifecycleLog)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumModeratorLifecycleLog, where),
    ])

    return toPageResult(list, total, page)
  }
}
