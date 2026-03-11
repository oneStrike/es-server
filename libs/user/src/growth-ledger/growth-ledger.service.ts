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
   *
   * 流程：
   * 1. 根据资产类型查询对应规则表
   * 2. 检查规则是否启用、数值是否有效
   * 3. 创建账本记录（幂等检查）
   * 4. 检查每日限额和总限额
   * 5. 更新用户余额
   * 6. 写入审计日志
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
      remark,
      targetType,
      targetId,
      context,
      occurredAt = new Date(),
    } = params

    // 规则读取：按资产类型分别走对应规则表
    // POINTS -> userPointRule, EXPERIENCE -> userExperienceRule
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

    // 规则不存在
    if (!rule) {
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
      }
    }

    // 规则已禁用
    if (!rule.isEnabled) {
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      }
    }

    // 获取规则定义的变动值（积分或经验）
    const delta = 'points' in rule ? rule.points : rule.experience

    // 规则值为零，无需处理
    if (delta === 0) {
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    // 创建账本记录入口（包含幂等检查）
    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
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

    // 构建规则键和日期键，用于限额检查
    const ruleKey = `${assetType}:${ruleType}`
    const dayKey = this.formatDateKey(occurredAt)

    // 检查每日限额：通过槽位占用实现并发安全
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
        // 每日限额已达，回滚账本记录
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.DAILY_LIMIT,
        }
      }
    }

    // 检查总限额：通过槽位占用实现并发安全
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
        // 总限额已达，回滚账本记录
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.TOTAL_LIMIT,
        }
      }
    }

    // 更新用户余额（原子操作）
    const currentValue = await this.incrementUserBalance(tx, {
      userId,
      assetType,
      amount: delta,
    })
    const afterValue = currentValue
    const beforeValue = afterValue - delta

    // 更新账本记录的前后值
    await tx.growthLedgerRecord.update({
      where: { id: gate.recordId },
      data: {
        beforeValue,
        afterValue,
      },
    })

    // 写入审计日志
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
   *
   * 流程：
   * 1. 验证变动金额
   * 2. 创建账本记录（幂等检查）
   * 3. 消费时检查余额是否充足
   * 4. 更新用户余额
   * 5. 写入审计日志
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
      remark,
      targetType,
      targetId,
      context,
    } = params

    // 变动金额必须大于零
    if (amount <= 0) {
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    // 根据操作类型计算带符号的变动值
    // CONSUME 为负数，GRANT 为正数
    const signedDelta =
      action === GrowthLedgerActionEnum.CONSUME ? -amount : amount

    // 创建账本记录入口（包含幂等检查）
    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
      delta: signedDelta,
      remark,
      targetType,
      targetId,
      context,
    })
    if (gate.duplicated) {
      return gate.result
    }

    // 消费操作：检查余额是否充足
    if (action === GrowthLedgerActionEnum.CONSUME) {
      const decreased = await this.decrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
      if (!decreased.ok) {
        // 余额不足，回滚账本记录
        await tx.growthLedgerRecord.delete({ where: { id: gate.recordId } })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE,
        }
      }
    } else {
      // 发放操作：直接增加余额
      await this.incrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
    }

    // 查询更新后的用户余额
    const user = await tx.appUser.findUniqueOrThrow({
      where: { id: userId },
      select: { points: true, experience: true },
    })
    const afterValue =
      assetType === GrowthAssetTypeEnum.POINTS ? user.points : user.experience
    const beforeValue = afterValue - signedDelta

    // 更新账本记录的前后值
    await tx.growthLedgerRecord.update({
      where: { id: gate.recordId },
      data: {
        beforeValue,
        afterValue,
      },
    })

    // 写入审计日志
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

  /**
   * 创建账本记录入口
   *
   * 实现幂等机制：
   * 1. 使用 skipDuplicates 避免唯一约束冲突打断事务
   * 2. 如果记录已存在，返回已有记录的结果
   *
   * @returns 如果重复返回已有结果，否则返回新记录ID
   */
  private async createLedgerGate(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      bizKey: string
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
    // 使用 skipDuplicates 避免唯一冲突异常把整个事务打断
    const inserted = await tx.growthLedgerRecord.createMany({
      data: {
        userId: params.userId,
        assetType: params.assetType,
        delta: params.delta,
        beforeValue: 0,
        afterValue: 0,
        bizKey: params.bizKey,
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
      throw new Error('账本记录创建失败')
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

  /**
   * 预留限额槽位
   *
   * 槽位占用策略：
   * 对于 limit=N，仅允许成功占用 N 个唯一槽位，超出即失败
   * 通过尝试占用 slotNo=1 到 limit 的槽位来实现并发安全
   *
   * @returns 是否成功占用槽位
   */
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

  /**
   * 增加用户余额
   * 使用原子操作更新用户表中的积分或经验字段
   * @returns 更新后的余额值
   */
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

  /**
   * 减少用户余额
   * 使用条件更新确保余额充足时才扣减
   * @returns 是否成功扣减
   */
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

  /**
   * 写入审计日志
   * 记录所有结算请求的决策和结果，用于问题排查
   */
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

  /** 格式化日期为 YYYY-MM-DD 格式，用于每日限额的日期键 */
  private formatDateKey(input: Date): string {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
}
