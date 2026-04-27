import type { CheckInRecordSelect } from '@db/schema'
import type {
  CheckInAdminCalendarDayAggregate,
  CheckInCalendarGrantCountSource,
  CheckInCalendarRecordAggregateSource,
} from './check-in-calendar.type'
import type {
  CheckInCalendarDayView,
  CheckInGrantItemView,
  CheckInRewardItems,
  CheckInRewardSettlementSummaryRecord,
} from './check-in.type'
import type { QueryAdminCheckInSignedUserPageDto } from './dto/check-in-calendar-query.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { addDaysToDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInMakeupPeriodTypeEnum, CheckInRecordTypeEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

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
    return this.buildUserCalendarByTargetDate(userId, targetDate)
  }

  // 为指定用户按目标日期构建所在周期的签到日历。
  async getSpecifiedUserCalendarByTargetDate(
    userId: number,
    targetDate: string,
  ) {
    await this.ensureUserExists(userId)
    return this.buildUserCalendarByTargetDate(userId, targetDate)
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
          Number(config.makeupPeriodType) as CheckInMakeupPeriodTypeEnum,
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
        baseRewardConfigProjectionOverview: rewardProjection.resolvedRewardItems,
        baseRewardConfigProjectionOverviewIconUrl:
          rewardProjection.resolvedRewardOverviewIconUrl,
        baseRewardActualOverview: this.aggregateRewardItemsFromRecords(records),
        baseRewardActualOverviewIconUrl:
          this.aggregateRewardOverviewIconFromRecords(records),
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

  // 为后台分页查询某日已签用户列表。
  async getAdminSignedUserPageByTargetDate(
    query: QueryAdminCheckInSignedUserPageDto,
  ) {
    const signDate = this.parseDateOnly(query.targetDate, '目标日期')
    const page = await this.drizzle.ext.findPagination(this.checkInRecordTable, {
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      where: eq(this.checkInRecordTable.signDate, signDate),
      orderBy: JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
    })

    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
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
  ) {
    const today = this.formatDateOnly(new Date())
    const { rewardDefinition, window } =
      await this.resolveCalendarContext(targetDate)
    const records = await this.listUserCalendarRecordRows(
      userId,
      window.periodStartDate,
      window.periodEndDate,
    )
    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
      records
        .map((record) => record.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    const grantCountMap = await this.buildUserGrantCountMap(
      userId,
      window.periodStartDate,
      window.periodEndDate,
    )
    const recordMap = new Map(
      records.map((record) => [this.toDateOnlyValue(record.signDate), record]),
    )

    const days: CheckInCalendarDayView[] = []
    let cursor = window.periodStartDate
    let dayIndex = 1
    while (cursor <= window.periodEndDate) {
      const record = recordMap.get(cursor)
      const rewardProjection = this.checkInRewardPolicyService.resolveRewardForDate(
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
          ? record.resolvedRewardOverviewIconUrl
          : rewardProjection.resolvedRewardOverviewIconUrl,
        makeupIconUrl:
          record?.recordType === CheckInRecordTypeEnum.MAKEUP
            ? record.resolvedMakeupIconUrl
            : null,
        rewardSettlement: record?.rewardSettlementId
          ? this.checkInSettlementService.toRewardSettlementSummary(
              settlementMap.get(record.rewardSettlementId) ?? null,
            )
          : null,
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
    const periodType = Number(
      config.makeupPeriodType,
    ) as CheckInMakeupPeriodTypeEnum
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

  // 查询单用户在目标周期内的签到事实。
  private async listUserCalendarRecordRows(
    userId: number,
    startDate: string,
    endDate: string,
  ) {
    return this.db
      .select()
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
  private async listGlobalCalendarRecordRows(startDate: string, endDate: string) {
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
    const recordBucketMap = new Map<string, CheckInCalendarRecordAggregateSource[]>()
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
      const rewardItems = this.checkInRewardPolicyService.parseStoredRewardItems(
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
      return new Map<
        number,
        { id: number, nickname?: string | null, avatarUrl?: string | null }
      >()
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
  private async buildGrantMapForPageRecords(records: CheckInRecordSelect[]) {
    if (records.length === 0) {
      return new Map<string, CheckInGrantItemView[]>()
    }

    const grants = await this.db
      .select()
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          inArray(
            this.checkInStreakGrantTable.userId,
            [...new Set(records.map((record) => record.userId))],
          ),
          inArray(
            this.checkInStreakGrantTable.triggerSignDate,
            [
              ...new Set(
                records.map((record) => this.toDateOnlyValue(record.signDate)),
              ),
            ],
          ),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )

    const rewardItemMap = await this.checkInSettlementService.buildGrantRewardItemMap(
      grants.map((grant) => grant.id),
    )
    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
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
        rewardSettlementId: grant.rewardSettlementId,
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
    record: CheckInRecordSelect,
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
      rewardSettlementId: record.rewardSettlementId,
      resolvedRewardSourceType: record.resolvedRewardSourceType,
      resolvedRewardRuleKey: record.resolvedRewardRuleKey,
      resolvedRewardItems: this.checkInRewardPolicyService.parseStoredRewardItems(
        record.resolvedRewardItems,
        {
          allowEmpty: true,
        },
      ),
      rewardSettlement: record.rewardSettlementId
        ? this.checkInSettlementService.toRewardSettlementSummary(
            settlementMap.get(record.rewardSettlementId) ?? null,
          )
        : null,
      grants: grantMap.get(`${record.userId}:${signDate}`) ?? [],
    }
  }
}
