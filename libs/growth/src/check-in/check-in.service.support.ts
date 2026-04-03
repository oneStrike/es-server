import type { Db, DrizzleService } from '@db/core'
import type {
  CheckInCycleSelect,
  CheckInPlanSelect,
  CheckInStreakRewardRuleSelect,
} from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger'
import type { SQL } from 'drizzle-orm'
import type {
  CheckInDateOnly,
  CheckInPlanSnapshot,
  CheckInPlanSnapshotSource,
  CheckInRewardConfig,
  CreateCheckInStreakRewardRuleInsert,
} from './check-in.type'
import type { CreateCheckInStreakRewardRuleDto } from './dto/check-in-streak-reward-rule.dto'
import {
  formatDateOnlyInAppTimeZone,
  getAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils'
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
  CheckInPlanStatusEnum,
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
   * 快照会冻结当前计划版本下的关键基础字段与连续奖励规则集合，保证用户在本周期
   * 内继续按旧版本解释。
   */
  protected buildPlanSnapshot(
    plan: CheckInPlanSnapshotSource,
    rules: CheckInStreakRewardRuleSelect[],
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
      streakRewardRules: rules.map((rule) => ({
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
   * 周/月都从计划开始日期向后推导，所有结果都基于部署时区自然日生成。
   */
  protected buildCycleFrame(
    plan: Pick<CheckInPlanSelect, 'cycleType' | 'startDate'>,
    now: Date,
  ) {
    const targetDate = dayjs
      .tz(this.formatDateOnly(now), 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
    const startDate = dayjs
      .tz(
        this.toDateOnlyValue(plan.startDate),
        'YYYY-MM-DD',
        this.getAppTimeZone(),
      )
      .startOf('day')
    const cycleType = this.parseCycleType(plan.cycleType)

    if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
      const cycleIndex = Math.floor(targetDate.diff(startDate, 'day') / 7)
      const cycleStart = startDate.add(cycleIndex * 7, 'day')
      const cycleEnd = cycleStart.add(6, 'day')
      return {
        cycleKey: `week-${cycleStart.format('YYYY-MM-DD')}`,
        cycleStartDate: cycleStart.format('YYYY-MM-DD'),
        cycleEndDate: cycleEnd.format('YYYY-MM-DD'),
      }
    }

    const anchorDay = startDate.date()
    const buildMonthAnchor = (base: typeof targetDate) =>
      base
        .startOf('month')
        .date(Math.min(anchorDay, base.daysInMonth()))
        .startOf('day')

    let cycleStart = buildMonthAnchor(targetDate)
    if (targetDate.date() < cycleStart.date()) {
      cycleStart = buildMonthAnchor(targetDate.subtract(1, 'month'))
    }
    const nextCycleStart = buildMonthAnchor(cycleStart.add(1, 'month'))
    const cycleEnd = nextCycleStart.subtract(1, 'day')
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

  /**
   * 查找覆盖某个自然日的周期实例。
   *
   * 补签、今日签到和摘要读取都依赖同一套“日期落在哪个周期里”的查询合同。
   */
  protected async findCycleContainingDate(
    userId: number,
    planId: number,
    targetDate: CheckInDateOnly,
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
      startDate: CheckInDateOnly
      endDate?: CheckInDateOnly | null
      allowMakeupCountPerCycle: number
      baseRewardConfig?: CheckInRewardConfig | null
    }
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
