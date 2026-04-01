import type { Db } from '@db/core'
import type { CheckInRecordSelect } from '@db/schema'
import type { GrowthLedgerApplyResult } from '@libs/growth/growth-ledger'
import type {
  CheckInActionView,
  CheckInDateOnly,
  CheckInPlanSnapshot,
  CheckInRewardConfig,
  MakeupCheckInInput,
  RepairCheckInRewardInput,
} from './check-in.type'
import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerService,
  GrowthLedgerSourceEnum,
} from '@libs/growth/growth-ledger'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import {
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
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
  async makeup(dto: MakeupCheckInInput, userId: number) {
    return this.performSign({
      userId,
      signDate: this.parseDateOnly(dto.signDate, '补签日期'),
      recordType: CheckInRecordTypeEnum.MAKEUP,
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_makeup' },
    })
  }

  /** 按目标类型触发基础奖励或连续奖励补偿。 */
  async repairReward(dto: RepairCheckInRewardInput, adminUserId: number) {
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
    signDate: CheckInDateOnly
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
            rewardApplicable: Boolean(snapshot.baseRewardConfig),
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
          signedCount: aggregation.signedCount,
          makeupUsedCount: aggregation.makeupUsedCount,
          currentStreak: aggregation.currentStreak,
          lastSignedDate: aggregation.lastSignedDate ?? null,
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
      } satisfies CheckInActionView
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

  /** 校验补签日期必须位于当前周期内，且满足“早于今天且计划允许补签”的合同。 */
  private assertMakeupAllowed(
    signDate: CheckInDateOnly,
    today: CheckInDateOnly,
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
    actionMeta: Pick<CheckInActionView, 'alreadyExisted' | 'triggeredGrantIds'>,
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
      currentStreak: cycle.currentStreak,
      signedCount: cycle.signedCount,
      remainingMakeupCount: Math.max(
        snapshot.allowMakeupCountPerCycle - cycle.makeupUsedCount,
        0,
      ),
      triggeredGrantIds: actionMeta.triggeredGrantIds,
      alreadyExisted: actionMeta.alreadyExisted,
    } satisfies CheckInActionView
  }

  /**
   * 结算基础签到奖励。
   *
   * 奖励失败不会回滚签到事实，而是把失败状态和错误原因写回记录，等待后续补偿。
   */
  private async settleRecordReward(
    recordId: number,
    context: { actorUserId?: number; source: string },
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

        const snapshot = this.getCycleSnapshot(cycle)
        const rewardConfig = snapshot.baseRewardConfig
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
    context: { actorUserId?: number; source: string },
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

        const rewardConfig = this.parseRewardConfig(
          this.asRecord(rule.rewardConfig) ?? undefined,
          { allowEmpty: false },
        )!
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
