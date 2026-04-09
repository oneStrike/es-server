import type { Db } from '@db/core'
import type {
  CheckInPlanSelect,
  CheckInRecordSelect,
  CheckInStreakRewardGrantSelect,
} from '@db/schema'
import type { GrowthLedgerApplyResult } from '@libs/growth/growth-ledger/growth-ledger.internal'
import type {
  CheckInCycleAggregation,
  CheckInPlanSnapshot,
  CheckInRewardConfig,
  CreateCheckInCycleInput,
  CreateCheckInGrantInput,
  CreateCheckInRecordInput,
} from './check-in.type'
import type {
  CheckInActionResponseDto,
  MakeupCheckInDto,
  RepairCheckInRewardDto,
} from './dto/check-in-execution.dto'
import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerSourceEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, eq, sql } from 'drizzle-orm'
import {
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到执行服务。
 *
 * 落实签到/补签、奖励结算和补偿入口，遵循“签到事实成功即主成功，奖励失败可补偿”。
 */
@Injectable()
export class CheckInExecutionService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  /** 发起今日签到，固定写入当前自然日的正常签到事实。 */
  async signToday(userId: number) {
    return this.performSign({
      userId,
      signDate: this.formatDateOnly(new Date()),
      recordType: CheckInRecordTypeEnum.NORMAL,
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_sign' },
    })
  }

  /** 发起补签，统一走签到主链路并切换为补签语义。 */
  async makeup(dto: MakeupCheckInDto, userId: number) {
    return this.performSign({
      userId,
      signDate: this.parseDateOnly(dto.signDate, '补签日期'),
      recordType: CheckInRecordTypeEnum.MAKEUP,
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_makeup' },
    })
  }

  /** 按目标类型触发基础奖励或连续奖励补偿。 */
  async repairReward(dto: RepairCheckInRewardDto, adminUserId: number) {
    if (dto.targetType === CheckInRepairTargetTypeEnum.RECORD_REWARD) {
      if (!dto.recordId) {
        throw new BadRequestException('recordId 不能为空')
      }
      return {
        targetType: dto.targetType,
        recordId: dto.recordId,
        success: await this.settleRecordReward(dto.recordId, {
          actorUserId: adminUserId,
          source: 'admin_repair',
        }),
      }
    }

    if (!dto.grantId) {
      throw new BadRequestException('grantId 不能为空')
    }
    return {
      targetType: dto.targetType,
      grantId: dto.grantId,
      success: await this.settleGrantReward(dto.grantId, {
        actorUserId: adminUserId,
        source: 'admin_repair',
      }),
    }
  }

  /**
   * 执行签到主流程。
   *
   * 事务内只负责事实写入、周期重算和连续奖励发放事实创建；账本结算放到事务外并允许失败补偿。
   */
  private async performSign(input: {
    userId: number
    signDate: string
    recordType: CheckInRecordTypeEnum
    operatorType: CheckInOperatorTypeEnum
    context?: Record<string, unknown>
  }) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    if (
      input.recordType === CheckInRecordTypeEnum.NORMAL &&
      input.signDate !== today
    ) {
      throw new BadRequestException('签到日期非法')
    }
    if (
      input.recordType === CheckInRecordTypeEnum.MAKEUP &&
      input.signDate >= today
    ) {
      throw new BadRequestException('补签只能发生在今天之前')
    }

    const plan = await this.getCurrentActivePlan(now)
    const action = await this.drizzle.withTransaction(async (tx) => {
      const cycle = await this.createOrGetCycle(tx, plan, input.userId, now)
      const snapshot = this.getCycleSnapshot(cycle)

      if (input.recordType === CheckInRecordTypeEnum.MAKEUP) {
        this.assertMakeupAllowed(input.signDate, today, cycle, snapshot)
      }
      const rewardResolution = this.resolveSnapshotRewardForDate(
        snapshot,
        input.signDate,
      )

      const existingRecord = await this.findRecordByUniqueKey(
        input.userId,
        plan.id,
        input.signDate,
        tx,
      )
      if (existingRecord) {
        return this.buildActionResultFromExisting(
          existingRecord,
          cycle,
          snapshot,
        )
      }

      const [insertedRecord] = await tx
        .insert(this.checkInRecordTable)
        .values(
          this.buildRecordInsert({
            userId: input.userId,
            planId: plan.id,
            cycleId: cycle.id,
            cycleKey: cycle.cycleKey,
            signDate: input.signDate,
            recordType: input.recordType,
            operatorType: input.operatorType,
            rewardApplicable: Boolean(rewardResolution.resolvedRewardConfig),
            resolvedRewardSourceType:
              rewardResolution.resolvedRewardSourceType,
            resolvedRewardRuleId: rewardResolution.resolvedRewardRuleId,
            resolvedRewardConfig: rewardResolution.resolvedRewardConfig,
            context: input.context,
          }),
        )
        .onConflictDoNothing()
        .returning()

      if (!insertedRecord) {
        const duplicatedRecord = await this.findRecordByUniqueKey(
          input.userId,
          plan.id,
          input.signDate,
          tx,
        )
        if (!duplicatedRecord) {
          throw new NotFoundException('签到记录创建失败')
        }
        return this.buildActionResultFromExisting(
          duplicatedRecord,
          cycle,
          snapshot,
        )
      }

      const records = await this.listCycleRecords(cycle.id, tx)
      const aggregation = this.recomputeCycleAggregation(records)
      if (aggregation.makeupUsedCount > snapshot.allowMakeupCountPerCycle) {
        throw new BadRequestException('已超过当前周期补签上限')
      }

      await tx
        .update(this.checkInCycleTable)
        .set({
          currentStreak: aggregation.currentStreak,
          lastSignedDate: aggregation.lastSignedDate ?? null,
          makeupUsedCount: aggregation.makeupUsedCount,
          signedCount: aggregation.signedCount,
          version: sql`${this.checkInCycleTable.version} + 1`,
        })
        .where(eq(this.checkInCycleTable.id, cycle.id))

      const existingGrants = await this.listCycleGrants(cycle.id, tx)
      const candidates = this.resolveEligibleGrantCandidates(
        snapshot.streakRewardRules,
        aggregation.streakByDate,
        existingGrants,
      )

      const triggeredGrantIds: number[] = []
      for (const candidate of candidates) {
        const [grant] = await tx
          .insert(this.checkInStreakRewardGrantTable)
          .values(
            this.buildGrantInsert({
              userId: input.userId,
              planId: plan.id,
              cycleId: cycle.id,
              ruleId: candidate.rule.id,
              triggerSignDate: candidate.triggerSignDate,
              planSnapshotVersion: cycle.planSnapshotVersion,
              context: {
                source:
                  input.recordType === CheckInRecordTypeEnum.MAKEUP
                    ? 'makeup_recompute'
                    : 'sign_recompute',
              },
            }),
          )
          .onConflictDoNothing()
          .returning()

        if (grant) {
          triggeredGrantIds.push(grant.id)
        }
      }

      return {
        recordId: insertedRecord.id,
        cycleId: cycle.id,
        signDate: input.signDate,
        recordType: insertedRecord.recordType,
        rewardStatus: insertedRecord.rewardStatus,
        rewardResultType: insertedRecord.rewardResultType,
        currentStreak: aggregation.currentStreak,
        signedCount: aggregation.signedCount,
        remainingMakeupCount: Math.max(
          snapshot.allowMakeupCountPerCycle - aggregation.makeupUsedCount,
          0,
        ),
        triggeredGrantIds,
        alreadyExisted: false,
      } satisfies CheckInActionResponseDto
    })

    if (!action.alreadyExisted) {
      await this.settleRecordReward(action.recordId, {
        source: 'record_reward',
      })
      for (const grantId of action.triggeredGrantIds) {
        await this.settleGrantReward(grantId, { source: 'streak_reward' })
      }
    }

    return this.buildLatestActionView(action.recordId, {
      alreadyExisted: action.alreadyExisted,
      triggeredGrantIds: action.triggeredGrantIds,
    })
  }

  /**
   * 创建或复用当前周期实例。
   *
   * 执行链路必须在同一事务内冻结快照、复用并发下已创建的周期，并返回唯一周期记录。
   */
  private async createOrGetCycle(
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
    const [dateRules, patternRules, streakRules] = await Promise.all([
      this.getPlanDateRewardRules(plan.id, plan.version, tx),
      this.getPlanPatternRewardRules(plan.id, plan.version, tx),
      this.getPlanRules(plan.id, plan.version, tx),
    ])
    const planSnapshot = this.buildPlanSnapshot(
      plan,
      streakRules,
      dateRules,
      patternRules,
    )
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

  /** 按用户、计划、签到日读取唯一签到事实。 */
  private async findRecordByUniqueKey(
    userId: number,
    planId: number,
    signDate: string,
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

  /** 按周期读取连续奖励发放事实。 */
  private async listCycleGrants(cycleId: number, db: Db = this.db) {
    return db
      .select()
      .from(this.checkInStreakRewardGrantTable)
      .where(eq(this.checkInStreakRewardGrantTable.cycleId, cycleId))
      .orderBy(
        asc(this.checkInStreakRewardGrantTable.triggerSignDate),
        asc(this.checkInStreakRewardGrantTable.id),
      )
  }

  /**
   * 基于当前周期全部签到事实重算聚合摘要。
   *
   * 补签会重新排列历史日期，因此连续签到、已签天数和补签已用次数都必须全量重算。
   */
  private recomputeCycleAggregation(
    records: Pick<CheckInRecordSelect, 'signDate' | 'recordType'>[],
  ): CheckInCycleAggregation {
    const streakByDate: Record<string, number> = {}
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
      signedCount: sortedRecords.length,
      makeupUsedCount: sortedRecords.filter(
        (record) => record.recordType === CheckInRecordTypeEnum.MAKEUP,
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
  private resolveEligibleGrantCandidates(
    rules: CheckInPlanSnapshot['streakRewardRules'],
    streakByDate: Record<string, number>,
    existingGrants: Pick<
      CheckInStreakRewardGrantSelect,
      'ruleId' | 'triggerSignDate'
    >[],
  ) {
    const existingGrantKeys = new Set(
      existingGrants.map(
        (grant) =>
          `${grant.ruleId}:${this.toDateOnlyValue(grant.triggerSignDate)}`,
      ),
    )
    const existingRuleIds = new Set(existingGrants.map((grant) => grant.ruleId))
    const streakEntries = Object.entries(streakByDate).sort(([left], [right]) =>
      left.localeCompare(right),
    )

    const candidates: Array<{
      rule: CheckInPlanSnapshot['streakRewardRules'][number]
      triggerSignDate: string
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

  /** 构建签到事实幂等键。 */
  private buildRecordBizKey(
    planId: number,
    cycleKey: string,
    userId: number,
    signDate: string,
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
  private buildGrantFactBizKey(
    planId: number,
    cycleId: number,
    ruleId: number,
    userId: number,
    triggerSignDate: string,
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
  private buildBaseRewardBizKey(recordId: number, userId: number) {
    return ['checkin', 'base', 'record', recordId, 'user', userId].join(':')
  }

  /** 构建连续奖励账本业务键前缀。 */
  private buildStreakRewardBizKey(
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
  private buildRecordInsert(input: {
    userId: number
    planId: number
    cycleId: number
    cycleKey: string
    signDate: string
    recordType: CheckInRecordTypeEnum
    operatorType: CheckInOperatorTypeEnum
    rewardApplicable: boolean
    resolvedRewardSourceType?: CreateCheckInRecordInput['resolvedRewardSourceType']
    resolvedRewardRuleId?: number | null
    resolvedRewardConfig?: CheckInRewardConfig | null
    context?: Record<string, unknown>
  }): CreateCheckInRecordInput {
    return {
      userId: input.userId,
      planId: input.planId,
      cycleId: input.cycleId,
      signDate: input.signDate,
      recordType: input.recordType,
      rewardStatus: input.rewardApplicable
        ? CheckInRewardStatusEnum.PENDING
        : null,
      resolvedRewardSourceType: input.rewardApplicable
        ? input.resolvedRewardSourceType ?? null
        : null,
      resolvedRewardRuleId: input.rewardApplicable
        ? input.resolvedRewardRuleId ?? null
        : null,
      resolvedRewardConfig: input.resolvedRewardConfig ?? null,
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
  private buildGrantInsert(input: {
    userId: number
    planId: number
    cycleId: number
    ruleId: number
    triggerSignDate: string
    planSnapshotVersion: number
    context?: Record<string, unknown>
  }): CreateCheckInGrantInput {
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

  /** 校验补签日期必须位于当前周期内，且满足“早于今天且计划允许补签”的合同。 */
  private assertMakeupAllowed(
    signDate: string,
    today: string,
    cycle: {
      cycleStartDate: string | Date
      cycleEndDate: string | Date
    },
    snapshot: CheckInPlanSnapshot,
  ) {
    const cycleStartDate = this.toDateOnlyValue(cycle.cycleStartDate)
    const cycleEndDate = this.toDateOnlyValue(cycle.cycleEndDate)

    if (signDate < cycleStartDate || signDate > cycleEndDate) {
      throw new BadRequestException('补签日期不在当前周期内')
    }
    if (signDate >= today) {
      throw new BadRequestException('补签日期必须早于今天')
    }
    if (snapshot.allowMakeupCountPerCycle <= 0) {
      throw new BadRequestException('当前计划不支持补签')
    }
  }

  /** 使用已存在签到事实构建幂等返回结果，避免重复落库后丢失当前周期摘要。 */
  private buildActionResultFromExisting(
    record: CheckInRecordSelect,
    cycle: {
      id: number
      signedCount: number
      makeupUsedCount: number
      currentStreak: number
    },
    snapshot: CheckInPlanSnapshot,
  ) {
    return {
      recordId: record.id,
      cycleId: cycle.id,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      rewardStatus: record.rewardStatus,
      rewardResultType: record.rewardResultType,
      resolvedRewardSourceType:
        record.resolvedRewardSourceType as CheckInRewardSourceTypeEnum | null,
      resolvedRewardRuleId: record.resolvedRewardRuleId,
      resolvedRewardConfig: this.parseStoredRewardConfig(
        record.resolvedRewardConfig,
        {
          allowEmpty: true,
        },
      ),
      currentStreak: cycle.currentStreak,
      signedCount: cycle.signedCount,
      remainingMakeupCount: Math.max(
        snapshot.allowMakeupCountPerCycle - cycle.makeupUsedCount,
        0,
      ),
      triggeredGrantIds: [],
      alreadyExisted: true,
    }
  }

  /** 基于最新记录和周期摘要回填前端动作返回视图。 */
  private async buildLatestActionView(
    recordId: number,
    actionMeta: Pick<
      CheckInActionResponseDto,
      'alreadyExisted' | 'triggeredGrantIds'
    >,
  ) {
    const [record] = await this.db
      .select()
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.id, recordId))
      .limit(1)
    if (!record) {
      throw new NotFoundException('签到记录不存在')
    }

    const [cycle] = await this.db
      .select()
      .from(this.checkInCycleTable)
      .where(eq(this.checkInCycleTable.id, record.cycleId))
      .limit(1)
    if (!cycle) {
      throw new NotFoundException('签到周期不存在')
    }

    const snapshot = this.getCycleSnapshot(cycle)

    return {
      recordId: record.id,
      cycleId: cycle.id,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      rewardStatus: record.rewardStatus,
      rewardResultType: record.rewardResultType,
      resolvedRewardSourceType:
        record.resolvedRewardSourceType as CheckInRewardSourceTypeEnum | null,
      resolvedRewardRuleId: record.resolvedRewardRuleId,
      resolvedRewardConfig: this.parseStoredRewardConfig(
        record.resolvedRewardConfig,
        {
          allowEmpty: true,
        },
      ),
      currentStreak: cycle.currentStreak,
      signedCount: cycle.signedCount,
      remainingMakeupCount: Math.max(
        snapshot.allowMakeupCountPerCycle - cycle.makeupUsedCount,
        0,
      ),
      triggeredGrantIds: actionMeta.triggeredGrantIds,
      alreadyExisted: actionMeta.alreadyExisted,
    } satisfies CheckInActionResponseDto
  }

  /**
   * 结算基础签到奖励。
   *
   * 奖励失败不会回滚签到事实，而是把失败状态和错误原因写回记录，等待后续补偿。
   */
  private async settleRecordReward(
    recordId: number,
    context: { actorUserId?: number, source: string },
  ) {
    try {
      await this.drizzle.withTransaction(async (tx) => {
        const [record] = await tx
          .select()
          .from(this.checkInRecordTable)
          .where(eq(this.checkInRecordTable.id, recordId))
          .limit(1)
        if (!record) {
          throw new NotFoundException('签到记录不存在')
        }

        const [cycle] = await tx
          .select()
          .from(this.checkInCycleTable)
          .where(eq(this.checkInCycleTable.id, record.cycleId))
          .limit(1)
        if (!cycle) {
          throw new NotFoundException('签到周期不存在')
        }

        const rewardConfig = this.parseStoredRewardConfig(
          record.resolvedRewardConfig,
          {
            allowEmpty: true,
          },
        )
        if (!rewardConfig) {
          return
        }

        const settlement = await this.applyRewardConfig(tx, {
          userId: record.userId,
          rewardConfig,
          baseBizKey: this.buildBaseRewardBizKey(record.id, record.userId),
          source: GrowthLedgerSourceEnum.CHECK_IN_BASE_BONUS,
          planId: record.planId,
          cycleId: record.cycleId,
          recordId: record.id,
          actorUserId: context.actorUserId,
        })

        await tx
          .update(this.checkInRecordTable)
          .set({
            rewardStatus: CheckInRewardStatusEnum.SUCCESS,
            rewardResultType: settlement.resultType,
            baseRewardLedgerIds: settlement.ledgerIds,
            rewardSettledAt: new Date(),
            lastRewardError: null,
          })
          .where(eq(this.checkInRecordTable.id, record.id))
      })

      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '签到基础奖励发放失败'
      this.logger.warn(
        `check_in_record_reward_failed recordId=${recordId} error=${message}`,
      )

      await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.checkInRecordTable)
          .set({
            rewardStatus: CheckInRewardStatusEnum.FAILED,
            rewardResultType: CheckInRewardResultTypeEnum.FAILED,
            rewardSettledAt: new Date(),
            lastRewardError: message,
          })
          .where(eq(this.checkInRecordTable.id, recordId)),
      )
      return false
    }
  }

  /**
   * 结算连续签到奖励。
   *
   * 失败后只回写发放事实状态，不反向破坏已命中的连续奖励事实。
   */
  private async settleGrantReward(
    grantId: number,
    context: { actorUserId?: number, source: string },
  ) {
    try {
      await this.drizzle.withTransaction(async (tx) => {
        const [grant] = await tx
          .select()
          .from(this.checkInStreakRewardGrantTable)
          .where(eq(this.checkInStreakRewardGrantTable.id, grantId))
          .limit(1)
        if (!grant) {
          throw new NotFoundException('连续奖励发放事实不存在')
        }

        const [rule] = await tx
          .select()
          .from(this.checkInStreakRewardRuleTable)
          .where(eq(this.checkInStreakRewardRuleTable.id, grant.ruleId))
          .limit(1)
        if (!rule) {
          throw new NotFoundException('连续奖励规则不存在')
        }

        const rewardConfig = this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!
        const settlement = await this.applyRewardConfig(tx, {
          userId: grant.userId,
          rewardConfig,
          baseBizKey: this.buildStreakRewardBizKey(
            grant.id,
            grant.ruleId,
            grant.userId,
          ),
          source: GrowthLedgerSourceEnum.CHECK_IN_STREAK_BONUS,
          planId: grant.planId,
          cycleId: grant.cycleId,
          grantId: grant.id,
          ruleId: grant.ruleId,
          actorUserId: context.actorUserId,
        })

        await tx
          .update(this.checkInStreakRewardGrantTable)
          .set({
            grantStatus: CheckInRewardStatusEnum.SUCCESS,
            grantResultType: settlement.resultType,
            ledgerIds: settlement.ledgerIds,
            grantSettledAt: new Date(),
            lastGrantError: null,
          })
          .where(eq(this.checkInStreakRewardGrantTable.id, grant.id))
      })

      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '连续奖励发放失败'
      this.logger.warn(
        `check_in_streak_grant_reward_failed grantId=${grantId} error=${message}`,
      )

      await this.drizzle.withErrorHandling(() =>
        this.db
          .update(this.checkInStreakRewardGrantTable)
          .set({
            grantStatus: CheckInRewardStatusEnum.FAILED,
            grantResultType: CheckInRewardResultTypeEnum.FAILED,
            grantSettledAt: new Date(),
            lastGrantError: message,
          })
          .where(eq(this.checkInStreakRewardGrantTable.id, grantId)),
      )
      return false
    }
  }

  /** 按奖励配置批量写入成长账本，并统一汇总账本记录 ID 与结果类型。 */
  private async applyRewardConfig(
    tx: Db,
    input: {
      userId: number
      rewardConfig: CheckInRewardConfig
      baseBizKey: string
      source: GrowthLedgerSourceEnum
      planId: number
      cycleId: number
      recordId?: number
      grantId?: number
      ruleId?: number
      actorUserId?: number
    },
  ) {
    const results: GrowthLedgerApplyResult[] = []

    if (input.rewardConfig.points) {
      results.push(
        await this.growthLedgerService.applyDelta(tx, {
          userId: input.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          action: GrowthLedgerActionEnum.GRANT,
          amount: input.rewardConfig.points,
          bizKey: `${input.baseBizKey}:POINTS`,
          source: input.source,
          remark: '签到奖励（积分）',
          context: {
            actorUserId: input.actorUserId,
            planId: input.planId,
            cycleId: input.cycleId,
            recordId: input.recordId,
            grantId: input.grantId,
            ruleId: input.ruleId,
          },
        }),
      )
    }

    if (input.rewardConfig.experience) {
      results.push(
        await this.growthLedgerService.applyDelta(tx, {
          userId: input.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          action: GrowthLedgerActionEnum.GRANT,
          amount: input.rewardConfig.experience,
          bizKey: `${input.baseBizKey}:EXPERIENCE`,
          source: input.source,
          remark: '签到奖励（经验）',
          context: {
            actorUserId: input.actorUserId,
            planId: input.planId,
            cycleId: input.cycleId,
            recordId: input.recordId,
            grantId: input.grantId,
            ruleId: input.ruleId,
          },
        }),
      )
    }

    for (const result of results) {
      if (!result.success) {
        throw new BadRequestException('签到奖励发放失败')
      }
    }

    return {
      ledgerIds: results
        .map((result) => result.recordId)
        .filter((id): id is number => typeof id === 'number'),
      resultType: this.resolveRewardResultType(results),
    }
  }

  /** 只要本次有任一资产真实落账，就把奖励结果视为 APPLIED。 */
  private resolveRewardResultType(results: GrowthLedgerApplyResult[]) {
    if (results.some((result) => result.duplicated !== true)) {
      return CheckInRewardResultTypeEnum.APPLIED
    }
    return CheckInRewardResultTypeEnum.IDEMPOTENT
  }
}
