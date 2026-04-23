import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInActiveStreakDayRule,
  CheckInDateLike,
  CheckInEligibleGrantCandidate,
  CheckInGrantTriggerView,
  CheckInNullableDateLike,
  CheckInRecordDateOnlyView,
  CheckInStreakAggregation,
  CheckInStreakAggregationOptions,
  CheckInStreakProgressSnapshot,
  CheckInStreakRewardRuleView,
  CheckInStreakRuleStatusWindow,
  CheckInStreakRuleViewSource,
} from './check-in.type'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  addDaysToDateOnlyInAppTimeZone,
  diffDateOnlyInAppTimeZone,
} from '@libs/platform/utils/time'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm'
import { CheckInStreakConfigStatusEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到连续奖励与进度服务。
 *
 * 负责连续签到规则状态、连续进度聚合、奖励候选计算和进度读写。
 */
@Injectable()
export class CheckInStreakService extends CheckInServiceSupport {
  // 注入连续签到服务所需的底层依赖与奖励策略服务。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 生成连续签到规则的稳定编码。
  buildStreakRuleCode(streakDays: number) {
    return `streak-day-${streakDays}`
  }

  // 按当前时间解析连续签到规则的真实生命周期状态。
  resolveStreakRuleStatus(
    rule: CheckInStreakRuleStatusWindow,
    at = new Date(),
  ) {
    if (rule.status === CheckInStreakConfigStatusEnum.DRAFT) {
      return CheckInStreakConfigStatusEnum.DRAFT
    }
    if (rule.status === CheckInStreakConfigStatusEnum.TERMINATED) {
      return CheckInStreakConfigStatusEnum.TERMINATED
    }
    if (rule.effectiveFrom > at) {
      return CheckInStreakConfigStatusEnum.SCHEDULED
    }
    if (rule.effectiveTo && rule.effectiveTo <= at) {
      return CheckInStreakConfigStatusEnum.EXPIRED
    }
    return CheckInStreakConfigStatusEnum.ACTIVE
  }

  // 按规则 ID 批量加载规则奖励项，并按规则分组返回。
  async loadStreakRewardRuleRowsByIds(
    targetRuleIds: number[],
    db: Db = this.db,
  ) {
    if (targetRuleIds.length === 0) {
      return []
    }
    const rules = await db
      .select()
      .from(this.checkInStreakRuleTable)
      .where(inArray(this.checkInStreakRuleTable.id, targetRuleIds))
      .orderBy(
        asc(this.checkInStreakRuleTable.streakDays),
        asc(this.checkInStreakRuleTable.version),
        asc(this.checkInStreakRuleTable.id),
      )

    const ruleIds = rules.map((rule) => rule.id)
    const rewardItems =
      ruleIds.length === 0
        ? []
        : await db
            .select()
            .from(this.checkInStreakRuleRewardItemTable)
            .where(
              inArray(this.checkInStreakRuleRewardItemTable.ruleId, ruleIds),
            )
            .orderBy(
              asc(this.checkInStreakRuleRewardItemTable.sortOrder),
              asc(this.checkInStreakRuleRewardItemTable.id),
            )

    const rewardMap = new Map<number, typeof rewardItems>()
    for (const item of rewardItems) {
      const items = rewardMap.get(item.ruleId) ?? []
      items.push(item)
      rewardMap.set(item.ruleId, items)
    }

    return rules.map((rule) => ({
      ...rule,
      rewardItems: rewardMap.get(rule.id) ?? [],
    }))
  }

  // 查询某个规则编码下的全部历史版本。
  async listStreakRuleVersionsByCode(ruleCode: string, db: Db = this.db) {
    return db
      .select()
      .from(this.checkInStreakRuleTable)
      .where(eq(this.checkInStreakRuleTable.ruleCode, ruleCode))
      .orderBy(
        desc(this.checkInStreakRuleTable.version),
        desc(this.checkInStreakRuleTable.id),
      )
  }

  // 查询某个规则编码下的最新版本。
  async findLatestStreakRuleVersion(ruleCode: string, db: Db = this.db) {
    const [rule] = await db
      .select()
      .from(this.checkInStreakRuleTable)
      .where(eq(this.checkInStreakRuleTable.ruleCode, ruleCode))
      .orderBy(
        desc(this.checkInStreakRuleTable.version),
        desc(this.checkInStreakRuleTable.id),
      )
      .limit(1)
    return rule
  }

  // 断言当前激活规则中不存在重复的连续签到天数。
  assertNoDuplicatedActiveStreakDays(rules: CheckInActiveStreakDayRule[]) {
    const duplicateStreakDays = this.findDuplicateValue(
      rules.map((rule) => String(rule.streakDays)),
    )
    if (duplicateStreakDays) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        `连续签到规则存在多个生效版本：streakDays=${duplicateStreakDays}`,
      )
    }
  }

  // 查询某个时点生效的全部连续签到规则。
  async listActiveStreakRulesAt(at: CheckInDateLike, db: Db = this.db) {
    const lookupAt =
      typeof at === 'string' ? this.resolveConfigLookupAt(at) : at
    const rules = await db
      .select()
      .from(this.checkInStreakRuleTable)
      .where(
        and(
          sql`${this.checkInStreakRuleTable.status} <> ${CheckInStreakConfigStatusEnum.DRAFT}`,
          sql`${this.checkInStreakRuleTable.status} <> ${CheckInStreakConfigStatusEnum.TERMINATED}`,
          sql`${this.checkInStreakRuleTable.effectiveFrom} <= ${lookupAt}`,
          or(
            sql`${this.checkInStreakRuleTable.effectiveTo} is null`,
            sql`${this.checkInStreakRuleTable.effectiveTo} > ${lookupAt}`,
          ),
        ),
      )
      .orderBy(
        asc(this.checkInStreakRuleTable.streakDays),
        desc(this.checkInStreakRuleTable.version),
        desc(this.checkInStreakRuleTable.id),
      )

    this.assertNoDuplicatedActiveStreakDays(rules)

    return this.loadStreakRewardRuleRowsByIds(
      rules.map((rule) => rule.id),
      db,
    )
  }

  // 把规则表行转换成运行时使用的连续奖励视图。
  toStreakRewardRuleViews(
    rules: CheckInStreakRuleViewSource[],
    at: CheckInDateLike = new Date(),
  ) {
    const lookupAt =
      typeof at === 'string' ? this.resolveConfigLookupAt(at) : at
    return rules
      .map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        repeatable: rule.repeatable,
        status: this.resolveStreakRuleStatus(rule, lookupAt),
        rewardItems: rule.rewardItems.map((item) => ({
          assetType: item.assetType,
          assetKey: item.assetKey,
          amount: item.amount,
        })),
      }))
      .sort((left, right) => {
        const streakDiff = left.streakDays - right.streakDays
        return streakDiff !== 0
          ? streakDiff
          : left.ruleCode.localeCompare(right.ruleCode)
      })
  }

  // 读取或初始化连续签到进度，处理并发首建场景。
  async getOrCreateStreakProgress(userId: number, tx: Db) {
    const existing = await tx.query.checkInStreakProgress.findFirst({
      where: { userId },
    })
    if (existing) {
      return existing
    }

    const [created] = await tx
      .insert(this.checkInStreakProgressTable)
      .values({
        userId,
        currentStreak: 0,
        streakStartedAt: null,
        lastSignedDate: null,
        version: 0,
      })
      .onConflictDoNothing({
        target: [this.checkInStreakProgressTable.userId],
      })
      .returning()
    if (created) {
      return created
    }

    const concurrent = await tx.query.checkInStreakProgress.findFirst({
      where: { userId },
    })
    if (!concurrent) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '连续签到进度初始化冲突，请稍后重试',
      )
    }
    return concurrent
  }

  // 按签到记录序列重算连续签到聚合结果。
  recomputeStreakAggregation(
    records: CheckInRecordDateOnlyView[],
    options?: CheckInStreakAggregationOptions,
  ): CheckInStreakAggregation {
    const startDate = options?.streakStartedAt
      ? this.toDateOnlyValue(options.streakStartedAt)
      : ''
    const scopedRecords = startDate
      ? records.filter(
          (record) => this.toDateOnlyValue(record.signDate) >= startDate,
        )
      : records

    const streakByDate: Record<string, number> = {}
    let previousDate: string | undefined
    let latestDate: string | undefined
    let streak = 0

    const sortedRecords = [...scopedRecords].sort((left, right) =>
      this.toDateOnlyValue(left.signDate).localeCompare(
        this.toDateOnlyValue(right.signDate),
      ),
    )

    for (const record of sortedRecords) {
      const signDate = this.toDateOnlyValue(record.signDate)
      if (
        previousDate &&
        diffDateOnlyInAppTimeZone(signDate, previousDate) === 1
      ) {
        streak += 1
      } else {
        streak = 1
      }
      streakByDate[signDate] = streak
      previousDate = signDate
      latestDate = signDate
    }

    return {
      currentStreak: latestDate ? streakByDate[latestDate] : 0,
      streakStartedAt:
        latestDate && streakByDate[latestDate] > 0
          ? addDaysToDateOnlyInAppTimeZone(
              latestDate,
              -(streakByDate[latestDate] - 1),
            )
          : undefined,
      lastSignedDate: latestDate,
      streakByDate,
    }
  }

  // 根据最后签到日期判断当前连续天数是否仍然有效。
  resolveEffectiveCurrentStreak(
    currentStreak: number,
    lastSignedDate: CheckInNullableDateLike,
    today: string,
  ) {
    if (currentStreak <= 0) {
      return 0
    }
    return this.isEffectiveStreakDate(lastSignedDate, today) ? currentStreak : 0
  }

  // 根据连续有效性返回最近一次有效签到日期。
  resolveEffectiveLastSignedDate(
    lastSignedDate: CheckInNullableDateLike,
    today: string,
  ) {
    if (!this.isEffectiveStreakDate(lastSignedDate, today)) {
      return undefined
    }
    return this.toDateOnlyValue(lastSignedDate) || undefined
  }

  // 构建用于排行榜和活跃状态筛选的连续进度条件。
  buildActiveStreakProgressWhere(today: string): SQL {
    const yesterday = addDaysToDateOnlyInAppTimeZone(today, -1)
    if (!yesterday) {
      throw new BadRequestException('日期非法')
    }

    return and(
      gt(this.checkInStreakProgressTable.currentStreak, 0),
      or(
        eq(this.checkInStreakProgressTable.lastSignedDate, today),
        eq(this.checkInStreakProgressTable.lastSignedDate, yesterday),
      ),
    )!
  }

  // 解析当前可触发的连续奖励规则，并处理重复发放语义。
  resolveEligibleGrantRules(
    rules: CheckInStreakRewardRuleView[] | CheckInStreakRuleViewSource[],
    streakByDate: Record<string, number>,
    existingGrants: CheckInGrantTriggerView[],
    streakStartedAt?: string,
  ): CheckInEligibleGrantCandidate[] {
    const normalizedRules =
      rules.length === 0 ||
      'effectiveFrom' in rules[0] ||
      'effectiveTo' in rules[0]
        ? this.toStreakRewardRuleViews(rules as CheckInStreakRuleViewSource[])
        : (rules as CheckInStreakRewardRuleView[])
    const scopedExistingGrants = streakStartedAt
      ? existingGrants.filter(
          (grant) =>
            this.toDateOnlyValue(grant.triggerSignDate) >= streakStartedAt,
        )
      : existingGrants
    const existingGrantKeys = new Set(
      scopedExistingGrants.map(
        (grant) =>
          `${grant.ruleCode}:${this.toDateOnlyValue(grant.triggerSignDate)}`,
      ),
    )
    const existingRuleCodes = new Set(
      scopedExistingGrants.map((grant) => grant.ruleCode),
    )
    const streakEntries = Object.entries(streakByDate).sort(([left], [right]) =>
      left.localeCompare(right),
    )
    const candidates: CheckInEligibleGrantCandidate[] = []

    for (const rule of normalizedRules) {
      if (rule.status !== CheckInStreakConfigStatusEnum.ACTIVE) {
        continue
      }

      const triggerDates = streakEntries
        .filter(
          ([triggerDate, streak]) =>
            (!streakStartedAt || triggerDate >= streakStartedAt) &&
            streak === rule.streakDays,
        )
        .map(([triggerDate]) => triggerDate)

      if (triggerDates.length === 0) {
        continue
      }

      if (!rule.repeatable) {
        if (existingRuleCodes.has(rule.ruleCode)) {
          continue
        }
        candidates.push({ rule, triggerSignDate: triggerDates[0] })
        continue
      }

      for (const triggerSignDate of triggerDates) {
        const key = `${rule.ruleCode}:${triggerSignDate}`
        if (!existingGrantKeys.has(key)) {
          candidates.push({ rule, triggerSignDate })
        }
      }
    }

    return candidates
  }

  // 根据最新签到记录重算并更新连续签到进度。
  async updateStreakProgress(
    progress: CheckInStreakProgressSnapshot,
    aggregation: CheckInStreakAggregation,
    tx: Db,
  ) {
    const [updated] = await tx
      .update(this.checkInStreakProgressTable)
      .set({
        currentStreak: aggregation.currentStreak,
        streakStartedAt: aggregation.streakStartedAt ?? null,
        lastSignedDate: aggregation.lastSignedDate ?? null,
        version: progress.version + 1,
      })
      .where(
        and(
          eq(this.checkInStreakProgressTable.id, progress.id),
          eq(this.checkInStreakProgressTable.version, progress.version),
        ),
      )
      .returning({ id: this.checkInStreakProgressTable.id })
    if (!updated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '连续签到进度并发冲突，请稍后重试',
      )
    }
  }

  // 读取用户全部签到记录，供连续签到重算使用。
  async listUserRecords(userId: number, tx: Db) {
    return tx
      .select({
        signDate: this.checkInRecordTable.signDate,
      })
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.userId, userId))
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  // 判断最近签到日期是否仍属于当前连续区间。
  private isEffectiveStreakDate(
    lastSignedDate: CheckInNullableDateLike,
    today: string,
  ) {
    const normalizedLastSignedDate = this.toDateOnlyValue(lastSignedDate)
    if (!normalizedLastSignedDate) {
      return false
    }

    const yesterday = addDaysToDateOnlyInAppTimeZone(today, -1)
    if (!yesterday) {
      return false
    }

    return (
      normalizedLastSignedDate === today ||
      normalizedLastSignedDate === yesterday
    )
  }
}
