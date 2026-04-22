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
import { resolveGrowthLedgerRemark } from './growth-ledger-remark'
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
 * 1. 所有可计量资产结算统一写入 growth_ledger_record
 * 2. 通过事务级 advisory lock + bizKey 唯一约束做幂等
 * 3. 热余额统一落在 user_asset_balance
 * 4. 规则限额统一落在 growth_rule_usage_counter
 * 5. growth_ledger_record 只记录真实生效后的最终资产事实
 */
@Injectable()
export class GrowthLedgerService {
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

  private get growthRuleUsageCounter() {
    return this.drizzle.schema.growthRuleUsageCounter
  }

  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
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
      assetKey,
      ruleType,
      bizKey,
      source = GrowthLedgerSourceEnum.GROWTH_RULE,
      targetType,
      targetId,
      context,
      occurredAt = new Date(),
    } = params
    const normalizedAssetKey = this.normalizeAssetKey(assetType, assetKey)

    await this.ensureLedgerOperationLock(tx, {
      userId,
      bizKey,
    })
    const existing = await this.findLedgerByUserBizKey(tx, {
      userId,
      bizKey,
    })
    if (existing) {
      if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        await this.syncUserLevelByCurrentExperience(tx, userId)
      }
      return {
        success: true,
        duplicated: true,
        assetKey: existing.assetKey,
        deltaApplied: existing.delta,
        beforeValue: existing.beforeValue,
        afterValue: existing.afterValue,
        recordId: existing.id,
      }
    }

    await this.ensureUserExists(tx, userId)

    const rule = await this.findRuleByType(
      tx,
      assetType,
      normalizedAssetKey,
      ruleType,
    )
    // 规则不存在
    if (!rule) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        assetKey: normalizedAssetKey,
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
        assetKey: normalizedAssetKey,
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

    // 获取规则定义的变动值（正数发放，负数规则在这里直接拒绝）
    const delta = rule.delta

    // 规则发奖值必须为正数；即使入口配置漂移，这里也要兜底拒绝。
    if (delta <= 0) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        assetKey: normalizedAssetKey,
        action: GrowthLedgerActionEnum.GRANT,
        ruleType,
        decision: GrowthAuditDecisionEnum.DENY,
        reason: GrowthLedgerFailReasonEnum.RULE_ZERO,
        context,
      })
      return { success: false, reason: GrowthLedgerFailReasonEnum.RULE_ZERO }
    }

    // 构建规则键和日期键，用于限额检查
    const ruleKey = `${assetType}:${normalizedAssetKey}:${ruleType}`
    const dayKey = this.formatDateKey(occurredAt)

    // 检查每日限额：通过累计计数实现并发安全
    if (rule.dailyLimit > 0) {
      const reserved = await this.incrementUsageCounter(tx, {
        userId,
        assetType,
        assetKey: normalizedAssetKey,
        ruleKey,
        scopeType: GrowthRuleUsageSlotTypeEnum.DAILY,
        scopeKey: dayKey,
        limit: rule.dailyLimit,
      })
      if (!reserved) {
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          assetKey: normalizedAssetKey,
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

    // 检查总限额：通过累计计数实现并发安全
    if (rule.totalLimit > 0) {
      const reserved = await this.incrementUsageCounter(tx, {
        userId,
        assetType,
        assetKey: normalizedAssetKey,
        ruleKey,
        scopeType: GrowthRuleUsageSlotTypeEnum.TOTAL,
        scopeKey: 'all',
        limit: rule.totalLimit,
      })
      if (!reserved) {
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          assetKey: normalizedAssetKey,
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
    const afterValue = await this.incrementUserBalance(tx, {
      userId,
      assetType,
      assetKey: normalizedAssetKey,
      amount: delta,
    })
    const beforeValue = afterValue - delta
    const remark = resolveGrowthLedgerRemark({
      assetType,
      source,
      action: GrowthLedgerActionEnum.GRANT,
      ruleType,
    })

    const recordId = await this.insertLedgerRecord(tx, {
      userId,
      assetType,
      assetKey: normalizedAssetKey,
      delta,
      beforeValue,
      afterValue,
      bizKey,
      source,
      ruleType,
      ruleId: rule.id,
      remark,
      targetType,
      targetId,
      context,
    })

    // 写入审计日志
    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      assetKey: normalizedAssetKey,
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
      assetKey: normalizedAssetKey,
      deltaApplied: delta,
      beforeValue,
      afterValue,
      ruleId: rule.id,
      recordId,
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
      assetKey,
      action,
      amount,
      bizKey,
      targetType,
      targetId,
      context,
    } = params
    const normalizedAssetKey = this.normalizeAssetKey(assetType, assetKey)

    // 变动金额必须大于零
    if (amount <= 0) {
      await this.writeAuditLog(tx, {
        userId,
        bizKey,
        assetType,
        assetKey: normalizedAssetKey,
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

    await this.ensureLedgerOperationLock(tx, {
      userId,
      bizKey,
    })
    const existing = await this.findLedgerByUserBizKey(tx, {
      userId,
      bizKey,
    })
    if (existing) {
      if (assetType === GrowthAssetTypeEnum.EXPERIENCE) {
        await this.syncUserLevelByCurrentExperience(tx, userId)
      }
      return {
        success: true,
        duplicated: true,
        assetKey: existing.assetKey,
        deltaApplied: existing.delta,
        beforeValue: existing.beforeValue,
        afterValue: existing.afterValue,
        recordId: existing.id,
      }
    }
    await this.ensureUserExists(tx, userId)

    // 消费操作：检查余额是否充足
    let afterValue: number
    if (action === GrowthLedgerActionEnum.CONSUME) {
      const decreased = await this.decrementUserBalance(tx, {
        userId,
        assetType,
        assetKey: normalizedAssetKey,
        amount,
      })
      if (!decreased.ok) {
        await this.writeAuditLog(tx, {
          userId,
          bizKey,
          assetType,
          assetKey: normalizedAssetKey,
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
        assetKey: normalizedAssetKey,
        amount,
      })
    }

    const beforeValue = afterValue - signedDelta
    const remark = resolveGrowthLedgerRemark({
      assetType,
      source: params.source,
      action,
    })

    const recordId = await this.insertLedgerRecord(tx, {
      userId,
      assetType,
      assetKey: normalizedAssetKey,
      delta: signedDelta,
      beforeValue,
      afterValue,
      bizKey,
      source: params.source,
      remark,
      targetType,
      targetId,
      context,
    })

    // 写入审计日志
    await this.writeAuditLog(tx, {
      userId,
      bizKey,
      assetType,
      assetKey: normalizedAssetKey,
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
      assetKey: normalizedAssetKey,
      deltaApplied: signedDelta,
      beforeValue,
      afterValue,
      recordId,
    }
  }

  /**
   * 将账本 context 裁剪为可公开展示的解释字段。
   * 只保留少量稳定、业务可读的白名单键，避免把内部调试载荷直接透出。
   */
  sanitizePublicContext(
    context?: Record<string, unknown> | null,
  ): PublicGrowthLedgerContext | undefined {
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      return undefined
    }

    const sanitizedEntries = this.publicGrowthLedgerContextKeys
      .map((key) => {
        const value = (
          context as Record<string, string | number | boolean | null | undefined>
        )[key]
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
      list: page.list.map((item) =>
        this.toPublicGrowthLedgerRecord(
          item as typeof item & { context?: Record<string, unknown> | null },
        ),
      ),
    }
  }

  private toPublicGrowthLedgerRecord(record: {
    id: number
    userId: number
    assetType: GrowthAssetTypeEnum
    assetKey: string
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
    context?: Record<string, unknown> | null
    createdAt: Date
  }): PublicGrowthLedgerRecord {
    return {
      id: record.id,
      userId: record.userId,
      assetType: record.assetType,
      assetKey: record.assetKey || undefined,
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
    value: string | number | boolean | null | undefined,
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
   * 使用原子 upsert 更新统一余额表
   * @returns 更新后的余额值
   */
  private async incrementUserBalance(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      assetKey: string
      amount: number
    },
  ): Promise<number> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.userAssetBalance)
        .values({
          userId: params.userId,
          assetType: params.assetType,
          assetKey: params.assetKey,
          balance: params.amount,
        })
        .onConflictDoUpdate({
          target: [
            this.userAssetBalance.userId,
            this.userAssetBalance.assetType,
            this.userAssetBalance.assetKey,
          ],
          set: {
            balance: sql`${this.userAssetBalance.balance} + ${params.amount}`,
            updatedAt: new Date(),
          },
        })
        .returning({
          balance: this.userAssetBalance.balance,
        }),
    )

    const balance = rows[0]?.balance
    if (balance === undefined) {
      throw new Error('用户资产余额写入失败')
    }
    return balance
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
      assetKey: string
      amount: number
    },
  ): Promise<{ ok: boolean, afterValue: number }> {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.userAssetBalance)
        .set({
          balance: sql`${this.userAssetBalance.balance} - ${params.amount}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(this.userAssetBalance.userId, params.userId),
            eq(this.userAssetBalance.assetType, params.assetType),
            eq(this.userAssetBalance.assetKey, params.assetKey),
            gte(this.userAssetBalance.balance, params.amount),
          ),
        )
        .returning({
          afterValue: this.userAssetBalance.balance,
        }),
    )

    const afterValue = rows[0]?.afterValue
    if (afterValue === undefined) {
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
      assetKey?: string
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
        assetKey: params.assetKey ?? '',
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

  private async syncUserLevelByCurrentExperience(
    tx: Tx,
    userId: number,
  ): Promise<void> {
    const experience = await this.getUserAssetBalance(tx, {
      userId,
      assetType: GrowthAssetTypeEnum.EXPERIENCE,
      assetKey: '',
    })
    await this.syncUserLevelByExperience(tx, userId, experience)
  }

  /** 格式化日期为 YYYY-MM-DD 格式，用于每日限额的日期键 */
  private formatDateKey(input: Date) {
    return formatDateKeyInAppTimeZone(input)
  }

  private async findRuleByType(
    tx: Tx,
    assetType: GrowthAssetTypeEnum,
    assetKey: string,
    ruleType: number,
  ) {
    const rows = await tx
      .select({
        id: this.growthRewardRule.id,
        delta: this.growthRewardRule.delta,
        dailyLimit: this.growthRewardRule.dailyLimit,
        totalLimit: this.growthRewardRule.totalLimit,
        isEnabled: this.growthRewardRule.isEnabled,
      })
      .from(this.growthRewardRule)
      .where(
        and(
          eq(this.growthRewardRule.type, ruleType),
          eq(this.growthRewardRule.assetType, assetType),
          eq(this.growthRewardRule.assetKey, assetKey),
        ),
      )
      .limit(1)
    return rows[0]
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
        assetKey: true,
        delta: true,
        beforeValue: true,
        afterValue: true,
      },
    })
  }

  private async ensureLedgerOperationLock(
    tx: Tx,
    params: { userId: number, bizKey: string },
  ) {
    await this.drizzle.withErrorHandling(() =>
      tx.execute(
        sql`SELECT pg_advisory_xact_lock(${params.userId}, hashtext(${params.bizKey}))`,
      ),
    )
  }

  private normalizeAssetKey(
    assetType: GrowthAssetTypeEnum,
    assetKey?: string,
  ) {
    const normalizedAssetKey = assetKey?.trim() ?? ''
    if (
      (assetType === GrowthAssetTypeEnum.POINTS
        || assetType === GrowthAssetTypeEnum.EXPERIENCE)
      && normalizedAssetKey !== ''
    ) {
      throw new Error('points/experience assetKey must be empty')
    }
    return normalizedAssetKey
  }

  private async ensureUserExists(tx: Tx, userId: number) {
    const user = await tx.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  private async insertLedgerRecord(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      assetKey: string
      delta: number
      beforeValue: number
      afterValue: number
      bizKey: string
      source: string
      ruleType?: number
      ruleId?: number
      remark?: string
      targetType?: number
      targetId?: number
      context?: Record<string, unknown>
    },
  ) {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.growthLedgerRecord)
        .values({
          userId: params.userId,
          assetType: params.assetType,
          assetKey: params.assetKey,
          delta: params.delta,
          beforeValue: params.beforeValue,
          afterValue: params.afterValue,
          bizKey: params.bizKey,
          source: params.source,
          ruleType: params.ruleType,
          ruleId: params.ruleId,
          targetType: params.targetType,
          targetId: params.targetId,
          remark: params.remark,
          context: params.context,
        })
        .returning({ id: this.growthLedgerRecord.id }),
    )

    const recordId = rows[0]?.id
    if (!recordId) {
      throw new Error('账本记录写入失败')
    }
    return recordId
  }

  private async incrementUsageCounter(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      assetKey: string
      ruleKey: string
      scopeType: GrowthRuleUsageSlotTypeEnum
      scopeKey: string
      limit: number
    },
  ) {
    const rows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.growthRuleUsageCounter)
        .values({
          userId: params.userId,
          assetType: params.assetType,
          assetKey: params.assetKey,
          ruleKey: params.ruleKey,
          scopeType: params.scopeType,
          scopeKey: params.scopeKey,
          usedCount: 1,
        })
        .onConflictDoUpdate({
          target: [
            this.growthRuleUsageCounter.userId,
            this.growthRuleUsageCounter.assetType,
            this.growthRuleUsageCounter.assetKey,
            this.growthRuleUsageCounter.ruleKey,
            this.growthRuleUsageCounter.scopeType,
            this.growthRuleUsageCounter.scopeKey,
          ],
          set: {
            usedCount: sql`${this.growthRuleUsageCounter.usedCount} + 1`,
            updatedAt: new Date(),
          },
          setWhere: sql`${this.growthRuleUsageCounter.usedCount} < ${params.limit}`,
        })
        .returning({ id: this.growthRuleUsageCounter.id }),
    )

    return rows.length > 0
  }

  async getUserAssetBalance(
    tx: Tx,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      assetKey?: string
    },
  ) {
    const balanceRecord = await tx.query.userAssetBalance.findFirst({
      where: {
        userId: params.userId,
        assetType: params.assetType,
        assetKey: params.assetKey ?? '',
      },
      columns: {
        balance: true,
      },
    })
    return balanceRecord?.balance ?? 0
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
