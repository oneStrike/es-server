import type { Db } from '@db/core'
import type {
  ApplyDeltaParams,
  ApplyRuleParams,
  GrowthLedgerApplyResult,
  PublicGrowthLedgerContext,
  PublicGrowthLedgerContextKey,
  PublicGrowthLedgerContextValue,
  PublicGrowthLedgerRecord,
} from './growth-ledger.internal'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { formatDateKeyInAppTimeZone } from '@libs/platform/utils/time'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { QueryGrowthLedgerPageDto } from './dto/growth-ledger-record.dto'
import {
  GrowthAssetTypeEnum,
  GrowthAuditDecisionEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
  GrowthRuleUsageSlotTypeEnum,
} from './growth-ledger.constant'
import { PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS } from './growth-ledger.internal'

type Tx = Db

/**
 * 统一成长账本服务
 *
 * 说明：
 * 1. 所有积分/经验结算统一写入 growth_ledger_record
 * 2. 通过 bizKey + 唯一约束做幂等
 * 3. 通过 growth_rule_usage_slot 做并发限流占位
 */
@Injectable()
export class GrowthLedgerService {
  private readonly maxSlotReserveLimit = 2000

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get growthAuditLog() {
    return this.drizzle.schema.growthAuditLog
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  private get growthRuleUsageSlot() {
    return this.drizzle.schema.growthRuleUsageSlot
  }

  private get userExperienceRule() {
    return this.drizzle.schema.userExperienceRule
  }

  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private get userPointRule() {
    return this.drizzle.schema.userPointRule
  }

  private readonly publicGrowthLedgerContextKeys: readonly PublicGrowthLedgerContextKey[] =
    PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS

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
      source = GrowthLedgerSourceEnum.GROWTH_RULE,
      remark,
      targetType,
      targetId,
      context,
      occurredAt = new Date(),
    } = params

    // 规则读取：按资产类型分别走对应规则表
    // POINTS -> userPointRule, EXPERIENCE -> userExperienceRule
    const rule = await this.findRuleByType(tx, assetType, ruleType)
    // 规则不存在
    if (!rule) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        action: GrowthLedgerActionEnum.GRANT,
        ruleType,
        decision: GrowthAuditDecisionEnum.DENY,
        reason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
        context,
      })
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
      }
    }

    // 规则已禁用
    if (!rule.isEnabled) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        action: GrowthLedgerActionEnum.GRANT,
        ruleType,
        decision: GrowthAuditDecisionEnum.DENY,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
        context,
      })
      return {
        success: false,
        reason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
      }
    }

    // 获取规则定义的变动值（积分或经验）
    const delta = 'points' in rule ? rule.points : rule.experience

    // 规则发奖值必须为正数；即使入口配置漂移，这里也要兜底拒绝。
    if (delta <= 0) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        action: GrowthLedgerActionEnum.GRANT,
        ruleType,
        decision: GrowthAuditDecisionEnum.DENY,
        reason: GrowthLedgerFailReasonEnum.RULE_ZERO,
        context,
      })
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    // 创建账本记录入口（包含幂等检查）
    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
      delta,
      source,
      ruleType,
      ruleId: rule.id,
      remark,
      targetType,
      targetId,
      context,
    })
    if (gate.duplicated) {
      if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        await this.syncUserLevelByExperience(tx, userId, gate.result.afterValue)
      }
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
        slotType: GrowthRuleUsageSlotTypeEnum.DAILY,
        slotScope: dayKey,
        limit: rule.dailyLimit,
      })
      if (!reservedDaily) {
        // 每日限额已达，回滚账本记录
        await this.deleteLedgerRecordById(tx, gate.recordId)
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          action: GrowthLedgerActionEnum.GRANT,
          ruleType,
          decision: GrowthAuditDecisionEnum.DENY,
          reason: GrowthLedgerFailReasonEnum.DAILY_LIMIT,
          deltaRequested: delta,
          context,
        })
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
        slotType: GrowthRuleUsageSlotTypeEnum.TOTAL,
        slotScope: 'all',
        limit: rule.totalLimit,
      })
      if (!reservedTotal) {
        // 总限额已达，回滚账本记录
        await this.deleteLedgerRecordById(tx, gate.recordId)
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          action: GrowthLedgerActionEnum.GRANT,
          ruleType,
          decision: GrowthAuditDecisionEnum.DENY,
          reason: GrowthLedgerFailReasonEnum.TOTAL_LIMIT,
          deltaRequested: delta,
          context,
        })
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
    await this.updateLedgerBeforeAfterValue(tx, gate.recordId, {
      beforeValue,
      afterValue,
    })

    // 写入审计日志
    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      action: GrowthLedgerActionEnum.GRANT,
      ruleType,
      decision: GrowthAuditDecisionEnum.ALLOW,
      deltaRequested: delta,
      deltaApplied: delta,
      context,
    })

    if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
      await this.syncUserLevelByExperience(tx, userId, afterValue)
    }

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
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        action,
        decision: GrowthAuditDecisionEnum.DENY,
        reason: GrowthLedgerFailReasonEnum.RULE_ZERO,
        context,
      })
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    // 根据动作类型计算带符号的变动值。
    // 扣减为负数，发放为正数。
    const signedDelta =
      action === GrowthLedgerActionEnum.CONSUME ? -amount : amount

    // 创建账本记录入口（包含幂等检查）
    const gate = await this.createLedgerGate(tx, {
      userId,
      assetType,
      bizKey,
      source: params.source,
      delta: signedDelta,
      remark,
      targetType,
      targetId,
      context,
    })
    if (gate.duplicated) {
      if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        await this.syncUserLevelByExperience(tx, userId, gate.result.afterValue)
      }
      return gate.result
    }

    // 消费操作：检查余额是否充足
    let afterValue: number
    if (action === GrowthLedgerActionEnum.CONSUME) {
      const decreased = await this.decrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
      if (!decreased.ok) {
        // 余额不足，回滚账本记录
        await this.deleteLedgerRecordById(tx, gate.recordId)
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          action,
          decision: GrowthAuditDecisionEnum.DENY,
          reason: GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE,
          deltaRequested: signedDelta,
          context,
        })
        return {
          success: false,
          reason: GrowthLedgerFailReasonEnum.INSUFFICIENT_BALANCE,
        }
      }
      afterValue = decreased.afterValue
    } else {
      afterValue = await this.incrementUserBalance(tx, {
        userId,
        assetType,
        amount,
      })
    }

    const beforeValue = afterValue - signedDelta

    // 更新账本记录的前后值
    await this.updateLedgerBeforeAfterValue(tx, gate.recordId, {
      beforeValue,
      afterValue,
    })

    // 写入审计日志
    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      action,
      decision: GrowthAuditDecisionEnum.ALLOW,
      deltaRequested: signedDelta,
      deltaApplied: signedDelta,
      context,
    })

    if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
      await this.syncUserLevelByExperience(tx, userId, afterValue)
    }

    return {
      success: true,
      deltaApplied: signedDelta,
      beforeValue,
      afterValue,
      recordId: gate.recordId,
    }
  }

  /**
   * 将账本 context 裁剪为可公开展示的解释字段。
   * 只保留少量稳定、业务可读的白名单键，避免把内部调试载荷直接透出。
   */
  sanitizePublicContext(
    context?: unknown | null,
  ): PublicGrowthLedgerContext | undefined {
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      return undefined
    }

    const sanitizedEntries = this.publicGrowthLedgerContextKeys
      .map((key) => {
        const value = (context as Record<string, unknown>)[key]
        return this.isPublicContextValue(value) ? [key, value] : null
      })
      .filter(
        (entry): entry is [string, PublicGrowthLedgerContextValue] =>
          entry !== null,
      )

    if (sanitizedEntries.length === 0) {
      return undefined
    }

    return Object.fromEntries(sanitizedEntries) as PublicGrowthLedgerContext
  }

  /**
   * 分页查询混合成长账本时间线。
   * 统一返回积分/经验流水，按 createdAt desc, id desc 稳定排序。
   */
  async getGrowthLedgerPage(dto: QueryGrowthLedgerPageDto) {
    const conditions = [eq(this.growthLedgerRecord.userId, dto.userId)]

    if (dto.assetType !== undefined) {
      conditions.push(eq(this.growthLedgerRecord.assetType, dto.assetType))
    }
    if (dto.ruleId !== undefined) {
      conditions.push(
        dto.ruleId === null
          ? isNull(this.growthLedgerRecord.ruleId)
          : eq(this.growthLedgerRecord.ruleId, dto.ruleId),
      )
    }
    if (dto.ruleType !== undefined) {
      conditions.push(
        dto.ruleType === null
          ? isNull(this.growthLedgerRecord.ruleType)
          : eq(this.growthLedgerRecord.ruleType, dto.ruleType),
      )
    }
    if (dto.targetType !== undefined) {
      conditions.push(
        dto.targetType === null
          ? isNull(this.growthLedgerRecord.targetType)
          : eq(this.growthLedgerRecord.targetType, dto.targetType),
      )
    }
    if (dto.targetId !== undefined) {
      conditions.push(
        dto.targetId === null
          ? isNull(this.growthLedgerRecord.targetId)
          : eq(this.growthLedgerRecord.targetId, dto.targetId),
      )
    }

    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }])

    const page = await this.drizzle.ext.findPagination(
      this.growthLedgerRecord,
      {
        where: and(...conditions),
        ...dto,
        orderBy,
      },
    )

    return {
      ...page,
      list: page.list.map((item) => this.toPublicGrowthLedgerRecord(item)),
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
      source: string
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
    const insertedRecordId = await this.insertLedgerGateRecord(tx, params)
    if (insertedRecordId !== null) {
      return { duplicated: false, recordId: insertedRecordId }
    }

    const existing = await this.findLedgerByUserBizKey(tx, {
      userId: params.userId,
      bizKey: params.bizKey,
    })
    if (existing) {
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
    throw new Error('账本记录创建失败')
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
      slotType: GrowthRuleUsageSlotTypeEnum
      slotScope: string
      limit: number
    },
  ): Promise<boolean> {
    if (params.limit > this.maxSlotReserveLimit) {
      throw new Error(
        `slot limit ${params.limit} exceeds max ${this.maxSlotReserveLimit}`,
      )
    }
    for (let slotNo = 1; slotNo <= params.limit; slotNo += 1) {
      const inserted = await this.insertUsageSlot(tx, {
        userId: params.userId,
        assetType: params.assetType,
        ruleKey: params.ruleKey,
        slotType: params.slotType,
        slotValue: `${params.slotScope}:${slotNo}`,
      })
      if (inserted) {
        return true
      }
    }
    return false
  }

  private toPublicGrowthLedgerRecord(record: {
    id: number
    userId: number
    assetType: GrowthAssetTypeEnum
    source: string
    ruleId: number | null
    ruleType: number | null
    targetType: number | null
    targetId: number | null
    delta: number
    beforeValue: number
    afterValue: number
    bizKey: string
    remark: string | null
    context?: unknown
    createdAt: Date
  }): PublicGrowthLedgerRecord {
    return {
      id: record.id,
      userId: record.userId,
      assetType: record.assetType,
      source: record.source,
      ruleId: record.ruleId ?? undefined,
      ruleType: record.ruleType ?? undefined,
      targetType: record.targetType ?? undefined,
      targetId: record.targetId ?? undefined,
      delta: record.delta,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue,
      bizKey: record.bizKey,
      remark: record.remark ?? undefined,
      context: this.sanitizePublicContext(record.context),
      createdAt: record.createdAt,
    }
  }

  private isPublicContextValue(
    value: unknown,
  ): value is PublicGrowthLedgerContextValue {
    return (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      typeof value === 'string'
    )
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
    const user = await this.incrementAndReturnUserBalance(tx, params)

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
  ): Promise<{ ok: boolean, afterValue: number }> {
    const afterValue = await this.decrementWithGuard(tx, params)
    if (afterValue === null) {
      return { ok: false, afterValue: 0 }
    }
    return { ok: true, afterValue }
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
      action: GrowthLedgerActionEnum
      decision: GrowthAuditDecisionEnum
      ruleType?: number
      reason?: string
      deltaRequested?: number
      deltaApplied?: number
      context?: Record<string, unknown>
    },
  ) {
    await this.drizzle.withErrorHandling(() =>
      tx.insert(this.growthAuditLog).values({
        userId: params.userId,
        bizKey: params.bizKey,
        assetType: params.assetType,
        action: params.action,
        ruleType: params.ruleType,
        decision: params.decision,
        reason: params.reason,
        deltaRequested: params.deltaRequested,
        deltaApplied: params.deltaApplied,
        context: params.context,
      }),
    )
  }

  private async syncUserLevelByExperience(
    tx: Tx,
    userId: number,
    experience?: number,
  ): Promise<void> {
    if (experience === undefined) {
      return
    }

    const levelRule = await this.findTargetLevelRule(tx, experience)

    if (!levelRule) {
      return
    }

    await this.syncUserLevel(tx, userId, levelRule.id)
  }

  /** 格式化日期为 YYYY-MM-DD 格式，用于每日限额的日期键 */
  private formatDateKey(input: Date) {
    return formatDateKeyInAppTimeZone(input)
  }

  private async findRuleByType(
    tx: Tx,
    assetType: GrowthAssetTypeEnum,
    ruleType: number,
  ) {
    if (assetType === GrowthAssetTypeEnum.POINTS) {
      const rows = await tx
        .select({
          id: this.userPointRule.id,
          points: this.userPointRule.points,
          dailyLimit: this.userPointRule.dailyLimit,
          totalLimit: this.userPointRule.totalLimit,
          isEnabled: this.userPointRule.isEnabled,
        })
        .from(this.userPointRule)
        .where(eq(this.userPointRule.type, ruleType))
        .limit(1)
      return rows[0]
    }
    const rows = await tx
      .select({
        id: this.userExperienceRule.id,
        experience: this.userExperienceRule.experience,
        dailyLimit: this.userExperienceRule.dailyLimit,
        totalLimit: this.userExperienceRule.totalLimit,
        isEnabled: this.userExperienceRule.isEnabled,
      })
      .from(this.userExperienceRule)
      .where(eq(this.userExperienceRule.type, ruleType))
      .limit(1)
    return rows[0]
  }

  private async deleteLedgerRecordById(tx: Tx, id: number) {
    await this.drizzle.withErrorHandling(() =>
      tx
        .delete(this.growthLedgerRecord)
        .where(eq(this.growthLedgerRecord.id, id)),
    )
  }

  private async updateLedgerBeforeAfterValue(
    tx: Tx,
    id: number,
    payload: { beforeValue: number, afterValue: number },
  ): Promise<void> {
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.growthLedgerRecord)
        .set(payload)
        .where(eq(this.growthLedgerRecord.id, id)),
    )
  }

  private async insertLedgerGateRecord(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      bizKey: string
      delta: number
      source: string
      ruleType?: number
      ruleId?: number
      remark?: string
      targetType?: number
      targetId?: number
      context?: Record<string, unknown>
    },
  ): Promise<number | null> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.growthLedgerRecord)
        .values({
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
          context: params.context,
        })
        .onConflictDoNothing({
          target: [
            this.growthLedgerRecord.userId,
            this.growthLedgerRecord.bizKey,
          ],
        })
        .returning({ id: this.growthLedgerRecord.id }),
    )
    return rows[0]?.id ?? null
  }

  private async findLedgerByUserBizKey(
    tx: Tx,
    params: { userId: number, bizKey: string },
  ) {
    return tx.query.growthLedgerRecord.findFirst({
      where: {
        userId: params.userId,
        bizKey: params.bizKey,
      },
      columns: {
        id: true,
        delta: true,
        beforeValue: true,
        afterValue: true,
      },
    })
  }

  private async insertUsageSlot(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      ruleKey: string
      slotType: GrowthRuleUsageSlotTypeEnum
      slotValue: string
    },
  ): Promise<boolean> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.growthRuleUsageSlot)
        .values({
          userId: params.userId,
          assetType: params.assetType,
          ruleKey: params.ruleKey,
          slotType: params.slotType,
          slotValue: params.slotValue,
        })
        .onConflictDoNothing({
          target: [
            this.growthRuleUsageSlot.userId,
            this.growthRuleUsageSlot.assetType,
            this.growthRuleUsageSlot.ruleKey,
            this.growthRuleUsageSlot.slotType,
            this.growthRuleUsageSlot.slotValue,
          ],
        })
        .returning({ id: this.growthRuleUsageSlot.id }),
    )
    return rows.length > 0
  }

  private async incrementAndReturnUserBalance(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      amount: number
    },
  ): Promise<{ points: number, experience: number }> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.appUser)
        .set(
          params.assetType === GrowthAssetTypeEnum.POINTS
            ? { points: sql`${this.appUser.points} + ${params.amount}` }
            : {
                experience: sql`${this.appUser.experience} + ${params.amount}`,
              },
        )
        .where(eq(this.appUser.id, params.userId))
        .returning({
          points: this.appUser.points,
          experience: this.appUser.experience,
        }),
    )
    const user = rows[0]
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return user
  }

  private async decrementWithGuard(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      amount: number
    },
  ): Promise<number | null> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.appUser)
        .set(
          params.assetType === GrowthAssetTypeEnum.POINTS
            ? { points: sql`${this.appUser.points} - ${params.amount}` }
            : {
                experience: sql`${this.appUser.experience} - ${params.amount}`,
              },
        )
        .where(
          params.assetType === GrowthAssetTypeEnum.POINTS
            ? and(
                eq(this.appUser.id, params.userId),
                gte(this.appUser.points, params.amount),
              )
            : and(
                eq(this.appUser.id, params.userId),
                gte(this.appUser.experience, params.amount),
              ),
        )
        .returning(
          params.assetType === GrowthAssetTypeEnum.POINTS
            ? { afterValue: this.appUser.points }
            : { afterValue: this.appUser.experience },
        ),
    )
    return rows[0]?.afterValue ?? null
  }

  private async findTargetLevelRule(tx: Tx, experience: number) {
    const rows = await tx
      .select({
        id: this.userLevelRule.id,
      })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          lte(this.userLevelRule.requiredExperience, experience),
        ),
      )
      .orderBy(sql`${this.userLevelRule.requiredExperience} desc`)
      .limit(1)
    return rows[0]
  }

  private async syncUserLevel(
    tx: Tx,
    userId: number,
    levelId: number,
  ): Promise<void> {
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.appUser)
        .set({ levelId })
        .where(
          and(
            eq(this.appUser.id, userId),
            or(isNull(this.appUser.levelId), ne(this.appUser.levelId, levelId)),
          ),
        ),
    )
  }
}
