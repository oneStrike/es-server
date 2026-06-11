import type {
  CheckInConfigSelect,
  CheckInRecordSelect,
  CheckInStreakGrantSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInGrantItemView,
  CheckInReconciliationPageItemView,
  CheckInRecordGrantLookup,
  CheckInRewardItems,
} from './check-in.type'
import type {
  QueryAppCheckInLeaderboardPageDto,
  QueryAppCheckInRecordPageDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { DrizzleService, extractRows, toPageResult } from '@db/core'
import {
  encodeGrowthCursor,
  parseGrowthCursor,
  rejectOffsetPaginationFields,
  toCursorPage,
} from '@libs/growth/growth/cursor-page.util'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { Injectable } from '@nestjs/common'
import { addDaysToDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { and, asc, desc, eq, exists, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { CheckInCalendarReadModelService } from './check-in-calendar-read-model.service'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInStreakService } from './check-in-streak.service'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到运行时读模型服务。
 *
 * 负责 app 侧摘要、日历、记录、排行榜以及 admin 侧对账读模型。
 */
@Injectable()
export class CheckInRuntimeService extends CheckInServiceSupport {
  // 注入签到读模型所需的数据库和账本依赖。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
    private readonly checkInRewardPolicyService: CheckInRewardPolicyService,
    private readonly checkInMakeupService: CheckInMakeupService,
    private readonly checkInStreakService: CheckInStreakService,
    private readonly checkInSettlementService: CheckInSettlementService,
    private readonly checkInCalendarReadModelService: CheckInCalendarReadModelService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 查询 app 侧签到摘要，并补齐最新记录和下一档连续奖励。
  async getSummary(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const config = await this.getRequiredConfig()
    const makeup =
      await this.checkInMakeupService.buildCurrentMakeupAccountView(
        userId,
        config,
        today,
      )
    const activeRules =
      await this.checkInStreakService.listActiveStreakRulesAt(now)
    const rewardRules = this.checkInStreakService.toStreakRewardRuleViews(
      activeRules,
      now,
    )
    const progress = await this.db.query.checkInStreakProgress.findFirst({
      where: { userId },
    })
    const effectiveCurrentStreak =
      this.checkInStreakService.resolveEffectiveCurrentStreak(
        progress?.currentStreak ?? 0,
        progress?.lastSignedDate,
        today,
      )
    const effectiveLastSignedDate =
      this.checkInStreakService.resolveEffectiveLastSignedDate(
        progress?.lastSignedDate,
        today,
      )
    const latestRecord = await this.getLatestRecord(userId)

    return {
      config: this.toAppConfigSummaryView(config),
      makeup,
      streak: {
        currentStreak: effectiveCurrentStreak,
        streakStartedAt:
          effectiveCurrentStreak > 0 && progress?.streakStartedAt
            ? this.toDateOnlyValue(progress.streakStartedAt)
            : null,
        lastSignedDate: effectiveLastSignedDate ?? null,
        nextReward:
          this.checkInRewardPolicyService.resolveNextStreakReward(
            rewardRules,
            effectiveCurrentStreak,
          ) ?? null,
      },
      todaySigned: await this.hasRecordForDate(userId, today),
      latestRecord: latestRecord
        ? await this.buildAppRecordItemView(latestRecord)
        : null,
    }
  }

  // 查询 app 侧连续签到详情，返回当前有效进度和全部生效奖励规则。
  async getStreakDetail(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const activeRules =
      await this.checkInStreakService.listActiveStreakRulesAt(now)
    const rewardRules = this.checkInStreakService.toStreakRewardRuleViews(
      activeRules,
      now,
    )
    const progress = await this.db.query.checkInStreakProgress.findFirst({
      where: { userId },
    })
    const effectiveCurrentStreak =
      this.checkInStreakService.resolveEffectiveCurrentStreak(
        progress?.currentStreak ?? 0,
        progress?.lastSignedDate,
        today,
      )

    return {
      progress: {
        currentStreak: effectiveCurrentStreak,
        streakStartedAt:
          effectiveCurrentStreak > 0 && progress?.streakStartedAt
            ? this.toDateOnlyValue(progress.streakStartedAt)
            : null,
        lastSignedDate:
          this.checkInStreakService.resolveEffectiveLastSignedDate(
            progress?.lastSignedDate,
            today,
          ) ?? null,
      },
      rewardRules,
    }
  }

  // 查询当前补签周期内的签到日历视图。
  async getCalendar(userId: number) {
    return this.checkInCalendarReadModelService.getCurrentUserCalendarByTargetDate(
      userId,
      this.formatDateOnly(new Date()),
    )
  }

  // 分页查询当前用户的签到记录，并补齐奖励和连续奖励信息。
  async getMyRecords(query: QueryAppCheckInRecordPageDto, userId: number) {
    rejectOffsetPaginationFields(query, '我的签到记录列表')
    const conditions = [eq(this.checkInRecordTable.userId, userId)]
    const cursor = this.parseCheckInRecordCursor(query.cursor)
    if (cursor) {
      conditions.push(
        or(
          lt(this.checkInRecordTable.signDate, cursor.signDate),
          and(
            eq(this.checkInRecordTable.signDate, cursor.signDate),
            lt(this.checkInRecordTable.id, cursor.id),
          ),
        )!,
      )
    }

    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage({ pageSize: query.pageSize })
    const rows = await this.db
      .select()
      .from(this.checkInRecordTable)
      .where(where)
      .orderBy(desc(this.checkInRecordTable.signDate), desc(this.checkInRecordTable.id))
      .limit(pageQuery.limit + 1)
    const page = toCursorPage(rows, pageQuery.limit, (record) =>
      this.encodeCheckInRecordCursor(record),
    )
    const grantMap = await this.buildAppGrantMapForRecords(page.list)

    return {
      ...page,
      list: page.list.map((record) =>
        this.toAppRecordItemView(
          record,
          grantMap.get(
            `${record.userId}:${this.toDateOnlyValue(record.signDate)}`,
          ) ?? [],
        ),
      ),
    }
  }

  // 查询当前连续签到排行榜，并补齐用户信息与名次。
  async getLeaderboardPage(query: QueryAppCheckInLeaderboardPageDto) {
    rejectOffsetPaginationFields(query, '签到排行榜')
    const today = this.formatDateOnly(new Date())
    const yesterday = addDaysToDateOnlyInAppTimeZone(today, -1)
    const pageQuery = this.drizzle.buildPage({ pageSize: query.pageSize })
    const cursor = this.parseLeaderboardCursor(query.cursor)
    const cursorSql = cursor
      ? sql`HAVING (
          p.current_streak < ${cursor.currentStreak}
          OR (p.current_streak = ${cursor.currentStreak} AND count(r.id)::int < ${cursor.signCount})
          OR (p.current_streak = ${cursor.currentStreak} AND count(r.id)::int = ${cursor.signCount} AND p.user_id > ${cursor.userId})
        )`
      : sql.empty()
    const result = await this.db.execute(sql`
      SELECT
        p.user_id AS "userId",
        p.current_streak AS "currentStreak",
        p.last_signed_date AS "lastSignedDate",
        count(r.id)::int AS "signCount"
      FROM check_in_streak_progress p
      LEFT JOIN check_in_record r ON r.user_id = p.user_id
      WHERE p.current_streak > 0
        AND p.last_signed_date IN (${today}, ${yesterday})
      GROUP BY p.user_id, p.current_streak, p.last_signed_date
      ${cursorSql}
      ORDER BY p.current_streak DESC, count(r.id)::int DESC, p.user_id ASC
      LIMIT ${pageQuery.limit + 1}
    `)
    const rows = extractRows<{
      userId: number
      currentStreak: number
      lastSignedDate: string | Date | null
      signCount: number
    }>(result)
    const list = rows.slice(0, pageQuery.limit)
    const hasMore = rows.length > pageQuery.limit
    const page = {
      list,
      pageSize: pageQuery.pageSize,
      hasMore,
      nextCursor:
        hasMore && list.length > 0
          ? this.encodeLeaderboardCursor(list[list.length - 1])
          : null,
    }

    const userIds = page.list.map((item) => item.userId)
    const users =
      userIds.length === 0
        ? []
        : await this.db
            .select({
              id: this.drizzle.schema.appUser.id,
              nickname: this.drizzle.schema.appUser.nickname,
              avatarUrl: this.drizzle.schema.appUser.avatarUrl,
            })
            .from(this.drizzle.schema.appUser)
            .where(inArray(this.drizzle.schema.appUser.id, userIds))
    const userMap = new Map(users.map((user) => [user.id, user]))

    return {
      ...page,
      list: page.list.map((item) => ({
        user: userMap.get(item.userId) ?? null,
        currentStreak: item.currentStreak,
        lastSignedDate: item.lastSignedDate
          ? this.toDateOnlyValue(item.lastSignedDate)
          : null,
        signCount: Number(item.signCount ?? 0),
      })),
    }
  }

  private encodeCheckInRecordCursor(record: CheckInRecordSelect) {
    return encodeGrowthCursor({
      signDate: this.toDateOnlyValue(record.signDate),
      id: record.id,
    })
  }

  private parseCheckInRecordCursor(cursor?: string | null) {
    return parseGrowthCursor(cursor, '签到记录分页游标非法', (payload) => {
      const signDate =
        typeof payload.signDate === 'string'
          ? this.parseDateOnly(payload.signDate, '游标日期')
          : undefined
      const id = Number(payload.id)
      if (!signDate || !Number.isInteger(id) || id <= 0) {
        return undefined
      }
      return { signDate, id }
    })
  }

  private encodeLeaderboardCursor(
    item: {
      userId: number
      currentStreak: number
      signCount: number
    },
  ) {
    return encodeGrowthCursor({
      currentStreak: item.currentStreak,
      signCount: Number(item.signCount ?? 0),
      userId: item.userId,
    })
  }

  private parseLeaderboardCursor(cursor?: string | null) {
    return parseGrowthCursor(cursor, '签到排行榜分页游标非法', (payload) => {
      const currentStreak = Number(payload.currentStreak)
      const signCount = Number(payload.signCount)
      const userId = Number(payload.userId)
      if (
        !Number.isInteger(currentStreak) ||
        currentStreak <= 0 ||
        !Number.isInteger(signCount) ||
        signCount < 0 ||
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return undefined
      }
      return { currentStreak, signCount, userId }
    })
  }

  // 查询 admin 侧签到奖励对账分页结果。
  async getReconciliationPage(query: QueryCheckInReconciliationDto) {
    const conditions: SQL[] = []

    if (query.recordId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.id, query.recordId))
    }
    if (query.userId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.userId, query.userId))
    }
    if (query.startDate) {
      conditions.push(
        gte(
          this.checkInRecordTable.signDate,
          this.parseDateOnly(query.startDate, '开始日期'),
        ),
      )
    }
    if (query.endDate) {
      conditions.push(
        lte(
          this.checkInRecordTable.signDate,
          this.parseDateOnly(query.endDate, '结束日期'),
        ),
      )
    }
    if (query.recordSettlementStatus != null) {
      conditions.push(
        exists(
          this.db
            .select({ id: this.growthRewardSettlementTable.id })
            .from(this.growthRewardSettlementTable)
            .where(
              and(
                eq(
                  this.growthRewardSettlementTable.id,
                  this.checkInRecordTable.rewardSettlementId,
                ),
                eq(
                  this.growthRewardSettlementTable.settlementStatus,
                  query.recordSettlementStatus,
                ),
              ),
            ),
        ),
      )
    }
    const grantCondition = this.buildGrantReconciliationCondition(query)
    if (grantCondition) {
      conditions.push(grantCondition)
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(
      query.orderBy?.trim() ||
        JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
      { table: this.checkInRecordTable },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.checkInRecordTable)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.checkInRecordTable, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    const settlementMap =
      await this.checkInSettlementService.buildSettlementMapById(
        page.list
          .map((record) => record.rewardSettlementId)
          .filter((id): id is number => typeof id === 'number'),
      )
    const grantMap = await this.buildGrantMapForRecords(page.list)

    return {
      ...page,
      list: page.list.map(
        (record) =>
          ({
            recordId: record.id,
            userId: record.userId,
            signDate: this.toDateOnlyValue(record.signDate),
            recordType: record.recordType,
            rewardSettlementId: record.rewardSettlementId ?? null,
            resolvedRewardSourceType: record.resolvedRewardSourceType ?? null,
            resolvedRewardRuleKey: record.resolvedRewardRuleKey ?? null,
            resolvedRewardItems:
              this.checkInRewardPolicyService.parseStoredRewardItems(
                record.resolvedRewardItems,
                {
                  allowEmpty: true,
                },
              ),
            resolvedRewardOverviewIconUrl:
              record.resolvedRewardOverviewIconUrl ?? null,
            resolvedMakeupIconUrl: record.resolvedMakeupIconUrl ?? null,
            rewardSettlement: record.rewardSettlementId
              ? this.checkInSettlementService.toRewardSettlementSummary(
                  settlementMap.get(record.rewardSettlementId) ?? null,
                )
              : null,
            grants:
              grantMap.get(
                `${record.userId}:${this.toDateOnlyValue(record.signDate)}`,
              ) ?? [],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          }) satisfies CheckInReconciliationPageItemView,
      ),
    }
  }

  // 判断某个自然日是否已经存在签到事实。
  private async hasRecordForDate(userId: number, signDate: string) {
    const record = await this.db.query.checkInRecord.findFirst({
      where: {
        userId,
        signDate,
      },
      columns: { id: true },
    })
    return !!record
  }

  // 查询用户最近一条签到记录。
  private async getLatestRecord(userId: number) {
    const [record] = await this.db
      .select()
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.userId, userId))
      .orderBy(
        desc(this.checkInRecordTable.signDate),
        desc(this.checkInRecordTable.id),
      )
      .limit(1)
    return record
  }

  // 构建 app 侧签到记录展示视图，不加载补偿结算诊断字段。
  private async buildAppRecordItemView(record: CheckInRecordSelect) {
    const grants = await this.listAppGrantsForRecord(
      record.userId,
      this.toDateOnlyValue(record.signDate),
    )

    return this.toAppRecordItemView(record, grants)
  }

  private toAppRecordItemView(
    record: CheckInRecordSelect,
    grants: Array<
      Omit<CheckInGrantItemView, 'rewardSettlementId' | 'rewardSettlement'>
    >,
  ) {
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      resolvedRewardSourceType: record.resolvedRewardSourceType ?? null,
      resolvedRewardRuleKey: record.resolvedRewardRuleKey ?? null,
      resolvedRewardItems:
        this.checkInRewardPolicyService.parseStoredRewardItems(
          record.resolvedRewardItems,
          {
            allowEmpty: true,
          },
        ),
      resolvedRewardOverviewIconUrl:
        record.resolvedRewardOverviewIconUrl ?? null,
      resolvedMakeupIconUrl: record.resolvedMakeupIconUrl ?? null,
      grants,
    }
  }

  // 查询某个签到自然日触发的 app 安全连续奖励列表。
  private async listAppGrantsForRecord(
    userId: number,
    signDate: string,
  ): Promise<
    Array<Omit<CheckInGrantItemView, 'rewardSettlementId' | 'rewardSettlement'>>
  > {
    const grants = await this.db
      .select()
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          eq(this.checkInStreakGrantTable.userId, userId),
          eq(this.checkInStreakGrantTable.triggerSignDate, signDate),
        ),
      )
      .orderBy(asc(this.checkInStreakGrantTable.id))

    const rewardItemMap =
      await this.checkInSettlementService.buildGrantRewardItemMap(
        grants.map((grant) => grant.id),
      )
    return grants.map((grant) =>
      this.toAppGrantItemView(grant, rewardItemMap.get(grant.id) ?? []),
    )
  }

  // 批量查询 app 记录列表所需连续奖励，不读取补偿结算诊断字段。
  private async buildAppGrantMapForRecords(
    records: CheckInRecordGrantLookup[],
  ): Promise<
    Map<
      string,
      Array<
        Omit<CheckInGrantItemView, 'rewardSettlementId' | 'rewardSettlement'>
      >
    >
  > {
    if (records.length === 0) {
      return new Map()
    }
    const userIds = [...new Set(records.map((record) => record.userId))]
    const signDates = [
      ...new Set(
        records.map((record) => this.toDateOnlyValue(record.signDate)),
      ),
    ]
    const grants = await this.db
      .select()
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          inArray(this.checkInStreakGrantTable.userId, userIds),
          inArray(this.checkInStreakGrantTable.triggerSignDate, signDates),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )

    const rewardItemMap =
      await this.checkInSettlementService.buildGrantRewardItemMap(
        grants.map((grant) => grant.id),
      )

    const grantMap = new Map<
      string,
      Array<
        Omit<CheckInGrantItemView, 'rewardSettlementId' | 'rewardSettlement'>
      >
    >()
    for (const grant of grants) {
      const key = `${grant.userId}:${this.toDateOnlyValue(grant.triggerSignDate)}`
      const items = grantMap.get(key) ?? []
      items.push(
        this.toAppGrantItemView(grant, rewardItemMap.get(grant.id) ?? []),
      )
      grantMap.set(key, items)
    }
    return grantMap
  }

  // 批量构建签到记录到连续奖励列表的映射。
  private async buildGrantMapForRecords(
    records: CheckInRecordGrantLookup[],
  ): Promise<Map<string, CheckInGrantItemView[]>> {
    if (records.length === 0) {
      return new Map<string, CheckInGrantItemView[]>()
    }
    const userIds = [...new Set(records.map((record) => record.userId))]
    const signDates = [
      ...new Set(
        records.map((record) => this.toDateOnlyValue(record.signDate)),
      ),
    ]
    const grants = await this.db
      .select()
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          inArray(this.checkInStreakGrantTable.userId, userIds),
          inArray(this.checkInStreakGrantTable.triggerSignDate, signDates),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )

    const rewardItemMap =
      await this.checkInSettlementService.buildGrantRewardItemMap(
        grants.map((grant) => grant.id),
      )
    const settlementMap =
      await this.checkInSettlementService.buildSettlementMapById(
        grants
          .map((grant) => grant.rewardSettlementId)
          .filter((id): id is number => typeof id === 'number'),
      )

    const grantMap = new Map<string, CheckInGrantItemView[]>()
    for (const grant of grants) {
      const key = `${grant.userId}:${this.toDateOnlyValue(grant.triggerSignDate)}`
      const items = grantMap.get(key) ?? []
      items.push({
        id: grant.id,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
        userId: grant.userId,
        ruleId: grant.ruleId,
        ruleCode: grant.ruleCode,
        streakDays: grant.streakDays,
        rewardItems: rewardItemMap.get(grant.id) ?? [],
        rewardOverviewIconUrl: grant.rewardOverviewIconUrl ?? null,
        repeatable: grant.repeatable,
        triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
        rewardSettlementId: grant.rewardSettlementId ?? null,
        rewardSettlement: grant.rewardSettlementId
          ? this.checkInSettlementService.toRewardSettlementSummary(
              settlementMap.get(grant.rewardSettlementId) ?? null,
            )
          : null,
      } satisfies CheckInGrantItemView)
      grantMap.set(key, items)
    }
    return grantMap
  }

  private toAppGrantItemView(
    grant: CheckInStreakGrantSelect,
    rewardItems: CheckInRewardItems,
  ) {
    return {
      id: grant.id,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      userId: grant.userId,
      ruleId: grant.ruleId,
      ruleCode: grant.ruleCode,
      streakDays: grant.streakDays,
      rewardItems,
      rewardOverviewIconUrl: grant.rewardOverviewIconUrl ?? null,
      repeatable: grant.repeatable,
      triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
    }
  }

  // 构建连续奖励对账筛选条件，复用记录筛选的同一语义。
  private buildGrantReconciliationCondition(
    query: QueryCheckInReconciliationDto,
  ) {
    const grantConditions: SQL[] = []

    if (query.ruleId !== undefined) {
      grantConditions.push(
        eq(this.checkInStreakGrantTable.ruleId, query.ruleId),
      )
    }
    if (query.grantId !== undefined) {
      grantConditions.push(eq(this.checkInStreakGrantTable.id, query.grantId))
    }
    if (query.grantSettlementStatus != null) {
      grantConditions.push(
        exists(
          this.db
            .select({ id: this.growthRewardSettlementTable.id })
            .from(this.growthRewardSettlementTable)
            .where(
              and(
                eq(
                  this.growthRewardSettlementTable.id,
                  this.checkInStreakGrantTable.rewardSettlementId,
                ),
                eq(
                  this.growthRewardSettlementTable.settlementStatus,
                  query.grantSettlementStatus,
                ),
              ),
            ),
        ),
      )
    }

    if (grantConditions.length === 0) {
      return undefined
    }

    return exists(
      this.db
        .select({ id: this.checkInStreakGrantTable.id })
        .from(this.checkInStreakGrantTable)
        .where(
          and(
            eq(
              this.checkInStreakGrantTable.userId,
              this.checkInRecordTable.userId,
            ),
            eq(
              this.checkInStreakGrantTable.triggerSignDate,
              this.checkInRecordTable.signDate,
            ),
            ...grantConditions,
          ),
        ),
    )
  }

  // 把配置表记录映射成 app 摘要所需的最小配置结构。
  private toAppConfigSummaryView(config: CheckInConfigSelect) {
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)
    return {
      isEnabled: config.isEnabled === 1,
      makeupPeriodType: config.makeupPeriodType,
      periodicAllowance: config.periodicAllowance,
      makeupIconUrl: rewardDefinition.makeupIconUrl ?? null,
      rewardOverviewIconUrl: rewardDefinition.rewardOverviewIconUrl ?? null,
      baseRewardItems: rewardDefinition.baseRewardItems ?? null,
    }
  }
}
