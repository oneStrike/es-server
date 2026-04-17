import type { Db, SQL } from '@db/core'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils/time'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonLabel,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserGrowthRuleActionDto } from '../growth/dto/growth-shared.dto'
import {
  ConsumeUserPointsDto,
  QueryUserPointRecordDto,
} from './dto/point-record.dto'

interface LedgerRecordShape {
  id: number
  userId: number
  ruleId: number | null
  ruleType?: number | null
  targetType: number | null
  targetId: number | null
  delta: number
  beforeValue: number
  afterValue: number
  bizKey?: string
  createdAt: Date
  updatedAt?: Date
  remark: string | null
  context?: Record<string, unknown> | null
}

/**
 * 积分服务类
 * 对外保留原有方法签名，内部统一切换到 GrowthLedger 写入。
 */
@Injectable()
export class UserPointService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthLedgerService: GrowthLedgerService,
  ) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 统一成长账本表。 */
  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  /** 用户表。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  /**
   * 增加积分
   * @param addPointsDto 增加积分的数据
   * @returns 增加积分的结果
   */
  async addPoints(
    addPointsDto: UserGrowthRuleActionDto & {
      bizKey?: string
      source?: string
    },
  ) {
    const { userId, ruleType, remark } = addPointsDto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const bizKey =
      addPointsDto.bizKey ??
      this.buildStableBizKey('point:rule', {
        userId,
        ruleType,
        remark,
        source: addPointsDto.source,
      })

    await this.drizzle.withTransaction(async (tx) => {
      const result = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        ruleType,
        bizKey,
        source: addPointsDto.source ?? GrowthLedgerSourceEnum.GROWTH_RULE,
        remark,
      })

      if (!result.success && !result.duplicated) {
        this.throwPointGrantFailure(result.reason)
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new InternalServerErrorException('积分发放失败')
      }
      await this.findLedgerRecordById(tx, recordId)
    })
    return true
  }

  /**
   * 消费积分
   * @param consumePointsDto 消费积分的数据
   * @returns 消费积分的结果
   */
  async consumePoints(
    consumePointsDto: ConsumeUserPointsDto & {
      bizKey?: string
      source?: string
    },
  ) {
    return this.drizzle.withTransaction(async (transaction) => {
      return this.consumePointsInTx(transaction, consumePointsDto)
    })
  }

  async consumePointsInTx(
    tx: Db,
    consumePointsDto: ConsumeUserPointsDto & {
      bizKey?: string
      source?: string
    },
  ) {
    const { userId, points, remark, targetType, targetId, exchangeId } =
      consumePointsDto

    /**
     * 在既有事务中执行积分扣减。
     * 扣减结果必须立即回查账本记录，确保事务内后续流程拿到的是已落库的稳定快照。
     */
    const applyConsume = async (trx: Db) => {
      const bizKey =
        consumePointsDto.bizKey ??
        this.buildStableBizKey('point:consume', {
          userId,
          points,
          targetType,
          targetId,
          exchangeId,
          remark,
          source: consumePointsDto.source,
        })
      const source = consumePointsDto.source ?? 'point_service'

      const result = await this.growthLedgerService.applyDelta(trx, {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        action: GrowthLedgerActionEnum.CONSUME,
        amount: points,
        bizKey,
        source,
        remark,
        targetType,
        targetId,
        context: exchangeId ? { exchangeId } : undefined,
      })

      if (!result.success && !result.duplicated) {
        this.throwPointConsumeFailure(result.reason)
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new InternalServerErrorException('积分扣减失败')
      }

      await this.findLedgerRecordById(trx, recordId)
      return true
    }

    return applyConsume(tx)
  }

  /** 按成长账本拒绝原因映射积分发放失败语义。 */
  private throwPointGrantFailure(
    reason?: keyof typeof GrowthLedgerFailReasonLabel,
  ): never {
    if (!reason) {
      throw new InternalServerErrorException('积分发放失败')
    }

    if (reason === 'rule_not_found') {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        GrowthLedgerFailReasonLabel[reason],
      )
    }

    if (
      reason === 'daily_limit' ||
      reason === 'total_limit' ||
      reason === 'insufficient_balance'
    ) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        GrowthLedgerFailReasonLabel[reason],
      )
    }

    if (reason === 'rule_disabled' || reason === 'cooldown') {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        GrowthLedgerFailReasonLabel[reason],
      )
    }

    throw new InternalServerErrorException(
      GrowthLedgerFailReasonLabel[reason] || '积分发放失败',
    )
  }

  /** 按成长账本拒绝原因映射积分扣减失败语义。 */
  private throwPointConsumeFailure(
    reason?: keyof typeof GrowthLedgerFailReasonLabel,
  ): never {
    if (reason === 'insufficient_balance') {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        '积分不足',
      )
    }

    if (
      reason === 'daily_limit' ||
      reason === 'total_limit' ||
      reason === 'cooldown'
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        GrowthLedgerFailReasonLabel[reason],
      )
    }

    throw new InternalServerErrorException('积分扣减失败')
  }

  /**
   * 分页查询积分记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getPointRecordPage(dto: QueryUserPointRecordDto) {
    const conditions: SQL[] = [
      eq(this.growthLedgerRecord.userId, dto.userId),
      eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.POINTS),
    ]

    if (dto.ruleId !== undefined) {
      conditions.push(
        dto.ruleId === null
          ? isNull(this.growthLedgerRecord.ruleId)
          : eq(this.growthLedgerRecord.ruleId, dto.ruleId),
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
    // 历史上这里走 JSON 字符串默认排序，现统一收口为字面量对象，减少调用层分支。
    const orderBy = dto.orderBy?.trim() ? dto.orderBy : { id: 'desc' as const }

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
        this.toPointRecord(
          item as typeof item & { context?: Record<string, unknown> | null },
        ),
      ),
    }
  }

  /**
   * 获取用户积分记录详情
   * @param id 记录ID
   * @returns 记录详情信息
   */
  async getPointRecordDetail(id: number) {
    const record = await this.db.query.growthLedgerRecord.findFirst({
      where: {
        id,
        assetType: GrowthAssetTypeEnum.POINTS,
      },
      with: {
        user: true,
      },
    })

    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '积分记录不存在',
      )
    }

    return {
      ...this.toPointRecord(
        record as typeof record & { context?: Record<string, unknown> | null },
      ),
      user: record.user,
    }
  }

  /**
   * 获取用户积分统计
   * @param userId 用户ID
   * @returns 积分统计信息
   */
  async getUserPointStats(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const today = startOfTodayInAppTimeZone()

    const [todayStats] = await this.db
      .select({
        earned: sql<number>`coalesce(sum(case when ${this.growthLedgerRecord.delta} > 0 then ${this.growthLedgerRecord.delta} else 0 end), 0)`,
        consumed: sql<number>`coalesce(sum(case when ${this.growthLedgerRecord.delta} < 0 then -${this.growthLedgerRecord.delta} else 0 end), 0)`,
      })
      .from(this.growthLedgerRecord)
      .where(
        and(
          eq(this.growthLedgerRecord.userId, userId),
          eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.POINTS),
          gte(this.growthLedgerRecord.createdAt, today),
        ),
      )

    return {
      currentPoints: await this.getCurrentPoints(userId),
      todayEarned: Number(todayStats?.earned ?? 0),
      todayConsumed: Number(todayStats?.consumed ?? 0),
    }
  }

  private async getCurrentPoints(userId: number) {
    const balance = await this.db.query.userAssetBalance.findFirst({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
      },
      columns: {
        balance: true,
      },
    })

    return balance?.balance ?? 0
  }

  /**
   * 与漫画系统互通接口
   * @param userId 用户ID
   * @param points 积分数量
   * @param operation 操作类型（add=增加, consume=消费）
   * @returns 操作结果
   */
  async syncWithComicSystem(
    userId: number,
    points: number,
    operation: 'add' | 'consume',
  ) {
    const result = await this.drizzle.withTransaction(async (tx) => {
      const action =
        operation === 'add'
          ? GrowthLedgerActionEnum.GRANT
          : GrowthLedgerActionEnum.CONSUME

      const ledger = await this.growthLedgerService.applyDelta(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        action,
        amount: points,
        bizKey: this.buildStableBizKey('point:comic-sync', {
          userId,
          operation,
          points,
        }),
        source: 'comic_sync',
        remark: operation === 'add' ? '漫画系统积分增加' : '漫画系统积分消费',
      })

      if (!ledger.success && !ledger.duplicated) {
        throw new BusinessException(
          BusinessErrorCode.QUOTA_NOT_ENOUGH,
          ledger.reason === 'insufficient_balance'
            ? '积分不足'
            : '积分同步失败',
        )
      }

      return {
        success: true,
        beforePoints: ledger.beforeValue,
        afterPoints: ledger.afterValue,
        points,
      }
    })

    return result
  }

  /**
   * 根据账本记录 ID 回查积分流水。
   * 用于在发放 / 扣减成功后确认记录已落库，避免下游继续处理不存在的 recordId。
   */
  private async findLedgerRecordById(
    tx: Db,
    id: number,
  ): Promise<LedgerRecordShape> {
    const record = await tx.query.growthLedgerRecord.findFirst({
      where: { id },
      columns: {
        id: true,
        userId: true,
        ruleId: true,
        targetType: true,
        targetId: true,
        delta: true,
        beforeValue: true,
        afterValue: true,
        createdAt: true,
        remark: true,
      },
    })
    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '积分记录不存在',
      )
    }
    return record
  }

  /**
   * 根据规则类型获取积分
   * @param userId 用户ID
   * @param ruleType 规则类型
   * @param remark 备注
   * @returns 操作结果
   */
  async addPointsByRuleType(
    userId: number,
    ruleType: GrowthRuleTypeEnum,
    remark?: string,
    extra?: {
      bizKey?: string
      source?: string
      targetType?: number
      targetId?: number
    },
  ) {
    return this.addPoints({
      userId,
      ruleType,
      remark,
      bizKey: extra?.bizKey,
      source: extra?.source,
    })
  }

  /**
   * 构建稳定业务键。
   * 相同业务上下文会生成相同 bizKey，用于积分流水幂等和管理端操作串联。
   */
  private buildStableBizKey(prefix: string, payload: Record<string, unknown>) {
    const serializedPayload = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .sort()
      .join('|')
    return `${prefix}:${serializedPayload}`
  }

  /**
   * 将账本记录映射为积分记录响应结构。
   * 该映射统一收敛 points / beforePoints / afterPoints 字段命名，避免调用方各自转换。
   */
  private toPointRecord(record: {
    id: number
    userId: number
    ruleId: number | null
    ruleType?: number | null
    source?: string | null
    targetType: number | null
    targetId: number | null
    delta: number
    beforeValue: number
    afterValue: number
    bizKey?: string
    remark: string | null
    context?: Record<string, unknown> | null
    createdAt: Date
  }) {
    return {
      id: record.id,
      userId: record.userId,
      ruleId: record.ruleId ?? undefined,
      ruleType: record.ruleType ?? undefined,
      source: record.source ?? undefined,
      targetType: record.targetType ?? undefined,
      targetId: record.targetId ?? undefined,
      bizKey: record.bizKey ?? '',
      context: this.growthLedgerService.sanitizePublicContext(record.context),
      points: record.delta,
      beforePoints: record.beforeValue,
      afterPoints: record.afterValue,
      remark: record.remark ?? undefined,
      createdAt: record.createdAt,
    }
  }
}
