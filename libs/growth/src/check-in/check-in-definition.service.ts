import type { Db } from '@db/core'
import type {
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
  UpdateCheckInStreakRoundDto,
} from './dto/check-in-definition.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'
import {
  CheckInStreakNextRoundStrategyEnum,
  CheckInStreakRoundStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_ROUND_MUTATION_LOCK_KEY = 1_048_102

/**
 * 签到定义服务。
 *
 * 负责全局签到配置和连续奖励轮次配置的后台维护。
 */
@Injectable()
export class CheckInDefinitionService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  async getConfigDetail() {
    const config = await this.getRequiredConfig()
    const rewardDefinition = this.parseRewardDefinition(config)

    return {
      id: config.id,
      enabled: config.enabled === 1,
      makeupPeriodType: config.makeupPeriodType,
      periodicAllowance: config.periodicAllowance,
      baseRewardItems: rewardDefinition.baseRewardItems,
      dateRewardRules: rewardDefinition.dateRewardRules,
      patternRewardRules: rewardDefinition.patternRewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  async updateConfig(dto: UpdateCheckInConfigDto, adminUserId: number) {
    const rewardDefinition = {
      baseRewardItems: this.parseRewardItems(dto.baseRewardItems, {
        allowEmpty: true,
      }),
      dateRewardRules: this.normalizeDateRewardRules(dto.dateRewardRules),
      patternRewardRules: this.normalizePatternRewardRules(
        dto.patternRewardRules,
        dto.makeupPeriodType,
      ),
    }

    await this.drizzle.withTransaction(async (tx) => {
      const current = await this.getCurrentConfig(tx)
      if (!current) {
        await tx.insert(this.checkInConfigTable).values({
          enabled: dto.enabled ? 1 : 0,
          makeupPeriodType: dto.makeupPeriodType,
          periodicAllowance: dto.periodicAllowance,
          baseRewardItems: rewardDefinition.baseRewardItems,
          dateRewardRules: rewardDefinition.dateRewardRules,
          patternRewardRules: rewardDefinition.patternRewardRules,
          updatedById: adminUserId,
        })
        return
      }

      await tx
        .update(this.checkInConfigTable)
        .set({
          enabled: dto.enabled ? 1 : 0,
          makeupPeriodType: dto.makeupPeriodType,
          periodicAllowance: dto.periodicAllowance,
          baseRewardItems: rewardDefinition.baseRewardItems,
          dateRewardRules: rewardDefinition.dateRewardRules,
          patternRewardRules: rewardDefinition.patternRewardRules,
          updatedById: adminUserId,
        })
        .where(eq(this.checkInConfigTable.id, current.id))
    })

    return true
  }

  async updateEnabled(dto: UpdateCheckInEnabledDto, adminUserId: number) {
    const current = await this.getRequiredConfig()
    await this.db
      .update(this.checkInConfigTable)
      .set({
        enabled: dto.enabled ? 1 : 0,
        updatedById: adminUserId,
      })
      .where(eq(this.checkInConfigTable.id, current.id))
    return true
  }

  async getRoundDetail() {
    const round = await this.getRequiredActiveRound()
    const definition = this.parseStreakRoundDefinition(round)

    return {
      id: round.id,
      roundCode: definition.roundCode,
      version: definition.version,
      status: definition.status,
      nextRoundStrategy: definition.nextRoundStrategy,
      nextRoundConfigId: definition.nextRoundConfigId,
      rewardRules: definition.rewardRules,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
    }
  }

  async updateRound(dto: UpdateCheckInStreakRoundDto, adminUserId: number) {
    if (dto.status !== CheckInStreakRoundStatusEnum.ACTIVE) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前接口只允许提交启用中的连续奖励轮次',
      )
    }

    const rewardRules = this.normalizeStreakRewardRules(dto.rewardRules)
    if (
      dto.nextRoundStrategy === CheckInStreakNextRoundStrategyEnum.INHERIT &&
      dto.nextRoundConfigId != null
    ) {
      throw new BadRequestException(
        '沿用当前轮策略不允许传入 nextRoundConfigId',
      )
    }
    if (
      dto.nextRoundStrategy ===
      CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前启用接口不支持提交显式下一轮策略',
      )
    }

    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_ROUND_MUTATION_LOCK_KEY})`,
      )
      const currentActive = await this.getActiveRound(tx)
      if (currentActive) {
        await tx
          .update(this.checkInStreakRoundConfigTable)
          .set({
            status: CheckInStreakRoundStatusEnum.ARCHIVED,
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakRoundConfigTable.id, currentActive.id))
      }

      const latestWithSameCode = await this.findLatestRoundByCode(
        dto.roundCode,
        tx,
      )
      const [createdRound] = await tx
        .insert(this.checkInStreakRoundConfigTable)
        .values({
          roundCode: dto.roundCode.trim(),
          version: (latestWithSameCode?.version ?? 0) + 1,
          status: dto.status,
          rewardRules,
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.INHERIT,
          nextRoundConfigId: null,
          updatedById: adminUserId,
        })
        .returning()

      if (!createdRound) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '连续奖励轮次创建冲突，请稍后重试',
        )
      }

      if (!currentActive) {
        return
      }

      if (currentActive.id === createdRound.id) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '连续奖励轮次接续配置非法',
        )
      }

      await tx
        .update(this.checkInStreakRoundConfigTable)
        .set({
          nextRoundStrategy: CheckInStreakNextRoundStrategyEnum.EXPLICIT_NEXT,
          nextRoundConfigId: createdRound.id,
          updatedById: adminUserId,
        })
        .where(eq(this.checkInStreakRoundConfigTable.id, currentActive.id))
    })

    return true
  }

  private async findLatestRoundByCode(roundCode: string, db: Db = this.db) {
    const [round] = await db
      .select()
      .from(this.checkInStreakRoundConfigTable)
      .where(eq(this.checkInStreakRoundConfigTable.roundCode, roundCode.trim()))
      .orderBy(desc(this.checkInStreakRoundConfigTable.version))
      .limit(1)
    return round
  }
}
