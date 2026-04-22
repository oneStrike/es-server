import type { Db, DrizzleService } from '@db/core'
import type {
  CheckInConfigSelect,
  CheckInMakeupAccountSelect,
  GrowthRewardSettlementSelect,
} from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import type { GrowthRewardItems } from '@libs/growth/reward-rule/reward-item.type'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInActiveStreakDayRule,
  CheckInAllowEmptyOption,
  CheckInDateLike,
  CheckInDateRewardRuleInput,
  CheckInDateRewardRuleView,
  CheckInEligibleGrantCandidate,
  CheckInGrantTriggerView,
  CheckInMakeupAccountBalance,
  CheckInMakeupAccountView,
  CheckInMakeupConsumePlanItem,
  CheckInMakeupWindowView,
  CheckInNullableDateLike,
  CheckInOptionalRewardItems,
  CheckInOptionalRewardSettlementSummary,
  CheckInPatternRewardRuleInput,
  CheckInPatternRewardRuleView,
  CheckInRecordDateOnlyView,
  CheckInResolvedReward,
  CheckInRewardDefinition,
  CheckInRewardDefinitionSource,
  CheckInStreakAggregation,
  CheckInStreakAggregationOptions,
  CheckInStreakRewardRuleInput,
  CheckInStreakRewardRuleView,
  CheckInStreakRuleDefinition,
  CheckInStreakRuleDefinitionSource,
  CheckInStreakRuleStatusWindow,
  CheckInStreakRuleViewSource,
} from './check-in.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  addDaysToDateOnlyInAppTimeZone,
  diffDateOnlyInAppTimeZone,
  endOfDayInAppTimeZone,
  formatDateOnlyInAppTimeZone,
  getDateOnlyPartsInAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils/time'
import { BadRequestException, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gt, inArray, or, sql } from 'drizzle-orm'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import {
  CheckInMakeupFactTypeEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakConfigStatusEnum,
} from './check-in.constant'

/**
 * 统一签到域 support 基类。
 *
 * 收口签到配置解析、补签账户窗口、连续签到规则关系查询与公共校验逻辑。
 */
export abstract class CheckInServiceSupport {
  protected readonly logger = new Logger(CheckInServiceSupport.name)

  // 注入签到域共享的数据库访问和账本依赖。
  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly growthLedgerService: GrowthLedgerService,
  ) {}

  // 暴露当前 Drizzle 数据库实例。
  protected get db() {
    return this.drizzle.db
  }

  // 暴露签到配置表 owner。
  protected get checkInConfigTable() {
    return this.drizzle.schema.checkInConfig
  }

  // 暴露补签事实表 owner。
  protected get checkInMakeupFactTable() {
    return this.drizzle.schema.checkInMakeupFact
  }

  // 暴露补签账户表 owner。
  protected get checkInMakeupAccountTable() {
    return this.drizzle.schema.checkInMakeupAccount
  }

  // 暴露签到事实表 owner。
  protected get checkInRecordTable() {
    return this.drizzle.schema.checkInRecord
  }

  // 暴露连续签到规则表 owner。
  protected get checkInStreakRuleTable() {
    return this.drizzle.schema.checkInStreakRule
  }

  // 暴露连续签到规则奖励项表 owner。
  protected get checkInStreakRuleRewardItemTable() {
    return this.drizzle.schema.checkInStreakRuleRewardItem
  }

  // 暴露连续签到进度表 owner。
  protected get checkInStreakProgressTable() {
    return this.drizzle.schema.checkInStreakProgress
  }

  // 暴露连续签到奖励发放表 owner。
  protected get checkInStreakGrantTable() {
    return this.drizzle.schema.checkInStreakGrant
  }

  // 暴露连续签到奖励发放奖励项表 owner。
  protected get checkInStreakGrantRewardItemTable() {
    return this.drizzle.schema.checkInStreakGrantRewardItem
  }

  // 暴露通用成长奖励补偿表 owner。
  protected get growthRewardSettlementTable() {
    return this.drizzle.schema.growthRewardSettlement
  }

  // 把 Date 或日期字符串规范化成 YYYY-MM-DD。
  protected formatDateOnly(value: CheckInDateLike) {
    return formatDateOnlyInAppTimeZone(value)
  }

  // 解析日期字符串；非法时统一抛协议层参数错误。
  protected parseDateOnly(value: string, fieldLabel = '日期') {
    const parsed = parseDateOnlyInAppTimeZone(value)
    if (!parsed) {
      throw new BadRequestException(`${fieldLabel}非法`)
    }
    return this.formatDateOnly(parsed)
  }

  // 把 Date / string / null 统一折叠成日期字符串或空串。
  protected toDateOnlyValue(value: CheckInNullableDateLike) {
    if (!value) {
      return ''
    }
    return typeof value === 'string' ? value : this.formatDateOnly(value)
  }

  // 仅在输入是普通对象时返回可安全读取的记录结构。
  protected asRecord<T>(value: T) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    return value as Record<string, unknown>
  }

  // 仅在输入是数组时返回原数组。
  protected asArray<T>(value: T) {
    return Array.isArray(value) ? value : undefined
  }

  // 生成连续签到规则的稳定编码。
  protected buildStreakRuleCode(streakDays: number) {
    return `streak-day-${streakDays}`
  }

  // 解析并校验奖励项列表，必要时做去重和空值控制。
  protected parseRewardItems(
    value: CheckInOptionalRewardItems,
    options: CheckInAllowEmptyOption = { allowEmpty: true },
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

  // 从持久化 JSON 中恢复奖励项列表，并复用统一校验逻辑。
  protected parseStoredRewardItems<T>(
    value: T,
    options: CheckInAllowEmptyOption = { allowEmpty: true },
  ) {
    const rewardItems = this.asArray(value)
    return this.parseRewardItems(
      rewardItems as GrowthRewardItems | undefined,
      options,
    )
  }

  // 解析单条奖励项，并限制在签到域支持的字段集合内。
  protected parseRewardItem(value: unknown, index: number) {
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

  // 规范化具体日期奖励规则，并校验日期和奖励项合法性。
  protected normalizeDateRewardRules(rules?: CheckInDateRewardRuleInput[]) {
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

  // 规范化周期奖励规则，并按周/月模式校验字段组合。
  protected normalizePatternRewardRules(
    rules: CheckInPatternRewardRuleInput[] = [],
    periodType: CheckInMakeupPeriodTypeEnum,
  ) {
    const normalizedRules = rules.map((rule) => {
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

  // 规范化连续奖励规则，并补齐默认编码、状态和重复发放标记。
  protected normalizeStreakRewardRules(rules?: CheckInStreakRewardRuleInput[]) {
    const normalizedRules = (rules ?? []).map((rule) => {
      if (!Number.isInteger(rule.streakDays) || rule.streakDays <= 0) {
        throw new BadRequestException('连续奖励阈值必须为正整数')
      }
      const rawRuleCode =
        'ruleCode' in rule && typeof rule.ruleCode === 'string'
          ? rule.ruleCode.trim()
          : ''
      const ruleCode = rawRuleCode || this.buildStreakRuleCode(rule.streakDays)

      return {
        ruleCode,
        streakDays: rule.streakDays,
        rewardItems: this.parseRewardItems(rule.rewardItems, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable ?? false,
        status: rule.status ?? CheckInStreakConfigStatusEnum.ACTIVE,
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

  // 从配置表记录中解析出运行时使用的奖励定义。
  protected parseRewardDefinition(config: CheckInRewardDefinitionSource) {
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

  // 把规则表记录和奖励项快照收敛成内部规则版本定义。
  protected parseStreakRuleDefinition(rule: CheckInStreakRuleDefinitionSource) {
    return {
      ruleCode: rule.ruleCode,
      streakDays: rule.streakDays,
      version: rule.version,
      status: rule.status as CheckInStreakConfigStatusEnum,
      publishStrategy: rule.publishStrategy,
      rewardItems: this.parseRewardItems(rule.rewardItems, {
        allowEmpty: false,
      })!,
      repeatable: rule.repeatable,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo ?? null,
    } satisfies CheckInStreakRuleDefinition
  }

  // 按当前时间解析连续签到规则的真实生命周期状态。
  protected resolveStreakRuleStatus(
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

  // 计算按签到日期回看配置时应使用的查询时间点。
  protected resolveConfigLookupAt(signDate: string) {
    return parseDateOnlyInAppTimeZone(signDate)!
  }

  // 按规则 ID 批量加载规则奖励项，并按规则分组返回。
  protected async loadStreakRewardRuleRowsByIds(
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

  // 查询某个规则编码下的全部历史版本，并补齐奖励项快照。
  protected async listStreakRuleVersionsByCode(
    ruleCode: string,
    db: Db = this.db,
  ) {
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
  protected async findLatestStreakRuleVersion(
    ruleCode: string,
    db: Db = this.db,
  ) {
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
  protected assertNoDuplicatedActiveStreakDays(
    rules: CheckInActiveStreakDayRule[],
  ) {
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
  protected async listActiveStreakRulesAt(
    at: CheckInDateLike,
    db: Db = this.db,
  ) {
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
  protected toStreakRewardRuleViews(
    rules: CheckInStreakRuleViewSource[],
    at: CheckInDateLike = new Date(),
  ) {
    const lookupAt =
      typeof at === 'string' ? this.resolveConfigLookupAt(at) : at
    return this.normalizeStreakRewardRules(
      rules.map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        repeatable: rule.repeatable,
        status: this.resolveStreakRuleStatus(rule, lookupAt),
        rewardItems: rule.rewardItems.map((item) => ({
          assetType: item.assetType,
          assetKey: item.assetKey,
          amount: item.amount,
        })),
      })),
    )
  }

  // 批量加载连续奖励发放记录对应的奖励项快照。
  protected async buildGrantRewardItemMap(
    grantIds: number[],
    db: Db = this.db,
  ) {
    if (grantIds.length === 0) {
      return new Map<number, GrowthRewardItems>()
    }

    const rewardItems = await db
      .select()
      .from(this.checkInStreakGrantRewardItemTable)
      .where(inArray(this.checkInStreakGrantRewardItemTable.grantId, grantIds))
      .orderBy(
        asc(this.checkInStreakGrantRewardItemTable.sortOrder),
        asc(this.checkInStreakGrantRewardItemTable.id),
      )

    const rewardMap = new Map<number, GrowthRewardItems>()
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

  // 读取当前唯一的签到配置；配置缺失时返回空值。
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

  // 读取当前签到配置；缺失时统一抛资源不存在异常。
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

  // 读取当前已启用的签到配置；未开启时统一抛业务异常。
  protected async getEnabledConfig(db: Db = this.db) {
    const config = await this.getRequiredConfig(db)
    if (config.isEnabled !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '签到功能未开启',
      )
    }
    return config
  }

  // 按补签周期类型计算某个自然日所在的周期窗口。
  protected buildMakeupWindow(
    date: string,
    periodType: CheckInMakeupPeriodTypeEnum,
  ): CheckInMakeupWindowView {
    const dateParts = getDateOnlyPartsInAppTimeZone(date)
    if (!dateParts) {
      throw new BadRequestException('日期非法')
    }

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      const periodStartDate = addDaysToDateOnlyInAppTimeZone(
        date,
        -(dateParts.weekday - 1),
      )!
      const periodEndDate = addDaysToDateOnlyInAppTimeZone(periodStartDate, 6)!
      return {
        periodType,
        periodKey: `week-${periodStartDate}`,
        periodStartDate,
        periodEndDate,
      }
    }

    return {
      periodType,
      periodKey: `month-${dateParts.monthStartDate}`,
      periodStartDate: dateParts.monthStartDate,
      periodEndDate: dateParts.monthEndDate,
    }
  }

  // 判断目标签到日期是否仍位于当前补签窗口内。
  protected isDateWithinMakeupWindow(
    signDate: string,
    window: CheckInMakeupWindowView,
  ) {
    return (
      signDate >= window.periodStartDate && signDate <= window.periodEndDate
    )
  }

  // 查询用户最近一次补签账户快照。
  protected async getLatestAccount(userId: number, db: Db = this.db) {
    const [account] = await db
      .select()
      .from(this.checkInMakeupAccountTable)
      .where(eq(this.checkInMakeupAccountTable.userId, userId))
      .orderBy(desc(this.checkInMakeupAccountTable.id))
      .limit(1)
    return account
  }

  // 查询当前周期对应的补签账户。
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

  // 构建当前周期的补签账户读模型，不存在账户时回退到默认视图。
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

  // 确保当前周期补签账户存在，并在跨周期时完成滚动初始化。
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
      const periodStartAt = parseDateOnlyInAppTimeZone(window.periodStartDate)!
      if (periodicRemaining > 0) {
        await tx
          .insert(this.checkInMakeupFactTable)
          .values({
            userId,
            factType: CheckInMakeupFactTypeEnum.EXPIRE,
            sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
            amount: 0,
            consumedAmount: periodicRemaining,
            effectiveAt: periodStartAt,
            expiresAt: periodStartAt,
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

    const periodStartAt = parseDateOnlyInAppTimeZone(window.periodStartDate)!
    const periodEndAt = endOfDayInAppTimeZone(
      parseDateOnlyInAppTimeZone(window.periodEndDate)!,
    )
    const grantedFactRows = await tx
      .insert(this.checkInMakeupFactTable)
      .values({
        userId,
        factType: CheckInMakeupFactTypeEnum.GRANT,
        sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
        amount: config.periodicAllowance,
        consumedAmount: 0,
        effectiveAt: periodStartAt,
        expiresAt: periodEndAt,
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

  // 根据当前账户余额决定本次补签应消费哪类额度。
  protected buildMakeupConsumePlan(
    account: CheckInMakeupAccountBalance,
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

  // 在事务内写入补签消费事实并乐观更新当前账户。
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

  // 校验目标用户是否存在，避免后续事实写入出现悬空引用。
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

  // 读取或初始化连续签到进度，处理并发首建场景。
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

  // 按签到记录序列重算连续签到聚合结果。
  protected recomputeStreakAggregation(
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

  // 解析某个签到日期命中的基础奖励来源和快照。
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

  // 按优先级解析某日命中的周期模式奖励规则。
  protected resolvePatternRewardRuleByPriority(
    rules: CheckInPatternRewardRuleView[],
    periodType: CheckInMakeupPeriodTypeEnum,
    date: string,
  ) {
    const dateParts = getDateOnlyPartsInAppTimeZone(date)
    if (!dateParts) {
      return undefined
    }

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      return rules.find(
        (rule) =>
          rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY &&
          rule.weekday === dateParts.weekday,
      )
    }

    const monthLastDayRule = rules.find(
      (rule) =>
        rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY &&
        dateParts.dayOfMonth === dateParts.daysInMonth,
    )
    if (monthLastDayRule) {
      return monthLastDayRule
    }

    return rules.find(
      (rule) =>
        rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
        rule.monthDay === dateParts.dayOfMonth,
    )
  }

  // 生成周期奖励规则的稳定业务键。
  protected buildPatternRuleKey(rule: CheckInPatternRewardRuleView) {
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
      return `WEEKDAY:${rule.weekday}`
    }
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
      return `MONTH_DAY:${rule.monthDay}`
    }
    return 'MONTH_LAST_DAY'
  }

  // 解析下一档仍可命中的连续奖励规则。
  protected resolveNextStreakReward(
    rules: CheckInStreakRewardRuleView[],
    currentStreak: number,
  ) {
    const nextRule = rules
      .filter((rule) => rule.status === CheckInStreakConfigStatusEnum.ACTIVE)
      .sort((left, right) => left.streakDays - right.streakDays)
      .find((rule) => rule.streakDays > currentStreak)

    return nextRule ?? undefined
  }

  // 根据最后签到日期判断当前连续天数是否仍然有效。
  protected resolveEffectiveCurrentStreak(
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
  protected resolveEffectiveLastSignedDate(
    lastSignedDate: CheckInNullableDateLike,
    today: string,
  ) {
    if (!this.isEffectiveStreakDate(lastSignedDate, today)) {
      return undefined
    }
    return this.toDateOnlyValue(lastSignedDate) || undefined
  }

  // 判断最近签到日期是否仍属于当前连续区间。
  protected isEffectiveStreakDate(
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

  // 构建用于排行榜和活跃状态筛选的连续进度条件。
  protected buildActiveStreakProgressWhere(today: string): SQL {
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
  protected resolveEligibleGrantRules(
    rules: CheckInStreakRewardRuleView[],
    streakByDate: Record<string, number>,
    existingGrants: CheckInGrantTriggerView[],
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
    const candidates: CheckInEligibleGrantCandidate[] = []

    for (const rule of rules) {
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

  // 把补偿事实映射成对外使用的补偿摘要。
  protected toRewardSettlementSummary(
    settlement: CheckInOptionalRewardSettlementSummary,
  ) {
    if (!settlement) {
      return null
    }
    return {
      ...settlement,
      ledgerRecordIds: settlement.ledgerRecordIds ?? [],
    }
  }

  // 按 ID 批量查询奖励补偿事实，并收敛成 Map 便于后续复用。
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

  // 找出字符串列表中的第一个重复值。
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

  // 比较两条周期奖励规则的排序优先级。
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
