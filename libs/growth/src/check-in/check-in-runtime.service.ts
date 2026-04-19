import type { PageDto } from '@libs/platform/dto/page.dto'
import type { SQL } from 'drizzle-orm'
import type {
  QueryCheckInActivityStreakPageDto,
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, desc, eq, exists, gte, inArray, lte } from 'drizzle-orm'
import { CheckInActivityStreakStatusEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到运行时读模型服务。
 *
 * 负责 app 侧摘要、日历、记录、排行榜、活动连续签到读模型以及 admin 侧对账读模型。
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
    const currentDailyConfig =
      await this.getRequiredCurrentDailyStreakConfig(now)
    const configDefinition =
      this.parseDailyStreakConfigDefinition(currentDailyConfig)
    const progress = await this.db.query.checkInDailyStreakProgress.findFirst({
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
    const latestRecordView = latestRecord
      ? await this.buildRecordItemView(latestRecord)
      : null

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
          this.resolveNextStreakReward(
            configDefinition.rewardRules,
            effectiveCurrentStreak,
          ) ?? null,
      },
      todaySigned: await this.hasRecordForDate(userId, today),
      latestRecord: latestRecordView,
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

    const page = await this.drizzle.ext.findPagination(
      this.checkInRecordTable,
      {
        where: and(...conditions),
        ...query,
        orderBy:
          query.orderBy?.trim() ||
          JSON.stringify([{ signDate: 'desc' }, { id: 'desc' }]),
      },
    )

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
      this.checkInDailyStreakProgressTable,
      {
        where: this.buildActiveDailyStreakProgressWhere(today),
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

  async getActivityPage(
    query: QueryCheckInActivityStreakPageDto,
    userId: number,
  ) {
    const now = new Date()
    const page = await this.drizzle.ext.findPagination(
      this.checkInActivityStreakTable,
      {
        where: and(
          eq(
            this.checkInActivityStreakTable.status,
            CheckInActivityStreakStatusEnum.PUBLISHED,
          ),
          lte(this.checkInActivityStreakTable.effectiveFrom, now),
          gte(this.checkInActivityStreakTable.effectiveTo, now),
        ),
        ...query,
        orderBy:
          query.orderBy?.trim() ||
          JSON.stringify([{ effectiveFrom: 'asc' }, { id: 'asc' }]),
      },
    )

    const activityIds = page.list.map((item) => item.id)
    const progresses =
      activityIds.length === 0
        ? []
        : await this.db
            .select()
            .from(this.checkInActivityStreakProgressTable)
            .where(
              and(
                eq(this.checkInActivityStreakProgressTable.userId, userId),
                inArray(
                  this.checkInActivityStreakProgressTable.activityId,
                  activityIds,
                ),
              ),
            )
    const progressMap = new Map(
      progresses.map((item) => [item.activityId, item]),
    )
    const today = this.formatDateOnly(now)

    return {
      ...page,
      list: page.list.map((activity) => {
        const progress = progressMap.get(activity.id)
        const definition = this.parseActivityStreakDefinition(activity)
        const effectiveCurrentStreak = this.resolveEffectiveCurrentStreak(
          progress?.currentStreak ?? 0,
          progress?.lastSignedDate,
          today,
        )

        return {
          id: activity.id,
          activityKey: activity.activityKey,
          title: activity.title,
          status: activity.status,
          effectiveFrom: activity.effectiveFrom,
          effectiveTo: activity.effectiveTo,
          currentStreak: effectiveCurrentStreak,
          lastSignedDate: this.resolveEffectiveLastSignedDate(
            progress?.lastSignedDate,
            today,
          ),
          nextReward:
            this.resolveNextStreakReward(
              definition.rewardRules,
              effectiveCurrentStreak,
            ) ?? null,
        }
      }),
    }
  }

  async getActivityDetail(query: { id: number }, userId: number) {
    const now = new Date()
    const activity = await this.db.query.checkInActivityStreak.findFirst({
      where: { id: query.id },
    })
    if (!activity || !this.isActivityVisibleForApp(activity, now)) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '活动连续签到不存在',
      )
    }

    const progress =
      await this.db.query.checkInActivityStreakProgress.findFirst({
        where: {
          activityId: activity.id,
          userId,
        },
      })
    const today = this.formatDateOnly(now)
    const definition = this.parseActivityStreakDefinition(activity)
    const effectiveCurrentStreak = this.resolveEffectiveCurrentStreak(
      progress?.currentStreak ?? 0,
      progress?.lastSignedDate,
      today,
    )

    return {
      id: activity.id,
      activityKey: activity.activityKey,
      title: activity.title,
      status: activity.status,
      effectiveFrom: activity.effectiveFrom,
      effectiveTo: activity.effectiveTo,
      currentStreak: effectiveCurrentStreak,
      streakStartedAt:
        effectiveCurrentStreak > 0 && progress?.streakStartedAt
          ? this.toDateOnlyValue(progress.streakStartedAt)
          : undefined,
      lastSignedDate: this.resolveEffectiveLastSignedDate(
        progress?.lastSignedDate,
        today,
      ),
      nextReward:
        this.resolveNextStreakReward(
          definition.rewardRules,
          effectiveCurrentStreak,
        ) ?? null,
      rewardRules: definition.rewardRules,
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

    const page = await this.drizzle.ext.findPagination(
      this.checkInRecordTable,
      {
        where: conditions.length > 0 ? and(...conditions) : undefined,
        ...query,
        orderBy:
          query.orderBy?.trim() ||
          JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
      },
    )

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
      scopeType: grant.scopeType,
      configVersionId: grant.configVersionId,
      activityId: grant.activityId,
      ruleCode: grant.ruleCode,
      streakDays: grant.streakDays,
      rewardItems: this.parseStoredRewardItems(grant.rewardItems, {
        allowEmpty: false,
      })!,
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

  private buildGrantReconciliationCondition(
    query: QueryCheckInReconciliationDto,
  ) {
    const hasGrantFilters =
      query.scopeType !== undefined ||
      query.configVersionId !== undefined ||
      query.activityId !== undefined ||
      query.grantId !== undefined ||
      query.grantSettlementStatus != null

    if (!hasGrantFilters) {
      return undefined
    }

    const conditions: SQL[] = [
      eq(this.checkInStreakGrantTable.userId, this.checkInRecordTable.userId),
      eq(
        this.checkInStreakGrantTable.triggerSignDate,
        this.checkInRecordTable.signDate,
      ),
    ]

    if (query.scopeType !== undefined) {
      conditions.push(eq(this.checkInStreakGrantTable.scopeType, query.scopeType))
    }
    if (query.configVersionId !== undefined) {
      conditions.push(
        eq(this.checkInStreakGrantTable.configVersionId, query.configVersionId),
      )
    }
    if (query.activityId !== undefined) {
      conditions.push(eq(this.checkInStreakGrantTable.activityId, query.activityId))
    }
    if (query.grantId !== undefined) {
      conditions.push(eq(this.checkInStreakGrantTable.id, query.grantId))
    }

    if (query.grantSettlementStatus != null) {
      return exists(
        this.db
          .select({ id: this.checkInStreakGrantTable.id })
          .from(this.checkInStreakGrantTable)
          .leftJoin(
            this.growthRewardSettlementTable,
            eq(
              this.checkInStreakGrantTable.rewardSettlementId,
              this.growthRewardSettlementTable.id,
            ),
          )
          .where(
            and(
              ...conditions,
              eq(
                this.growthRewardSettlementTable.settlementStatus,
                query.grantSettlementStatus,
              ),
            ),
          ),
      )
    }

    return exists(
      this.db
        .select({ id: this.checkInStreakGrantTable.id })
        .from(this.checkInStreakGrantTable)
        .where(and(...conditions)),
    )
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
        scopeType: grant.scopeType,
        configVersionId: grant.configVersionId,
        activityId: grant.activityId,
        ruleCode: grant.ruleCode,
        streakDays: grant.streakDays,
        rewardItems: this.parseStoredRewardItems(grant.rewardItems, {
          allowEmpty: false,
        })!,
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

  private toConfigDetailView(
    config: typeof this.checkInConfigTable.$inferSelect,
  ) {
    const rewardDefinition = this.parseRewardDefinition(config)
    return {
      id: config.id,
      enabled: config.enabled === 1,
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
