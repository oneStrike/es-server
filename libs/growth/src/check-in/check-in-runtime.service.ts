import type { CheckInConfigSelect, CheckInRecordSelect } from '@db/schema'
import type { PageDto } from '@libs/platform/dto'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInCalendarDayView,
  CheckInGrantItemView,
  CheckInReconciliationPageItemView,
  CheckInRecordGrantLookup,
} from './check-in.type'
import type {
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { addDaysToDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, exists, gte, inArray, lte } from 'drizzle-orm'
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
  ) {
    super(drizzle, growthLedgerService)
  }

  // 查询 app 侧签到摘要，并补齐最新记录和下一档连续奖励。
  async getSummary(userId: number) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    const config = await this.getRequiredConfig()
    const makeup = await this.checkInMakeupService.buildCurrentMakeupAccountView(
      userId,
      config,
      today,
    )
    const activeRules = await this.checkInStreakService.listActiveStreakRulesAt(
      now,
    )
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
          this.checkInRewardPolicyService.resolveNextStreakReward(
            rewardRules,
            effectiveCurrentStreak,
          ) ?? null,
      },
      todaySigned: await this.hasRecordForDate(userId, today),
      latestRecord: latestRecord
        ? await this.buildRecordItemView(latestRecord)
        : null,
    }
  }

  // 查询当前补签周期内的签到日历视图。
  async getCalendar(userId: number) {
    const today = this.formatDateOnly(new Date())
    const config = await this.getRequiredConfig()
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)
    const makeup = await this.checkInMakeupService.buildCurrentMakeupAccountView(
      userId,
      config,
      today,
    )
    const records = await this.listRecordsInDateRange(
      userId,
      makeup.periodStartDate,
      makeup.periodEndDate,
    )
    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
      records
        .map((record) => record.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    const grantMap = await this.buildGrantMapForRecords(records)
    const recordMap = new Map(
      records.map((record) => [this.toDateOnlyValue(record.signDate), record]),
    )

    const days: CheckInCalendarDayView[] = []
    let cursor = makeup.periodStartDate
    let dayIndex = 1
    while (cursor <= makeup.periodEndDate) {
      const record = recordMap.get(cursor)
      const rewardItems = record
        ? this.checkInRewardPolicyService.parseStoredRewardItems(
            record.resolvedRewardItems,
            {
            allowEmpty: true,
            },
          )
        : this.checkInRewardPolicyService.resolveRewardForDate(
            rewardDefinition,
            cursor,
            makeup.periodType,
          ).resolvedRewardItems
      days.push({
        signDate: cursor,
        dayIndex,
        isToday: cursor === today,
        isFuture: cursor > today,
        isSigned: !!record,
        grantCount: grantMap.get(`${userId}:${cursor}`)?.length ?? 0,
        rewardItems,
        rewardSettlement: record?.rewardSettlementId
          ? this.checkInSettlementService.toRewardSettlementSummary(
              settlementMap.get(record.rewardSettlementId) ?? null,
            )
          : null,
      } satisfies CheckInCalendarDayView)
      cursor = addDaysToDateOnlyInAppTimeZone(cursor, 1)!
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

  // 分页查询当前用户的签到记录，并补齐奖励和连续奖励信息。
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

  // 查询当前连续签到排行榜，并补齐用户信息与名次。
  async getLeaderboardPage(query: QueryCheckInLeaderboardDto) {
    const today = this.formatDateOnly(new Date())
    const page = await this.drizzle.ext.findPagination(
      this.checkInStreakProgressTable,
      {
        where: this.checkInStreakService.buildActiveStreakProgressWhere(today),
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

    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
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
            rewardSettlementId: record.rewardSettlementId,
            resolvedRewardSourceType: record.resolvedRewardSourceType,
            resolvedRewardRuleKey: record.resolvedRewardRuleKey,
            resolvedRewardItems:
              this.checkInRewardPolicyService.parseStoredRewardItems(
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

  // 查询指定日期区间内的签到记录。
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

  // 构建单条签到记录的对外展示视图。
  private async buildRecordItemView(record: CheckInRecordSelect) {
    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
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
      grants,
    }
  }

  // 查询某个签到自然日触发的连续奖励列表。
  private async listGrantsForRecord(
    userId: number,
    signDate: string,
  ): Promise<CheckInGrantItemView[]> {
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

    const rewardItemMap = await this.checkInSettlementService.buildGrantRewardItemMap(
      grants.map((grant) => grant.id),
    )
    const settlementMap = await this.checkInSettlementService.buildSettlementMapById(
      grants
        .map((grant) => grant.rewardSettlementId)
        .filter((id): id is number => typeof id === 'number'),
    )
    return grants.map(
      (grant) =>
        ({
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
            ? this.checkInSettlementService.toRewardSettlementSummary(
                settlementMap.get(grant.rewardSettlementId) ?? null,
              )
            : null,
        }) satisfies CheckInGrantItemView,
    )
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
          ? this.checkInSettlementService.toRewardSettlementSummary(
              settlementMap.get(grant.rewardSettlementId) ?? null,
            )
          : null,
      } satisfies CheckInGrantItemView)
      grantMap.set(key, items)
    }
    return grantMap
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

  // 把配置表记录映射成对外的配置详情 DTO 结构。
  private toConfigDetailView(config: CheckInConfigSelect) {
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)
    return {
      id: config.id,
      isEnabled: config.isEnabled === 1,
      makeupPeriodType: config.makeupPeriodType,
      periodicAllowance: config.periodicAllowance,
      baseRewardItems: rewardDefinition.baseRewardItems,
      dateRewardRules:
        this.checkInRewardPolicyService.toEditableDateRewardRules(
          rewardDefinition.dateRewardRules,
        ),
      patternRewardRules: rewardDefinition.patternRewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }
}
