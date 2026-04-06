import type {
  CheckInPlanSelect,
  CheckInRecordSelect,
  CheckInStreakRewardGrantSelect,
} from '@db/schema'
import type { PageDto } from '@libs/platform/dto/page.dto';
import type { SQL } from 'drizzle-orm'
import type {
  CheckInPlanSnapshot,
  CheckInVirtualCycleView,
} from './check-in.type'
import type {
  CheckInCalendarDayDto,
  CheckInRecordItemDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import type { CheckInGrantItemDto } from './dto/check-in-streak-reward-grant.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service';
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, eq, exists, gte, lte, or } from 'drizzle-orm'
import {
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
        baseRewardConfig: cycle.planSnapshot.baseRewardConfig ?? null,
      },
      cycle: {
        id: cycle.id,
        cycleKey: cycle.cycleKey,
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
        signedCount: cycle.signedCount,
        makeupUsedCount: cycle.makeupUsedCount,
        remainingMakeupCount: Math.max(
          cycle.planSnapshot.allowMakeupCountPerCycle - cycle.makeupUsedCount,
          0,
        ),
        currentStreak: cycle.currentStreak,
        lastSignedDate: cycle.lastSignedDate,
      },
      todaySigned: records.some(
        (record) => this.toDateOnlyValue(record.signDate) === today,
      ),
      nextStreakReward:
        this.resolveNextStreakReward(
          cycle.planSnapshot.streakRewardRules,
          cycle.currentStreak,
        ) ?? null,
      latestRecord: latestRecord ?? null,
    }
  }

  /** 读取当前周期签到日历，并为未签到日期补齐占位视图。 */
  async getCalendar(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const plan = await this.findCurrentActivePlan(now)
    if (!plan) {
      return { days: [] }
    }

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
      days: this.buildCalendarDays(cycle, recordViews, today),
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

  /**
   * 获取当前周期读模型。
   *
   * 若数据库中尚未落周期实例，则返回基于当前计划版本推导出的虚拟周期视图。
   */
  private async getCurrentCycleView(
    userId: number,
    plan: CheckInPlanSelect,
    now: Date,
  ) {
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
        planSnapshotVersion: cycle.planSnapshotVersion,
        planSnapshot: this.getCycleSnapshot(cycle),
      }
    }

    const frame = this.buildCycleFrame(plan, now)
    const rules = await this.getPlanRules(plan.id, plan.version)
    return {
      cycleKey: frame.cycleKey,
      cycleStartDate: frame.cycleStartDate,
      cycleEndDate: frame.cycleEndDate,
      signedCount: 0,
      makeupUsedCount: 0,
      currentStreak: 0,
      planSnapshotVersion: plan.version,
      planSnapshot: this.buildPlanSnapshot(plan, rules),
    }
  }

  /** 解析下一档可见的连续奖励。 */
  private resolveNextStreakReward(
    rules: CheckInPlanSnapshot['streakRewardRules'],
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
   * 构建当前周期日历视图。
   *
   * 即使某天没有签到事实，也要返回占位项供前端明确区分未来日和漏签日。
   */
  private buildCalendarDays(
    cycle: Pick<CheckInVirtualCycleView, 'cycleStartDate' | 'cycleEndDate'>,
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
      days.push({
        signDate,
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
      | 'ruleId'
      | 'triggerSignDate'
      | 'grantStatus'
      | 'grantResultType'
      | 'ledgerIds'
      | 'lastGrantError'
    >,
  ): CheckInGrantItemDto {
    return {
      id: grant.id,
      ruleId: grant.ruleId,
      triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
      grantStatus: grant.grantStatus as CheckInRewardStatusEnum,
      grantResultType:
        grant.grantResultType as CheckInRewardResultTypeEnum | null,
      ledgerIds: grant.ledgerIds,
      lastGrantError: grant.lastGrantError,
    }
  }
}
