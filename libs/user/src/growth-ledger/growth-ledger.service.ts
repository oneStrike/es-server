import type {
  ApplyDeltaParams,
  ApplyRuleParams,
  GrowthLedgerApplyResult,
} from './growth-ledger.types'
import { BaseService, Prisma } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonEnum,
} from './growth-ledger.constant'

type Tx = any

/**
 * 统一成长账本服务
 *
 * 说明：
 * 1. 所有积分/经验结算统一写入 growth_ledger_record
 * 2. 通过 bizKey + 唯一约束做幂等
 * 3. 通过 growth_rule_usage_slot 做并发限流占位
 */
@Injectable()
export class GrowthLedgerService extends BaseService {
  /**
   * 按规则结算（发放）
   */
  async applyByRule(
    tx: Tx,
    params: ApplyRuleParams,
  ): Promise<GrowthLedgerApplyResult> {
    const {
      userId,
      assetType,
      ruleType,
      bizKey,
      source,
      remark,
      targetType,
      targetId,
      context,
      occurredAt = new Date(),
    } = params

    // 规则读取按资产类型分别走对应规则表
    const rule =
      assetType === GrowthAssetTypeEnum.POINTS
        ? await tx.userPointRule.findUnique({
            where: { type: ruleType },
            select: {
              id: true,
              points: true,
              dailyLimit: true,
              totalLimit: true,
              isEnabled: true,
            },
          })
        : await tx.userExperienceRule.findUnique({
            where: { type: ruleType },
            select: {
              id: true,
              experience: true,
              dailyLimit: true,
              totalLimit: true,
              isEnabled: true,
            },
          })

    if (!rule) {
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
      }
    }

    if (!rule.isEnabled) {
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      }
    }

    const delta = 'points' in rule ? rule.points : rule.experience

    if (delta === 0) {
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
      source,
      delta,
      ruleType,
      ruleId: rule.id,
      remark,
      targetType,
      targetId,
      context,
    })
    if (gate.duplicated) {
      return gate.result
    }

    const ruleKey = `${assetType}:${ruleType}`
    const dayKey = this.formatDateKey(occurredAt)

    if (rule.dailyLimit > 0) {
      const reservedDaily = await this.reserveLimitedSlots(tx, {
        userId,
        assetType,
        ruleKey,
        slotType: 'DAILY',
        slotScope: dayKey,
        limit: rule.dailyLimit,
      })
      if (!reservedDaily) {
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.DAILY_LIMIT,
        }
      }
    }

    if (rule.totalLimit > 0) {
      const reservedTotal = await this.reserveLimitedSlots(tx, {
        userId,
        assetType,
        ruleKey,
        slotType: 'TOTAL',
        slotScope: 'all',
        limit: rule.totalLimit,
      })
      if (!reservedTotal) {
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.TOTAL_LIMIT,
        }
      }
    }

    const currentValue = await this.incrementUserBalance(tx, {
      userId,
      assetType,
      amount: delta,
    })
    const afterValue = currentValue
    const beforeValue = afterValue - delta

    await tx.growthLedgerRecord.update({
      where: { id: gate.recordId },
      data: {
        beforeValue,
        afterValue,
      },
    })

    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      action: GrowthLedgerActionEnum.GRANT,
      ruleType,
      decision: 'allow',
      deltaRequested: delta,
      deltaApplied: delta,
      context,
    })

    return {
      success: true,
      deltaApplied: delta,
      beforeValue,
      afterValue,
      ruleId: rule.id,
      recordId: gate.recordId,
    }
  }

  /**
   * 直接结算（不走规则表）
   */
  async applyDelta(
    tx: Tx,
    params: ApplyDeltaParams,
  ): Promise<GrowthLedgerApplyResult> {
    const {
      userId,
      assetType,
      action,
      amount,
      bizKey,
      source,
      remark,
      targetType,
      targetId,
      context,
    } = params

    if (amount <= 0) {
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    const signedDelta =
      action === GrowthLedgerActionEnum.CONSUME ? -amount : amount

    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
      source,
      delta: signedDelta,
      remark,
      targetType,
      targetId,
      context,
    })
    if (gate.duplicated) {
      return gate.result
    }

    if (action === GrowthLedgerActionEnum.CONSUME) {
      const decreased = await this.decrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
      if (!decreased.ok) {
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE,
        }
      }
    } else {
      await this.incrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
    }

    const user = await tx.appUser.findUniqueOrThrow({
      where: { id: userId },
      select: { points: true, experience: true },
    })
    const afterValue =
      assetType === GrowthAssetTypeEnum.POINTS ? user.points : user.experience
    const beforeValue = afterValue - signedDelta

    await tx.growthLedgerRecord.update({
      where: { id: gate.recordId },
      data: {
        beforeValue,
        afterValue,
      },
    })

    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      action,
      decision: 'allow',
      deltaRequested: signedDelta,
      deltaApplied: signedDelta,
      context,
    })

    return {
      success: true,
      deltaApplied: signedDelta,
      beforeValue,
      afterValue,
      recordId: gate.recordId,
    }
  }

  private async createLedgerGate(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      bizKey: string
      source: string
      delta: number
      ruleType?: number
      ruleId?: number
      remark?: string
      targetType?: number
      targetId?: number
      context?: Record<string, unknown>
    },
  ): Promise<
    | { duplicated: false, recordId: number }
    | { duplicated: true, result: GrowthLedgerApplyResult }
  > {
    // 事务内幂等 gate：
    // 使用 skipDuplicates 避免唯一冲突异常把整个事务打断。
    const inserted = await tx.growthLedgerRecord.createMany({
      data: {
        userId: params.userId,
        assetType: params.assetType,
        delta: params.delta,
        beforeValue: 0,
        afterValue: 0,
        bizKey: params.bizKey,
        source: params.source,
        ruleType: params.ruleType,
        ruleId: params.ruleId,
        targetType: params.targetType,
        targetId: params.targetId,
        remark: params.remark,
        context: params.context as Prisma.InputJsonValue | undefined,
      },
      skipDuplicates: true,
    })

    const existing = await tx.growthLedgerRecord.findUnique({
      where: {
        userId_bizKey: {
          userId: params.userId,
          bizKey: params.bizKey,
        },
      },
      select: {
        id: true,
        delta: true,
        beforeValue: true,
        afterValue: true,
      },
    })

    if (!existing) {
      throw new Error('LEDGER_GATE_CREATE_FAILED')
    }

    if (inserted.count === 0) {
      return {
        duplicated: true,
        result: {
          success: true,
          duplicated: true,
          deltaApplied: existing.delta,
          beforeValue: existing.beforeValue,
          afterValue: existing.afterValue,
          recordId: existing.id,
        },
      }
    }

    return { duplicated: false, recordId: existing.id }
  }

  private async reserveLimitedSlots(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      ruleKey: string
      slotType: 'DAILY' | 'TOTAL'
      slotScope: string
      limit: number
    },
  ): Promise<boolean> {
    // 槽位占用策略：
    // 对于 limit=N，仅允许成功占用 N 个唯一槽位，超出即失败。
    for (let slotNo = 1; slotNo <= params.limit; slotNo += 1) {
      const inserted = await tx.growthRuleUsageSlot.createMany({
        data: {
          userId: params.userId,
          assetType: params.assetType,
          ruleKey: params.ruleKey,
          slotType: params.slotType,
          slotValue: `${params.slotScope}:${slotNo}`,
        },
        skipDuplicates: true,
      })
      if (inserted.count > 0) {
        return true
      }
    }
    return false
  }

  private async incrementUserBalance(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      amount: number
    },
  ): Promise<number> {
    const user = await tx.appUser.update({
      where: { id: params.userId },
      data:
        params.assetType === GrowthAssetTypeEnum.POINTS
          ? { points: { increment: params.amount } }
          : { experience: { increment: params.amount } },
      select: { points: true, experience: true },
    })

    return params.assetType === GrowthAssetTypeEnum.POINTS
      ? user.points
      : user.experience
  }

  private async decrementUserBalance(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      amount: number
    },
  ): Promise<{ ok: boolean }> {
    const updateResult = await tx.appUser.updateMany({
      where:
        params.assetType === GrowthAssetTypeEnum.POINTS
          ? {
              id: params.userId,
              points: { gte: params.amount },
            }
          : {
              id: params.userId,
              experience: { gte: params.amount },
            },
      data:
        params.assetType === GrowthAssetTypeEnum.POINTS
          ? { points: { decrement: params.amount } }
          : { experience: { decrement: params.amount } },
    })
    return { ok: updateResult.count > 0 }
  }

  private async writeAuditLog(
    tx: Tx,
    params: {
      userId: number
      bizKey: string
      assetType: GrowthAssetTypeEnum
      action: GrowthLedgerActionEnum | 'GRANT' | 'CONSUME'
      decision: 'allow' | 'deny'
      ruleType?: number
      reason?: string
      deltaRequested?: number
      deltaApplied?: number
      context?: Record<string, unknown>
    },
  ) {
    await tx.growthAuditLog.create({
      data: {
        userId: params.userId,
        bizKey: params.bizKey,
        assetType: params.assetType,
        action: params.action,
        ruleType: params.ruleType,
        decision: params.decision,
        reason: params.reason,
        deltaRequested: params.deltaRequested,
        deltaApplied: params.deltaApplied,
        context: params.context as Prisma.InputJsonValue | undefined,
      },
    })
  }

  private formatDateKey(input: Date): string {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
}
