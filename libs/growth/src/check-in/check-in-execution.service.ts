import type { Db } from '@db/core'
import type { GrowthLedgerApplyResult } from '@libs/growth/growth-ledger/growth-ledger.internal'
import type { GrowthRewardItems } from '../reward-rule/reward-item.type'
import type {
  CheckInGrantRewardSettlementSource,
  CheckInMakeupWindowView,
  CheckInPerformSignInput,
  CheckInRecordRewardSettlementSource,
  CheckInRewardApplyInput,
  CheckInRewardSettlementContext,
  CheckInSignAction,
  CheckInStreakAggregation,
  CheckInStreakProgressSnapshot,
} from './check-in.type'
import type {
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
import { GrowthRewardSettlementService } from '@libs/growth/growth-reward/growth-reward-settlement.service'
import { GrowthRewardSettlementStatusEnum } from '@libs/growth/growth-reward/growth-reward.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardResultTypeEnum,
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
    private readonly growthRewardSettlementService: GrowthRewardSettlementService,
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
        success: await this.settleRecordReward(dto.recordId, {
          actorUserId: adminUserId,
          isRetry: true,
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
        isRetry: true,
      }),
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
    const rewardDefinition = this.parseRewardDefinition(config)
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

          let account = await this.ensureCurrentMakeupAccount(
            input.userId,
            config,
            today,
            tx,
          )
          const window = this.buildMakeupWindow(
            today,
            config.makeupPeriodType as CheckInMakeupPeriodTypeEnum,
          )

          if (input.recordType === CheckInRecordTypeEnum.MAKEUP) {
            this.assertMakeupAllowed(input.signDate, today, window)
            const consumePlan = this.buildMakeupConsumePlan(account)
            account = await this.consumeMakeupAllowance(
              account,
              consumePlan,
              tx,
            )
          }

          const rewardResolution = this.resolveRewardForDate(
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

    await this.settleRecordReward(action.recordId, {})
    for (const grantId of action.triggeredGrantIds) {
      await this.settleGrantReward(grantId, {})
    }

    return this.buildActionResponse(action.recordId, action.triggeredGrantIds)
  }

  // 根据最新连续签到状态计算并发放本次命中的连续奖励。
  private async processStreakGrants(userId: number, tx: Db, now: Date) {
    const progress = await this.getOrCreateStreakProgress(userId, tx)
    const records = await this.listUserRecords(userId, tx)
    const aggregation = this.recomputeStreakAggregation(records)
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
      const activeRuleRows = await this.listActiveStreakRulesAt(
        ruleLookupAt,
        tx,
      )
      const activeRules = this.toStreakRewardRuleViews(
        activeRuleRows,
        ruleLookupAt,
      )
      const grantCandidates = this.resolveEligibleGrantRules(
        activeRules,
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
        await this.insertGrantRewardItems(
          grant.id,
          candidate.rule.rewardItems,
          tx,
        )
        triggeredGrantIds.push(grant.id)
      }
    }

    await this.updateStreakProgress(progress, aggregation, tx)
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
    if (!this.isDateWithinMakeupWindow(signDate, window)) {
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
    const makeup = await this.buildCurrentMakeupAccountView(
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
      resolvedRewardItems: this.parseStoredRewardItems(
        record.resolvedRewardItems,
        {
          allowEmpty: true,
        },
      ),
      rewardSettlement: this.toRewardSettlementSummary(settlement),
      currentMakeupPeriodType: makeup.periodType,
      currentMakeupPeriodKey: makeup.periodKey,
      periodicRemaining: makeup.periodicRemaining,
      eventAvailable: makeup.eventAvailable,
      currentStreak: progress?.currentStreak ?? 0,
      triggeredGrantIds,
    }
  }

  // 为基础签到奖励创建或执行补偿结算。
  private async settleRecordReward(
    recordId: number,
    context: CheckInRewardSettlementContext,
  ) {
    try {
      await this.drizzle.withTransaction(async (tx) => {
        const record = await tx.query.checkInRecord.findFirst({
          where: { id: recordId },
        })
        if (!record) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '签到记录不存在',
          )
        }
        if (!record.resolvedRewardItems) {
          return
        }
        const rewardItems = this.parseStoredRewardItems(
          record.resolvedRewardItems,
          {
            allowEmpty: false,
          },
        )!
        const settlement = await this.ensureRecordRewardSettlement(record, tx)
        const latestSettlement = await this.getSettlementById(settlement.id, tx)
        if (
          latestSettlement?.settlementStatus ===
          GrowthRewardSettlementStatusEnum.SUCCESS
        ) {
          return
        }
        if (
          latestSettlement?.settlementStatus ===
          GrowthRewardSettlementStatusEnum.TERMINAL
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '签到奖励已进入终态失败，无需重试',
          )
        }

        const rewardResult = await this.applyRewardItems(tx, {
          userId: record.userId,
          rewardItems,
          baseBizKey: this.buildBaseRewardBizKey(record.id, record.userId),
          source: GrowthLedgerSourceEnum.CHECK_IN_BASE_BONUS,
          actorUserId: context.actorUserId,
        })

        await this.growthRewardSettlementService.syncManualSettlementResult(
          settlement.id,
          {
            success: true,
            resultType: rewardResult.resultType,
            ledgerRecordIds: rewardResult.ledgerIds,
          },
          { isRetry: context.isRetry, tx },
        )
      })
      return true
    } catch (error) {
      if (
        error instanceof BusinessException &&
        (error.code === BusinessErrorCode.RESOURCE_NOT_FOUND ||
          error.code === BusinessErrorCode.OPERATION_NOT_ALLOWED)
      ) {
        throw error
      }

      const message =
        error instanceof Error ? error.message : '签到基础奖励发放失败'
      this.logger.warn(
        `check_in_record_reward_failed recordId=${recordId} error=${message}`,
      )

      const record = await this.db.query.checkInRecord.findFirst({
        where: { id: recordId },
      })
      if (record && this.asArray(record.resolvedRewardItems)?.length) {
        const settlement = await this.ensureRecordRewardSettlement(record)
        await this.growthRewardSettlementService.syncManualSettlementResult(
          settlement.id,
          {
            success: false,
            resultType: CheckInRewardResultTypeEnum.FAILED,
            ledgerRecordIds: [],
            errorMessage: message,
          },
          { isRetry: context.isRetry },
        )
      }
      return false
    }
  }

  // 为连续签到奖励创建或执行补偿结算。
  private async settleGrantReward(
    grantId: number,
    context: CheckInRewardSettlementContext,
  ) {
    try {
      await this.drizzle.withTransaction(async (tx) => {
        const grant = await tx.query.checkInStreakGrant.findFirst({
          where: { id: grantId },
        })
        if (!grant) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '连续奖励发放事实不存在',
          )
        }
        const rewardItemMap = await this.buildGrantRewardItemMap([grant.id], tx)
        const settlement = await this.ensureGrantRewardSettlement(
          {
            ...grant,
            rewardItems: rewardItemMap.get(grant.id) ?? [],
          },
          tx,
        )
        const latestSettlement = await this.getSettlementById(settlement.id, tx)
        if (
          latestSettlement?.settlementStatus ===
          GrowthRewardSettlementStatusEnum.SUCCESS
        ) {
          return
        }
        if (
          latestSettlement?.settlementStatus ===
          GrowthRewardSettlementStatusEnum.TERMINAL
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '签到奖励已进入终态失败，无需重试',
          )
        }

        const rewardItems = rewardItemMap.get(grant.id) ?? []
        const rewardResult = await this.applyRewardItems(tx, {
          userId: grant.userId,
          rewardItems,
          baseBizKey: this.buildStreakRewardBizKey(
            grant.id,
            grant.ruleCode,
            grant.userId,
          ),
          source: GrowthLedgerSourceEnum.CHECK_IN_STREAK_BONUS,
          actorUserId: context.actorUserId,
        })

        await this.growthRewardSettlementService.syncManualSettlementResult(
          settlement.id,
          {
            success: true,
            resultType: rewardResult.resultType,
            ledgerRecordIds: rewardResult.ledgerIds,
          },
          { isRetry: context.isRetry, tx },
        )
      })
      return true
    } catch (error) {
      if (
        error instanceof BusinessException &&
        (error.code === BusinessErrorCode.RESOURCE_NOT_FOUND ||
          error.code === BusinessErrorCode.OPERATION_NOT_ALLOWED)
      ) {
        throw error
      }

      const message =
        error instanceof Error ? error.message : '连续奖励发放失败'
      this.logger.warn(
        `check_in_streak_grant_reward_failed grantId=${grantId} error=${message}`,
      )

      const grant = await this.db.query.checkInStreakGrant.findFirst({
        where: { id: grantId },
      })
      if (grant) {
        const rewardItemMap = await this.buildGrantRewardItemMap([grant.id])
        const settlement = await this.ensureGrantRewardSettlement({
          ...grant,
          rewardItems: rewardItemMap.get(grant.id) ?? [],
        })
        await this.growthRewardSettlementService.syncManualSettlementResult(
          settlement.id,
          {
            success: false,
            resultType: CheckInRewardResultTypeEnum.FAILED,
            ledgerRecordIds: [],
            errorMessage: message,
          },
          { isRetry: context.isRetry },
        )
      }
      return false
    }
  }

  // 按奖励项逐条落到账本，并返回每条落账结果。
  private async applyRewardItems(tx: Db, input: CheckInRewardApplyInput) {
    const results: GrowthLedgerApplyResult[] = []

    for (const rewardItem of input.rewardItems) {
      const assetType = this.resolveLedgerAssetType(rewardItem.assetType)
      results.push(
        await this.growthLedgerService.applyDelta(tx, {
          userId: input.userId,
          assetType,
          action: GrowthLedgerActionEnum.GRANT,
          amount: rewardItem.amount,
          bizKey: `${input.baseBizKey}:${rewardItem.assetType}`,
          source: input.source,
          remark: this.buildRewardItemRemark(rewardItem.assetType),
          context: {
            actorUserId: input.actorUserId,
          },
        }),
      )
    }

    for (const result of results) {
      if (!result.success) {
        throw new InternalServerErrorException('签到奖励发放失败')
      }
    }

    return {
      ledgerIds: results
        .map((result) => result.recordId)
        .filter((id): id is number => typeof id === 'number'),
      resultType: this.resolveRewardResultType(results),
    }
  }

  // 将奖励规则资产类型映射到账本资产类型。
  private resolveLedgerAssetType(assetType: GrowthRewardRuleAssetTypeEnum) {
    if (
      assetType !== GrowthRewardRuleAssetTypeEnum.POINTS &&
      assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
    ) {
      throw new InternalServerErrorException(
        `暂不支持的签到奖励资产类型：${assetType}`,
      )
    }
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? GrowthAssetTypeEnum.POINTS
      : GrowthAssetTypeEnum.EXPERIENCE
  }

  // 生成签到奖励落账备注，便于后续排障和审计。
  private buildRewardItemRemark(assetType: GrowthRewardRuleAssetTypeEnum) {
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? '签到奖励（积分）'
      : '签到奖励（经验）'
  }

  // 汇总账本落账结果，收敛成补偿结果类型。
  private resolveRewardResultType(results: GrowthLedgerApplyResult[]) {
    if (results.some((result) => result.duplicated !== true)) {
      return CheckInRewardResultTypeEnum.APPLIED
    }
    return CheckInRewardResultTypeEnum.IDEMPOTENT
  }

  // 读取用户全部签到记录，供连续签到重算使用。
  private async listUserRecords(userId: number, tx: Db) {
    return tx
      .select({
        signDate: this.checkInRecordTable.signDate,
      })
      .from(this.checkInRecordTable)
      .where(eq(this.checkInRecordTable.userId, userId))
      .orderBy(
        asc(this.checkInRecordTable.signDate),
        asc(this.checkInRecordTable.id),
      )
  }

  // 根据最新签到记录重算并更新连续签到进度。
  private async updateStreakProgress(
    progress: CheckInStreakProgressSnapshot,
    aggregation: CheckInStreakAggregation,
    tx: Db,
  ) {
    const [updated] = await tx
      .update(this.checkInStreakProgressTable)
      .set({
        currentStreak: aggregation.currentStreak,
        streakStartedAt: aggregation.streakStartedAt ?? null,
        lastSignedDate: aggregation.lastSignedDate ?? null,
        version: progress.version + 1,
      })
      .where(
        and(
          eq(this.checkInStreakProgressTable.id, progress.id),
          eq(this.checkInStreakProgressTable.version, progress.version),
        ),
      )
      .returning({ id: this.checkInStreakProgressTable.id })
    if (!updated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '连续签到进度并发冲突，请稍后重试',
      )
    }
  }

  // 把连续奖励快照奖励项逐条写入关系表。
  private async insertGrantRewardItems(
    grantId: number,
    rewardItems: GrowthRewardItems,
    tx: Db,
  ) {
    if (rewardItems.length === 0) {
      return
    }
    await tx.insert(this.checkInStreakGrantRewardItemTable).values(
      rewardItems.map((item, sortOrder) => ({
        grantId,
        assetType: item.assetType,
        assetKey: item.assetKey,
        amount: item.amount,
        sortOrder,
      })),
    )
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

  // 生成基础奖励补偿事实的稳定幂等键。
  private buildBaseRewardBizKey(recordId: number, userId: number) {
    return `checkin:base:record:${recordId}:user:${userId}`
  }

  // 生成连续奖励补偿事实的稳定幂等键。
  private buildStreakRewardBizKey(
    grantId: number,
    ruleCode: string,
    userId: number,
  ) {
    return `checkin:streak:grant:${grantId}:rule:${ruleCode}:user:${userId}`
  }

  // 确保基础奖励存在结算事实，必要时补建待处理记录。
  private async ensureRecordRewardSettlement(
    record: CheckInRecordRewardSettlementSource,
    tx?: Db,
  ) {
    const existing = record.rewardSettlementId
      ? await this.getSettlementById(record.rewardSettlementId, tx)
      : null
    if (existing) {
      return existing
    }

    const config = await this.getRequiredConfig(tx ?? this.db)
    const settlement =
      await this.growthRewardSettlementService.ensureCheckInRecordRewardSettlement(
        {
          recordId: record.id,
          userId: record.userId,
          configId: config.id,
          signDate: this.toDateOnlyValue(record.signDate),
          rewardItems: this.asArray(record.resolvedRewardItems) ?? null,
        },
        tx,
      )

    await this.drizzle.withErrorHandling(() =>
      (tx ?? this.db)
        .update(this.checkInRecordTable)
        .set({ rewardSettlementId: settlement.id })
        .where(eq(this.checkInRecordTable.id, record.id)),
    )
    return settlement
  }

  // 确保连续奖励存在结算事实，必要时补建待处理记录。
  private async ensureGrantRewardSettlement(
    grant: CheckInGrantRewardSettlementSource,
    tx?: Db,
  ) {
    const existing = grant.rewardSettlementId
      ? await this.getSettlementById(grant.rewardSettlementId, tx)
      : null
    if (existing) {
      return existing
    }

    const settlement =
      await this.growthRewardSettlementService.ensureCheckInStreakRewardSettlement(
        {
          grantId: grant.id,
          userId: grant.userId,
          ruleId: grant.ruleId,
          ruleCode: grant.ruleCode,
          triggerSignDate: this.toDateOnlyValue(grant.triggerSignDate),
          rewardItems: this.asArray(grant.rewardItems) ?? null,
        },
        tx,
      )

    await this.drizzle.withErrorHandling(() =>
      (tx ?? this.db)
        .update(this.checkInStreakGrantTable)
        .set({ rewardSettlementId: settlement.id })
        .where(eq(this.checkInStreakGrantTable.id, grant.id)),
    )
    return settlement
  }

  // 读取奖励补偿记录，不存在时统一返回资源不存在异常。
  private async getSettlementById(id: number, tx?: Db) {
    return (tx ?? this.db).query.growthRewardSettlement.findFirst({
      where: { id },
    })
  }
}
