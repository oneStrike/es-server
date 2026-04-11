import type { Db, DrizzleService } from '@db/core'
import type { CheckInPlanSelect } from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInDateRewardRuleView,
  CheckInPatternRewardRuleView,
  CheckInResolvedReward,
  CheckInRewardConfig,
  CheckInRewardDefinition,
  CheckInStreakRewardRuleView,
} from './check-in.type'
import type { CreateCheckInDateRewardRuleDto } from './dto/check-in-date-reward-rule.dto'
import type { CreateCheckInPatternRewardRuleDto } from './dto/check-in-pattern-reward-rule.dto'
import type { CreateCheckInStreakRewardRuleDto } from './dto/check-in-streak-reward-rule.dto'
import {
  formatDateOnlyInAppTimeZone,
  getAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils/time'
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { and, asc, desc, eq, gte, isNull, lte, ne, or } from 'drizzle-orm'
import {
  CheckInCycleTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 签到域共享 support 基类。
 *
 * 统一收口签到计划校验、周期切片、奖励定义解析、幂等键生成与底层 Drizzle 访问，
 * 供 definition/runtime/execution 三个子服务复用同一套规则。
 */
export abstract class CheckInServiceSupport {
  protected readonly logger = new Logger(CheckInServiceSupport.name)

  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly growthLedgerService: GrowthLedgerService,
  ) {}

  /** 数据库连接实例。 */
  protected get db() {
    return this.drizzle.db
  }

  /** 签到计划表。 */
  protected get checkInPlanTable() {
    return this.drizzle.schema.checkInPlan
  }

  /** 签到周期表。 */
  protected get checkInCycleTable() {
    return this.drizzle.schema.checkInCycle
  }

  /** 签到事实表。 */
  protected get checkInRecordTable() {
    return this.drizzle.schema.checkInRecord
  }

  /** 连续奖励发放事实表。 */
  protected get checkInStreakRewardGrantTable() {
    return this.drizzle.schema.checkInStreakRewardGrant
  }

  /** 获取当前部署统一使用的业务时区。 */
  protected getAppTimeZone() {
    return getAppTimeZone()
  }

  /** 把时间值格式化成签到域统一使用的 `YYYY-MM-DD`。 */
  protected formatDateOnly(value: Date | string) {
    return formatDateOnlyInAppTimeZone(value)
  }

  /**
   * 解析 `date` 语义输入并统一收口到签到域日期字符串。
   *
   * 非法日期会立即抛业务异常，避免后续周期切片继续使用脏值。
   */
  protected parseDateOnly(value: string, fieldLabel = '日期') {
    const parsed = parseDateOnlyInAppTimeZone(value)
    if (!parsed) {
      throw new BadRequestException(`${fieldLabel}非法`)
    }
    return this.formatDateOnly(parsed)
  }

  /**
   * 将未知 JSON 值安全收敛成对象记录。
   *
   * 数组和原始值统一视为无效结构，避免奖励定义误判。
   */
  protected asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    return value as Record<string, unknown>
  }

  /** 校验计划日期范围：结束日期不能早于开始日期。 */
  protected ensurePlanDateRange(startDate: string, endDate?: string | null) {
    if (endDate && endDate < startDate) {
      throw new BadRequestException('计划日期范围非法')
    }
  }

  /** 解析并校验签到周期类型。 */
  protected parseCycleType(value?: string | null) {
    if (
      value === CheckInCycleTypeEnum.WEEKLY ||
      value === CheckInCycleTypeEnum.MONTHLY
    ) {
      return value
    }
    throw new BadRequestException('周期类型非法')
  }

  /**
   * 解析并校验签到奖励配置。
   *
   * 当前仅支持 `points` / `experience` 两类正整数奖励。
   */
  protected parseRewardConfig(
    value?: CheckInRewardConfig | null,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    if (value === null || value === undefined) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励配置不能为空')
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('奖励配置非法')
    }
    const record = value as Record<string, unknown>

    const unsupportedKeys = Object.keys(record).filter(
      (key) => !['points', 'experience'].includes(key),
    )
    if (unsupportedKeys.length > 0) {
      throw new BadRequestException('奖励配置仅支持 points / experience')
    }

    const normalizedConfig: CheckInRewardConfig = {}
    const points = record.points
    const experience = record.experience

    if (points !== undefined) {
      if (!Number.isInteger(points) || Number(points) <= 0) {
        throw new BadRequestException('points 必须为正整数')
      }
      normalizedConfig.points = Number(points)
    }

    if (experience !== undefined) {
      if (!Number.isInteger(experience) || Number(experience) <= 0) {
        throw new BadRequestException('experience 必须为正整数')
      }
      normalizedConfig.experience = Number(experience)
    }

    if (Object.keys(normalizedConfig).length === 0) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励配置不能为空')
    }

    return normalizedConfig
  }

  /**
   * 从存储层 `jsonb` 字段恢复奖励配置对象。
   *
   * 数据库存储允许使用 JSON 容器，但领域层继续只消费显式奖励配置对象。
   */
  protected parseStoredRewardConfig(
    value: unknown,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    return this.parseRewardConfig(
      this.asRecord(value) as CheckInRewardConfig | undefined,
      options,
    )
  }

  /**
   * 归一化具体日期奖励规则输入，并提前拦截计划窗口外和重复日期配置。
   */
  protected normalizeDateRewardRules(
    rules:
      | CreateCheckInDateRewardRuleDto[]
      | CheckInDateRewardRuleView[]
      | undefined,
    startDate: string,
    endDate?: string | null,
  ) {
    const normalizedRules = (rules ?? []).map((rule) => {
      const rewardDate = this.parseDateOnly(rule.rewardDate, '奖励日期')
      if (rewardDate < startDate || (endDate && rewardDate > endDate)) {
        throw new BadRequestException('具体日期奖励必须落在计划窗口内')
      }

      return {
        rewardDate,
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      } satisfies CheckInDateRewardRuleView
    })

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

  /**
   * 归一化周期模式奖励规则输入，并在配置阶段阻断重复规则。
   */
  protected normalizePatternRewardRules(
    rules:
      | CreateCheckInPatternRewardRuleDto[]
      | CheckInPatternRewardRuleView[]
      | undefined,
    cycleType: CheckInCycleTypeEnum,
  ) {
    const normalizedRules = (rules ?? []).map((rule) => {
      const patternType = rule.patternType
      const weekday =
        rule.weekday === undefined || rule.weekday === null
          ? null
          : Number(rule.weekday)
      const monthDay =
        rule.monthDay === undefined || rule.monthDay === null
          ? null
          : Number(rule.monthDay)

      if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
        if (patternType !== CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
          throw new BadRequestException('周计划仅支持 WEEKDAY 模式奖励规则')
        }
      } else if (
        patternType !== CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
        patternType !== CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY
      ) {
        throw new BadRequestException(
          '月计划仅支持 MONTH_DAY / MONTH_LAST_DAY 模式奖励规则',
        )
      }

      if (patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
        if (
          weekday === null ||
          !Number.isInteger(weekday) ||
          weekday < 1 ||
          weekday > 7
        ) {
          throw new BadRequestException('WEEKDAY 规则必须提供 1..7 的 weekday')
        }
        if (monthDay !== null) {
          throw new BadRequestException('WEEKDAY 规则不能同时配置 monthDay')
        }
      }

      if (patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
        if (
          monthDay === null ||
          !Number.isInteger(monthDay) ||
          monthDay < 1 ||
          monthDay > 31
        ) {
          throw new BadRequestException(
            'MONTH_DAY 规则必须提供 1..31 的 monthDay',
          )
        }
        if (weekday !== null) {
          throw new BadRequestException('MONTH_DAY 规则不能同时配置 weekday')
        }
      }

      if (patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY) {
        if (weekday !== null || monthDay !== null) {
          throw new BadRequestException(
            'MONTH_LAST_DAY 规则不能配置 weekday / monthDay',
          )
        }
      }

      return {
        patternType,
        weekday,
        monthDay,
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      } satisfies CheckInPatternRewardRuleView
    })

    if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
      const duplicateWeekday = this.findDuplicateValue(
        normalizedRules.map((rule) => String(rule.weekday)),
      )
      if (duplicateWeekday) {
        throw new BadRequestException(
          `周期模式奖励规则重复：WEEKDAY=${duplicateWeekday}`,
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
          `周期模式奖励规则重复：MONTH_DAY=${duplicateMonthDay}`,
        )
      }

    }

    return normalizedRules.sort((left, right) =>
      this.comparePatternRewardRules(left, right),
    )
  }

  /**
   * 归一化连续签到奖励规则输入，并提前拦截重复阈值和重复编码。
   */
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
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
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

  /** 解析并归一化存储在计划上的奖励定义。 */
  protected getPlanRewardDefinition(
    plan: Pick<
      CheckInPlanSelect,
      'cycleType' | 'startDate' | 'endDate' | 'rewardDefinition'
    >,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    const record = this.asRecord(plan.rewardDefinition)
    if (!record) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励配置不能为空')
    }

    const startDate = this.toDateOnlyValue(plan.startDate)
    const endDate = this.toDateOnlyValue(plan.endDate) || null
    const cycleType = this.parseCycleType(plan.cycleType)

    return {
      baseRewardConfig: this.parseRewardConfig(
        this.asRecord(record.baseRewardConfig) as
        | CheckInRewardConfig
        | undefined,
        { allowEmpty: true },
      ),
      dateRewardRules: this.normalizeDateRewardRules(
        Array.isArray(record.dateRewardRules)
          ? (record.dateRewardRules as CheckInDateRewardRuleView[])
          : [],
        startDate,
        endDate,
      ),
      patternRewardRules: this.normalizePatternRewardRules(
        Array.isArray(record.patternRewardRules)
          ? (record.patternRewardRules as CheckInPatternRewardRuleView[])
          : [],
        cycleType,
      ),
      streakRewardRules: this.normalizeStreakRewardRules(
        Array.isArray(record.streakRewardRules)
          ? (record.streakRewardRules as CheckInStreakRewardRuleView[])
          : [],
      ),
    } satisfies CheckInRewardDefinition
  }

  /** 构建规范化后的奖励定义对象。 */
  protected buildRewardDefinition(input: {
    cycleType: CheckInCycleTypeEnum
    startDate: string
    endDate?: string | null
    baseRewardConfig?: CheckInRewardConfig | null
    dateRewardRules?:
      | CreateCheckInDateRewardRuleDto[]
      | CheckInDateRewardRuleView[]
    patternRewardRules?:
      | CreateCheckInPatternRewardRuleDto[]
      | CheckInPatternRewardRuleView[]
    streakRewardRules?:
      | CreateCheckInStreakRewardRuleDto[]
      | CheckInStreakRewardRuleView[]
  }) {
    return {
      baseRewardConfig: this.parseRewardConfig(input.baseRewardConfig, {
        allowEmpty: true,
      }),
      dateRewardRules: this.normalizeDateRewardRules(
        input.dateRewardRules,
        input.startDate,
        input.endDate ?? null,
      ),
      patternRewardRules: this.normalizePatternRewardRules(
        input.patternRewardRules,
        input.cycleType,
      ),
      streakRewardRules: this.normalizeStreakRewardRules(
        input.streakRewardRules,
      ),
    } satisfies CheckInRewardDefinition
  }

  /** 把连续奖励规则映射成对外稳定视图。 */
  protected toStreakRuleView(rule: CheckInStreakRewardRuleView) {
    return {
      ruleCode: rule.ruleCode,
      streakDays: rule.streakDays,
      rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
        allowEmpty: false,
      })!,
      repeatable: rule.repeatable,
      status: rule.status,
    }
  }

  /** 把具体日期奖励规则映射成对外稳定视图。 */
  protected toDateRewardRuleView(
    rule: CheckInDateRewardRuleView,
  ): CheckInDateRewardRuleView {
    return {
      rewardDate: this.toDateOnlyValue(rule.rewardDate),
      rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
        allowEmpty: false,
      })!,
    }
  }

  /** 把周期模式奖励规则映射成对外稳定视图。 */
  protected toPatternRewardRuleView(
    rule: CheckInPatternRewardRuleView,
  ): CheckInPatternRewardRuleView {
    return {
      patternType: rule.patternType,
      weekday: rule.weekday,
      monthDay: rule.monthDay,
      rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
        allowEmpty: false,
      })!,
    }
  }

  /** 校验计划日期边界必须与自然周期边界对齐。 */
  protected ensurePlanBoundaryAligned(
    cycleType: CheckInCycleTypeEnum,
    startDate: string,
    endDate?: string | null,
  ) {
    const start = dayjs.tz(startDate, 'YYYY-MM-DD', this.getAppTimeZone())
    if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
      if (start.day() !== 1) {
        throw new BadRequestException('周计划开始日期必须对齐周一')
      }
      if (endDate) {
        const end = dayjs.tz(endDate, 'YYYY-MM-DD', this.getAppTimeZone())
        if (end.day() !== 0) {
          throw new BadRequestException('周计划结束日期必须对齐周日')
        }
      }
      return
    }

    if (start.date() !== 1) {
      throw new BadRequestException('月计划开始日期必须对齐月初')
    }
    if (endDate) {
      const end = dayjs.tz(endDate, 'YYYY-MM-DD', this.getAppTimeZone())
      if (end.date() !== end.daysInMonth()) {
        throw new BadRequestException('月计划结束日期必须对齐月末')
      }
    }
  }

  /** 解析指定自然日对应的奖励天序号。 */
  protected resolveRewardDayIndex(
    cycleType: CheckInCycleTypeEnum,
    signDate: string,
  ) {
    const date = dayjs.tz(signDate, 'YYYY-MM-DD', this.getAppTimeZone())
    if (cycleType === CheckInCycleTypeEnum.MONTHLY) {
      return date.date()
    }

    const weekday = date.day()
    return weekday === 0 ? 7 : weekday
  }

  /**
   * 基于当前计划奖励定义解析指定签到日期的基础奖励配置。
   *
   * 解析顺序固定为：具体日期奖励 > 周期模式奖励 > 默认基础奖励。
   * 月计划内若同日同时命中 MONTH_LAST_DAY 与 MONTH_DAY，则 MONTH_LAST_DAY 优先。
   */
  protected resolveRewardForDate(
    cycleType: CheckInCycleTypeEnum,
    rewardDefinition: Pick<
      CheckInRewardDefinition,
      'baseRewardConfig' | 'dateRewardRules' | 'patternRewardRules'
    >,
    signDate: string,
  ): CheckInResolvedReward {
    const dateRule = rewardDefinition.dateRewardRules.find(
      (item) => item.rewardDate === signDate,
    )
    if (dateRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
        resolvedRewardRuleKey: `DATE:${dateRule.rewardDate}`,
        resolvedRewardConfig: dateRule.rewardConfig,
      }
    }

    const patternRule = this.resolvePatternRewardRuleByPriority(
      cycleType,
      rewardDefinition.patternRewardRules,
      signDate,
    )
    if (patternRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleKey: this.buildPatternRuleKey(patternRule),
        resolvedRewardConfig: patternRule.rewardConfig,
      }
    }

    if (rewardDefinition.baseRewardConfig) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
        resolvedRewardRuleKey: null,
        resolvedRewardConfig: rewardDefinition.baseRewardConfig,
      }
    }

    return {
      resolvedRewardSourceType: null,
      resolvedRewardRuleKey: null,
      resolvedRewardConfig: null,
    }
  }

  /** 统一把数据库/视图中的日期字段收口为签到域 `date` 字符串。 */
  protected toDateOnlyValue(value: string | Date | null | undefined) {
    if (!value) {
      return ''
    }
    return typeof value === 'string' ? value : this.formatDateOnly(value)
  }

  /**
   * 计算给定时间点所属的周期边界。
   *
   * 周/月都按真实自然周 / 月生成，所有结果都基于部署时区自然日计算。
   */
  protected buildCycleFrame(
    plan: Pick<CheckInPlanSelect, 'cycleType' | 'startDate'>,
    now: Date,
  ) {
    const targetDate = dayjs
      .tz(this.formatDateOnly(now), 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
    const cycleType = this.parseCycleType(plan.cycleType)

    if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
      const weekday = targetDate.day()
      const offset = weekday === 0 ? 6 : weekday - 1
      const cycleStart = targetDate.subtract(offset, 'day')
      const cycleEnd = cycleStart.add(6, 'day')
      return {
        cycleKey: `week-${cycleStart.format('YYYY-MM-DD')}`,
        cycleStartDate: cycleStart.format('YYYY-MM-DD'),
        cycleEndDate: cycleEnd.format('YYYY-MM-DD'),
      }
    }

    const cycleStart = targetDate.startOf('month')
    const cycleEnd = targetDate.endOf('month').startOf('day')
    return {
      cycleKey: `month-${cycleStart.format('YYYY-MM-DD')}`,
      cycleStartDate: cycleStart.format('YYYY-MM-DD'),
      cycleEndDate: cycleEnd.format('YYYY-MM-DD'),
    }
  }

  /** 统一把数据库中的计划状态收口为签到域状态枚举。 */
  protected resolvePlanStatus(plan: Pick<CheckInPlanSelect, 'status'>) {
    return plan.status as CheckInPlanStatusEnum
  }

  /** 把单一计划状态写回数据库状态列。 */
  protected buildPlanStatusPersistence(status: CheckInPlanStatusEnum) {
    return { status }
  }

  /** 构建管理端计划状态筛选条件。 */
  protected buildPlanStatusCondition(status: CheckInPlanStatusEnum): SQL {
    return eq(this.checkInPlanTable.status, status)
  }

  /**
   * 判断计划在某个自然日是否处于生效态。
   *
   * 这里统一执行“状态为已发布 + 开始/结束日期都按自然日包含边界”口径。
   */
  protected isPlanActiveAt(
    plan: Pick<CheckInPlanSelect, 'status' | 'startDate' | 'endDate'>,
    now: Date,
  ) {
    if (this.resolvePlanStatus(plan) !== CheckInPlanStatusEnum.PUBLISHED) {
      return false
    }
    const today = this.formatDateOnly(now)
    if (plan.startDate > today) {
      return false
    }
    if (plan.endDate && plan.endDate < today) {
      return false
    }
    return true
  }

  // ==================== 计划与周期查询 ====================

  /**
   * 查找当前唯一生效的签到计划。
   *
   * 若命中多条有效计划，说明运营配置已破坏单计划生效合同，这里直接抛冲突异常。
   */
  protected async findCurrentActivePlan(now = new Date(), db: Db = this.db) {
    const today = this.formatDateOnly(now)
    const plans = await db
      .select()
      .from(this.checkInPlanTable)
      .where(
        and(
          isNull(this.checkInPlanTable.deletedAt),
          eq(this.checkInPlanTable.status, CheckInPlanStatusEnum.PUBLISHED),
          lte(this.checkInPlanTable.startDate, today),
          or(
            isNull(this.checkInPlanTable.endDate),
            gte(this.checkInPlanTable.endDate, today),
          ),
        ),
      )
      .orderBy(
        desc(this.checkInPlanTable.updatedAt),
        desc(this.checkInPlanTable.id),
      )
      .limit(2)

    if (plans.length > 1) {
      throw new ConflictException('当前存在多个有效签到计划')
    }
    return plans[0]
  }

  /** 获取当前生效计划，不存在时抛业务异常。 */
  protected async getCurrentActivePlan(now = new Date(), db: Db = this.db) {
    const plan = await this.findCurrentActivePlan(now, db)
    if (!plan) {
      throw new NotFoundException('当前无有效签到计划')
    }
    return plan
  }

  /** 断言指定计划之外不存在其他生效中的计划。 */
  protected async assertNoOtherCurrentActivePlan(
    planId: number,
    now = new Date(),
  ) {
    const today = this.formatDateOnly(now)
    const [otherPlan] = await this.db
      .select({ id: this.checkInPlanTable.id })
      .from(this.checkInPlanTable)
      .where(
        and(
          isNull(this.checkInPlanTable.deletedAt),
          ne(this.checkInPlanTable.id, planId),
          eq(this.checkInPlanTable.status, CheckInPlanStatusEnum.PUBLISHED),
          lte(this.checkInPlanTable.startDate, today),
          or(
            isNull(this.checkInPlanTable.endDate),
            gte(this.checkInPlanTable.endDate, today),
          ),
        ),
      )
      .limit(1)

    if (otherPlan) {
      throw new ConflictException('当前已有其他生效中的签到计划')
    }
  }

  /** 按 ID 获取未删除的签到计划。 */
  protected async getPlanById(id: number, db: Db = this.db) {
    const [plan] = await db
      .select()
      .from(this.checkInPlanTable)
      .where(
        and(
          eq(this.checkInPlanTable.id, id),
          isNull(this.checkInPlanTable.deletedAt),
        ),
      )
      .limit(1)

    if (!plan) {
      throw new NotFoundException('签到计划不存在')
    }
    return plan
  }

  /**
   * 查找覆盖某个自然日的周期实例。
   *
   * 补签、今日签到和摘要读取都依赖同一套“日期落在哪个周期里”的查询合同。
   */
  protected async findCycleContainingDate(
    userId: number,
    planId: number,
    targetDate: string,
    db: Db = this.db,
  ) {
    const [cycle] = await db
      .select()
      .from(this.checkInCycleTable)
      .where(
        and(
          eq(this.checkInCycleTable.userId, userId),
          eq(this.checkInCycleTable.planId, planId),
          lte(this.checkInCycleTable.cycleStartDate, targetDate),
          gte(this.checkInCycleTable.cycleEndDate, targetDate),
        ),
      )
      .orderBy(desc(this.checkInCycleTable.id))
      .limit(1)

    return cycle
  }

  /**
   * 按周期读取签到事实列表。
   *
   * 读模型和执行链路都依赖统一的日期排序口径，避免同一周期在不同路径里出现重排差异。
   */
  protected async listCycleRecords(cycleId: number, db: Db = this.db) {
    return db
      .select()
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.cycleId, cycleId))
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  /** 比较周期模式奖励规则的稳定排序。 */
  private comparePatternRewardRules(
    left: Pick<
      CheckInPatternRewardRuleView,
      'patternType' | 'weekday' | 'monthDay'
    >,
    right: Pick<
      CheckInPatternRewardRuleView,
      'patternType' | 'weekday' | 'monthDay'
    >,
  ) {
    const typeCompare = left.patternType.localeCompare(right.patternType)
    if (typeCompare !== 0) {
      return typeCompare
    }

    const weekdayCompare = (left.weekday ?? 0) - (right.weekday ?? 0)
    if (weekdayCompare !== 0) {
      return weekdayCompare
    }

    return (left.monthDay ?? 0) - (right.monthDay ?? 0)
  }

  /**
   * 按固定优先级解析周期模式奖励规则，避免同一自然日多规则同时命中时出现歧义。
   */
  private resolvePatternRewardRuleByPriority(
    cycleType: CheckInCycleTypeEnum,
    rules: CheckInPatternRewardRuleView[],
    signDate: string,
  ) {
    if (cycleType === CheckInCycleTypeEnum.MONTHLY) {
      const monthLastDayRule = rules.find(
        (rule) =>
          rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY &&
          this.matchesPatternRewardRule(cycleType, rule, signDate),
      )
      if (monthLastDayRule) {
        return monthLastDayRule
      }

      return rules.find(
        (rule) =>
          rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
          this.matchesPatternRewardRule(cycleType, rule, signDate),
      )
    }

    return rules.find((rule) =>
      this.matchesPatternRewardRule(cycleType, rule, signDate),
    )
  }

  /** 判断指定自然日是否命中某条周期模式奖励规则。 */
  private matchesPatternRewardRule(
    cycleType: CheckInCycleTypeEnum,
    rule: Pick<
      CheckInPatternRewardRuleView,
      'patternType' | 'weekday' | 'monthDay'
    >,
    signDate: string,
  ) {
    const date = dayjs.tz(signDate, 'YYYY-MM-DD', this.getAppTimeZone())

    if (
      cycleType === CheckInCycleTypeEnum.WEEKLY &&
      rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY
    ) {
      return rule.weekday === this.resolveRewardDayIndex(cycleType, signDate)
    }

    if (cycleType !== CheckInCycleTypeEnum.MONTHLY) {
      return false
    }

    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
      return rule.monthDay === date.date()
    }

    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY) {
      return date.date() === date.daysInMonth()
    }

    return false
  }

  /** 构建周期模式奖励规则稳定键。 */
  private buildPatternRuleKey(
    rule: Pick<
      CheckInPatternRewardRuleView,
      'patternType' | 'weekday' | 'monthDay'
    >,
  ) {
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.WEEKDAY) {
      return `WEEKDAY:${rule.weekday}`
    }
    if (rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY) {
      return `MONTH_DAY:${rule.monthDay}`
    }
    return 'MONTH_LAST_DAY'
  }

  /** 查找数组中的第一个重复值。 */
  private findDuplicateValue(values: string[]) {
    const seen = new Set<string>()
    for (const value of values) {
      if (seen.has(value)) {
        return value
      }
      seen.add(value)
    }
    return undefined
  }
}
