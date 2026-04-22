import type { Db } from '@db/core'
import type {
  CheckInMakeupWindowView,
  CheckInPerformSignInput,
  CheckInSignAction,
} from './check-in.type'
import type {
  MakeupCheckInDto,
  RepairCheckInRewardDto,
} from './dto/check-in-execution.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { CheckInMakeupService } from './check-in-makeup.service'
import { CheckInRewardPolicyService } from './check-in-reward-policy.service'
import { CheckInSettlementService } from './check-in-settlement.service'
import { CheckInStreakService } from './check-in-streak.service'
import {
  CheckInMakeupPeriodTypeEnum,
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

          let account = await this.checkInMakeupService.ensureCurrentMakeupAccount(
            input.userId,
            config,
            today,
            tx,
          )
          const window = this.checkInMakeupService.buildMakeupWindow(
            today,
            config.makeupPeriodType as CheckInMakeupPeriodTypeEnum,
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
              config.makeupPeriodType as CheckInMakeupPeriodTypeEnum,
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

    return this.buildActionResponse(action.recordId, action.triggeredGrantIds)
  }

  // 根据最新连续签到状态计算并发放本次命中的连续奖励。
  private async processStreakGrants(userId: number, tx: Db, now: Date) {
    const progress = await this.checkInStreakService.getOrCreateStreakProgress(
      userId,
      tx,
    )
    const records = await this.checkInStreakService.listUserRecords(userId, tx)
    const aggregation = this.checkInStreakService.recomputeStreakAggregation(
      records,
    )
    const today = this.formatDateOnly(now)

    const existingGrants = await tx
      .select({
        id: this.checkInStreakGrantTable.id,
        ruleCode: this.checkInStreakGrantTable.ruleCode,
        triggerSignDate: this.checkInStreakGrantTable.triggerSignDate,
      })
      .from(this.checkInStreakGrantTable)
      .where(eq(this.checkInStreakGrantTable.userId, userId))
      .orderBy(
        asc(this.checkInStreakGrantTable.triggerSignDate),
        asc(this.checkInStreakGrantTable.id),
      )

    const triggeredGrantIds: number[] = []

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
      const activeRuleRows = await this.checkInStreakService.listActiveStreakRulesAt(
        ruleLookupAt,
        tx,
      )
      const grantCandidates =
        this.checkInStreakService.resolveEligibleGrantRules(
          activeRuleRows,
          { [triggerSignDate]: streak },
          existingGrants.map((grant) => ({
            ruleCode: grant.ruleCode,
            triggerSignDate: grant.triggerSignDate,
          })),
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
            context: {
              source:
                candidate.triggerSignDate === this.formatDateOnly(now)
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
        triggeredGrantIds.push(grant.id)
      }
    }

    await this.checkInStreakService.updateStreakProgress(
      progress,
      aggregation,
      tx,
    )
    return triggeredGrantIds
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
  private async buildActionResponse(
    recordId: number,
    triggeredGrantIds: number[],
  ) {
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
    const makeup = await this.checkInMakeupService.buildCurrentMakeupAccountView(
      record.userId,
      config,
      this.formatDateOnly(new Date()),
    )
    const progress = await this.db.query.checkInStreakProgress.findFirst({
      where: { userId: record.userId },
    })
    const settlement = record.rewardSettlementId
      ? await this.db.query.growthRewardSettlement.findFirst({
          where: { id: record.rewardSettlementId },
        })
      : null

    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      signDate: this.toDateOnlyValue(record.signDate),
      recordType: record.recordType,
      rewardSettlementId: record.rewardSettlementId,
      resolvedRewardSourceType: record.resolvedRewardSourceType,
      resolvedRewardRuleKey: record.resolvedRewardRuleKey,
      resolvedRewardItems: this.checkInRewardPolicyService.parseStoredRewardItems(
        record.resolvedRewardItems,
        {
          allowEmpty: true,
        },
      ),
      rewardSettlement:
        this.checkInSettlementService.toRewardSettlementSummary(settlement),
      currentMakeupPeriodType: makeup.periodType,
      currentMakeupPeriodKey: makeup.periodKey,
      periodicRemaining: makeup.periodicRemaining,
      eventAvailable: makeup.eventAvailable,
      currentStreak: progress?.currentStreak ?? 0,
      triggeredGrantIds,
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
