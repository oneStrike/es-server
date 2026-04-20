import type { Db, DrizzleService } from '@db/core'
import type {
  CheckInConfigSelect,
  CheckInMakeupAccountSelect,
  CheckInRecordSelect,
  CheckInStreakConfigSelect,
  CheckInStreakGrantSelect,
  CheckInStreakRuleRewardItemSelect,
  CheckInStreakRuleSelect,
  GrowthRewardSettlementSelect,
} from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInDateRewardRuleView,
  CheckInMakeupAccountView,
  CheckInMakeupConsumePlanItem,
  CheckInPatternRewardRuleView,
  CheckInResolvedReward,
  CheckInRewardDefinition,
  CheckInRewardItems,
  CheckInStreakAggregation,
  CheckInStreakConfigDefinition,
  CheckInStreakRewardRuleView,
} from './check-in.type'
import type { CreateCheckInDateRewardRuleDto } from './dto/check-in-date-reward-rule.dto'
import type { CreateCheckInPatternRewardRuleDto } from './dto/check-in-pattern-reward-rule.dto'
import type { CheckInRewardSettlementSummaryDto } from './dto/check-in-record.dto'
import type { CreateCheckInStreakRewardRuleDto } from './dto/check-in-streak-reward-rule.dto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  formatDateOnlyInAppTimeZone,
  getAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils/time'
import { BadRequestException, Logger } from '@nestjs/common'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import {
  CheckInMakeupFactTypeEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakConfigStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 统一签到域 support 基类。
 *
 * 收口签到配置解析、补签账户窗口、连续签到规则关系查询与公共校验逻辑。
 */
export abstract class CheckInServiceSupport {
  protected readonly logger = new Logger(CheckInServiceSupport.name)

  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly growthLedgerService: GrowthLedgerService,
  ) {}

  protected get db() {
    return this.drizzle.db
  }

  protected get checkInConfigTable() {
    return this.drizzle.schema.checkInConfig
  }

  protected get checkInMakeupFactTable() {
    return this.drizzle.schema.checkInMakeupFact
  }

  protected get checkInMakeupAccountTable() {
    return this.drizzle.schema.checkInMakeupAccount
  }

  protected get checkInRecordTable() {
    return this.drizzle.schema.checkInRecord
  }

  protected get checkInStreakConfigTable() {
    return this.drizzle.schema.checkInStreakConfig
  }

  protected get checkInStreakRuleTable() {
    return this.drizzle.schema.checkInStreakRule
  }

  protected get checkInStreakRuleRewardItemTable() {
    return this.drizzle.schema.checkInStreakRuleRewardItem
  }

  protected get checkInStreakProgressTable() {
    return this.drizzle.schema.checkInStreakProgress
  }

  protected get checkInStreakGrantTable() {
    return this.drizzle.schema.checkInStreakGrant
  }

  protected get checkInStreakGrantRewardItemTable() {
    return this.drizzle.schema.checkInStreakGrantRewardItem
  }

  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  protected getAppTimeZone() {
    return getAppTimeZone()
  }

  protected formatDateOnly(value: Date | string) {
    return formatDateOnlyInAppTimeZone(value)
  }

  protected parseDateOnly(value: string, fieldLabel = '日期') {
    const parsed = parseDateOnlyInAppTimeZone(value)
    if (!parsed) {
      throw new BadRequestException(`${fieldLabel}非法`)
    }
    return this.formatDateOnly(parsed)
  }

  protected toDateOnlyValue(value: string | Date | null | undefined) {
    if (!value) {
      return ''
    }
    return typeof value === 'string' ? value : this.formatDateOnly(value)
  }

  protected asRecord<T>(value: T) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    return value as Record<string, unknown>
  }

  protected asArray<T>(value: T) {
    return Array.isArray(value) ? value : undefined
  }

  protected stringifyError(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  protected parseRewardItems(
    value?: CheckInRewardItems | null,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    if (value === null || value === undefined) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励项不能为空')
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException('奖励项非法')
    }
    if (value.length === 0) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励项不能为空')
    }

    const rewardItems = value.map((item, index) =>
      this.parseRewardItem(item, index),
    )
    const dedupeKeySet = new Set<string>()
    for (const rewardItem of rewardItems) {
      const dedupeKey = `${rewardItem.assetType}:${rewardItem.assetKey ?? ''}`
      if (dedupeKeySet.has(dedupeKey)) {
        throw new BadRequestException(
          `奖励项重复：assetType=${rewardItem.assetType} assetKey=${rewardItem.assetKey ?? ''}`,
        )
      }
      dedupeKeySet.add(dedupeKey)
    }
    return rewardItems
  }

  protected parseStoredRewardItems<T>(
    value: T,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    const rewardItems = this.asArray(value)
    return this.parseRewardItems(
      rewardItems as CheckInRewardItems | undefined,
      options,
    )
  }

  protected parseRewardItem(
    value: unknown,
    index: number,
  ): NonNullable<CheckInRewardItems>[number] {
    const record = this.asRecord(value)
    if (!record) {
      throw new BadRequestException(`rewardItems[${index}] 必须是对象`)
    }

    const unsupportedKeys = Object.keys(record).filter(
      (key) => !['assetType', 'assetKey', 'amount'].includes(key),
    )
    if (unsupportedKeys.length > 0) {
      throw new BadRequestException(
        `rewardItems[${index}] 暂不支持字段：${unsupportedKeys.join(', ')}`,
      )
    }

    const assetType = Number(record.assetType)
    if (
      !Number.isInteger(assetType) ||
      (assetType !== GrowthRewardRuleAssetTypeEnum.POINTS &&
        assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE)
    ) {
      throw new BadRequestException(
        `rewardItems[${index}].assetType 仅支持 1=积分、2=经验`,
      )
    }

    const amount = Number(record.amount)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(`rewardItems[${index}].amount 必须是正整数`)
    }

    const assetKey =
      typeof record.assetKey === 'string' ? record.assetKey.trim() : ''
    if (assetKey !== '') {
      throw new BadRequestException(
        `rewardItems[${index}].assetKey 当前必须为空字符串`,
      )
    }

    return {
      assetType,
      assetKey,
      amount,
    }
  }

  protected normalizeDateRewardRules(
    rules:
      | CreateCheckInDateRewardRuleDto[]
      | CheckInDateRewardRuleView[]
      | undefined,
  ) {
    const normalizedRules = (rules ?? []).map(
      (rule) =>
        ({
          rewardDate: this.parseDateOnly(rule.rewardDate, '奖励日期'),
          rewardItems: this.parseRewardItems(rule.rewardItems, {
            allowEmpty: false,
          })!,
        }) satisfies CheckInDateRewardRuleView,
    )

    const duplicateRewardDate = this.findDuplicateValue(
      normalizedRules.map((rule) => rule.rewardDate),
    )
    if (duplicateRewardDate) {
      throw new BadRequestException(`具体日期奖励重复：${duplicateRewardDate}`)
    }

    return normalizedRules.sort((left, right) =>
      left.rewardDate.localeCompare(right.rewardDate),
    )
  }

  protected normalizePatternRewardRules(
    rules:
      | CreateCheckInPatternRewardRuleDto[]
      | CheckInPatternRewardRuleView[]
      | undefined,
    periodType: CheckInMakeupPeriodTypeEnum,
  ) {
    const normalizedRules = (rules ?? []).map((rule) => {
      const patternType = rule.patternType
      const weekday = rule.weekday == null ? null : Number(rule.weekday)
      const monthDay = rule.monthDay == null ? null : Number(rule.monthDay)

      if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
        if (patternType !== CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
          throw new BadRequestException('按周模式下仅支持星期几奖励规则')
        }
        if (
          weekday === null ||
          !Number.isInteger(weekday) ||
          weekday < 1 ||
          weekday > 7
        ) {
          throw new BadRequestException('weekday 必须是 1..7')
        }
        if (monthDay !== null) {
          throw new BadRequestException('按周规则不能配置 monthDay')
        }
      }

      if (periodType === CheckInMakeupPeriodTypeEnum.MONTHLY) {
        if (
          patternType !== CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
          patternType !== CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY
        ) {
          throw new BadRequestException(
            '按月模式下仅支持按月日期或月末奖励规则',
          )
        }
        if (
          patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
          (monthDay === null ||
            !Number.isInteger(monthDay) ||
            monthDay < 1 ||
            monthDay > 31)
        ) {
          throw new BadRequestException('monthDay 必须是 1..31')
        }
        if (
          patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
          weekday !== null
        ) {
          throw new BadRequestException('按月日期规则不能配置 weekday')
        }
        if (
          patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY &&
          (weekday !== null || monthDay !== null)
        ) {
          throw new BadRequestException(
            '按月最后一天规则不能配置 weekday 或 monthDay',
          )
        }
      }

      return {
        patternType,
        weekday,
        monthDay,
        rewardItems: this.parseRewardItems(rule.rewardItems, {
          allowEmpty: false,
        })!,
      } satisfies CheckInPatternRewardRuleView
    })

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      const duplicateWeekday = this.findDuplicateValue(
        normalizedRules.map((rule) => String(rule.weekday)),
      )
      if (duplicateWeekday) {
        throw new BadRequestException(
          `周期模式奖励规则重复：按周星期=${duplicateWeekday}`,
        )
      }
    } else {
      const duplicateMonthDay = this.findDuplicateValue(
        normalizedRules
          .filter(
            (rule) =>
              rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
          )
          .map((rule) => String(rule.monthDay)),
      )
      if (duplicateMonthDay) {
        throw new BadRequestException(
          `周期模式奖励规则重复：按月日期=${duplicateMonthDay}`,
        )
      }

      const monthLastDayRuleCount = normalizedRules.filter(
        (rule) =>
          rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
      ).length
      if (monthLastDayRuleCount > 1) {
        throw new BadRequestException('周期模式奖励规则重复：按月最后一天')
      }
    }

    return normalizedRules.sort((left, right) =>
      this.comparePatternRewardRules(left, right),
    )
  }

  protected normalizeStreakRewardRules(
    rules:
      | CreateCheckInStreakRewardRuleDto[]
      | CheckInStreakRewardRuleView[]
      | undefined,
  ) {
    const normalizedRules = (rules ?? []).map((rule) => {
      const ruleCode = rule.ruleCode.trim()
      if (!ruleCode) {
        throw new BadRequestException('连续奖励规则编码不能为空')
      }
      if (!Number.isInteger(rule.streakDays) || rule.streakDays <= 0) {
        throw new BadRequestException('连续奖励阈值必须为正整数')
      }

      return {
        ruleCode,
        streakDays: rule.streakDays,
        rewardItems: this.parseRewardItems(rule.rewardItems, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable ?? false,
        status: rule.status ?? CheckInStreakRewardRuleStatusEnum.ENABLED,
      } satisfies CheckInStreakRewardRuleView
    })

    const duplicateRuleCode = this.findDuplicateValue(
      normalizedRules.map((rule) => rule.ruleCode),
    )
    if (duplicateRuleCode) {
      throw new BadRequestException(
        `连续奖励规则编码重复：${duplicateRuleCode}`,
      )
    }

    const duplicateStreakDays = this.findDuplicateValue(
      normalizedRules.map((rule) => String(rule.streakDays)),
    )
    if (duplicateStreakDays) {
      throw new BadRequestException(`连续奖励阈值重复：${duplicateStreakDays}`)
    }

    return normalizedRules.sort((left, right) => {
      const streakDiff = left.streakDays - right.streakDays
      return streakDiff !== 0
        ? streakDiff
        : left.ruleCode.localeCompare(right.ruleCode)
    })
  }

  protected parseRewardDefinition(
    config: Pick<
      CheckInConfigSelect,
      | 'makeupPeriodType'
      | 'baseRewardItems'
      | 'dateRewardRules'
      | 'patternRewardRules'
    >,
  ) {
    return {
      baseRewardItems: this.parseStoredRewardItems(config.baseRewardItems, {
        allowEmpty: true,
      }),
      dateRewardRules: this.normalizeDateRewardRules(
        Array.isArray(config.dateRewardRules)
          ? (config.dateRewardRules as CheckInDateRewardRuleView[])
          : [],
      ),
      patternRewardRules: this.normalizePatternRewardRules(
        Array.isArray(config.patternRewardRules)
          ? (config.patternRewardRules as CheckInPatternRewardRuleView[])
          : [],
        Number(config.makeupPeriodType) as CheckInMakeupPeriodTypeEnum,
      ),
    } satisfies CheckInRewardDefinition
  }

  protected parseStreakConfigDefinition(
    config: Pick<
      CheckInStreakConfigSelect,
      'version' | 'status' | 'publishStrategy' | 'effectiveFrom' | 'effectiveTo'
    > & {
      rewardRules: CheckInStreakRewardRuleView[]
    },
  ) {
    return {
      version: config.version,
      status: config.status as CheckInStreakConfigStatusEnum,
      publishStrategy: config.publishStrategy,
      rewardRules: this.normalizeStreakRewardRules(config.rewardRules),
      effectiveFrom: config.effectiveFrom,
      effectiveTo: config.effectiveTo ?? null,
    } satisfies CheckInStreakConfigDefinition
  }

  protected resolveStreakConfigStatus(
    config: Pick<
      CheckInStreakConfigSelect,
      'status' | 'effectiveFrom' | 'effectiveTo'
    >,
    at = new Date(),
  ) {
    if (config.status === CheckInStreakConfigStatusEnum.DRAFT) {
      return CheckInStreakConfigStatusEnum.DRAFT
    }
    if (config.status === CheckInStreakConfigStatusEnum.TERMINATED) {
      return CheckInStreakConfigStatusEnum.TERMINATED
    }
    if (config.effectiveFrom > at) {
      return CheckInStreakConfigStatusEnum.SCHEDULED
    }
    if (config.effectiveTo && config.effectiveTo <= at) {
      return CheckInStreakConfigStatusEnum.EXPIRED
    }
    return CheckInStreakConfigStatusEnum.ACTIVE
  }

  protected resolveConfigLookupAt(signDate: string) {
    return dayjs
      .tz(signDate, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
      .toDate()
  }

  protected resolveStreakConfigForSignDate(
    signDate: string,
    configs: Array<
      Pick<
        CheckInStreakConfigSelect,
        'id' | 'status' | 'effectiveFrom' | 'effectiveTo'
      >
    >,
  ) {
    const lookupAt = this.resolveConfigLookupAt(signDate)
    return configs.find(
      (config) =>
        this.resolveStreakConfigStatus(config, lookupAt) ===
        CheckInStreakConfigStatusEnum.ACTIVE,
    )
  }

  protected async loadStreakRewardRuleRows(
    configId: number,
    db: Db = this.db,
  ) {
    const rules = await db
      .select()
      .from(this.checkInStreakRuleTable)
      .where(eq(this.checkInStreakRuleTable.configId, configId))
      .orderBy(
        asc(this.checkInStreakRuleTable.streakDays),
        asc(this.checkInStreakRuleTable.id),
      )

    const ruleIds = rules.map((rule) => rule.id)
    const rewardItems =
      ruleIds.length === 0
        ? []
        : await db
            .select()
            .from(this.checkInStreakRuleRewardItemTable)
            .where(inArray(this.checkInStreakRuleRewardItemTable.ruleId, ruleIds))
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

  protected async loadStreakRewardRules(configId: number, db: Db = this.db) {
    return this.toStreakRewardRuleViews(
      await this.loadStreakRewardRuleRows(configId, db),
    )
  }

  protected toStreakRewardRuleViews(
    rules: Array<
      Pick<
        CheckInStreakRuleSelect,
        'ruleCode' | 'streakDays' | 'repeatable' | 'status'
      > & {
        rewardItems: Array<
          Pick<
            CheckInStreakRuleRewardItemSelect,
            'assetType' | 'assetKey' | 'amount'
          >
        >
      }
    >,
  ) {
    return this.normalizeStreakRewardRules(
      rules.map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        repeatable: rule.repeatable,
        status: rule.status,
        rewardItems: rule.rewardItems.map((item) => ({
          assetType: item.assetType,
          assetKey: item.assetKey,
          amount: item.amount,
        })),
      })),
    )
  }

  protected async buildGrantRewardItemMap(
    grantIds: number[],
    db: Db = this.db,
  ) {
    if (grantIds.length === 0) {
      return new Map<number, CheckInRewardItems>()
    }

    const rewardItems = await db
      .select()
      .from(this.checkInStreakGrantRewardItemTable)
      .where(inArray(this.checkInStreakGrantRewardItemTable.grantId, grantIds))
      .orderBy(
        asc(this.checkInStreakGrantRewardItemTable.sortOrder),
        asc(this.checkInStreakGrantRewardItemTable.id),
      )

    const rewardMap = new Map<number, CheckInRewardItems>()
    for (const item of rewardItems) {
      const list = rewardMap.get(item.grantId) ?? []
      list.push({
        assetType: item.assetType,
        assetKey: item.assetKey,
        amount: item.amount,
      })
      rewardMap.set(item.grantId, list)
    }

    return rewardMap
  }

  protected async getCurrentConfig(db: Db = this.db) {
    const [config] = await db
      .select()
      .from(this.checkInConfigTable)
      .orderBy(
        desc(this.checkInConfigTable.updatedAt),
        desc(this.checkInConfigTable.id),
      )
      .limit(1)
    return config
  }

  protected async getRequiredConfig(db: Db = this.db) {
    const config = await this.getCurrentConfig(db)
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '签到配置不存在',
      )
    }
    return config
  }

  protected async getEnabledConfig(db: Db = this.db) {
    const config = await this.getRequiredConfig(db)
    if (config.enabled !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '签到功能未开启',
      )
    }
    return config
  }

  protected async getCurrentStreakConfig(at = new Date(), db: Db = this.db) {
    const rows = await db
      .select()
      .from(this.checkInStreakConfigTable)
      .where(
        and(
          sql`${this.checkInStreakConfigTable.status} <> ${CheckInStreakConfigStatusEnum.DRAFT}`,
          sql`${this.checkInStreakConfigTable.status} <> ${CheckInStreakConfigStatusEnum.TERMINATED}`,
          sql`${this.checkInStreakConfigTable.effectiveFrom} <= ${at}`,
          or(
            sql`${this.checkInStreakConfigTable.effectiveTo} is null`,
            sql`${this.checkInStreakConfigTable.effectiveTo} > ${at}`,
          ),
        ),
      )
      .orderBy(
        desc(this.checkInStreakConfigTable.effectiveFrom),
        desc(this.checkInStreakConfigTable.id),
      )
      .limit(2)

    if (rows.length > 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '当前存在多个生效中的连续签到配置',
      )
    }
    return rows[0]
  }

  protected async getRequiredCurrentStreakConfig(
    at = new Date(),
    db: Db = this.db,
  ) {
    const config = await this.getCurrentStreakConfig(at, db)
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '连续签到配置不存在',
      )
    }
    return config
  }

  protected async listStreakConfigs(db: Db = this.db) {
    return db
      .select()
      .from(this.checkInStreakConfigTable)
      .orderBy(
        desc(this.checkInStreakConfigTable.effectiveFrom),
        desc(this.checkInStreakConfigTable.id),
      )
  }

  protected buildMakeupWindow(
    date: string,
    periodType: CheckInMakeupPeriodTypeEnum,
  ) {
    const targetDate = dayjs
      .tz(date, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      const weekday = targetDate.day()
      const offset = weekday === 0 ? 6 : weekday - 1
      const periodStart = targetDate.subtract(offset, 'day')
      const periodEnd = periodStart.add(6, 'day')
      return {
        periodType,
        periodKey: `week-${periodStart.format('YYYY-MM-DD')}`,
        periodStartDate: periodStart.format('YYYY-MM-DD'),
        periodEndDate: periodEnd.format('YYYY-MM-DD'),
      }
    }

    const periodStart = targetDate.startOf('month')
    const periodEnd = targetDate.endOf('month').startOf('day')
    return {
      periodType,
      periodKey: `month-${periodStart.format('YYYY-MM-DD')}`,
      periodStartDate: periodStart.format('YYYY-MM-DD'),
      periodEndDate: periodEnd.format('YYYY-MM-DD'),
    }
  }

  protected isDateWithinMakeupWindow(
    signDate: string,
    window: ReturnType<CheckInServiceSupport['buildMakeupWindow']>,
  ) {
    return (
      signDate >= window.periodStartDate && signDate <= window.periodEndDate
    )
  }

  protected async getLatestAccount(userId: number, db: Db = this.db) {
    const [account] = await db
      .select()
      .from(this.checkInMakeupAccountTable)
      .where(eq(this.checkInMakeupAccountTable.userId, userId))
      .orderBy(desc(this.checkInMakeupAccountTable.id))
      .limit(1)
    return account
  }

  protected async getCurrentMakeupAccount(
    userId: number,
    periodType: CheckInMakeupPeriodTypeEnum,
    periodKey: string,
    db: Db = this.db,
  ) {
    const [account] = await db
      .select()
      .from(this.checkInMakeupAccountTable)
      .where(
        and(
          eq(this.checkInMakeupAccountTable.userId, userId),
          eq(this.checkInMakeupAccountTable.periodType, periodType),
          eq(this.checkInMakeupAccountTable.periodKey, periodKey),
        ),
      )
      .limit(1)
    return account
  }

  protected async buildCurrentMakeupAccountView(
    userId: number,
    config: CheckInConfigSelect,
    today = this.formatDateOnly(new Date()),
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountView> {
    const periodType = Number(
      config.makeupPeriodType,
    ) as CheckInMakeupPeriodTypeEnum
    const window = this.buildMakeupWindow(today, periodType)
    const currentAccount = await this.getCurrentMakeupAccount(
      userId,
      window.periodType,
      window.periodKey,
      db,
    )
    if (currentAccount) {
      return {
        ...window,
        periodicGranted: currentAccount.periodicGranted,
        periodicUsed: currentAccount.periodicUsed,
        periodicRemaining: Math.max(
          currentAccount.periodicGranted - currentAccount.periodicUsed,
          0,
        ),
        eventAvailable: currentAccount.eventAvailable,
      }
    }

    const latestAccount = await this.getLatestAccount(userId, db)
    return {
      ...window,
      periodicGranted: config.periodicAllowance,
      periodicUsed: 0,
      periodicRemaining: config.periodicAllowance,
      eventAvailable: latestAccount?.eventAvailable ?? 0,
    }
  }

  protected async ensureCurrentMakeupAccount(
    userId: number,
    config: CheckInConfigSelect,
    today: string,
    tx: Db,
  ) {
    const periodType = Number(
      config.makeupPeriodType,
    ) as CheckInMakeupPeriodTypeEnum
    const window = this.buildMakeupWindow(today, periodType)
    const existing = await this.getCurrentMakeupAccount(
      userId,
      window.periodType,
      window.periodKey,
      tx,
    )
    if (existing) {
      return existing
    }

    const previous = await this.getLatestAccount(userId, tx)
    if (previous && previous.periodKey !== window.periodKey) {
      const periodicRemaining = Math.max(
        previous.periodicGranted - previous.periodicUsed,
        0,
      )
      if (periodicRemaining > 0) {
        await tx
          .insert(this.checkInMakeupFactTable)
          .values({
            userId,
            factType: CheckInMakeupFactTypeEnum.EXPIRE,
            sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
            amount: 0,
            consumedAmount: periodicRemaining,
            effectiveAt: new Date(`${window.periodStartDate}T00:00:00.000Z`),
            expiresAt: new Date(`${window.periodStartDate}T00:00:00.000Z`),
            periodType: previous.periodType,
            periodKey: previous.periodKey,
            sourceRef: null,
            bizKey: `checkin:makeup:expire:user:${userId}:period:${previous.periodKey}`,
            context: { source: 'period_rollover' },
          })
          .onConflictDoNothing({
            target: [
              this.checkInMakeupFactTable.userId,
              this.checkInMakeupFactTable.bizKey,
            ],
          })
      }
    }

    const grantedFactRows = await tx
      .insert(this.checkInMakeupFactTable)
      .values({
        userId,
        factType: CheckInMakeupFactTypeEnum.GRANT,
        sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
        amount: config.periodicAllowance,
        consumedAmount: 0,
        effectiveAt: new Date(`${window.periodStartDate}T00:00:00.000Z`),
        expiresAt: new Date(`${window.periodEndDate}T23:59:59.999Z`),
        periodType: window.periodType,
        periodKey: window.periodKey,
        sourceRef: null,
        bizKey: `checkin:makeup:grant:user:${userId}:period:${window.periodKey}`,
        context: { source: 'periodic_allowance' },
      })
      .onConflictDoNothing({
        target: [
          this.checkInMakeupFactTable.userId,
          this.checkInMakeupFactTable.bizKey,
        ],
      })
      .returning({ id: this.checkInMakeupFactTable.id })

    const [account] = await tx
      .insert(this.checkInMakeupAccountTable)
      .values({
        userId,
        periodType: window.periodType,
        periodKey: window.periodKey,
        periodicGranted: config.periodicAllowance,
        periodicUsed: 0,
        eventAvailable: previous?.eventAvailable ?? 0,
        version: 0,
        lastSyncedFactId: grantedFactRows[0]?.id ?? null,
      })
      .onConflictDoNothing({
        target: [
          this.checkInMakeupAccountTable.userId,
          this.checkInMakeupAccountTable.periodType,
          this.checkInMakeupAccountTable.periodKey,
        ],
      })
      .returning()
    if (account) {
      return account
    }

    const concurrent = await this.getCurrentMakeupAccount(
      userId,
      window.periodType,
      window.periodKey,
      tx,
    )
    if (!concurrent) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '补签账户初始化冲突，请稍后重试',
      )
    }
    return concurrent
  }

  protected buildMakeupConsumePlan(
    account: Pick<
      CheckInMakeupAccountSelect,
      'periodicGranted' | 'periodicUsed' | 'eventAvailable'
    >,
  ): CheckInMakeupConsumePlanItem[] {
    const periodicRemaining = Math.max(
      account.periodicGranted - account.periodicUsed,
      0,
    )
    if (periodicRemaining > 0) {
      return [
        {
          sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
          amount: 1,
        },
      ]
    }

    if (account.eventAvailable > 0) {
      return [
        {
          sourceType: CheckInMakeupSourceTypeEnum.EVENT_CARD,
          amount: 1,
        },
      ]
    }

    throw new BusinessException(
      BusinessErrorCode.QUOTA_NOT_ENOUGH,
      '当前无可用补签额度',
    )
  }

  protected async consumeMakeupAllowance(
    account: CheckInMakeupAccountSelect,
    consumePlan: CheckInMakeupConsumePlanItem[],
    tx: Db,
  ) {
    let periodicUsed = account.periodicUsed
    let eventAvailable = account.eventAvailable
    let lastFactId: number | null = account.lastSyncedFactId ?? null

    for (const item of consumePlan) {
      const factRows = await tx
        .insert(this.checkInMakeupFactTable)
        .values({
          userId: account.userId,
          factType: CheckInMakeupFactTypeEnum.CONSUME,
          sourceType: item.sourceType,
          amount: 0,
          consumedAmount: item.amount,
          effectiveAt: new Date(),
          expiresAt: null,
          periodType: account.periodType,
          periodKey: account.periodKey,
          sourceRef: null,
          bizKey: `checkin:makeup:consume:user:${account.userId}:account:${account.id}:version:${account.version + 1}:${item.sourceType}`,
          context: { source: 'makeup_sign' },
        })
        .returning({ id: this.checkInMakeupFactTable.id })

      lastFactId = factRows[0]?.id ?? lastFactId
      if (item.sourceType === CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE) {
        periodicUsed += item.amount
      } else if (item.sourceType === CheckInMakeupSourceTypeEnum.EVENT_CARD) {
        eventAvailable -= item.amount
      }
    }

    const [nextAccount] = await tx
      .update(this.checkInMakeupAccountTable)
      .set({
        periodicUsed,
        eventAvailable,
        version: account.version + 1,
        lastSyncedFactId: lastFactId,
      })
      .where(
        and(
          eq(this.checkInMakeupAccountTable.id, account.id),
          eq(this.checkInMakeupAccountTable.version, account.version),
        ),
      )
      .returning()
    if (!nextAccount) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '补签额度账户并发冲突，请稍后重试',
      )
    }
    return nextAccount
  }

  protected async ensureUserExists(userId: number, db: Db = this.db) {
    const user = await db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  protected async getOrCreateStreakProgress(userId: number, tx: Db) {
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

  protected recomputeStreakAggregation(
    records: Pick<CheckInRecordSelect, 'signDate'>[],
    options?: { streakStartedAt?: string | null },
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
        dayjs
          .tz(signDate, 'YYYY-MM-DD', this.getAppTimeZone())
          .diff(
            dayjs.tz(previousDate, 'YYYY-MM-DD', this.getAppTimeZone()),
            'day',
          ) === 1
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
          ? dayjs
              .tz(latestDate, 'YYYY-MM-DD', this.getAppTimeZone())
              .subtract(streakByDate[latestDate] - 1, 'day')
              .format('YYYY-MM-DD')
          : undefined,
      lastSignedDate: latestDate,
      streakByDate,
    }
  }

  protected resolveRewardForDate(
    rewardDefinition: CheckInRewardDefinition,
    date: string,
    periodType: CheckInMakeupPeriodTypeEnum,
  ): CheckInResolvedReward {
    const dateRule = rewardDefinition.dateRewardRules.find(
      (item) => item.rewardDate === date,
    )
    if (dateRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
        resolvedRewardRuleKey: `DATE:${dateRule.rewardDate}`,
        resolvedRewardItems: dateRule.rewardItems,
      }
    }

    const patternRule = this.resolvePatternRewardRuleByPriority(
      rewardDefinition.patternRewardRules,
      periodType,
      date,
    )
    if (patternRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleKey: this.buildPatternRuleKey(patternRule),
        resolvedRewardItems: patternRule.rewardItems,
      }
    }

    if (rewardDefinition.baseRewardItems) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
        resolvedRewardRuleKey: null,
        resolvedRewardItems: rewardDefinition.baseRewardItems,
      }
    }

    return {
      resolvedRewardSourceType: null,
      resolvedRewardRuleKey: null,
      resolvedRewardItems: null,
    }
  }

  protected resolvePatternRewardRuleByPriority(
    rules: CheckInPatternRewardRuleView[],
    periodType: CheckInMakeupPeriodTypeEnum,
    date: string,
  ) {
    const targetDate = dayjs.tz(date, 'YYYY-MM-DD', this.getAppTimeZone())

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      const weekday = targetDate.day() === 0 ? 7 : targetDate.day()
      return rules.find(
        (rule) =>
          rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY &&
          rule.weekday === weekday,
      )
    }

    const monthDay = targetDate.date()
    const monthLastDayRule = rules.find(
      (rule) =>
        rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY &&
        monthDay === targetDate.daysInMonth(),
    )
    if (monthLastDayRule) {
      return monthLastDayRule
    }

    return rules.find(
      (rule) =>
        rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
        rule.monthDay === monthDay,
    )
  }

  protected buildPatternRuleKey(rule: CheckInPatternRewardRuleView) {
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
      return `WEEKDAY:${rule.weekday}`
    }
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
      return `MONTH_DAY:${rule.monthDay}`
    }
    return 'MONTH_LAST_DAY'
  }

  protected resolveNextStreakReward(
    rules: CheckInStreakRewardRuleView[],
    currentStreak: number,
  ) {
    const nextRule = rules
      .filter(
        (rule) => rule.status === CheckInStreakRewardRuleStatusEnum.ENABLED,
      )
      .sort((left, right) => left.streakDays - right.streakDays)
      .find((rule) => rule.streakDays > currentStreak)

    return nextRule ?? undefined
  }

  protected resolveEffectiveCurrentStreak(
    currentStreak: number,
    lastSignedDate: string | Date | null | undefined,
    today: string,
  ) {
    if (currentStreak <= 0) {
      return 0
    }
    return this.isEffectiveStreakDate(lastSignedDate, today) ? currentStreak : 0
  }

  protected resolveEffectiveLastSignedDate(
    lastSignedDate: string | Date | null | undefined,
    today: string,
  ) {
    if (!this.isEffectiveStreakDate(lastSignedDate, today)) {
      return undefined
    }
    return this.toDateOnlyValue(lastSignedDate) || undefined
  }

  protected isEffectiveStreakDate(
    lastSignedDate: string | Date | null | undefined,
    today: string,
  ) {
    const normalizedLastSignedDate = this.toDateOnlyValue(lastSignedDate)
    if (!normalizedLastSignedDate) {
      return false
    }

    const yesterday = dayjs
      .tz(today, 'YYYY-MM-DD', this.getAppTimeZone())
      .subtract(1, 'day')
      .format('YYYY-MM-DD')

    return (
      normalizedLastSignedDate === today ||
      normalizedLastSignedDate === yesterday
    )
  }

  protected buildActiveStreakProgressWhere(today: string): SQL {
    const yesterday = dayjs
      .tz(today, 'YYYY-MM-DD', this.getAppTimeZone())
      .subtract(1, 'day')
      .format('YYYY-MM-DD')

    return and(
      gt(this.checkInStreakProgressTable.currentStreak, 0),
      or(
        eq(this.checkInStreakProgressTable.lastSignedDate, today),
        eq(this.checkInStreakProgressTable.lastSignedDate, yesterday),
      ),
    )!
  }

  protected resolveEligibleGrantRules(
    rules: CheckInStreakRewardRuleView[],
    streakByDate: Record<string, number>,
    existingGrants: Pick<CheckInStreakGrantSelect, 'ruleCode' | 'triggerSignDate'>[],
    streakStartedAt?: string,
  ) {
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
    const candidates: Array<{
      rule: CheckInStreakRewardRuleView
      triggerSignDate: string
    }> = []

    for (const rule of rules) {
      if (rule.status !== CheckInStreakRewardRuleStatusEnum.ENABLED) {
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

  protected toRewardSettlementSummary(
    settlement:
      | Pick<
          GrowthRewardSettlementSelect,
          | 'id'
          | 'settlementStatus'
          | 'settlementResultType'
          | 'ledgerRecordIds'
          | 'retryCount'
          | 'lastRetryAt'
          | 'settledAt'
          | 'lastError'
        >
      | null
      | undefined,
  ): CheckInRewardSettlementSummaryDto | null {
    if (!settlement) {
      return null
    }
    return {
      ...settlement,
      ledgerRecordIds: settlement.ledgerRecordIds ?? [],
    }
  }

  protected async buildSettlementMapById(ids: number[], db: Db = this.db) {
    if (ids.length === 0) {
      return new Map<number, GrowthRewardSettlementSelect>()
    }

    const rows = await db
      .select()
      .from(this.growthRewardSettlementTable)
      .where(inArray(this.growthRewardSettlementTable.id, ids))
    return new Map(rows.map((row) => [row.id, row]))
  }

  protected findDuplicateValue(values: string[]) {
    const seen = new Set<string>()
    for (const value of values) {
      if (seen.has(value)) {
        return value
      }
      seen.add(value)
    }
    return undefined
  }

  protected comparePatternRewardRules(
    left: CheckInPatternRewardRuleView,
    right: CheckInPatternRewardRuleView,
  ) {
    if (left.patternType !== right.patternType) {
      return left.patternType - right.patternType
    }
    if (left.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
      return (left.weekday ?? 0) - (right.weekday ?? 0)
    }
    return (left.monthDay ?? 0) - (right.monthDay ?? 0)
  }
}
