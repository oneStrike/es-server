import type { SQL } from 'drizzle-orm'
import type {
  QueryCheckInReconciliationPageInput,
  QueryMyCheckInRecordPageInput,
} from './check-in.type'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger'
import { Injectable } from '@nestjs/common'
import { and, eq, exists, gte, lte } from 'drizzle-orm'
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
    const recordViews = records.map(record =>
      this.toRecordView(
        record,
        grantMap.get(`${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`) ?? [],
      ),
    )
    const latestRecord = recordViews.at(-1)

    return {
      plan: {
        id: plan.id,
        planCode: plan.planCode,
        planName: plan.planName,
        status: plan.status,
        cycleType: this.parseCycleType(plan.cycleType),
        cycleAnchorDate: this.toDateOnlyValue(plan.cycleAnchorDate),
        allowMakeupCountPerCycle: plan.allowMakeupCountPerCycle,
        baseRewardConfig: cycle.planSnapshot.baseRewardConfig ?? null,
        publishStartAt: plan.publishStartAt,
        publishEndAt: plan.publishEndAt,
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
      todaySigned: records.some(record => this.toDateOnlyValue(record.signDate) === today),
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
    const recordViews = records.map(record =>
      this.toRecordView(
        record,
        grantMap.get(`${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`) ?? [],
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
  async getMyRecords(query: QueryMyCheckInRecordPageInput, userId: number) {
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

    const page = await this.drizzle.ext.findPagination(this.checkInRecordTable, {
      where: and(...conditions),
      ...query,
      orderBy: orderBy || JSON.stringify([{ signDate: 'desc' }, { id: 'desc' }]),
    })

    const grantMap = await this.buildGrantMapForRecords(page.list)
    return {
      ...page,
      list: page.list.map(record =>
        this.toRecordView(
          record,
          grantMap.get(`${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`) ?? [],
        ),
      ),
    }
  }

  /** 分页读取签到奖励对账结果，并按记录维度挂载连续奖励发放列表。 */
  async getReconciliationPage(query: QueryCheckInReconciliationPageInput) {
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
      conditions.push(eq(this.checkInRecordTable.rewardStatus, query.rewardStatus))
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
                eq(this.checkInStreakRewardGrantTable.cycleId, this.checkInRecordTable.cycleId),
                eq(this.checkInStreakRewardGrantTable.triggerSignDate, this.checkInRecordTable.signDate),
                eq(this.checkInStreakRewardGrantTable.grantStatus, query.grantStatus),
              ),
            ),
        ),
      )
    }
    const orderBy = query.orderBy?.trim()

    const page = await this.drizzle.ext.findPagination(this.checkInRecordTable, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...query,
      orderBy:
        orderBy || JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
    })

    const grantMap = await this.buildGrantMapForRecords(page.list)
    return {
      ...page,
      list: page.list.map(record => ({
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
        grants: grantMap.get(`${record.cycleId}:${this.toDateOnlyValue(record.signDate)}`) ?? [],
        createdAt: record.createdAt,
      })),
    }
  }
}
