import type { Db } from '@db/core'
import type { GrowthLedgerApplyResult } from '@libs/growth/growth-ledger/growth-ledger.internal'
import type { GrowthRewardItems } from '@libs/growth/reward-rule/reward-item.type'
import type {
  CheckInGrantRewardSettlementSource,
  CheckInOptionalRewardSettlementSummary,
  CheckInRecordRewardSettlementSource,
  CheckInRewardApplyInput,
  CheckInRewardSettlementContext,
} from './check-in.type'
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
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { asc, eq, inArray } from 'drizzle-orm'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import { CheckInRewardResultTypeEnum } from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到奖励结算服务。
 *
 * 负责基础签到奖励、连续奖励和对应补偿事实的创建、同步与重试。
 */
@Injectable()
export class CheckInSettlementService extends CheckInServiceSupport {
  // 注入签到奖励结算所需的底层数据库、账本和结算服务。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
    private readonly growthRewardSettlementService: GrowthRewardSettlementService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 为基础签到奖励创建或执行补偿结算。
  async settleRecordReward(
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
  async settleGrantReward(
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

  // 把补偿事实映射成对外使用的补偿摘要。
  toRewardSettlementSummary(
    settlement: CheckInOptionalRewardSettlementSummary,
  ) {
    if (!settlement) {
      return null
    }
    return {
      ...settlement,
      ledgerRecordIds: settlement.ledgerRecordIds ?? [],
    }
  }

  // 按 ID 批量查询奖励补偿事实，并收敛成 Map 便于后续复用。
  async buildSettlementMapById(ids: number[], db: Db = this.db) {
    if (ids.length === 0) {
      return new Map()
    }

    const rows = await db
      .select()
      .from(this.growthRewardSettlementTable)
      .where(inArray(this.growthRewardSettlementTable.id, ids))
    return new Map(rows.map((row) => [row.id, row]))
  }

  // 批量加载连续奖励发放记录对应的奖励项快照。
  async buildGrantRewardItemMap(grantIds: number[], db: Db = this.db) {
    if (grantIds.length === 0) {
      return new Map<number, GrowthRewardItems>()
    }

    const rewardItems = await db
      .select()
      .from(this.checkInStreakGrantRewardItemTable)
      .where(inArray(this.checkInStreakGrantRewardItemTable.grantId, grantIds))
      .orderBy(
        asc(this.checkInStreakGrantRewardItemTable.sortOrder),
        asc(this.checkInStreakGrantRewardItemTable.id),
      )

    const rewardMap = new Map<number, GrowthRewardItems>()
    for (const item of rewardItems) {
      const list = rewardMap.get(item.grantId) ?? []
      list.push({
        assetType: item.assetType,
        assetKey: item.assetKey,
        amount: item.amount,
      })
      rewardMap.set(item.grantId, list)
    }

    return rewardMap
  }

  // 把连续奖励快照奖励项逐条写入关系表。
  async insertGrantRewardItems(
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

  // 从持久化 JSON 中恢复奖励项列表，并复用统一校验逻辑。
  private parseStoredRewardItems<T>(
    value: T,
    options: { allowEmpty: boolean },
  ) {
    const rewardItems = this.asArray(value)
    if (!rewardItems || rewardItems.length === 0) {
      if (options.allowEmpty) {
        return null
      }
      throw new InternalServerErrorException('签到奖励快照缺失')
    }
    return rewardItems as GrowthRewardItems
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

  // 汇总账本落账结果，收敛成补偿结果类型。
  private resolveRewardResultType(results: GrowthLedgerApplyResult[]) {
    if (results.some((result) => result.duplicated !== true)) {
      return CheckInRewardResultTypeEnum.APPLIED
    }
    return CheckInRewardResultTypeEnum.IDEMPOTENT
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
