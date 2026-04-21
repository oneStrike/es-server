import type { PageDto } from '@libs/platform/dto/page.dto'
import type { SQL } from 'drizzle-orm'
import type {
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, desc, eq, exists, gte, inArray, lte } from 'drizzle-orm'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到运行时读模型服务。
 *
 * 负责 app 侧摘要、日历、记录、排行榜以及 admin 侧对账读模型。
 */
@Injectable()
export class CheckInRuntimeService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  async getSummary(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const config = await this.getRequiredConfig()
    const makeup = await this.buildCurrentMakeupAccountView(
      userId,
      config,
      today,
    )
    const activeRules = await this.listActiveStreakRulesAt(now)
    const rewardRules = this.toStreakRewardRuleViews(activeRules, now)
    const progress = await this.db.query.checkInStreakProgress.findFirst({
      where: { userId },
    })
    const effectiveCurrentStreak = this.resolveEffectiveCurrentStreak(
      progress?.currentStreak ?? 0,
      progress?.lastSignedDate,
      today,
    )
    const effectiveLastSignedDate = this.resolveEffectiveLastSignedDate(
      progress?.lastSignedDate,
      today,
    )
    const latestRecord = await this.getLatestRecord(userId)

    return {
      config: this.toConfigDetailView(config),
      makeup,
      streak: {
        currentStreak: effectiveCurrentStreak,
        streakStartedAt:
          effectiveCurrentStreak > 0 && progress?.streakStartedAt
            ? this.toDateOnlyValue(progress.streakStartedAt)
            : undefined,
        lastSignedDate: effectiveLastSignedDate,
        nextReward:
          this.resolveNextStreakReward(rewardRules, effectiveCurrentStreak) ??
          null,
      },
      todaySigned: await this.hasRecordForDate(userId, today),
      latestRecord: latestRecord
        ? await this.buildRecordItemView(latestRecord)
        : null,
    }
  }

  async getCalendar(userId: number) {
    const today = this.formatDateOnly(new Date())
    const config = await this.getRequiredConfig()
    const rewardDefinition = this.parseRewardDefinition(config)
    const makeup = await this.buildCurrentMakeupAccountView(
      userId,
      config,
      today,
    )
    const records = await this.listRecordsInDateRange(
      userId,
      makeup.periodStartDate,
      makeup.periodEndDate,
    )
    const settlementMap = await this.buildSettlementMapById(
      records
        .map((record) => record.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    const grantMap = await this.buildGrantMapForRecords(records)
    const recordMap = new Map(
      records.map((record) => [this.toDateOnlyValue(record.signDate), record]),
    )

    const days: Array<Record<string, unknown>> = []
    let cursor = makeup.periodStartDate
    let dayIndex = 1
    while (cursor <= makeup.periodEndDate) {
      const record = recordMap.get(cursor)
      const rewardItems = record
        ? this.parseStoredRewardItems(record.resolvedRewardItems, {
            allowEmpty: true,
          })
        : this.resolveRewardForDate(rewardDefinition, cursor, makeup.periodType)
            .resolvedRewardItems
      days.push({
        signDate: cursor,
        dayIndex,
        isToday: cursor === today,
        isFuture: cursor > today,
        isSigned: !!record,
        grantCount: grantMap.get(`${userId}:${cursor}`)?.length ?? 0,
        rewardItems,
        rewardSettlement: record?.rewardSettlementId
          ? this.toRewardSettlementSummary(
              settlementMap.get(record.rewardSettlementId) ?? null,
            )
          : null,
      })
      cursor = this.formatDateOnly(
        new Date(
          dayjs
            .tz(cursor, 'YYYY-MM-DD', this.getAppTimeZone())
            .add(1, 'day')
            .toISOString(),
        ),
      )
      dayIndex += 1
    }

    return {
      periodType: makeup.periodType,
      periodKey: makeup.periodKey,
      periodStartDate: makeup.periodStartDate,
      periodEndDate: makeup.periodEndDate,
      days,
    }
  }

  async getMyRecords(query: PageDto, userId: number) {
    const conditions = [eq(this.checkInRecordTable.userId, userId)]
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

    const page = await this.drizzle.ext.findPagination(this.checkInRecordTable, {
      where: and(...conditions),
      ...query,
      orderBy:
        query.orderBy?.trim() ||
        JSON.stringify([{ signDate: 'desc' }, { id: 'desc' }]),
    })

    return {
      ...page,
      list: await Promise.all(
        page.list.map(async (record) => this.buildRecordItemView(record)),
      ),
    }
  }

  async getLeaderboardPage(query: QueryCheckInLeaderboardDto) {
    const today = this.formatDateOnly(new Date())
    const page = await this.drizzle.ext.findPagination(
      this.checkInStreakProgressTable,
      {
        where: this.buildActiveStreakProgressWhere(today),
        ...query,
        orderBy: JSON.stringify([
          { currentStreak: 'desc' },
          { lastSignedDate: 'desc' },
          { id: 'asc' },
        ]),
      },
    )

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
      list: page.list.map((item, index) => ({
        rank: (page.pageIndex - 1) * page.pageSize + index + 1,
        user: userMap.get(item.userId),
        currentStreak: item.currentStreak,
        lastSignedDate: item.lastSignedDate
          ? this.toDateOnlyValue(item.lastSignedDate)
          : undefined,
      })),
    }
  }

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

    const page = await this.drizzle.ext.findPagination(this.checkInRecordTable, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...query,
      orderBy:
        query.orderBy?.trim() ||
        JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
    })

    const settlementMap = await this.buildSettlementMapById(
      page.list
        .map((record) => record.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    const grantMap = await this.buildGrantMapForRecords(page.list)

    return {
      ...page,
      list: page.list.map((record) => ({
        recordId: record.id,
        userId: record.userId,
        signDate: this.toDateOnlyValue(record.signDate),
        recordType: record.recordType,
        rewardSettlementId: record.rewardSettlementId,
        resolvedRewardSourceType: record.resolvedRewardSourceType,
        resolvedRewardRuleKey: record.resolvedRewardRuleKey,
        resolvedRewardItems: this.parseStoredRewardItems(
          record.resolvedRewardItems,
          {
            allowEmpty: true,
          },
        ),
        rewardSettlement: record.rewardSettlementId
          ? this.toRewardSettlementSummary(
              settlementMap.get(record.rewardSettlementId) ?? null,
            )
          : null,
        grants:
          grantMap.get(
            `${record.userId}:${this.toDateOnlyValue(record.signDate)}`,
          ) ?? [],
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
    }
  }

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

  private async listRecordsInDateRange(
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

  private async buildRecordItemView(
    record: typeof this.checkInRecordTable.$inferSelect,
  ) {
    const settlementMap = await this.buildSettlementMapById(
      typeof record.rewardSettlementId === 'number'
        ? [record.rewardSettlementId]
        : [],
    )
    const grants = await this.listGrantsForRecord(
      record.userId,
      this.toDateOnlyValue(record.signDate),
    )

    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      rewardSettlementId: record.rewardSettlementId,
      resolvedRewardSourceType: record.resolvedRewardSourceType,
      resolvedRewardRuleKey: record.resolvedRewardRuleKey,
      resolvedRewardItems: this.parseStoredRewardItems(
        record.resolvedRewardItems,
        {
          allowEmpty: true,
        },
      ),
      rewardSettlement: record.rewardSettlementId
        ? this.toRewardSettlementSummary(
            settlementMap.get(record.rewardSettlementId) ?? null,
          )
        : null,
      grants,
    }
  }

  private async listGrantsForRecord(userId: number, signDate: string) {
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

    const rewardItemMap = await this.buildGrantRewardItemMap(
      grants.map((grant) => grant.id),
    )
    const settlementMap = await this.buildSettlementMapById(
      grants
        .map((grant) => grant.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    return grants.map((grant) => ({
      id: grant.id,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      userId: grant.userId,
      ruleId: grant.ruleId,
      ruleCode: grant.ruleCode,
      streakDays: grant.streakDays,
      rewardItems: rewardItemMap.get(grant.id) ?? [],
      repeatable: grant.repeatable,
      triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
      rewardSettlementId: grant.rewardSettlementId,
      rewardSettlement: grant.rewardSettlementId
        ? this.toRewardSettlementSummary(
            settlementMap.get(grant.rewardSettlementId) ?? null,
          )
        : null,
    }))
  }

  private async buildGrantMapForRecords(
    records: Array<
      Pick<typeof this.checkInRecordTable.$inferSelect, 'userId' | 'signDate'>
    >,
  ) {
    if (records.length === 0) {
      return new Map<string, Array<Record<string, unknown>>>()
    }
    const userIds = [...new Set(records.map((record) => record.userId))]
    const signDates = [
      ...new Set(records.map((record) => this.toDateOnlyValue(record.signDate))),
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

    const rewardItemMap = await this.buildGrantRewardItemMap(
      grants.map((grant) => grant.id),
    )
    const settlementMap = await this.buildSettlementMapById(
      grants
        .map((grant) => grant.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )

    const grantMap = new Map<string, Array<Record<string, unknown>>>()
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
        repeatable: grant.repeatable,
        triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
        rewardSettlementId: grant.rewardSettlementId,
        rewardSettlement: grant.rewardSettlementId
          ? this.toRewardSettlementSummary(
              settlementMap.get(grant.rewardSettlementId) ?? null,
            )
          : null,
      })
      grantMap.set(key, items)
    }
    return grantMap
  }

  private buildGrantReconciliationCondition(
    query: QueryCheckInReconciliationDto,
  ) {
    const grantConditions: SQL[] = []

    if (query.ruleId !== undefined) {
      grantConditions.push(eq(this.checkInStreakGrantTable.ruleId, query.ruleId))
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

  private toConfigDetailView(config: typeof this.checkInConfigTable.$inferSelect) {
    const rewardDefinition = this.parseRewardDefinition(config)
    return {
      id: config.id,
      isEnabled: config.isEnabled === 1,
      makeupPeriodType: config.makeupPeriodType,
      periodicAllowance: config.periodicAllowance,
      baseRewardItems: rewardDefinition.baseRewardItems,
      dateRewardRules: rewardDefinition.dateRewardRules,
      patternRewardRules: rewardDefinition.patternRewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }
}
