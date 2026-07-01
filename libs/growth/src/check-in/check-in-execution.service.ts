import type { Db } from '@db/core'
import type {
  CheckInGrantTriggerView,
  CheckInMakeupWindowView,
  CheckInPerformSignInput,
  CheckInSignAction,
  CheckInStreakAggregation,
  CheckInStreakProgressSnapshot,
  CheckInStreakRepairResult,
} from './check-in.type'
import type {
  MakeupCheckInDto,
  RepairCheckInRewardDto,
  RepairCheckInStreakDto,
} from './dto/check-in-execution.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInStreakService } from './check-in-streak.service'
import {
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_WRITE_RETRY_LIMIT = 3

/**
 * 签到执行服务。
 *
 * 负责今日签到、补签、统一连续奖励发放，以及签到奖励补偿重试。
 */
@Injectable()
export class CheckInExecutionService extends CheckInServiceSupport {
  // 注入签到执行所需的数据库、账本与奖励补偿服务。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
    private readonly checkInRewardPolicyService: CheckInRewardPolicyService,
    private readonly checkInMakeupService: CheckInMakeupService,
    private readonly checkInStreakService: CheckInStreakService,
    private readonly checkInSettlementService: CheckInSettlementService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 为当前自然日执行正常签到。
  async signToday(userId: number) {
    return this.performSign({
      userId,
      signDate: this.formatDateOnly(new Date()),
      recordType: CheckInRecordTypeEnum.NORMAL,
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_sign' },
    })
  }

  // 为指定历史自然日执行补签。
  async makeup(dto: MakeupCheckInDto, userId: number) {
    return this.performSign({
      userId,
      signDate: this.parseDateOnly(dto.signDate, '补签日期'),
      recordType: CheckInRecordTypeEnum.MAKEUP,
      operatorType: CheckInOperatorTypeEnum.USER,
      context: { source: 'app_makeup' },
    })
  }

  // 按目标类型触发基础奖励或连续奖励的补偿重试。
  async repairReward(dto: RepairCheckInRewardDto, adminUserId: number) {
    if (dto.targetType === CheckInRepairTargetTypeEnum.RECORD_REWARD) {
      if (!dto.recordId) {
        throw new BadRequestException('recordId 不能为空')
      }
      return {
        targetType: dto.targetType,
        recordId: dto.recordId,
        success: await this.checkInSettlementService.settleRecordReward(
          dto.recordId,
          {
            actorUserId: adminUserId,
            isRetry: true,
          },
        ),
      }
    }

    if (!dto.grantId) {
      throw new BadRequestException('grantId 不能为空')
    }
    return {
      targetType: dto.targetType,
      grantId: dto.grantId,
      success: await this.checkInSettlementService.settleGrantReward(
        dto.grantId,
        {
          actorUserId: adminUserId,
          isRetry: true,
        },
      ),
    }
  }

  // 后台闭环修复连续签到进度和缺失的连续奖励发放事实。
  async repairStreak(
    dto: RepairCheckInStreakDto,
    adminUserId: number,
  ): Promise<CheckInStreakRepairResult> {
    const repairResult = await this.drizzle.withTransaction(async (tx) => {
      await this.ensureUserExists(dto.userId, tx)
      const progress =
        await this.checkInStreakService.getOrCreateStreakProgress(
          dto.userId,
          tx,
        )
      const records = await this.checkInStreakService.listUserRecords(
        dto.userId,
        tx,
      )
      const aggregation =
        this.checkInStreakService.recomputeStreakAggregation(records)
      const retryableGrantIds = await this.listRetryableStreakGrantIds(
        dto.userId,
        aggregation,
        tx,
      )
      const createdGrantIds = await this.upsertStreakGrantsForAggregation(
        dto.userId,
        aggregation,
        tx,
        new Date(),
        'repair',
      )

      await this.checkInStreakService.updateStreakProgress(
        progress,
        aggregation,
        tx,
      )

      return {
        userId: dto.userId,
        currentStreak: aggregation.currentStreak,
        streakStartedAt: aggregation.streakStartedAt ?? null,
        lastSignedDate: aggregation.lastSignedDate ?? null,
        createdGrantIds,
        retryableGrantIds,
      }
    })

    const settledGrantIds: number[] = []
    const grantIdsToSettle = [
      ...new Set([
        ...repairResult.retryableGrantIds,
        ...repairResult.createdGrantIds,
      ]),
    ]
    for (const grantId of grantIdsToSettle) {
      const success = await this.settleRepairGrantReward(grantId, adminUserId)
      if (success) {
        settledGrantIds.push(grantId)
      }
    }

    return {
      userId: repairResult.userId,
      currentStreak: repairResult.currentStreak,
      streakStartedAt: repairResult.streakStartedAt,
      lastSignedDate: repairResult.lastSignedDate,
      createdGrantIds: repairResult.createdGrantIds,
      settledGrantIds,
    }
  }

  // 统一执行签到/补签主流程，并在事务内完成事实写入和奖励补偿。
  private async performSign(input: CheckInPerformSignInput) {
    const now = new Date()
    const today = this.formatDateOnly(now)
    if (
      input.recordType === CheckInRecordTypeEnum.NORMAL &&
      input.signDate !== today
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '签到日期非法',
      )
    }
    if (
      input.recordType === CheckInRecordTypeEnum.MAKEUP &&
      input.signDate >= today
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签只能发生在今天之前',
      )
    }

    const config = await this.getEnabledConfig()
    const rewardDefinition =
      this.checkInRewardPolicyService.parseRewardDefinition(config)
    let action: CheckInSignAction | undefined

    for (let attempt = 0; attempt < CHECK_IN_WRITE_RETRY_LIMIT; attempt++) {
      try {
        action = await this.drizzle.withTransaction(async (tx) => {
          await this.ensureUserExists(input.userId, tx)
          const existing = await tx.query.checkInRecord.findFirst({
            where: {
              userId: input.userId,
              signDate: input.signDate,
            },
          })
          if (existing) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              input.recordType === CheckInRecordTypeEnum.NORMAL
                ? '今日已签到，请勿重复操作'
                : '该日期已签到，请勿重复补签',
            )
          }

          let account =
            await this.checkInMakeupService.ensureCurrentMakeupAccount(
              input.userId,
              config,
              today,
              tx,
            )
          const window = this.checkInMakeupService.buildMakeupWindow(
            today,
            config.makeupPeriodType,
          )

          if (input.recordType === CheckInRecordTypeEnum.MAKEUP) {
            this.assertMakeupAllowed(input.signDate, today, window)
            const consumePlan =
              this.checkInMakeupService.buildMakeupConsumePlan(account)
            account = await this.checkInMakeupService.consumeMakeupAllowance(
              account,
              consumePlan,
              tx,
            )
          }

          const rewardResolution =
            this.checkInRewardPolicyService.resolveRewardForDate(
              rewardDefinition,
              input.signDate,
              config.makeupPeriodType,
            )

          const [record] = await tx
            .insert(this.checkInRecordTable)
            .values({
              userId: input.userId,
              signDate: input.signDate,
              recordType: input.recordType,
              resolvedRewardSourceType: rewardResolution.resolvedRewardItems
                ? (rewardResolution.resolvedRewardSourceType ?? null)
                : null,
              resolvedRewardRuleKey: rewardResolution.resolvedRewardItems
                ? (rewardResolution.resolvedRewardRuleKey ?? null)
                : null,
              resolvedRewardItems: rewardResolution.resolvedRewardItems ?? null,
              resolvedRewardOverviewIconUrl:
                rewardResolution.resolvedRewardItems
                  ? rewardResolution.resolvedRewardOverviewIconUrl
                  : null,
              resolvedMakeupIconUrl:
                input.recordType === CheckInRecordTypeEnum.MAKEUP
                  ? rewardDefinition.makeupIconUrl
                  : null,
              rewardSettlementId: null,
              bizKey: this.buildRecordBizKey(input.userId, input.signDate),
              operatorType: input.operatorType,
              context: input.context,
            })
            .onConflictDoNothing({
              target: [
                this.checkInRecordTable.userId,
                this.checkInRecordTable.signDate,
              ],
            })
            .returning()

          if (!record) {
            const concurrentRecord = await tx.query.checkInRecord.findFirst({
              where: {
                userId: input.userId,
                signDate: input.signDate,
              },
            })
            if (concurrentRecord) {
              throw new BusinessException(
                BusinessErrorCode.OPERATION_NOT_ALLOWED,
                input.recordType === CheckInRecordTypeEnum.NORMAL
                  ? '今日已签到，请勿重复操作'
                  : '该日期已签到，请勿重复补签',
              )
            }
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '签到写入冲突，请稍后重试',
            )
          }

          const triggeredGrantIds = await this.processStreakGrants(
            input.userId,
            input.signDate,
            input.recordType,
            window,
            tx,
            now,
          )

          return {
            recordId: record.id,
            triggeredGrantIds,
          }
        })
        break
      } catch (error) {
        if (
          error instanceof BusinessException &&
          error.code === BusinessErrorCode.STATE_CONFLICT &&
          attempt < CHECK_IN_WRITE_RETRY_LIMIT - 1
        ) {
          continue
        }
        throw error
      }
    }

    if (!action) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '签到写入冲突，请稍后重试',
      )
    }

    await this.checkInSettlementService.settleRecordReward(action.recordId, {})
    for (const grantId of action.triggeredGrantIds) {
      await this.checkInSettlementService.settleGrantReward(grantId, {})
    }

    return this.buildActionResponse(action.recordId)
  }

  // 根据最新连续签到状态计算并发放本次命中的连续奖励。
  private async processStreakGrants(
    userId: number,
    signDate: string,
    recordType: CheckInRecordTypeEnum,
    makeupWindow: CheckInMakeupWindowView,
    tx: Db,
    now: Date,
  ) {
    const progress = await this.checkInStreakService.getOrCreateStreakProgress(
      userId,
      tx,
    )
    const today = this.formatDateOnly(now)
    const aggregation =
      recordType === CheckInRecordTypeEnum.NORMAL
        ? this.checkInStreakService.buildIncrementalNormalSignAggregation(
            progress,
            signDate,
          )
        : (
            await this.checkInStreakService.buildMakeupBoundedStreakAggregation(
              {
                userId,
                makeupDate: signDate,
                periodStartDate: makeupWindow.periodStartDate,
                today,
                currentProgress: progress,
              },
              tx,
            )
          ).aggregation
    const progressAggregation = this.resolveProgressAggregation(
      progress,
      aggregation,
      recordType,
    )

    const triggeredGrantIds = await this.upsertStreakGrantsForAggregation(
      userId,
      aggregation,
      tx,
      now,
      'sign',
    )

    await this.checkInStreakService.updateStreakProgress(
      progress,
      progressAggregation,
      tx,
    )
    return triggeredGrantIds
  }

  // 根据聚合结果补齐缺失的连续奖励 grant，复用正常签到和后台修复的同一幂等写入逻辑。
  private async upsertStreakGrantsForAggregation(
    userId: number,
    aggregation: CheckInStreakAggregation,
    tx: Db,
    now: Date,
    source: 'sign' | 'repair',
  ) {
    const today = this.formatDateOnly(now)
    const createdGrantIds: number[] = []
    const ruleRowsByLookupDate = new Map<
      string,
      Awaited<ReturnType<CheckInStreakService['listActiveStreakRulesAt']>>
    >()
    const grantEvidenceByRuleSet = new Map<string, CheckInGrantTriggerView[]>()

    for (const [triggerSignDate, streak] of Object.entries(
      aggregation.streakByDate,
    )) {
      if (
        aggregation.streakStartedAt &&
        triggerSignDate < aggregation.streakStartedAt
      ) {
        continue
      }

      const ruleLookupAt = triggerSignDate === today ? now : triggerSignDate
      const ruleLookupDate = triggerSignDate === today ? today : triggerSignDate
      let activeRuleRows = ruleRowsByLookupDate.get(ruleLookupDate)
      if (!activeRuleRows) {
        activeRuleRows =
          await this.checkInStreakService.listActiveStreakRulesAt(
            ruleLookupAt,
            tx,
          )
        ruleRowsByLookupDate.set(ruleLookupDate, activeRuleRows)
      }
      const grantCandidates =
        this.checkInStreakService.resolveEligibleGrantRules(
          activeRuleRows,
          { [triggerSignDate]: streak },
          await this.loadRelevantExistingStreakGrants(
            userId,
            activeRuleRows.map((rule) => rule.ruleCode),
            aggregation.streakStartedAt,
            tx,
            grantEvidenceByRuleSet,
          ),
          aggregation.streakStartedAt,
        )

      const ruleIdMap = new Map(
        activeRuleRows.map((rule) => [rule.ruleCode, rule.id]),
      )

      for (const candidate of grantCandidates) {
        const ruleId = ruleIdMap.get(candidate.rule.ruleCode)
        if (!ruleId) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            `连续奖励规则不存在：${candidate.rule.ruleCode}`,
          )
        }
        const [grant] = await tx
          .insert(this.checkInStreakGrantTable)
          .values({
            userId,
            ruleId,
            triggerSignDate: candidate.triggerSignDate,
            rewardSettlementId: null,
            bizKey: this.buildGrantBizKey(
              userId,
              candidate.rule.ruleCode,
              candidate.triggerSignDate,
            ),
            ruleCode: candidate.rule.ruleCode,
            streakDays: candidate.rule.streakDays,
            repeatable: candidate.rule.repeatable,
            rewardOverviewIconUrl: candidate.rule.rewardOverviewIconUrl ?? null,
            context: {
              source:
                source === 'repair'
                  ? 'repair'
                  : candidate.triggerSignDate === today
                    ? 'sign'
                    : 'recompute',
            },
          })
          .onConflictDoNothing({
            target: [
              this.checkInStreakGrantTable.userId,
              this.checkInStreakGrantTable.bizKey,
            ],
          })
          .returning({ id: this.checkInStreakGrantTable.id })
        if (!grant) {
          continue
        }
        await this.checkInSettlementService.insertGrantRewardItems(
          grant.id,
          candidate.rule.rewardItems,
          tx,
        )
        createdGrantIds.push(grant.id)
      }
    }

    return createdGrantIds
  }

  // 后台重算时把当前连续链上已有但尚未成功的连续奖励也纳入补偿重试。
  private async listRetryableStreakGrantIds(
    userId: number,
    aggregation: CheckInStreakAggregation,
    tx: Db,
  ) {
    if (!aggregation.lastSignedDate) {
      return []
    }

    const rows = await tx
      .select({ id: this.checkInStreakGrantTable.id })
      .from(this.checkInStreakGrantTable)
      .leftJoin(
        this.growthRewardSettlementTable,
        eq(
          this.checkInStreakGrantTable.rewardSettlementId,
          this.growthRewardSettlementTable.id,
        ),
      )
      .where(
        and(
          eq(this.checkInStreakGrantTable.userId, userId),
          aggregation.streakStartedAt
            ? gte(
                this.checkInStreakGrantTable.triggerSignDate,
                aggregation.streakStartedAt,
              )
            : undefined,
          lte(
            this.checkInStreakGrantTable.triggerSignDate,
            aggregation.lastSignedDate,
          ),
          or(
            isNull(this.checkInStreakGrantTable.rewardSettlementId),
            isNull(this.growthRewardSettlementTable.id),
            eq(
              this.growthRewardSettlementTable.settlementStatus,
              GrowthRewardSettlementStatusEnum.PENDING,
            ),
          ),
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )

    return rows.map((row) => row.id)
  }

  private async settleRepairGrantReward(grantId: number, adminUserId: number) {
    try {
      return await this.checkInSettlementService.settleGrantReward(grantId, {
        actorUserId: adminUserId,
        isRetry: true,
      })
    } catch (error) {
      if (
        error instanceof BusinessException &&
        error.code === BusinessErrorCode.OPERATION_NOT_ALLOWED
      ) {
        return false
      }
      throw error
    }
  }

  // 只读取本次候选规则和当前连续链相关的发放事实，避免高频签到拉取用户全部历史 grant。
  private async loadRelevantExistingStreakGrants(
    userId: number,
    ruleCodes: string[],
    streakStartedAt: string | undefined,
    tx: Db,
    cache: Map<string, CheckInGrantTriggerView[]>,
  ) {
    const uniqueRuleCodes = [...new Set(ruleCodes)].sort()
    if (uniqueRuleCodes.length === 0) {
      return []
    }

    const cacheKey = `${streakStartedAt ?? ''}:${uniqueRuleCodes.join('|')}`
    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const rows = await tx
      .select({
        ruleCode: this.checkInStreakGrantTable.ruleCode,
        triggerSignDate: this.checkInStreakGrantTable.triggerSignDate,
      })
      .from(this.checkInStreakGrantTable)
      .where(
        and(
          eq(this.checkInStreakGrantTable.userId, userId),
          inArray(this.checkInStreakGrantTable.ruleCode, uniqueRuleCodes),
          streakStartedAt
            ? gte(this.checkInStreakGrantTable.triggerSignDate, streakStartedAt)
            : undefined,
        ),
      )
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )
    cache.set(cacheKey, rows)
    return rows
  }

  // 补签历史窗口只在影响最新有效连续状态时更新进度，避免把当前进度回退到历史日期。
  private resolveProgressAggregation(
    progress: CheckInStreakProgressSnapshot,
    aggregation: CheckInStreakAggregation,
    recordType: CheckInRecordTypeEnum,
  ): CheckInStreakAggregation {
    if (recordType === CheckInRecordTypeEnum.NORMAL) {
      return aggregation
    }

    const currentLastSignedDate = this.toDateOnlyValue(progress.lastSignedDate)
    if (
      aggregation.lastSignedDate &&
      (!currentLastSignedDate ||
        aggregation.lastSignedDate >= currentLastSignedDate)
    ) {
      return aggregation
    }

    return {
      currentStreak: progress.currentStreak,
      streakStartedAt:
        this.toDateOnlyValue(progress.streakStartedAt) || undefined,
      lastSignedDate: currentLastSignedDate || undefined,
      streakByDate: {},
    }
  }

  // 校验补签日期是否仍位于当前可补签窗口内。
  private assertMakeupAllowed(
    signDate: string,
    today: string,
    window: CheckInMakeupWindowView,
  ) {
    if (signDate >= today) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签日期必须早于今天',
      )
    }
    if (!this.checkInMakeupService.isDateWithinMakeupWindow(signDate, window)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签日期不在当前补签周期内',
      )
    }
  }

  // 组装签到动作响应，补齐账户、奖励和连续签到摘要。
  private async buildActionResponse(recordId: number) {
    const record = await this.db.query.checkInRecord.findFirst({
      where: { id: recordId },
    })
    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '签到记录不存在',
      )
    }

    const config = await this.getRequiredConfig()
    const makeup =
      await this.checkInMakeupService.buildCurrentMakeupAccountView(
        record.userId,
        config,
        this.formatDateOnly(new Date()),
      )
    const progress = await this.db.query.checkInStreakProgress.findFirst({
      where: { userId: record.userId },
    })

    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      resolvedRewardSourceType: record.resolvedRewardSourceType ?? null,
      resolvedRewardRuleKey: record.resolvedRewardRuleKey ?? null,
      resolvedRewardItems:
        this.checkInRewardPolicyService.parseStoredRewardItems(
          record.resolvedRewardItems,
          {
            allowEmpty: true,
          },
        ),
      resolvedRewardOverviewIconUrl:
        record.resolvedRewardOverviewIconUrl ?? null,
      resolvedMakeupIconUrl: record.resolvedMakeupIconUrl ?? null,
      currentMakeupPeriodType: makeup.periodType,
      currentMakeupPeriodKey: makeup.periodKey,
      periodicRemaining: makeup.periodicRemaining,
      eventAvailable: makeup.eventAvailable,
      currentStreak: progress?.currentStreak ?? 0,
    }
  }

  // 生成签到事实的稳定幂等键。
  private buildRecordBizKey(userId: number, signDate: string) {
    return `checkin:record:user:${userId}:date:${signDate}`
  }

  // 生成连续奖励发放事实的稳定幂等键。
  private buildGrantBizKey(
    userId: number,
    ruleCode: string,
    triggerSignDate: string,
  ) {
    return [
      'checkin',
      'grant',
      'rule',
      ruleCode,
      'user',
      userId,
      'date',
      triggerSignDate,
    ].join(':')
  }
}
