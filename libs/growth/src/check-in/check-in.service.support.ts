import type { Db, DrizzleService } from '@db/core'
import type {
  CheckInCycleSelect,
  CheckInDateRewardRuleSelect,
  CheckInPatternRewardRuleSelect,
  CheckInPlanSelect,
  CheckInStreakRewardRuleSelect,
} from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInDateRewardRuleCoreView,
  CheckInPlanSnapshot,
  CheckInPlanSnapshotSource,
  CheckInPatternRewardRuleCoreView,
  CheckInRewardConfig,
  CheckInResolvedReward,
  CreateCheckInDateRewardRuleInsert,
  CreateCheckInPatternRewardRuleInsert,
  CreateCheckInStreakRewardRuleInsert,
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
 * 统一收口签到计划校验、周期切片、幂等键生成、视图映射与底层 Drizzle 访问，
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

  /** 签到具体日期奖励规则表。 */
  protected get checkInDateRewardRuleTable() {
    return this.drizzle.schema.checkInDateRewardRule
  }

  /** 签到周期模式奖励规则表。 */
  protected get checkInPatternRewardRuleTable() {
    return this.drizzle.schema.checkInPatternRewardRule
  }

  /** 签到事实表。 */
  protected get checkInRecordTable() {
    return this.drizzle.schema.checkInRecord
  }

  /** 连续奖励规则表。 */
  protected get checkInStreakRewardRuleTable() {
    return this.drizzle.schema.checkInStreakRewardRule
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
   * 数组和原始值统一视为无效结构，避免快照或奖励配置误判。
   */
  protected asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    return value as Record<string, unknown>
  }

  /** 校验计划日期范围：结束日期不能早于开始日期。 */
  protected ensurePlanDateRange(
    startDate: string,
    endDate?: string | null,
  ) {
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
    rules: CreateCheckInDateRewardRuleDto[] | undefined,
    planId: number,
    planVersion: number,
    startDate: string,
    endDate?: string | null,
  ) {
    const normalizedRules = (rules ?? []).map((rule) => {
      const rewardDate = this.parseDateOnly(rule.rewardDate, '奖励日期')
      if (rewardDate < startDate || (endDate && rewardDate > endDate)) {
        throw new BadRequestException('具体日期奖励必须落在计划窗口内')
      }

      return {
        planId,
        planVersion,
        rewardDate,
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      } satisfies CreateCheckInDateRewardRuleInsert
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
   * 归一化周期模式奖励规则输入，并在配置阶段阻断同日双命中的冲突。
   */
  protected normalizePatternRewardRules(
    rules: CreateCheckInPatternRewardRuleDto[] | undefined,
    planId: number,
    planVersion: number,
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
        planId,
        planVersion,
        patternType,
        weekday,
        monthDay,
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
      } satisfies CreateCheckInPatternRewardRuleInsert
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
            (rule) => rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
          )
          .map((rule) => String(rule.monthDay)),
      )
      if (duplicateMonthDay) {
        throw new BadRequestException(
          `周期模式奖励规则重复：MONTH_DAY=${duplicateMonthDay}`,
        )
      }

      const monthLastDayRule = normalizedRules.find(
        (rule) => rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_LAST_DAY,
      )
      if (
        monthLastDayRule &&
        normalizedRules.some(
          (rule) =>
            rule.patternType === CheckInPatternRewardRuleTypeEnum.MONTH_DAY &&
            rule.monthDay !== null &&
            [29, 30, 31].includes(rule.monthDay),
        )
      ) {
        throw new BadRequestException(
          'MONTH_LAST_DAY 不能与 MONTH_DAY=29/30/31 同时配置',
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
    rules: CreateCheckInStreakRewardRuleDto[] | undefined,
    planId: number,
    planVersion: number,
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
        planId,
        planVersion,
        ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable ?? false,
        status: rule.status ?? CheckInStreakRewardRuleStatusEnum.ENABLED,
      } satisfies CreateCheckInStreakRewardRuleInsert
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

    return normalizedRules
  }

  /**
   * 构建周期级计划快照。
   *
   * 快照会冻结当前计划版本下的关键基础字段、具体日期奖励、周期模式奖励和连续奖励，
   * 保证用户在本周期内继续按旧版本解释。
   */
  protected buildPlanSnapshot(
    plan: CheckInPlanSnapshotSource,
    streakRules: CheckInStreakRewardRuleSelect[],
    dateRules: CheckInDateRewardRuleSelect[],
    patternRules: CheckInPatternRewardRuleSelect[],
  ) {
    return {
      id: plan.id,
      planCode: plan.planCode,
      planName: plan.planName,
      cycleType: this.parseCycleType(plan.cycleType),
      startDate: this.toDateOnlyValue(plan.startDate),
      endDate: plan.endDate ? this.toDateOnlyValue(plan.endDate) : null,
      allowMakeupCountPerCycle: plan.allowMakeupCountPerCycle,
      baseRewardConfig: this.parseStoredRewardConfig(plan.baseRewardConfig, {
        allowEmpty: true,
      }),
      version: plan.version,
      dateRewardRules: dateRules
        .map((rule) => ({
          id: rule.id,
          planVersion: rule.planVersion,
          rewardDate: this.toDateOnlyValue(rule.rewardDate),
          rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
            allowEmpty: false,
          })!,
        }))
        .sort((left, right) => left.rewardDate.localeCompare(right.rewardDate)),
      patternRewardRules: patternRules
        .map((rule) => ({
          id: rule.id,
          planVersion: rule.planVersion,
          patternType: rule.patternType as CheckInPatternRewardRuleTypeEnum,
          weekday: rule.weekday,
          monthDay: rule.monthDay,
          rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
            allowEmpty: false,
          })!,
        }))
        .sort((left, right) => this.comparePatternRewardRules(left, right)),
      streakRewardRules: streakRules.map((rule) => ({
        id: rule.id,
        planVersion: rule.planVersion,
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable,
        status: rule.status as CheckInStreakRewardRuleStatusEnum,
      })),
    }
  }

  /**
   * 从周期记录中恢复稳定的计划快照。
   *
   * 若快照缺失，说明历史事实已损坏，需要直接阻断执行链路。
   */
  protected getCycleSnapshot(cycle: Pick<CheckInCycleSelect, 'planSnapshot'>) {
    const snapshot = this.asRecord(cycle.planSnapshot)
    if (!snapshot) {
      throw new BadRequestException('周期快照缺失')
    }
    return snapshot as unknown as CheckInPlanSnapshot
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
    return {
      status,
    }
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

  /** 获取指定计划版本下的连续奖励规则列表。 */
  protected async getPlanRules(
    planId: number,
    planVersion: number,
    db: Db = this.db,
  ) {
    return db
      .select()
      .from(this.checkInStreakRewardRuleTable)
      .where(
        and(
          eq(this.checkInStreakRewardRuleTable.planId, planId),
          eq(this.checkInStreakRewardRuleTable.planVersion, planVersion),
          isNull(this.checkInStreakRewardRuleTable.deletedAt),
        ),
      )
      .orderBy(
        asc(this.checkInStreakRewardRuleTable.streakDays),
        asc(this.checkInStreakRewardRuleTable.id),
      )
  }

  /** 获取指定计划版本下的具体日期奖励规则列表。 */
  protected async getPlanDateRewardRules(
    planId: number,
    planVersion: number,
    db: Db = this.db,
  ) {
    return db
      .select()
      .from(this.checkInDateRewardRuleTable)
      .where(
        and(
          eq(this.checkInDateRewardRuleTable.planId, planId),
          eq(this.checkInDateRewardRuleTable.planVersion, planVersion),
        ),
      )
      .orderBy(
        asc(this.checkInDateRewardRuleTable.rewardDate),
        asc(this.checkInDateRewardRuleTable.id),
      )
  }

  /** 获取指定计划版本下的周期模式奖励规则列表。 */
  protected async getPlanPatternRewardRules(
    planId: number,
    planVersion: number,
    db: Db = this.db,
  ) {
    return db
      .select()
      .from(this.checkInPatternRewardRuleTable)
      .where(
        and(
          eq(this.checkInPatternRewardRuleTable.planId, planId),
          eq(this.checkInPatternRewardRuleTable.planVersion, planVersion),
        ),
      )
      .orderBy(
        asc(this.checkInPatternRewardRuleTable.patternType),
        asc(this.checkInPatternRewardRuleTable.weekday),
        asc(this.checkInPatternRewardRuleTable.monthDay),
        asc(this.checkInPatternRewardRuleTable.id),
      )
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

  /** 把连续奖励规则映射成对外稳定视图。 */
  protected toStreakRuleView(rule: {
    id: number
    ruleCode: string
    streakDays: number
    rewardConfig: unknown
    repeatable: boolean
    status: number
  }) {
    return {
      id: rule.id,
      ruleCode: rule.ruleCode,
      streakDays: rule.streakDays,
      rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
        allowEmpty: false,
      })!,
      repeatable: rule.repeatable,
      status: rule.status as CheckInStreakRewardRuleStatusEnum,
    }
  }

  /** 把具体日期奖励规则映射成对外稳定视图。 */
  protected toDateRewardRuleView(rule: {
    id: number
    rewardDate: string | Date
    rewardConfig: unknown
  }): CheckInDateRewardRuleCoreView {
    return {
      id: rule.id,
      rewardDate: this.toDateOnlyValue(rule.rewardDate),
      rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
        allowEmpty: false,
      })!,
    }
  }

  /** 把周期模式奖励规则映射成对外稳定视图。 */
  protected toPatternRewardRuleView(rule: {
    id: number
    patternType: string
    weekday: number | null
    monthDay: number | null
    rewardConfig: unknown
  }): CheckInPatternRewardRuleCoreView {
    return {
      id: rule.id,
      patternType: rule.patternType as CheckInPatternRewardRuleTypeEnum,
      weekday: rule.weekday,
      monthDay: rule.monthDay,
      rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
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

  /** 基于快照解析指定签到日期的基础奖励配置。 */
  protected resolveSnapshotRewardForDate(
    snapshot: Pick<
      CheckInPlanSnapshot,
      | 'cycleType'
      | 'baseRewardConfig'
      | 'dateRewardRules'
      | 'patternRewardRules'
    >,
    signDate: string,
  ): CheckInResolvedReward {
    const dateRule = snapshot.dateRewardRules.find(
      (item) => item.rewardDate === signDate,
    )
    if (dateRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
        resolvedRewardRuleId: dateRule.id,
        resolvedRewardConfig: dateRule.rewardConfig,
      }
    }

    const patternRule = snapshot.patternRewardRules.find((item) =>
      this.matchesPatternRewardRule(snapshot.cycleType, item, signDate),
    )
    if (patternRule) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.PATTERN_RULE,
        resolvedRewardRuleId: patternRule.id,
        resolvedRewardConfig: patternRule.rewardConfig,
      }
    }

    if (snapshot.baseRewardConfig) {
      return {
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
        resolvedRewardRuleId: null,
        resolvedRewardConfig: snapshot.baseRewardConfig,
      }
    }

    return {
      resolvedRewardSourceType: null,
      resolvedRewardRuleId: null,
      resolvedRewardConfig: null,
    }
  }

  // ==================== 版本与基础工具 ====================

  /** 比较两个可空日期值是否完全一致。 */
  protected isSameNullableDate(left?: string | null, right?: string | null) {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return left === right
  }

  /**
   * 判断计划更新是否需要切到新版本。
   *
   * 只要配置变更会影响周期、补签或奖励解释，就必须递增 `plan.version`。
   */
  protected shouldBumpPlanVersion(input: {
    currentPlan: CheckInPlanSelect
    nextPlan: {
      cycleType: CheckInCycleTypeEnum
      startDate: string
      endDate?: string | null
      allowMakeupCountPerCycle: number
      baseRewardConfig?: CheckInRewardConfig | null
    }
    currentDateRules: CheckInDateRewardRuleSelect[]
    nextDateRules: CreateCheckInDateRewardRuleInsert[]
    currentPatternRules: CheckInPatternRewardRuleSelect[]
    nextPatternRules: CreateCheckInPatternRewardRuleInsert[]
    currentRules: CheckInStreakRewardRuleSelect[]
    nextRules: CreateCheckInStreakRewardRuleInsert[]
  }) {
    if (input.currentPlan.cycleType !== input.nextPlan.cycleType) {
      return true
    }
    if (this.toDateOnlyValue(input.currentPlan.startDate) !== input.nextPlan.startDate) {
      return true
    }
    if (
      input.currentPlan.allowMakeupCountPerCycle !==
      input.nextPlan.allowMakeupCountPerCycle
    ) {
      return true
    }
    if (
      JSON.stringify(
        this.parseStoredRewardConfig(input.currentPlan.baseRewardConfig, {
          allowEmpty: true,
        }),
      ) !== JSON.stringify(input.nextPlan.baseRewardConfig ?? null)
    ) {
      return true
    }
    if (
      !this.isSameNullableDate(
        input.currentPlan.endDate,
        input.nextPlan.endDate,
      )
    ) {
      return true
    }

    const currentDateRuleSignatures = input.currentDateRules
      .map((rule) => ({
        rewardDate: this.toDateOnlyValue(rule.rewardDate),
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        }),
      }))
      .sort((left, right) => left.rewardDate.localeCompare(right.rewardDate))
    const nextDateRuleSignatures = input.nextDateRules
      .map((rule) => ({
        rewardDate: rule.rewardDate,
        rewardConfig: rule.rewardConfig,
      }))
      .sort((left, right) => left.rewardDate.localeCompare(right.rewardDate))
    if (
      JSON.stringify(currentDateRuleSignatures) !==
      JSON.stringify(nextDateRuleSignatures)
    ) {
      return true
    }

    const currentPatternRuleSignatures = input.currentPatternRules
      .map((rule) => ({
        patternType: rule.patternType,
        weekday: rule.weekday,
        monthDay: rule.monthDay,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        }),
      }))
      .sort((left, right) => this.comparePatternRewardRules(left, right))
    const nextPatternRuleSignatures = input.nextPatternRules
      .map((rule) => ({
        patternType: rule.patternType,
        weekday: rule.weekday,
        monthDay: rule.monthDay,
        rewardConfig: rule.rewardConfig,
      }))
      .sort((left, right) => this.comparePatternRewardRules(left, right))
    if (
      JSON.stringify(currentPatternRuleSignatures) !==
      JSON.stringify(nextPatternRuleSignatures)
    ) {
      return true
    }

    const currentRuleSignatures = input.currentRules
      .map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        }),
        repeatable: rule.repeatable,
        status: rule.status,
      }))
      .sort((left, right) => left.ruleCode.localeCompare(right.ruleCode))
    const nextRuleSignatures = input.nextRules
      .map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: rule.rewardConfig,
        repeatable: rule.repeatable,
        status: rule.status,
      }))
      .sort((left, right) => left.ruleCode.localeCompare(right.ruleCode))

    return (
      JSON.stringify(currentRuleSignatures) !==
      JSON.stringify(nextRuleSignatures)
    )
  }

  /** 统一把数据库/视图中的日期字段收口为签到域 `date` 字符串。 */
  protected toDateOnlyValue(value: string | Date | null | undefined) {
    if (!value) {
      return ''
    }
    return typeof value === 'string' ? value : this.formatDateOnly(value)
  }

  /** 比较周期模式奖励规则的稳定排序。 */
  private comparePatternRewardRules(
    left: Pick<
      CreateCheckInPatternRewardRuleInsert,
      'patternType' | 'weekday' | 'monthDay'
    >,
    right: Pick<
      CreateCheckInPatternRewardRuleInsert,
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

  /** 判断指定自然日是否命中某条周期模式奖励规则。 */
  private matchesPatternRewardRule(
    cycleType: CheckInCycleTypeEnum,
    rule: Pick<
      CheckInPlanSnapshot['patternRewardRules'][number],
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
