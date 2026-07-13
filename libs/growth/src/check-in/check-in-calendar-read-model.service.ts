import type { CheckInRecordSelect, CheckInStreakGrantSelect } from '@db/schema'
import type {
  CheckInAdminCalendarDayAggregate,
  CheckInCalendarGrantCountSource,
  CheckInCalendarOverviewCounter,
  CheckInCalendarOverviewGrantAggregateRow,
  CheckInCalendarOverviewRecordAggregateRow,
  CheckInCalendarRecordAggregateSource,
} from './check-in-calendar.type'
import type {
  AppCheckInCalendarDayView,
  CheckInCalendarDayView,
  CheckInGrantItemView,
  CheckInRewardItems,
  CheckInRewardSettlementSummaryRecord,
} from './check-in.type'
import type { QueryAdminCheckInSignedUserPageDto } from './dto/check-in-calendar-query.dto'
import { DrizzleService, toPageResult } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { addDaysToDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInRecordTypeEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

interface CheckInUserCalendarRecordSource {
  signDate: CheckInRecordSelect['signDate']
  recordType: CheckInRecordSelect['recordType']
  resolvedRewardItems: CheckInRecordSelect['resolvedRewardItems']
  resolvedRewardOverviewIconUrl: CheckInRecordSelect['resolvedRewardOverviewIconUrl']
  resolvedMakeupIconUrl: CheckInRecordSelect['resolvedMakeupIconUrl']
  rewardSettlementId?: CheckInRecordSelect['rewardSettlementId']
}

interface CheckInSignedUserSummary {
  id: number
  nickname?: string | null
  avatarUrl?: string | null
}

type CheckInAdminSignedUserRecordSource = Pick<
  CheckInRecordSelect,
  | 'id'
  | 'userId'
  | 'signDate'
  | 'recordType'
  | 'rewardSettlementId'
  | 'resolvedRewardSourceType'
  | 'resolvedRewardRuleKey'
  | 'resolvedRewardItems'
  | 'resolvedRewardOverviewIconUrl'
  | 'resolvedMakeupIconUrl'
  | 'createdAt'
  | 'updatedAt'
>

type CheckInAdminPageGrantSource = Pick<
  CheckInStreakGrantSelect,
  | 'id'
  | 'userId'
  | 'ruleId'
  | 'ruleCode'
  | 'streakDays'
  | 'repeatable'
  | 'rewardOverviewIconUrl'
  | 'triggerSignDate'
  | 'rewardSettlementId'
  | 'createdAt'
  | 'updatedAt'
>

/**
 * 签到日历专用读模型服务。
 *
 * 统一承载 targetDate 周期解析、用户周期日历、后台全局周期日历和按日已签用户分页。
 */
@Injectable()
export class CheckInCalendarReadModelService extends CheckInServiceSupport {
  // 注入签到日历读模型所需的共享依赖。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
    private readonly checkInRewardPolicyService: CheckInRewardPolicyService,
    private readonly checkInMakeupService: CheckInMakeupService,
    private readonly checkInSettlementService: CheckInSettlementService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 为当前用户按目标日期构建所在周期的签到日历。
  async getCurrentUserCalendarByTargetDate(userId: number, targetDate: string) {
    return this.buildUserCalendarByTargetDate(userId, targetDate, {
      includeSettlement: false,
    })
  }

  // 为指定用户按目标日期构建所在周期的签到日历。
  async getSpecifiedUserCalendarByTargetDate(
    userId: number,
    targetDate: string,
  ) {
    await this.ensureUserExists(userId)
    return this.buildUserCalendarByTargetDate(userId, targetDate, {
      includeSettlement: true,
    })
  }

  // 为后台构建目标日期所属周期的全局签到日历。
  async getAdminCalendarByTargetDate(targetDate: string) {
    const today = this.formatDateOnly(new Date())
    const { config, rewardDefinition, window } =
      await this.resolveCalendarContext(targetDate)
    const recordRows = await this.listGlobalCalendarRecordRows(
      window.periodStartDate,
      window.periodEndDate,
    )
    const grantRows = await this.listCalendarGrantCountRows(
      window.periodStartDate,
      window.periodEndDate,
    )

    const grantCountMap = this.buildGrantCountMap(grantRows)
    const recordBucketMap = this.buildRecordBucketMap(recordRows)
    const days: CheckInAdminCalendarDayAggregate[] = []
    let cursor = window.periodStartDate
    let dayIndex = 1
    while (cursor <= window.periodEndDate) {
      const rewardProjection =
        this.checkInRewardPolicyService.resolveRewardForDate(
          rewardDefinition,
          cursor,
          Number(config.makeupPeriodType),
        )
      const records = recordBucketMap.get(cursor) ?? []
      days.push({
        signDate: cursor,
        dayIndex,
        isToday: cursor === today,
        isFuture: cursor > today,
        signedCount: this.countDistinctUserIds(records),
        normalSignCount: this.countDistinctUserIdsByRecordType(
          records,
          CheckInRecordTypeEnum.NORMAL,
        ),
        makeupSignCount: this.countDistinctUserIdsByRecordType(
          records,
          CheckInRecordTypeEnum.MAKEUP,
        ),
        streakRewardTriggerCount: grantCountMap.get(cursor) ?? 0,
        baseRewardConfigProjectionOverview:
          rewardProjection.resolvedRewardItems ?? null,
        baseRewardConfigProjectionOverviewIconUrl:
          rewardProjection.resolvedRewardOverviewIconUrl ?? null,
        baseRewardActualOverview:
          this.aggregateRewardItemsFromRecords(records) ?? null,
        baseRewardActualOverviewIconUrl:
          this.aggregateRewardOverviewIconFromRecords(records) ?? null,
      })
      cursor = addDaysToDateOnlyInAppTimeZone(cursor, 1)!
      dayIndex += 1
    }

    return {
      periodType: window.periodType,
      periodKey: window.periodKey,
      periodStartDate: window.periodStartDate,
      periodEndDate: window.periodEndDate,
      days,
    }
  }

  // 为后台配置面板构建目标周期轻量概览，不读取奖励 JSON、图标或补偿诊断字段。
  async getAdminCalendarOverviewByTargetDate(targetDate: string) {
    const today = this.formatDateOnly(new Date())
    const { window, targetDateValue } =
      await this.resolveCalendarContext(targetDate)
    const cutoffDate =
      window.periodEndDate < today ? window.periodEndDate : today
    const [recordRows, grantRows] = await Promise.all([
      this.listCalendarOverviewRecordAggregateRows(
        window.periodStartDate,
        cutoffDate,
      ),
      this.listCalendarOverviewGrantAggregateRows(
        window.periodStartDate,
        cutoffDate,
      ),
    ])
    const counterMap = this.buildOverviewCounterMap(recordRows, grantRows)
    const emptyCounter = this.emptyOverviewCounter()

    return {
      periodType: window.periodType,
      periodKey: window.periodKey,
      periodStartDate: window.periodStartDate,
      periodEndDate: window.periodEndDate,
      targetDay: {
        signDate: targetDateValue,
        ...(counterMap.get(targetDateValue) ?? emptyCounter),
      },
      periodToDate: this.sumOverviewCounters(counterMap),
      cutoffDate,
    }
  }

  // 为后台分页查询某日已签用户列表。
  async getAdminSignedUserPageByTargetDate(
    query: QueryAdminCheckInSignedUserPageDto,
  ) {
    const signDate = this.parseDateOnly(query.targetDate, '目标日期')
    const where = eq(this.checkInRecordTable.signDate, signDate)
    const pageQuery = this.drizzle.buildPage(query)
    const orderQuery = this.drizzle.buildOrderBy(
      [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      { table: this.checkInRecordTable },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildAdminSignedUserRecordSelect())
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
    const grantMap = await this.buildGrantMapForPageRecords(page.list)
    const userMap = await this.buildSignedUserMap(
      page.list.map((record) => record.userId),
    )

    return {
      ...page,
      list: page.list.map((record) => ({
        ...this.toRecordItemView(record, settlementMap, grantMap),
        user: userMap.get(record.userId) ?? null,
      })),
    }
  }

  // 为单用户日历统一构建目标日期所属周期的日历响应。
  private async buildUserCalendarByTargetDate(
    userId: number,
    targetDate: string,
    options: { includeSettlement: boolean },
  ) {
    const today = this.formatDateOnly(new Date())
    const { rewardDefinition, window } =
      await this.resolveCalendarContext(targetDate)
    const records = options.includeSettlement
      ? await this.listSpecifiedUserCalendarRecordRows(
          userId,
          window.periodStartDate,
          window.periodEndDate,
        )
      : await this.listCurrentUserCalendarRecordRows(
          userId,
          window.periodStartDate,
          window.periodEndDate,
        )
    const settlementMap = options.includeSettlement
      ? await this.checkInSettlementService.buildSettlementMapById(
          records
            .map((record) => record.rewardSettlementId)
            .filter((id): id is number => typeof id === 'number'),
        )
      : new Map<number, CheckInRewardSettlementSummaryRecord>()
    const grantCountMap = await this.buildUserGrantCountMap(
      userId,
      window.periodStartDate,
      window.periodEndDate,
    )
    const recordMap = new Map(
      records.map((record) => [this.toDateOnlyValue(record.signDate), record]),
    )

    const days: Array<AppCheckInCalendarDayView | CheckInCalendarDayView> = []
    let cursor = window.periodStartDate
    let dayIndex = 1
    while (cursor <= window.periodEndDate) {
      const record = recordMap.get(cursor)
      const rewardProjection =
        this.checkInRewardPolicyService.resolveRewardForDate(
          rewardDefinition,
          cursor,
          window.periodType,
        )
      const rewardItems = record
        ? this.checkInRewardPolicyService.parseStoredRewardItems(
            record.resolvedRewardItems,
            {
              allowEmpty: true,
            },
          )
        : rewardProjection.resolvedRewardItems
      days.push({
        signDate: cursor,
        dayIndex,
        isToday: cursor === today,
        isFuture: cursor > today,
        isSigned: !!record,
        grantCount: grantCountMap.get(cursor) ?? 0,
        rewardItems,
        rewardOverviewIconUrl: record
          ? (record.resolvedRewardOverviewIconUrl ?? null)
          : (rewardProjection.resolvedRewardOverviewIconUrl ?? null),
        makeupIconUrl:
          record?.recordType === CheckInRecordTypeEnum.MAKEUP
            ? record.resolvedMakeupIconUrl
            : null,
        ...(options.includeSettlement
          ? {
              rewardSettlement: record?.rewardSettlementId
                ? this.checkInSettlementService.toRewardSettlementSummary(
                    settlementMap.get(record.rewardSettlementId) ?? null,
                  )
                : null,
            }
          : {}),
      })
      cursor = addDaysToDateOnlyInAppTimeZone(cursor, 1)!
      dayIndex += 1
    }

    return {
      periodType: window.periodType,
      periodKey: window.periodKey,
      periodStartDate: window.periodStartDate,
      periodEndDate: window.periodEndDate,
      days,
    }
  }

  // 解析目标日期所属的配置、奖励定义和周期窗口。
  private async resolveCalendarContext(targetDate: string) {
    const targetDateValue = this.parseDateOnly(targetDate, '目标日期')
    const config = await this.getRequiredConfig()
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)
    const periodType = Number(config.makeupPeriodType)
    const window = this.checkInMakeupService.buildMakeupWindow(
      targetDateValue,
      periodType,
    )

    return {
      config,
      rewardDefinition,
      targetDateValue,
      window,
    }
  }

  // app 日历不读取奖励结算关联或事实诊断字段。
  private async listCurrentUserCalendarRecordRows(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<CheckInUserCalendarRecordSource[]> {
    return this.db
      .select(this.buildAppUserCalendarRecordSelect())
      .from(this.checkInRecordTable)
      .where(
        and(
          eq(this.checkInRecordTable.userId, userId),
          gte(this.checkInRecordTable.signDate, startDate),
          lte(this.checkInRecordTable.signDate, endDate),
        ),
      )
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  // 指定用户的后台日历仅额外读取奖励结算关联。
  private async listSpecifiedUserCalendarRecordRows(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<CheckInUserCalendarRecordSource[]> {
    return this.db
      .select(this.buildAdminUserCalendarRecordSelect())
      .from(this.checkInRecordTable)
      .where(
        and(
          eq(this.checkInRecordTable.userId, userId),
          gte(this.checkInRecordTable.signDate, startDate),
          lte(this.checkInRecordTable.signDate, endDate),
        ),
      )
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  // 查询目标周期内用于后台全局聚合的最小签到事实。
  private async listGlobalCalendarRecordRows(
    startDate: string,
    endDate: string,
  ) {
    return this.db
      .select({
        userId: this.checkInRecordTable.userId,
        signDate: this.checkInRecordTable.signDate,
        recordType: this.checkInRecordTable.recordType,
        resolvedRewardItems: this.checkInRecordTable.resolvedRewardItems,
        resolvedRewardOverviewIconUrl:
          this.checkInRecordTable.resolvedRewardOverviewIconUrl,
      })
      .from(this.checkInRecordTable)
      .where(
        and(
          gte(this.checkInRecordTable.signDate, startDate),
          lte(this.checkInRecordTable.signDate, endDate),
        ),
      )
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  // 查询目标周期内的连续奖励触发行。
  private async listCalendarGrantCountRows(startDate: string, endDate: string) {
    return this.db
      .select({
        id: this.checkInStreakGrantTable.id,
        triggerSignDate: this.checkInStreakGrantTable.triggerSignDate,
      })
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          gte(this.checkInStreakGrantTable.triggerSignDate, startDate),
          lte(this.checkInStreakGrantTable.triggerSignDate, endDate),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )
  }

  private async listCalendarOverviewRecordAggregateRows(
    startDate: string,
    endDate: string,
  ) {
    if (endDate < startDate) {
      return [] satisfies CheckInCalendarOverviewRecordAggregateRow[]
    }

    return this.db
      .select({
        signDate: this.checkInRecordTable.signDate,
        signedCount:
          sql<number>`count(distinct ${this.checkInRecordTable.userId})::int`.mapWith(
            Number,
          ),
        normalSignCount:
          sql<number>`count(distinct case when ${this.checkInRecordTable.recordType} = ${CheckInRecordTypeEnum.NORMAL} then ${this.checkInRecordTable.userId} end)::int`.mapWith(
            Number,
          ),
        makeupSignCount:
          sql<number>`count(distinct case when ${this.checkInRecordTable.recordType} = ${CheckInRecordTypeEnum.MAKEUP} then ${this.checkInRecordTable.userId} end)::int`.mapWith(
            Number,
          ),
      })
      .from(this.checkInRecordTable)
      .where(
        and(
          gte(this.checkInRecordTable.signDate, startDate),
          lte(this.checkInRecordTable.signDate, endDate),
        ),
      )
      .groupBy(this.checkInRecordTable.signDate)
      .orderBy(asc(this.checkInRecordTable.signDate))
  }

  private async listCalendarOverviewGrantAggregateRows(
    startDate: string,
    endDate: string,
  ) {
    if (endDate < startDate) {
      return [] satisfies CheckInCalendarOverviewGrantAggregateRow[]
    }

    return this.db
      .select({
        signDate: this.checkInStreakGrantTable.triggerSignDate,
        streakRewardTriggerCount:
          sql<number>`count(${this.checkInStreakGrantTable.id})::int`.mapWith(
            Number,
          ),
      })
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          gte(this.checkInStreakGrantTable.triggerSignDate, startDate),
          lte(this.checkInStreakGrantTable.triggerSignDate, endDate),
        ),
      )
      .groupBy(this.checkInStreakGrantTable.triggerSignDate)
      .orderBy(asc(this.checkInStreakGrantTable.triggerSignDate))
  }

  private buildOverviewCounterMap(
    recordRows: CheckInCalendarOverviewRecordAggregateRow[],
    grantRows: CheckInCalendarOverviewGrantAggregateRow[],
  ) {
    const counterMap = new Map<string, CheckInCalendarOverviewCounter>()
    for (const row of recordRows) {
      counterMap.set(this.toDateOnlyValue(row.signDate), {
        signedCount: Number(row.signedCount) || 0,
        normalSignCount: Number(row.normalSignCount) || 0,
        makeupSignCount: Number(row.makeupSignCount) || 0,
        streakRewardTriggerCount: 0,
      })
    }
    for (const row of grantRows) {
      const signDate = this.toDateOnlyValue(row.signDate)
      counterMap.set(signDate, {
        ...(counterMap.get(signDate) ?? this.emptyOverviewCounter()),
        streakRewardTriggerCount: Number(row.streakRewardTriggerCount) || 0,
      })
    }
    return counterMap
  }

  private sumOverviewCounters(
    counterMap: Map<string, CheckInCalendarOverviewCounter>,
  ) {
    const total = this.emptyOverviewCounter()
    for (const counter of counterMap.values()) {
      total.signedCount += counter.signedCount
      total.normalSignCount += counter.normalSignCount
      total.makeupSignCount += counter.makeupSignCount
      total.streakRewardTriggerCount += counter.streakRewardTriggerCount
    }
    return total
  }

  private emptyOverviewCounter(): CheckInCalendarOverviewCounter {
    return {
      signedCount: 0,
      normalSignCount: 0,
      makeupSignCount: 0,
      streakRewardTriggerCount: 0,
    }
  }

  // 查询单用户目标周期内的连续奖励触发行。
  private async listUserCalendarGrantCountRows(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    return this.db
      .select({
        id: this.checkInStreakGrantTable.id,
        triggerSignDate: this.checkInStreakGrantTable.triggerSignDate,
      })
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          eq(this.checkInStreakGrantTable.userId, userId),
          gte(this.checkInStreakGrantTable.triggerSignDate, startDate),
          lte(this.checkInStreakGrantTable.triggerSignDate, endDate),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )
  }

  // 构建单用户目标周期的连续奖励触发计数映射。
  private async buildUserGrantCountMap(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    return this.buildGrantCountMap(
      await this.listUserCalendarGrantCountRows(userId, startDate, endDate),
    )
  }

  // 按自然日构建连续奖励触发次数映射。
  private buildGrantCountMap(rows: CheckInCalendarGrantCountSource[]) {
    const grantCountMap = new Map<string, number>()
    for (const row of rows) {
      const signDate = this.toDateOnlyValue(row.triggerSignDate)
      grantCountMap.set(signDate, (grantCountMap.get(signDate) ?? 0) + 1)
    }
    return grantCountMap
  }

  // 按自然日分桶后台聚合所需的签到事实。
  private buildRecordBucketMap(rows: CheckInCalendarRecordAggregateSource[]) {
    const recordBucketMap = new Map<
      string,
      CheckInCalendarRecordAggregateSource[]
    >()
    for (const row of rows) {
      const signDate = this.toDateOnlyValue(row.signDate)
      const records = recordBucketMap.get(signDate) ?? []
      records.push(row)
      recordBucketMap.set(signDate, records)
    }
    return recordBucketMap
  }

  // 统计某日已签到的 distinct userId 数量。
  private countDistinctUserIds(rows: CheckInCalendarRecordAggregateSource[]) {
    return new Set(rows.map((row) => row.userId)).size
  }

  // 统计某日指定签到类型的 distinct userId 数量。
  private countDistinctUserIdsByRecordType(
    rows: CheckInCalendarRecordAggregateSource[],
    recordType: CheckInRecordTypeEnum,
  ) {
    return new Set(
      rows
        .filter((row) => row.recordType === recordType)
        .map((row) => row.userId),
    ).size
  }

  // 按冻结奖励快照聚合某日基础奖励实际概览。
  private aggregateRewardItemsFromRecords(
    rows: CheckInCalendarRecordAggregateSource[],
  ) {
    const rewardItemMap = new Map<string, CheckInRewardItems[number]>()
    for (const row of rows) {
      const rewardItems =
        this.checkInRewardPolicyService.parseStoredRewardItems(
          row.resolvedRewardItems,
          {
            allowEmpty: true,
          },
        )
      if (!rewardItems) {
        continue
      }
      for (const rewardItem of rewardItems) {
        const rewardKey = `${rewardItem.assetType}:${rewardItem.assetKey ?? ''}:${rewardItem.iconUrl ?? ''}`
        const previous = rewardItemMap.get(rewardKey)
        rewardItemMap.set(rewardKey, {
          assetType: rewardItem.assetType,
          assetKey: rewardItem.assetKey ?? '',
          amount: (previous?.amount ?? 0) + rewardItem.amount,
          iconUrl: rewardItem.iconUrl ?? null,
        })
      }
    }

    const rewardOverview = [...rewardItemMap.values()].sort((left, right) =>
      `${left.assetType}:${left.assetKey ?? ''}`.localeCompare(
        `${right.assetType}:${right.assetKey ?? ''}`,
      ),
    )
    return rewardOverview.length > 0 ? rewardOverview : null
  }

  // 聚合后台当日基础奖励实际概览图标；若同日存在多个不同图标则返回空值。
  private aggregateRewardOverviewIconFromRecords(
    rows: CheckInCalendarRecordAggregateSource[],
  ) {
    const iconSet = new Set(
      rows
        .map((row) => row.resolvedRewardOverviewIconUrl?.trim())
        .filter((iconUrl): iconUrl is string => Boolean(iconUrl)),
    )
    if (iconSet.size !== 1) {
      return null
    }
    return [...iconSet][0]
  }

  // 构建已签用户列表所需的用户摘要映射。
  private async buildSignedUserMap(userIds: number[]) {
    const distinctUserIds = [...new Set(userIds)]
    if (distinctUserIds.length === 0) {
      return new Map<number, CheckInSignedUserSummary>()
    }

    const users = await this.db
      .select({
        id: this.drizzle.schema.appUser.id,
        nickname: this.drizzle.schema.appUser.nickname,
        avatarUrl: this.drizzle.schema.appUser.avatarUrl,
      })
      .from(this.drizzle.schema.appUser)
      .where(inArray(this.drizzle.schema.appUser.id, distinctUserIds))

    return new Map(users.map((user) => [user.id, user]))
  }

  // 构建分页记录到连续奖励列表的映射。
  private async buildGrantMapForPageRecords(
    records: Pick<CheckInRecordSelect, 'userId' | 'signDate'>[],
  ) {
    if (records.length === 0) {
      return new Map<string, CheckInGrantItemView[]>()
    }

    const grants: CheckInAdminPageGrantSource[] = await this.db
      .select(this.buildAdminPageGrantSelect())
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          inArray(this.checkInStreakGrantTable.userId, [
            ...new Set(records.map((record) => record.userId)),
          ]),
          inArray(this.checkInStreakGrantTable.triggerSignDate, [
            ...new Set(
              records.map((record) => this.toDateOnlyValue(record.signDate)),
            ),
          ]),
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
      const grantKey = `${grant.userId}:${this.toDateOnlyValue(grant.triggerSignDate)}`
      const items = grantMap.get(grantKey) ?? []
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
      })
      grantMap.set(grantKey, items)
    }
    return grantMap
  }

  // 把单条签到事实映射成后台已签用户分页项。
  private toRecordItemView(
    record: CheckInAdminSignedUserRecordSource,
    settlementMap: Map<number, CheckInRewardSettlementSummaryRecord>,
    grantMap: Map<string, CheckInGrantItemView[]>,
  ) {
    const signDate = this.toDateOnlyValue(record.signDate)
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      signDate,
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
      grants: grantMap.get(`${record.userId}:${signDate}`) ?? [],
    }
  }

  // 当前用户日历只需要渲染当日奖励和补签图标。
  private buildAppUserCalendarRecordSelect() {
    return {
      signDate: this.checkInRecordTable.signDate,
      recordType: this.checkInRecordTable.recordType,
      resolvedRewardItems: this.checkInRecordTable.resolvedRewardItems,
      resolvedRewardOverviewIconUrl:
        this.checkInRecordTable.resolvedRewardOverviewIconUrl,
      resolvedMakeupIconUrl: this.checkInRecordTable.resolvedMakeupIconUrl,
    }
  }

  // 后台指定用户日历仅额外关联奖励结算摘要。
  private buildAdminUserCalendarRecordSelect() {
    return {
      signDate: this.checkInRecordTable.signDate,
      recordType: this.checkInRecordTable.recordType,
      resolvedRewardItems: this.checkInRecordTable.resolvedRewardItems,
      resolvedRewardOverviewIconUrl:
        this.checkInRecordTable.resolvedRewardOverviewIconUrl,
      resolvedMakeupIconUrl: this.checkInRecordTable.resolvedMakeupIconUrl,
      rewardSettlementId: this.checkInRecordTable.rewardSettlementId,
    }
  }

  // 后台已签用户分页保留当前稳定输出和结算关联，排除业务幂等与诊断字段。
  private buildAdminSignedUserRecordSelect() {
    return {
      id: this.checkInRecordTable.id,
      userId: this.checkInRecordTable.userId,
      signDate: this.checkInRecordTable.signDate,
      recordType: this.checkInRecordTable.recordType,
      rewardSettlementId: this.checkInRecordTable.rewardSettlementId,
      resolvedRewardSourceType:
        this.checkInRecordTable.resolvedRewardSourceType,
      resolvedRewardRuleKey: this.checkInRecordTable.resolvedRewardRuleKey,
      resolvedRewardItems: this.checkInRecordTable.resolvedRewardItems,
      resolvedRewardOverviewIconUrl:
        this.checkInRecordTable.resolvedRewardOverviewIconUrl,
      resolvedMakeupIconUrl: this.checkInRecordTable.resolvedMakeupIconUrl,
      createdAt: this.checkInRecordTable.createdAt,
      updatedAt: this.checkInRecordTable.updatedAt,
    }
  }

  // 已签用户分页的连续奖励只读取展示与结算摘要所需字段。
  private buildAdminPageGrantSelect() {
    return {
      id: this.checkInStreakGrantTable.id,
      userId: this.checkInStreakGrantTable.userId,
      ruleId: this.checkInStreakGrantTable.ruleId,
      ruleCode: this.checkInStreakGrantTable.ruleCode,
      streakDays: this.checkInStreakGrantTable.streakDays,
      repeatable: this.checkInStreakGrantTable.repeatable,
      rewardOverviewIconUrl: this.checkInStreakGrantTable.rewardOverviewIconUrl,
      triggerSignDate: this.checkInStreakGrantTable.triggerSignDate,
      rewardSettlementId: this.checkInStreakGrantTable.rewardSettlementId,
      createdAt: this.checkInStreakGrantTable.createdAt,
      updatedAt: this.checkInStreakGrantTable.updatedAt,
    }
  }
}
