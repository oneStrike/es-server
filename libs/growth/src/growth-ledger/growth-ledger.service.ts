import type { DbExecutor, DbTransaction, IntegrityLockRequest } from '@db/core'
import type {
  ApplyDeltaParams,
  ApplyNonExperienceDeltaParams,
  ApplyRuleParams,
  GrowthLedgerApplyResult,
  GrowthLedgerLevelSyncCandidate,
  GrowthLedgerOperationLockInput,
  PublicGrowthLedgerContext,
  PublicGrowthLedgerContextKey,
  PublicGrowthLedgerContextValue,
  PublicGrowthLedgerRecord,
} from './growth-ledger.type'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  relationIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { formatDateKeyInAppTimeZone } from '@libs/platform/utils'
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

  // 用户成长时间线的稳定公开 read-model；归档字段仅服务保留策略，不能随整行查询进入响应。
  private buildGrowthLedgerPageSelect() {
    return {
      id: this.growthLedgerRecord.id,
      userId: this.growthLedgerRecord.userId,
      assetType: this.growthLedgerRecord.assetType,
      assetKey: this.growthLedgerRecord.assetKey,
      source: this.growthLedgerRecord.source,
      ruleId: this.growthLedgerRecord.ruleId,
      ruleType: this.growthLedgerRecord.ruleType,
      targetType: this.growthLedgerRecord.targetType,
      targetId: this.growthLedgerRecord.targetId,
      delta: this.growthLedgerRecord.delta,
      beforeValue: this.growthLedgerRecord.beforeValue,
      afterValue: this.growthLedgerRecord.afterValue,
      bizKey: this.growthLedgerRecord.bizKey,
      remark: this.growthLedgerRecord.remark,
      context: this.growthLedgerRecord.context,
      createdAt: this.growthLedgerRecord.createdAt,
    }
  }

  private readonly publicGrowthLedgerContextKeys: readonly PublicGrowthLedgerContextKey[] =
    PUBLIC_GROWTH_LEDGER_CONTEXT_KEYS

  // 单笔规则结算复用批处理协议，确保账本锁先于终端等级规则锁。
  async applyByRule(
    tx: DbTransaction,
    params: ApplyRuleParams,
  ): Promise<GrowthLedgerApplyResult> {
    const [result] = await this.applyByRuleBatch(tx, [params])
    if (!result) {
      throw new Error('growth ledger rule batch returned no result')
    }
    return result
  }

  // 先一次性取得完整账本业务键集合，再逐项结算，最后同步受影响用户的等级。
  async applyByRuleBatch(
    tx: DbTransaction,
    paramsList: readonly ApplyRuleParams[],
  ): Promise<GrowthLedgerApplyResult[]> {
    await this.acquireLedgerOperationLocks(tx, paramsList)
    const results: GrowthLedgerApplyResult[] = []
    const experienceUserIds = new Set<number>()
    for (const params of paramsList) {
      const result = await this.applyByRuleAfterOperationLock(tx, params)
      results.push(result)
      if (
        result.success &&
        params.assetType === GrowthAssetTypeEnum.EXPERIENCE
      ) {
        experienceUserIds.add(params.userId)
      }
      if (!result.success) {
        break
      }
    }
    await this.syncExperienceUsersAfterLedgerBatch(tx, experienceUserIds)
    return results
  }

  // 在调用方已持有完整账本业务键集合后执行单项规则结算。
  private async applyByRuleAfterOperationLock(
    tx: DbTransaction,
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

    const existing = await this.findLedgerByUserBizKey(tx, {
      userId,
      bizKey,
    })
    if (existing) {
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

  // 单笔直接结算复用批处理协议，确保账本锁先于终端等级规则锁。
  async applyDelta(
    tx: DbTransaction,
    params: ApplyDeltaParams,
  ): Promise<GrowthLedgerApplyResult> {
    const [result] = await this.applyDeltaBatch(tx, [params])
    if (!result) {
      throw new Error('growth ledger delta batch returned no result')
    }
    return result
  }

  // 先一次性取得完整账本业务键集合，再逐项直接结算并执行终端等级同步。
  async applyDeltaBatch(
    tx: DbTransaction,
    paramsList: readonly ApplyDeltaParams[],
  ): Promise<GrowthLedgerApplyResult[]> {
    await this.acquireLedgerOperationLocks(tx, paramsList)
    const results: GrowthLedgerApplyResult[] = []
    const experienceUserIds = new Set<number>()
    for (const params of paramsList) {
      const result = await this.applyDeltaAfterOperationLock(tx, params)
      results.push(result)
      if (
        result.success &&
        params.assetType === GrowthAssetTypeEnum.EXPERIENCE
      ) {
        experienceUserIds.add(params.userId)
      }
      if (!result.success) {
        break
      }
    }
    await this.syncExperienceUsersAfterLedgerBatch(tx, experienceUserIds)
    return results
  }

  /** 为外层业务根构造稳定的账本幂等键互斥锁请求。 */
  buildOperationLockRequest(
    input: GrowthLedgerOperationLockInput,
  ): IntegrityLockRequest {
    return exclusiveIntegrityLock(
      relationIntegrityLock(
        'growth-ledger-biz-key',
        input.userId,
        input.bizKey,
      ),
    )
  }

  /**
   * 在业务根已经取得账本幂等键锁后结算非经验资产。
   * EXPERIENCE 必须走带终端等级同步的批处理入口，运行时继续拒绝越界调用。
   */
  async applyNonExperienceDeltaAfterOperationLock(
    tx: DbTransaction,
    params: ApplyNonExperienceDeltaParams,
  ): Promise<GrowthLedgerApplyResult> {
    if (
      (params as ApplyDeltaParams).assetType === GrowthAssetTypeEnum.EXPERIENCE
    ) {
      throw new TypeError(
        'experience delta must use the terminal level-sync settlement path',
      )
    }
    return this.applyDeltaAfterOperationLock(tx, params)
  }

  // 在调用方已持有完整账本业务键集合后执行单项直接结算。
  private async applyDeltaAfterOperationLock(
    tx: DbTransaction,
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

    const existing = await this.findLedgerByUserBizKey(tx, {
      userId,
      bizKey,
    })
    if (existing) {
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

    return {
      success: true,
      assetKey: normalizedAssetKey,
      deltaApplied: signedDelta,
      beforeValue,
      afterValue,
      recordId,
    }
  }

  // 将账本 context 裁剪为可公开展示的解释字段。 只保留少量稳定、业务可读的白名单键，避免把内部调试载荷直接透出。
  sanitizePublicContext(
    context?: Record<string, unknown> | null,
  ): PublicGrowthLedgerContext | undefined {
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      return undefined
    }

    const sanitizedEntries = this.publicGrowthLedgerContextKeys
      .map((key) => {
        const value = (
          context as Record<
            string,
            string | number | boolean | null | undefined
          >
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

    return Object.fromEntries(sanitizedEntries)
  }

  // 分页查询混合成长账本时间线。 统一返回积分/经验流水，按 createdAt desc, id desc 稳定排序。
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

    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.growthLedgerRecord,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildGrowthLedgerPageSelect())
        .from(this.growthLedgerRecord)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.growthLedgerRecord, where),
    ])
    const page = toPageResult(list, total, pageQuery)

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
      assetKey: record.assetKey || null,
      source: record.source,
      ruleId: record.ruleId ?? null,
      ruleType: record.ruleType ?? null,
      targetType: record.targetType ?? null,
      targetId: record.targetId ?? null,
      delta: record.delta,
      beforeValue: record.beforeValue,
      afterValue: record.afterValue,
      bizKey: record.bizKey,
      remark: record.remark ?? null,
      context: this.sanitizePublicContext(record.context) ?? null,
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

  // 增加用户余额 使用原子 upsert 更新统一余额表
  private async incrementUserBalance(
    tx: DbExecutor,
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

  // 减少用户余额 使用条件更新确保余额充足时才扣减
  private async decrementUserBalance(
    tx: DbExecutor,
    params: {
      userId: number
      assetType: GrowthAssetTypeEnum
      assetKey: string
      amount: number
    },
  ): Promise<{ ok: boolean; afterValue: number }> {
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

  // 写入审计日志 记录所有结算请求的决策和结果，用于问题排查
  private async writeAuditLog(
    tx: DbExecutor,
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

  // 格式化日期为 YYYY-MM-DD 格式，用于每日限额的日期键
  private formatDateKey(input: Date) {
    return formatDateKeyInAppTimeZone(input)
  }

  private async findRuleByType(
    tx: DbExecutor,
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
          isNull(this.growthRewardRule.archivedAt),
        ),
      )
      .limit(1)
    return rows[0]
  }

  private async findLedgerByUserBizKey(
    tx: DbExecutor,
    params: { userId: number; bizKey: string },
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

  // 一次性取得当前业务根的完整账本幂等键集合，避免终端规则锁后的后续取锁。
  private async acquireLedgerOperationLocks(
    tx: DbTransaction,
    paramsList: readonly GrowthLedgerOperationLockInput[],
  ) {
    await this.drizzle.withErrorHandling(async () =>
      acquireIntegrityLocks(
        tx,
        paramsList.map((params) => this.buildOperationLockRequest(params)),
      ),
    )
  }

  // 所有账本键均已持有后，按用户顺序执行唯一的终端等级同步阶段。
  private async syncExperienceUsersAfterLedgerBatch(
    tx: DbTransaction,
    userIds: ReadonlySet<number>,
  ) {
    if (userIds.size === 0) {
      return
    }

    const candidates: GrowthLedgerLevelSyncCandidate[] = []
    for (const userId of [...userIds].sort((left, right) => left - right)) {
      const experience = await this.getUserAssetBalance(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
      })
      const levelRule = await this.findTargetLevelRule(tx, experience)
      if (levelRule) {
        candidates.push({ experience, ruleId: levelRule.id, userId })
      }
    }

    await acquireIntegrityLocks(
      tx,
      candidates.map((candidate) =>
        sharedIntegrityLock(
          tableIntegrityLock('user_level_rule', candidate.ruleId),
        ),
      ),
    )

    for (const candidate of candidates) {
      const lockedLevelRule = await this.findEligibleLevelRuleById(
        tx,
        candidate.ruleId,
        candidate.experience,
      )
      if (lockedLevelRule) {
        await this.syncUserLevel(tx, candidate.userId, lockedLevelRule.id)
      }
    }
  }

  private normalizeAssetKey(assetType: GrowthAssetTypeEnum, assetKey?: string) {
    const normalizedAssetKey = assetKey?.trim() ?? ''
    if (
      (assetType === GrowthAssetTypeEnum.POINTS ||
        assetType === GrowthAssetTypeEnum.EXPERIENCE) &&
      normalizedAssetKey !== ''
    ) {
      throw new Error('points/experience assetKey must be empty')
    }
    return normalizedAssetKey
  }

  private async ensureUserExists(tx: DbExecutor, userId: number) {
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
    tx: DbExecutor,
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
    tx: DbExecutor,
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
    tx: DbExecutor,
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

  private async findTargetLevelRule(tx: DbTransaction, experience: number) {
    const rows = await tx
      .select({
        id: this.userLevelRule.id,
      })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          isNull(this.userLevelRule.business),
          lte(this.userLevelRule.requiredExperience, experience),
        ),
      )
      .orderBy(
        sql`${this.userLevelRule.requiredExperience} desc`,
        sql`${this.userLevelRule.id} desc`,
      )
      .limit(1)
    return rows[0]
  }

  /**
   * 在拿到该等级规则的 canonical lock 后，按同一业务条件重查最初选中的记录。
   * 不回退到一个未加锁的新候选项，避免并发删除时写入悬挂 levelId。
   */
  private async findEligibleLevelRuleById(
    tx: DbTransaction,
    levelRuleId: number,
    experience: number,
  ) {
    const rows = await tx
      .select({ id: this.userLevelRule.id })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.id, levelRuleId),
          eq(this.userLevelRule.isEnabled, true),
          isNull(this.userLevelRule.business),
          lte(this.userLevelRule.requiredExperience, experience),
        ),
      )
      .limit(1)
    return rows[0]
  }

  private async syncUserLevel(
    tx: DbTransaction,
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
