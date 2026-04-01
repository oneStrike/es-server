import type { Db, DrizzleService } from '@db/core'
import type {
  CheckInCycleSelect,
  CheckInPlanSelect,
  CheckInRecordSelect,
  CheckInStreakRewardGrantSelect,
  CheckInStreakRewardRuleSelect,
} from '@db/schema'
import type { GrowthLedgerService } from '@libs/growth/growth-ledger'
import type {
  CheckInOperatorTypeEnum,
  CheckInRewardResultTypeEnum,
} from './check-in.constant'
import type {
  CheckInCalendarDayView,
  CheckInDateOnly,
  CheckInGrantView,
  CheckInPlanSnapshot,
  CheckInPlanSnapshotSource,
  CheckInRecordView,
  CheckInRewardConfig,
  CheckInStreakRewardRuleInput,
  CheckInVirtualCycleView,
  CreateCheckInCycleInput,
  CreateCheckInStreakRewardRuleInsert,
} from './check-in.type'
import { escapeLikePattern } from '@db/core'
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
import isoWeek from 'dayjs/plugin/isoWeek'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lte,
  ne,
  or,
} from 'drizzle-orm'
import {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRecordTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

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

  /** 构建带转义的模糊查询关键词。 */
  protected buildLikeKeyword(keyword?: string) {
    const trimmed = keyword?.trim()
    if (!trimmed) {
      return undefined
    }
    return `%${escapeLikePattern(trimmed)}%`
  }

  /** 校验发布时间窗满足左闭右开前提：开始时间必须早于结束时间。 */
  protected ensurePublishWindow(
    publishStartAt?: Date | null,
    publishEndAt?: Date | null,
  ) {
    if (publishStartAt && publishEndAt && publishStartAt >= publishEndAt) {
      throw new BadRequestException('发布时间窗非法')
    }
  }

  /** 解析并校验签到周期类型。 */
  protected parseCycleType(value?: string | null) {
    if (
      value === CheckInCycleTypeEnum.DAILY
      || value === CheckInCycleTypeEnum.WEEKLY
      || value === CheckInCycleTypeEnum.MONTHLY
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
    value?: CheckInRewardConfig | Record<string, unknown> | null,
    options: { allowEmpty: boolean } = { allowEmpty: true },
  ) {
    if (value === null || value === undefined) {
      if (options.allowEmpty) {
        return null
      }
      throw new BadRequestException('奖励配置不能为空')
    }

    const record = this.asRecord(value)
    if (!record) {
      throw new BadRequestException('奖励配置非法')
    }

    const unsupportedKeys = Object.keys(record).filter(
      key => !['points', 'experience'].includes(key),
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
   * 归一化连续签到奖励规则输入，并提前拦截重复阈值和重复编码。
   */
  protected normalizeStreakRewardRules(
    rules: CheckInStreakRewardRuleInput[] | undefined,
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
      normalizedRules.map(rule => rule.ruleCode),
    )
    if (duplicateRuleCode) {
      throw new BadRequestException(`连续奖励规则编码重复：${duplicateRuleCode}`)
    }

    const duplicateStreakDays = this.findDuplicateValue(
      normalizedRules.map(rule => String(rule.streakDays)),
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
      cycleAnchorDate: this.toDateOnlyValue(plan.cycleAnchorDate),
      allowMakeupCountPerCycle: plan.allowMakeupCountPerCycle,
      baseRewardConfig: this.parseRewardConfig(
        this.asRecord(plan.baseRewardConfig) ?? undefined,
        { allowEmpty: true },
      ),
      version: plan.version,
      streakRewardRules: rules.map(rule => ({
        id: rule.id,
        planVersion: rule.planVersion,
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseRewardConfig(
          this.asRecord(rule.rewardConfig) ?? undefined,
          { allowEmpty: false },
        )!,
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
   * 周切片使用锚点周几，月切片使用锚点日，所有结果都基于部署时区自然日生成。
   */
  protected buildCycleFrame(
    plan: Pick<CheckInPlanSelect, 'cycleType' | 'cycleAnchorDate'>,
    now: Date,
  ) {
    const targetDate = dayjs
      .tz(this.formatDateOnly(now), 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
    const anchorDate = dayjs
      .tz(
        this.toDateOnlyValue(plan.cycleAnchorDate),
        'YYYY-MM-DD',
        this.getAppTimeZone(),
      )
      .startOf('day')
    const cycleType = this.parseCycleType(plan.cycleType)

    if (cycleType === CheckInCycleTypeEnum.DAILY) {
      const dateKey = targetDate.format('YYYY-MM-DD')
      return {
        cycleKey: dateKey,
        cycleStartDate: dateKey,
        cycleEndDate: dateKey,
      }
    }

    if (cycleType === CheckInCycleTypeEnum.WEEKLY) {
      const anchorWeekday = anchorDate.isoWeekday()
      const offset = (targetDate.isoWeekday() - anchorWeekday + 7) % 7
      const cycleStart = targetDate.subtract(offset, 'day')
      const cycleEnd = cycleStart.add(6, 'day')
      return {
        cycleKey: `week-${cycleStart.format('YYYY-MM-DD')}`,
        cycleStartDate: cycleStart.format('YYYY-MM-DD'),
        cycleEndDate: cycleEnd.format('YYYY-MM-DD'),
      }
    }

    const anchorDay = anchorDate.date()
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

  /**
   * 判断计划在某个绝对时间点是否处于生效态。
   *
   * 这里统一执行“已发布 + 已启用 + 发布时间窗左闭右开”口径。
   */
  protected isPlanActiveAt(
    plan: Pick<
      CheckInPlanSelect,
      'status' | 'isEnabled' | 'publishStartAt' | 'publishEndAt'
    >,
    now: Date,
  ) {
    if (
      plan.status !== CheckInPlanStatusEnum.PUBLISHED
      || plan.isEnabled !== true
    ) {
      return false
    }
    if (plan.publishStartAt && plan.publishStartAt > now) {
      return false
    }
    if (plan.publishEndAt && plan.publishEndAt <= now) {
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
    const plans = await db
      .select()
      .from(this.checkInPlanTable)
      .where(
        and(
          isNull(this.checkInPlanTable.deletedAt),
          eq(this.checkInPlanTable.status, CheckInPlanStatusEnum.PUBLISHED),
          eq(this.checkInPlanTable.isEnabled, true),
          or(
            isNull(this.checkInPlanTable.publishStartAt),
            lte(this.checkInPlanTable.publishStartAt, now),
          ),
          or(
            isNull(this.checkInPlanTable.publishEndAt),
            gt(this.checkInPlanTable.publishEndAt, now),
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
    const [otherPlan] = await this.db
      .select({ id: this.checkInPlanTable.id })
      .from(this.checkInPlanTable)
      .where(
        and(
          isNull(this.checkInPlanTable.deletedAt),
          ne(this.checkInPlanTable.id, planId),
          eq(this.checkInPlanTable.status, CheckInPlanStatusEnum.PUBLISHED),
          eq(this.checkInPlanTable.isEnabled, true),
          or(
            isNull(this.checkInPlanTable.publishStartAt),
            lte(this.checkInPlanTable.publishStartAt, now),
          ),
          or(
            isNull(this.checkInPlanTable.publishEndAt),
            gt(this.checkInPlanTable.publishEndAt, now),
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
   * 创建或复用当前周期实例。
   *
   * 该方法必须在事务内执行，并把当前计划版本的快照冻结到周期记录。
   */
  protected async createOrGetCycle(
    tx: Db,
    plan: CheckInPlanSelect,
    userId: number,
    now: Date,
  ) {
    const today = this.formatDateOnly(now)
    const existingCycle = await this.findCycleContainingDate(
      userId,
      plan.id,
      today,
      tx,
    )
    if (existingCycle) {
      return existingCycle
    }

    const frame = this.buildCycleFrame(plan, now)
    const rules = await this.getPlanRules(plan.id, plan.version, tx)
    const planSnapshot = this.buildPlanSnapshot(plan, rules)
    const cycleInsert: CreateCheckInCycleInput = {
      userId,
      planId: plan.id,
      cycleKey: frame.cycleKey,
      cycleStartDate: frame.cycleStartDate,
      cycleEndDate: frame.cycleEndDate,
      signedCount: 0,
      makeupUsedCount: 0,
      currentStreak: 0,
      lastSignedDate: null,
      planSnapshotVersion: plan.version,
      planSnapshot,
    }

    const [createdCycle] = await tx
      .insert(this.checkInCycleTable)
      .values(cycleInsert)
      .onConflictDoNothing()
      .returning()

    if (createdCycle) {
      return createdCycle
    }

    const [cycle] = await tx
      .select()
      .from(this.checkInCycleTable)
      .where(
        and(
          eq(this.checkInCycleTable.userId, userId),
          eq(this.checkInCycleTable.planId, plan.id),
          eq(this.checkInCycleTable.cycleKey, frame.cycleKey),
        ),
      )
      .limit(1)

    if (!cycle) {
      throw new NotFoundException('签到周期创建失败')
    }
    return cycle
  }

  /**
   * 获取当前周期读模型。
   *
   * 若数据库中尚未落周期实例，则返回基于当前计划版本推导出的虚拟周期视图。
   */
  protected async getCurrentCycleView(
    userId: number,
    plan: CheckInPlanSelect,
    now: Date,
  ) {
    const today = this.formatDateOnly(now)
    const cycle = await this.findCycleContainingDate(userId, plan.id, today)
    if (cycle) {
      return {
        id: cycle.id,
        cycleKey: cycle.cycleKey,
        cycleStartDate: this.toDateOnlyValue(cycle.cycleStartDate),
        cycleEndDate: this.toDateOnlyValue(cycle.cycleEndDate),
        signedCount: cycle.signedCount,
        makeupUsedCount: cycle.makeupUsedCount,
        currentStreak: cycle.currentStreak,
        lastSignedDate: cycle.lastSignedDate
          ? this.toDateOnlyValue(cycle.lastSignedDate)
          : undefined,
        planSnapshotVersion: cycle.planSnapshotVersion,
        planSnapshot: this.getCycleSnapshot(cycle),
      }
    }

    const frame = this.buildCycleFrame(plan, now)
    const rules = await this.getPlanRules(plan.id, plan.version)
    return {
      cycleKey: frame.cycleKey,
      cycleStartDate: frame.cycleStartDate,
      cycleEndDate: frame.cycleEndDate,
      signedCount: 0,
      makeupUsedCount: 0,
      currentStreak: 0,
      planSnapshotVersion: plan.version,
      planSnapshot: this.buildPlanSnapshot(plan, rules),
    }
  }

  /** 按周期读取签到事实列表。 */
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

  /** 按周期读取连续奖励发放事实。 */
  protected async listCycleGrants(cycleId: number, db: Db = this.db) {
    return db
      .select()
      .from(this.checkInStreakRewardGrantTable)
      .where(eq(this.checkInStreakRewardGrantTable.cycleId, cycleId))
      .orderBy(
        asc(this.checkInStreakRewardGrantTable.triggerSignDate),
        asc(this.checkInStreakRewardGrantTable.id),
      )
  }

  /** 按用户、计划、签到日读取唯一签到事实。 */
  protected async findRecordByUniqueKey(
    userId: number,
    planId: number,
    signDate: CheckInDateOnly,
    db: Db = this.db,
  ) {
    const [record] = await db
      .select()
      .from(this.checkInRecordTable)
      .where(
        and(
          eq(this.checkInRecordTable.userId, userId),
          eq(this.checkInRecordTable.planId, planId),
          eq(this.checkInRecordTable.signDate, signDate),
        ),
      )
      .limit(1)
    return record
  }

  // ==================== 聚合重算与规则判定 ====================

  /**
   * 基于当前周期全部签到事实重算聚合摘要。
   *
   * 补签会重新排列历史日期，因此连续签到、已签天数和补签已用次数都必须全量重算。
   */
  protected recomputeCycleAggregation(
    records: Pick<CheckInRecordSelect, 'signDate' | 'recordType'>[],
  ) {
    const streakByDate: Record<CheckInDateOnly, number> = {}
    let previousDate: string | undefined
    let latestDate: string | undefined
    let streak = 0

    const sortedRecords = [...records].sort((left, right) =>
      this.toDateOnlyValue(left.signDate).localeCompare(
        this.toDateOnlyValue(right.signDate),
      ),
    )

    for (const record of sortedRecords) {
      const signDate = this.toDateOnlyValue(record.signDate)
      if (
        previousDate
        && dayjs
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
      signedCount: sortedRecords.length,
      makeupUsedCount: sortedRecords.filter(
        record => record.recordType === CheckInRecordTypeEnum.MAKEUP,
      ).length,
      currentStreak: latestDate ? streakByDate[latestDate] : 0,
      lastSignedDate: latestDate,
      streakByDate,
    }
  }

  /**
   * 根据重算后的连续天数识别本次应创建的连续奖励发放事实。
   *
   * 非重复奖励在单周期内最多发一次；重复奖励按 `triggerSignDate` 维度去重。
   */
  protected resolveEligibleGrantCandidates(
    rules: CheckInPlanSnapshot['streakRewardRules'],
    streakByDate: Record<CheckInDateOnly, number>,
    existingGrants: Pick<
      CheckInStreakRewardGrantSelect,
      'ruleId' | 'triggerSignDate'
    >[],
  ) {
    const existingGrantKeys = new Set(
      existingGrants.map(
        grant => `${grant.ruleId}:${this.toDateOnlyValue(grant.triggerSignDate)}`,
      ),
    )
    const existingRuleIds = new Set(existingGrants.map(grant => grant.ruleId))
    const streakEntries = Object.entries(streakByDate).sort(([left], [right]) =>
      left.localeCompare(right),
    )

    const candidates: Array<{
      rule: CheckInPlanSnapshot['streakRewardRules'][number]
      triggerSignDate: CheckInDateOnly
    }> = []

    for (const rule of rules) {
      if (rule.status !== CheckInStreakRewardRuleStatusEnum.ENABLED) {
        continue
      }
      const triggerDates = streakEntries
        .filter(([, streak]) => streak === rule.streakDays)
        .map(([date]) => date)
      if (triggerDates.length === 0) {
        continue
      }

      if (!rule.repeatable) {
        if (existingRuleIds.has(rule.id)) {
          continue
        }
        candidates.push({ rule, triggerSignDate: triggerDates[0] })
        continue
      }

      for (const triggerSignDate of triggerDates) {
        const grantKey = `${rule.id}:${triggerSignDate}`
        if (!existingGrantKeys.has(grantKey)) {
          candidates.push({ rule, triggerSignDate })
        }
      }
    }

    return candidates
  }

  /** 解析下一档可见的连续奖励。 */
  protected resolveNextStreakReward(
    rules: CheckInPlanSnapshot['streakRewardRules'],
    currentStreak: number,
  ) {
    const nextRule = rules
      .filter(rule => rule.status === CheckInStreakRewardRuleStatusEnum.ENABLED)
      .sort((left, right) => left.streakDays - right.streakDays)
      .find(rule => rule.streakDays > currentStreak)

    return nextRule ? this.toStreakRuleView(nextRule) : undefined
  }

  // ==================== 幂等键与写入载荷 ====================

  /** 构建签到事实幂等键。 */
  protected buildRecordBizKey(
    planId: number,
    cycleKey: string,
    userId: number,
    signDate: CheckInDateOnly,
  ) {
    return [
      'checkin',
      'record',
      'plan',
      planId,
      'cycle',
      cycleKey,
      'user',
      userId,
      'date',
      signDate,
    ].join(':')
  }

  /** 构建连续奖励发放事实幂等键。 */
  protected buildGrantFactBizKey(
    planId: number,
    cycleId: number,
    ruleId: number,
    userId: number,
    triggerSignDate: CheckInDateOnly,
  ) {
    return [
      'checkin',
      'grant',
      'plan',
      planId,
      'cycle',
      cycleId,
      'rule',
      ruleId,
      'user',
      userId,
      'date',
      triggerSignDate,
    ].join(':')
  }

  /** 构建基础签到奖励账本业务键前缀。 */
  protected buildBaseRewardBizKey(recordId: number, userId: number) {
    return ['checkin', 'base', 'record', recordId, 'user', userId].join(':')
  }

  /** 构建连续奖励账本业务键前缀。 */
  protected buildStreakRewardBizKey(
    grantId: number,
    ruleId: number,
    userId: number,
  ) {
    return [
      'checkin',
      'streak',
      'grant',
      grantId,
      'rule',
      ruleId,
      'user',
      userId,
    ].join(':')
  }

  /**
   * 构建签到事实写表载荷。
   *
   * 没有基础奖励时，这里会直接把奖励状态置空，明确表达“无奖励而非待结算”。
   */
  protected buildRecordInsert(input: {
    userId: number
    planId: number
    cycleId: number
    cycleKey: string
    signDate: CheckInDateOnly
    recordType: CheckInRecordTypeEnum
    operatorType: CheckInOperatorTypeEnum
    rewardApplicable: boolean
    context?: Record<string, unknown>
  }) {
    return {
      userId: input.userId,
      planId: input.planId,
      cycleId: input.cycleId,
      signDate: input.signDate,
      recordType: input.recordType,
      rewardStatus: input.rewardApplicable
        ? CheckInRewardStatusEnum.PENDING
        : null,
      bizKey: this.buildRecordBizKey(
        input.planId,
        input.cycleKey,
        input.userId,
        input.signDate,
      ),
      operatorType: input.operatorType,
      context: input.context,
    }
  }

  /** 构建连续奖励发放事实写表载荷。 */
  protected buildGrantInsert(input: {
    userId: number
    planId: number
    cycleId: number
    ruleId: number
    triggerSignDate: CheckInDateOnly
    planSnapshotVersion: number
    context?: Record<string, unknown>
  }) {
    return {
      userId: input.userId,
      planId: input.planId,
      cycleId: input.cycleId,
      ruleId: input.ruleId,
      triggerSignDate: input.triggerSignDate,
      grantStatus: CheckInRewardStatusEnum.PENDING,
      bizKey: this.buildGrantFactBizKey(
        input.planId,
        input.cycleId,
        input.ruleId,
        input.userId,
        input.triggerSignDate,
      ),
      planSnapshotVersion: input.planSnapshotVersion,
      context: input.context,
    }
  }

  // ==================== 视图映射 ====================

  /**
   * 批量查询签到记录关联的连续奖励发放列表。
   *
   * 这里按 `(cycleId, signDate)` 聚合返回，避免逐条 N+1 查询。
   */
  protected async buildGrantMapForRecords(
    records: Pick<CheckInRecordSelect, 'cycleId' | 'signDate'>[],
    db: Db = this.db,
  ) {
    const grantMap = new Map<string, CheckInGrantView[]>()
    if (records.length === 0) {
      return grantMap
    }

    const predicates = records.map(record =>
      and(
        eq(this.checkInStreakRewardGrantTable.cycleId, record.cycleId),
        eq(
          this.checkInStreakRewardGrantTable.triggerSignDate,
          this.toDateOnlyValue(record.signDate),
        ),
      ),
    )

    const grants = await db
      .select()
      .from(this.checkInStreakRewardGrantTable)
      .where(predicates.length === 1 ? predicates[0] : or(...predicates))
      .orderBy(
        asc(this.checkInStreakRewardGrantTable.triggerSignDate),
        asc(this.checkInStreakRewardGrantTable.id),
      )

    for (const grant of grants) {
      const key = `${grant.cycleId}:${this.toDateOnlyValue(grant.triggerSignDate)}`
      const current = grantMap.get(key) ?? []
      current.push(this.toGrantView(grant))
      grantMap.set(key, current)
    }

    return grantMap
  }

  /**
   * 构建当前周期日历视图。
   *
   * 即使某天没有签到事实，也要返回占位项供前端明确区分未来日和漏签日。
   */
  protected buildCalendarDays(
    cycle: Pick<CheckInVirtualCycleView, 'cycleStartDate' | 'cycleEndDate'>,
    records: CheckInRecordView[],
    today: CheckInDateOnly,
  ) {
    const recordMap = new Map(records.map(record => [record.signDate, record]))
    const days: CheckInCalendarDayView[] = []
    let cursor = dayjs
      .tz(cycle.cycleStartDate, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')
    const end = dayjs
      .tz(cycle.cycleEndDate, 'YYYY-MM-DD', this.getAppTimeZone())
      .startOf('day')

    while (cursor.isSame(end) || cursor.isBefore(end)) {
      const signDate = cursor.format('YYYY-MM-DD')
      const record = recordMap.get(signDate)
      days.push({
        signDate,
        isToday: signDate === today,
        isFuture: signDate > today,
        isSigned: Boolean(record),
        recordType: record?.recordType,
        rewardStatus: record?.rewardStatus,
        rewardResultType: record?.rewardResultType,
        grantCount: record?.grants.length ?? 0,
      })
      cursor = cursor.add(1, 'day')
    }

    return days
  }

  /** 把签到事实映射成稳定读模型。 */
  protected toRecordView(
    record: Pick<
      CheckInRecordSelect,
      | 'id'
      | 'signDate'
      | 'recordType'
      | 'rewardStatus'
      | 'rewardResultType'
      | 'baseRewardLedgerIds'
      | 'lastRewardError'
      | 'rewardSettledAt'
      | 'createdAt'
    >,
    grants: CheckInGrantView[] = [],
  ) {
    return {
      id: record.id,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType as CheckInRecordTypeEnum,
      rewardStatus: record.rewardStatus as CheckInRewardStatusEnum | null,
      rewardResultType:
        record.rewardResultType as CheckInRewardResultTypeEnum | null,
      baseRewardLedgerIds: record.baseRewardLedgerIds,
      lastRewardError: record.lastRewardError,
      rewardSettledAt: record.rewardSettledAt,
      grants,
      createdAt: record.createdAt,
    }
  }

  /** 把连续奖励发放事实映射成稳定读模型。 */
  protected toGrantView(
    grant: Pick<
      CheckInStreakRewardGrantSelect,
      | 'id'
      | 'ruleId'
      | 'triggerSignDate'
      | 'grantStatus'
      | 'grantResultType'
      | 'ledgerIds'
      | 'lastGrantError'
    >,
  ) {
    return {
      id: grant.id,
      ruleId: grant.ruleId,
      triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
      grantStatus: grant.grantStatus as CheckInRewardStatusEnum,
      grantResultType:
        grant.grantResultType as CheckInRewardResultTypeEnum | null,
      ledgerIds: grant.ledgerIds,
      lastGrantError: grant.lastGrantError,
    }
  }

  /** 把连续奖励规则映射成对外稳定视图。 */
  protected toStreakRuleView(
    rule: {
      id: number
      ruleCode: string
      streakDays: number
      rewardConfig: unknown
      repeatable: boolean
      status: number
    },
  ) {
    return {
      id: rule.id,
      ruleCode: rule.ruleCode,
      streakDays: rule.streakDays,
      rewardConfig: this.parseRewardConfig(
        this.asRecord(rule.rewardConfig) ?? undefined,
        { allowEmpty: false },
      )!,
      repeatable: rule.repeatable,
      status: rule.status as CheckInStreakRewardRuleStatusEnum,
    }
  }

  // ==================== 版本与基础工具 ====================

  /** 比较两个可空时间值是否完全一致。 */
  protected isSameNullableDate(left?: Date | null, right?: Date | null) {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return left.getTime() === right.getTime()
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
      cycleAnchorDate: CheckInDateOnly
      allowMakeupCountPerCycle: number
      baseRewardConfig?: CheckInRewardConfig | null
      publishStartAt?: Date | null
      publishEndAt?: Date | null
    }
    currentRules: CheckInStreakRewardRuleSelect[]
    nextRules: CreateCheckInStreakRewardRuleInsert[]
  }) {
    if (input.currentPlan.cycleType !== input.nextPlan.cycleType) {
      return true
    }
    if (
      this.toDateOnlyValue(input.currentPlan.cycleAnchorDate)
      !== input.nextPlan.cycleAnchorDate
    ) {
      return true
    }
    if (
      input.currentPlan.allowMakeupCountPerCycle
      !== input.nextPlan.allowMakeupCountPerCycle
    ) {
      return true
    }
    if (
      JSON.stringify(
        this.parseRewardConfig(
          this.asRecord(input.currentPlan.baseRewardConfig) ?? undefined,
          { allowEmpty: true },
        ),
      )
      !== JSON.stringify(input.nextPlan.baseRewardConfig ?? null)
    ) {
      return true
    }
    if (
      !this.isSameNullableDate(
        input.currentPlan.publishStartAt,
        input.nextPlan.publishStartAt,
      )
      || !this.isSameNullableDate(
        input.currentPlan.publishEndAt,
        input.nextPlan.publishEndAt,
      )
    ) {
      return true
    }

    const currentRuleSignatures = input.currentRules
      .map(rule => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseRewardConfig(
          this.asRecord(rule.rewardConfig) ?? undefined,
          { allowEmpty: false },
        ),
        repeatable: rule.repeatable,
        status: rule.status,
      }))
      .sort((left, right) => left.ruleCode.localeCompare(right.ruleCode))
    const nextRuleSignatures = input.nextRules
      .map(rule => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: rule.rewardConfig,
        repeatable: rule.repeatable,
        status: rule.status,
      }))
      .sort((left, right) => left.ruleCode.localeCompare(right.ruleCode))

    return (
      JSON.stringify(currentRuleSignatures)
      !== JSON.stringify(nextRuleSignatures)
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
