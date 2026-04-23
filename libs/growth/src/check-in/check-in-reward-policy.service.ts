import type { GrowthRewardItems } from '@libs/growth/reward-rule/reward-item.type'
import type {
  CheckInAllowEmptyOption,
  CheckInDateRewardRuleInput,
  CheckInDateRewardRuleView,
  CheckInOptionalRewardItems,
  CheckInPatternRewardRuleInput,
  CheckInPatternRewardRuleView,
  CheckInResolvedReward,
  CheckInRewardDefinition,
  CheckInRewardDefinitionSource,
  CheckInStreakRewardRuleInput,
  CheckInStreakRewardRuleView,
  CheckInStreakRuleDefinition,
  CheckInStreakRuleDefinitionSource,
} from './check-in.type'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { getDateOnlyPartsInAppTimeZone } from '@libs/platform/utils/time'
import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakConfigStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到奖励规则策略服务。
 *
 * 负责基础奖励、日期奖励、周期奖励和连续奖励规则的解析、归一化与命中判定。
 */
@Injectable()
export class CheckInRewardPolicyService extends CheckInServiceSupport {
  // 注入奖励规则策略所需的底层数据库与账本依赖。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 解析并校验奖励项列表，必要时做去重和空值控制。
  parseRewardItems(
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
  parseStoredRewardItems<T>(
    value: T,
    options: CheckInAllowEmptyOption = { allowEmpty: true },
  ) {
    const rewardItems = this.asArray(value)
    return this.parseRewardItems(
      rewardItems as GrowthRewardItems | undefined,
      options,
    )
  }

  // 规范化具体日期奖励规则，并校验日期和奖励项合法性。
  normalizeDateRewardRules(rules?: CheckInDateRewardRuleInput[]) {
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
  normalizePatternRewardRules(
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
  normalizeStreakRewardRules(rules?: CheckInStreakRewardRuleInput[]) {
    const normalizedRules = (rules ?? []).map((rule) => {
      if (!Number.isInteger(rule.streakDays) || rule.streakDays <= 0) {
        throw new BadRequestException('连续奖励阈值必须为正整数')
      }
      const rawRuleCode =
        'ruleCode' in rule && typeof rule.ruleCode === 'string'
          ? rule.ruleCode.trim()
          : ''
      const ruleCode =
        rawRuleCode || `streak-day-${rule.streakDays}`

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
  parseRewardDefinition(config: CheckInRewardDefinitionSource) {
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
  parseStreakRuleDefinition(rule: CheckInStreakRuleDefinitionSource) {
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

  // 解析某个签到日期命中的基础奖励来源和快照。
  resolveRewardForDate(
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

  // 解析下一档仍可命中的连续奖励规则。
  resolveNextStreakReward(
    rules: CheckInStreakRewardRuleView[],
    currentStreak: number,
  ) {
    const nextRule = rules
      .filter((rule) => rule.status === CheckInStreakConfigStatusEnum.ACTIVE)
      .sort((left, right) => left.streakDays - right.streakDays)
      .find((rule) => rule.streakDays > currentStreak)

    return nextRule ?? undefined
  }

  // 解析单条奖励项，并限制在签到域支持的字段集合内。
  private parseRewardItem(value: unknown, index: number) {
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

  // 按优先级解析某日命中的周期模式奖励规则。
  private resolvePatternRewardRuleByPriority(
    rules: CheckInPatternRewardRuleView[],
    periodType: CheckInMakeupPeriodTypeEnum,
    date: string,
  ) {
    const dateParts = this.getDateOnlyParts(date)
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
  private buildPatternRuleKey(rule: CheckInPatternRewardRuleView) {
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
      return `WEEKDAY:${rule.weekday}`
    }
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
      return `MONTH_DAY:${rule.monthDay}`
    }
    return 'MONTH_LAST_DAY'
  }

  // 比较两条周期奖励规则的排序优先级。
  private comparePatternRewardRules(
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

  // 统一读取自然日拆分结果，屏蔽时间工具依赖细节。
  private getDateOnlyParts(date: string) {
    return getDateOnlyPartsInAppTimeZone(date)
  }
}
