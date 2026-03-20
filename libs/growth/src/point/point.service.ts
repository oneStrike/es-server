import type { Db } from '@db/core'
import type {
  AddUserPointsInput,
  ConsumeUserPointsInput,
  QueryUserPointRecordPageInput,
} from './point.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, gte, sql } from 'drizzle-orm'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonLabel,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserPointRuleService } from './point-rule.service'

interface LedgerRecordShape {
  id: number
  userId: number
  ruleId: number | null
  targetType: number | null
  targetId: number | null
  delta: number
  beforeValue: number
  afterValue: number
  createdAt: Date
  updatedAt?: Date
  remark: string | null
}

/**
 * 积分服务类
 * 对外保留原有方法签名，内部统一切换到 GrowthLedger 写入。
 */
@Injectable()
export class UserPointService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly pointRuleService: UserPointRuleService,
    private readonly growthLedgerService: GrowthLedgerService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 增加积分
   * @param addPointsDto 增加积分的数据
   * @returns 增加积分的结果
   */
  async addPoints(
    addPointsDto: AddUserPointsInput & { bizKey?: string, source?: string },
  ) {
    const { userId, ruleType, remark } = addPointsDto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const rule = await this.pointRuleService.getEnabledRuleByType(ruleType)
    if (!rule) {
      throw new BadRequestException('积分规则不存在')
    }
    if (rule.points <= 0) {
      throw new BadRequestException('积分规则配置错误')
    }

    const bizKey =
      addPointsDto.bizKey
      ?? this.buildStableBizKey('point:rule', {
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
        remark,
      })

      if (!result.success && !result.duplicated) {
        throw new BadRequestException(
          result.reason
            ? GrowthLedgerFailReasonLabel[result.reason]
            : '积分发放失败',
        )
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new BadRequestException('积分发放失败')
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
    consumePointsDto: ConsumeUserPointsInput & {
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
    consumePointsDto: ConsumeUserPointsInput & {
      bizKey?: string
      source?: string
    },
  ) {
    const { userId, points, remark, targetType, targetId, exchangeId } =
      consumePointsDto

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
        throw new BadRequestException(
          result.reason === 'insufficient_balance'
            ? '积分不足'
            : '积分扣减失败',
        )
      }

      const recordId = result.recordId
      if (!recordId) {
        throw new BadRequestException('积分扣减失败')
      }

      await this.findLedgerRecordById(trx, recordId)
      return true
    }

    return applyConsume(tx)
  }

  /**
   * 分页查询积分记录列表
   * @param dto 查询条件
   * @returns 分页的记录列表
   */
  async getPointRecordPage(dto: QueryUserPointRecordPageInput) {
    const page = await this.drizzle.ext.findPagination(this.growthLedgerRecord, {
      where: this.drizzle.buildWhere(this.growthLedgerRecord, {
        and: {
          userId: dto.userId,
          ruleId: dto.ruleId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          assetType: GrowthAssetTypeEnum.POINTS,
        },
      }),
      ...dto,
      orderBy: dto.orderBy ?? JSON.stringify([{ id: 'desc' }]),
    })

    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        userId: item.userId,
        ruleId: item.ruleId ?? undefined,
        targetType: item.targetType ?? undefined,
        targetId: item.targetId ?? undefined,
        points: item.delta,
        beforePoints: item.beforeValue,
        afterPoints: item.afterValue,
        remark: item.remark ?? undefined,
        createdAt: item.createdAt,
      })),
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
      throw new BadRequestException('积分记录不存在')
    }

    return {
      id: record.id,
      userId: record.userId,
      ruleId: record.ruleId ?? undefined,
      targetType: record.targetType ?? undefined,
      targetId: record.targetId ?? undefined,
      points: record.delta,
      beforePoints: record.beforeValue,
      afterPoints: record.afterValue,
      remark: record.remark ?? undefined,
      createdAt: record.createdAt,
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
      columns: { id: true, points: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

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
      currentPoints: user.points,
      todayEarned: Number(todayStats?.earned ?? 0),
      todayConsumed: Number(todayStats?.consumed ?? 0),
    }
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
        throw new BadRequestException(
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
      throw new BadRequestException('积分记录不存在')
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

  private buildStableBizKey(
    prefix: string,
    payload: Record<string, unknown>,
  ) {
    const serializedPayload = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .sort()
      .join('|')
    return `${prefix}:${serializedPayload}`
  }
}
