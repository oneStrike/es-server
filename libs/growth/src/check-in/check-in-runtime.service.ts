import type {
  CheckInPlanSelect,
  CheckInRecordSelect,
  CheckInStreakRewardGrantSelect,
} from '@db/schema'
import type { PageDto } from '@libs/platform/dto/page.dto'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInRewardDefinition,
  CheckInVirtualCycleView,
} from './check-in.type'
import type {
  CheckInCalendarDayDto,
  CheckInLeaderboardItemDto,
  CheckInRecordItemDto,
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import type { CheckInGrantItemDto } from './dto/check-in-streak-reward-grant.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, desc, eq, exists, gte, lte, or, sql } from 'drizzle-orm'
import {
  CheckInCycleTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到运行态读服务。
 *
 * 提供 App 摘要、日历、记录，以及 Admin 对账页需要的查询结果。
 */
@Injectable()
export class CheckInRuntimeService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  /** 汇总当前用户的生效计划、周期摘要、下一档连续奖励和最近签到记录。 */
  async getSummary(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const plan = await this.findCurrentActivePlan(now)
    if (!plan) {
      return {
        plan: null,
        cycle: null,
        todaySigned: false,
        nextStreakReward: null,
        latestRecord: null,
      }
    }

    const cycle = await this.getCurrentCycleView(userId, plan, now)
    const records = cycle.id ? await this.listCycleRecords(cycle.id) : []
    const grantMap = await this.buildGrantMapForRecords(records)
    const effectiveCurrentStreak = this.resolveEffectiveCurrentStreak(
      cycle.currentStreak,
      cycle.lastSignedDate,
      today,
    )
    const recordViews = records.map((record) =>
      this.toRecordView(
        record,
        grantMap.get(
          `${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`,
        ) ?? [],
      ),
    )
    const latestRecord = recordViews.at(-1)

    return {
      plan: {
        id: plan.id,
        planCode: plan.planCode,
        planName: plan.planName,
        status: this.resolvePlanStatus(plan),
        cycleType: this.parseCycleType(plan.cycleType),
        startDate: this.toDateOnlyValue(plan.startDate),
        endDate: plan.endDate ? this.toDateOnlyValue(plan.endDate) : null,
        allowMakeupCountPerCycle: plan.allowMakeupCountPerCycle,
        baseRewardConfig: cycle.rewardDefinition.baseRewardConfig,
      },
      cycle: {
        id: cycle.id,
        cycleKey: cycle.cycleKey,
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
        signedCount: cycle.signedCount,
        makeupUsedCount: cycle.makeupUsedCount,
        remainingMakeupCount: Math.max(
          plan.allowMakeupCountPerCycle - cycle.makeupUsedCount,
          0,
        ),
        currentStreak: effectiveCurrentStreak,
        lastSignedDate: cycle.lastSignedDate,
      },
      todaySigned: records.some(
        (record) => this.toDateOnlyValue(record.signDate) === today,
      ),
      nextStreakReward:
        this.resolveNextStreakReward(
          cycle.rewardDefinition.streakRewardRules,
          effectiveCurrentStreak,
        ) ?? null,
      latestRecord: latestRecord ?? null,
    }
  }

  /** 读取当前周期签到日历，并为未签到日期补齐占位视图。 */
  async getCalendar(userId: number) {
    const now = new Date()
    const plan = await this.findCurrentActivePlan(now)
    if (!plan) {
      return { days: [] }
    }

    const today = this.formatDateOnly(now)
    const cycle = await this.getCurrentCycleView(userId, plan, now)
    const records = cycle.id ? await this.listCycleRecords(cycle.id) : []
    const grantMap = await this.buildGrantMapForRecords(records)
    const recordViews = records.map((record) =>
      this.toRecordView(
        record,
        grantMap.get(
          `${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`,
        ) ?? [],
      ),
    )

    return {
      planId: plan.id,
      cycleId: cycle.id,
      cycleKey: cycle.cycleKey,
      cycleStartDate: cycle.cycleStartDate,
      cycleEndDate: cycle.cycleEndDate,
      days: this.buildCalendarDays(
        cycle,
        this.parseCycleType(plan.cycleType),
        recordViews,
        today,
      ),
    }
  }

  /** 分页读取当前用户签到记录，并批量拼装同日触发的连续奖励列表。 */
  async getMyRecords(query: PageDto, userId: number) {
    const conditions: SQL[] = [eq(this.checkInRecordTable.userId, userId)]

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
    const orderBy = query.orderBy?.trim()

    const page = await this.drizzle.ext.findPagination(
      this.checkInRecordTable,
      {
        where: and(...conditions),
        ...query,
        orderBy:
          orderBy || JSON.stringify([{ signDate: 'desc' }, { id: 'desc' }]),
      },
    )

    const grantMap = await this.buildGrantMapForRecords(page.list)
    return {
      ...page,
      list: page.list.map((record) =>
        this.toRecordView(
          record,
          grantMap.get(
            `${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`,
          ) ?? [],
        ),
      ),
    }
  }

  /** 分页读取签到奖励对账结果，并按记录维度挂载连续奖励发放列表。 */
  async getReconciliationPage(query: QueryCheckInReconciliationDto) {
    const conditions: SQL[] = []

    if (query.recordId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.id, query.recordId))
    }
    if (query.planId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.planId, query.planId))
    }
    if (query.userId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.userId, query.userId))
    }
    if (query.cycleId !== undefined) {
      conditions.push(eq(this.checkInRecordTable.cycleId, query.cycleId))
    }
    if (query.rewardStatus != null) {
      conditions.push(
        eq(this.checkInRecordTable.rewardStatus, query.rewardStatus),
      )
    }
    if (query.grantId !== undefined) {
      conditions.push(
        exists(
          this.db
            .select({ id: this.checkInStreakRewardGrantTable.id })
            .from(this.checkInStreakRewardGrantTable)
            .where(
              and(
                eq(this.checkInStreakRewardGrantTable.id, query.grantId),
                eq(
                  this.checkInStreakRewardGrantTable.cycleId,
                  this.checkInRecordTable.cycleId,
                ),
                eq(
                  this.checkInStreakRewardGrantTable.triggerSignDate,
                  this.checkInRecordTable.signDate,
                ),
              ),
            ),
        ),
      )
    }
    if (query.grantStatus != null) {
      conditions.push(
        exists(
          this.db
            .select({ id: this.checkInStreakRewardGrantTable.id })
            .from(this.checkInStreakRewardGrantTable)
            .where(
              and(
                eq(
                  this.checkInStreakRewardGrantTable.cycleId,
                  this.checkInRecordTable.cycleId,
                ),
                eq(
                  this.checkInStreakRewardGrantTable.triggerSignDate,
                  this.checkInRecordTable.signDate,
                ),
                eq(
                  this.checkInStreakRewardGrantTable.grantStatus,
                  query.grantStatus,
                ),
              ),
            ),
        ),
      )
    }
    const orderBy = query.orderBy?.trim()

    const page = await this.drizzle.ext.findPagination(
      this.checkInRecordTable,
      {
        where: conditions.length > 0 ? and(...conditions) : undefined,
        ...query,
        orderBy:
          orderBy || JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
      },
    )

    const grantMap = await this.buildGrantMapForRecords(page.list)
    return {
      ...page,
      list: page.list.map((record) => ({
        recordId: record.id,
        userId: record.userId,
        planId: record.planId,
        cycleId: record.cycleId,
        signDate: this.toDateOnlyValue(record.signDate),
        recordType: record.recordType,
        rewardStatus: record.rewardStatus,
        rewardResultType: record.rewardResultType,
        resolvedRewardSourceType: record.resolvedRewardSourceType,
        resolvedRewardRuleKey: record.resolvedRewardRuleKey,
        resolvedRewardConfig: this.parseStoredRewardConfig(
          record.resolvedRewardConfig,
          {
            allowEmpty: true,
          },
        ),
        baseRewardLedgerIds: record.baseRewardLedgerIds,
        lastRewardError: record.lastRewardError,
        grants:
          grantMap.get(
            `${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`,
          ) ?? [],
        createdAt: record.createdAt,
      })),
    }
  }

  /** 分页读取当前生效签到计划的连续签到排行榜。 */
  async getLeaderboardPage(query: QueryCheckInLeaderboardDto) {
    const pageQuery = this.drizzle.buildPage(query)
    const now = new Date()
    const today = this.formatDateOnly(now)
    const yesterday = dayjs
      .tz(today, 'YYYY-MM-DD', this.getAppTimeZone())
      .subtract(1, 'day')
      .format('YYYY-MM-DD')
    const plan = await this.findCurrentActivePlan(now)

    if (!plan) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
      }
    }

    const effectiveCurrentStreakSql = sql<number>`
      case
        when ${this.checkInCycleTable.lastSignedDate} is not null
          and (
            ${this.checkInCycleTable.lastSignedDate} = ${today}
            or ${this.checkInCycleTable.lastSignedDate} = ${yesterday}
          )
        then ${this.checkInCycleTable.currentStreak}
        else 0
      end
    `
    const where = and(
      eq(this.checkInCycleTable.planId, plan.id),
      lte(this.checkInCycleTable.cycleStartDate, today),
      gte(this.checkInCycleTable.cycleEndDate, today),
      sql`${effectiveCurrentStreakSql} > 0`,
    )
    const [rows, total] = await Promise.all([
      this.db
        .select({
          userId: this.checkInCycleTable.userId,
          currentStreak: effectiveCurrentStreakSql,
          lastSignedDate: this.checkInCycleTable.lastSignedDate,
        })
        .from(this.checkInCycleTable)
        .where(where)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset)
        .orderBy(
          desc(effectiveCurrentStreakSql),
          desc(this.checkInCycleTable.lastSignedDate),
          asc(this.checkInCycleTable.userId),
        ),
      this.db.$count(this.checkInCycleTable, where),
    ])
    const page = {
      list: rows,
      total,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }

    if (page.list.length === 0) {
      return page
    }

    const userMap = await this.buildLeaderboardUserMap(
      page.list.map((item) => item.userId),
    )
    const rankOffset = (page.pageIndex - 1) * page.pageSize

    return {
      ...page,
      list: page.list.flatMap((item, index) => {
        const user = userMap.get(item.userId)
        if (!user) {
          return []
        }

        return [
          {
            rank: rankOffset + index + 1,
            currentStreak: item.currentStreak,
            lastSignedDate: item.lastSignedDate
              ? this.toDateOnlyValue(item.lastSignedDate)
              : undefined,
            user: {
              id: user.id,
              nickname: user.nickname,
              avatarUrl: user.avatarUrl ?? undefined,
            },
          } satisfies CheckInLeaderboardItemDto,
        ]
      }),
    }
  }

  /**
   * 获取当前周期读模型。
   *
   * 若数据库中尚未落周期实例，则返回基于当前计划推导出的虚拟周期视图。
   */
  private async getCurrentCycleView(
    userId: number,
    plan: CheckInPlanSelect,
    now: Date,
  ) {
    const rewardDefinition = this.getPlanRewardDefinition(plan, {
      allowEmpty: true,
    }) ?? {
      baseRewardConfig: null,
      dateRewardRules: [],
      patternRewardRules: [],
      streakRewardRules: [],
    }
    const today = this.formatDateOnly(now)
    const cycle = await this.findCycleContainingDate(userId, plan.id, today)
    if (cycle) {
      return {
        id: cycle.id,
        cycleKey: cycle.cycleKey,
        cycleStartDate: this.toDateOnlyValue(cycle.cycleStartDate),
        cycleEndDate: this.toDateOnlyValue(cycle.cycleEndDate),
        signedCount: cycle.signedCount,
        makeupUsedCount: cycle.makeupUsedCount,
        currentStreak: cycle.currentStreak,
        lastSignedDate: cycle.lastSignedDate
          ? this.toDateOnlyValue(cycle.lastSignedDate)
          : undefined,
        rewardDefinition,
      }
    }

    const frame = this.buildCycleFrame(plan, now)
    return {
      cycleKey: frame.cycleKey,
      cycleStartDate: frame.cycleStartDate,
      cycleEndDate: frame.cycleEndDate,
      signedCount: 0,
      makeupUsedCount: 0,
      currentStreak: 0,
      rewardDefinition,
    }
  }

  /** 解析下一档可见的连续奖励。 */
  private resolveNextStreakReward(
    rules: CheckInRewardDefinition['streakRewardRules'],
    currentStreak: number,
  ) {
    const nextRule = rules
      .filter(
        (rule) => rule.status === CheckInStreakRewardRuleStatusEnum.ENABLED,
      )
      .sort((left, right) => left.streakDays - right.streakDays)
      .find((rule) => rule.streakDays > currentStreak)

    return nextRule ? this.toStreakRuleView(nextRule) : undefined
  }

  /**
   * 批量查询签到记录关联的连续奖励发放列表。
   *
   * 这里按 `(cycleId, signDate)` 聚合返回，避免逐条 N+1 查询。
   */
  private async buildGrantMapForRecords(
    records: Pick<CheckInRecordSelect, 'cycleId' | 'signDate'>[],
  ) {
    const grantMap = new Map<string, CheckInGrantItemDto[]>()
    if (records.length === 0) {
      return grantMap
    }

    const predicates = records.map((record) =>
      and(
        eq(this.checkInStreakRewardGrantTable.cycleId, record.cycleId),
        eq(
          this.checkInStreakRewardGrantTable.triggerSignDate,
          this.toDateOnlyValue(record.signDate),
        ),
      ),
    )

    const grants = await this.db
      .select()
      .from(this.checkInStreakRewardGrantTable)
      .where(predicates.length === 1 ? predicates[0] : or(...predicates))
      .orderBy(
        asc(this.checkInStreakRewardGrantTable.triggerSignDate),
        asc(this.checkInStreakRewardGrantTable.id),
      )

    for (const grant of grants) {
      const key = `${grant.cycleId}:${this.toDateOnlyValue(grant.triggerSignDate)}`
      const current = grantMap.get(key) ?? []
      current.push(this.toGrantView(grant))
      grantMap.set(key, current)
    }

    return grantMap
  }

  /**
   * 批量读取排行榜用户的最小展示信息。
   *
   * 仅查询榜单卡片展示需要的字段，避免把完整用户资料带入签到读模型。
   */
  private async buildLeaderboardUserMap(userIds: number[]) {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          nickname: string
          avatarUrl: string | null
        }
      >()
    }

    const users = await this.db.query.appUser.findMany({
      where: {
        id: { in: uniqueUserIds },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })

    return new Map(users.map((user) => [user.id, user] as const))
  }

  /**
   * 构建当前周期日历视图。
   *
   * 即使某天没有签到事实，也要返回占位项供前端明确区分未来日和漏签日。
   */
  private buildCalendarDays(
    cycle: Pick<
      CheckInVirtualCycleView,
      'cycleStartDate' | 'cycleEndDate' | 'rewardDefinition'
    >,
    cycleType: CheckInCycleTypeEnum,
    records: CheckInRecordItemDto[],
    today: string,
  ) {
    const recordMap = new Map(
      records.map((record) => [record.signDate, record]),
    )
    const days: CheckInCalendarDayDto[] = []
    let cursor = dayjs
      .tz(cycle.cycleStartDate, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
    const end = dayjs
      .tz(cycle.cycleEndDate, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')

    while (cursor.isSame(end) || cursor.isBefore(end)) {
      const signDate = cursor.format('YYYY-MM-DD')
      const record = recordMap.get(signDate)
      const rewardResolution = this.resolveRewardForDate(
        cycleType,
        cycle.rewardDefinition,
        signDate,
      )
      days.push({
        signDate,
        dayIndex: this.resolveRewardDayIndex(cycleType, signDate),
        inPlanWindow: true,
        planRewardConfig: rewardResolution.resolvedRewardConfig,
        isToday: signDate === today,
        isFuture: signDate > today,
        isSigned: Boolean(record),
        recordType: record?.recordType,
        rewardStatus: record?.rewardStatus,
        rewardResultType: record?.rewardResultType,
        grantCount: record?.grants.length ?? 0,
      })
      cursor = cursor.add(1, 'day')
    }

    return days
  }

  /** 把签到事实映射成稳定读模型。 */
  private toRecordView(
    record: Pick<
      CheckInRecordSelect,
      | 'id'
      | 'signDate'
      | 'recordType'
      | 'rewardStatus'
      | 'rewardResultType'
      | 'resolvedRewardSourceType'
      | 'resolvedRewardRuleKey'
      | 'resolvedRewardConfig'
      | 'baseRewardLedgerIds'
      | 'lastRewardError'
      | 'rewardSettledAt'
      | 'createdAt'
    >,
    grants: CheckInGrantItemDto[] = [],
  ): CheckInRecordItemDto {
    return {
      id: record.id,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType as CheckInRecordTypeEnum,
      rewardStatus: record.rewardStatus as CheckInRewardStatusEnum | null,
      rewardResultType:
        record.rewardResultType as CheckInRewardResultTypeEnum | null,
      resolvedRewardSourceType:
        record.resolvedRewardSourceType as CheckInRecordItemDto['resolvedRewardSourceType'],
      resolvedRewardRuleKey: record.resolvedRewardRuleKey,
      resolvedRewardConfig: this.parseStoredRewardConfig(
        record.resolvedRewardConfig,
        {
          allowEmpty: true,
        },
      ),
      baseRewardLedgerIds: record.baseRewardLedgerIds,
      lastRewardError: record.lastRewardError,
      rewardSettledAt: record.rewardSettledAt,
      grants,
      createdAt: record.createdAt,
    }
  }

  /** 把连续奖励发放事实映射成稳定读模型。 */
  private toGrantView(
    grant: Pick<
      CheckInStreakRewardGrantSelect,
      | 'id'
      | 'ruleCode'
      | 'streakDays'
      | 'rewardConfig'
      | 'triggerSignDate'
      | 'grantStatus'
      | 'grantResultType'
      | 'ledgerIds'
      | 'lastGrantError'
    >,
  ): CheckInGrantItemDto {
    return {
      id: grant.id,
      ruleCode: grant.ruleCode,
      streakDays: grant.streakDays,
      rewardConfig: this.parseStoredRewardConfig(grant.rewardConfig, {
        allowEmpty: false,
      })!,
      triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
      grantStatus: grant.grantStatus as CheckInRewardStatusEnum,
      grantResultType:
        grant.grantResultType as CheckInRewardResultTypeEnum | null,
      ledgerIds: grant.ledgerIds,
      lastGrantError: grant.lastGrantError,
    }
  }
}
