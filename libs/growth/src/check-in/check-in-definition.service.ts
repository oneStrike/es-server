import type {
  PublishCheckInStreakConfigDto,
  QueryCheckInStreakConfigHistoryPageDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
} from './dto/check-in-definition.dto'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { desc, eq, sql } from 'drizzle-orm'
import {
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_STREAK_MUTATION_LOCK_KEY = 1_048_102

/**
 * 签到定义管理服务。
 *
 * 负责全局签到配置与统一连续签到配置的后台写入、历史查询与终止操作。
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
    const normalized = {
      enabled: dto.enabled ? 1 : 0,
      makeupPeriodType: dto.makeupPeriodType,
      periodicAllowance: dto.periodicAllowance,
      baseRewardItems: this.parseRewardItems(dto.baseRewardItems, {
        allowEmpty: true,
      }),
      dateRewardRules: this.normalizeDateRewardRules(dto.dateRewardRules),
      patternRewardRules: this.normalizePatternRewardRules(
        dto.patternRewardRules,
        dto.makeupPeriodType,
      ),
      updatedById: adminUserId,
    }

    const current = await this.getCurrentConfig()
    if (!current) {
      await this.db.insert(this.checkInConfigTable).values(normalized)
      return true
    }

    await this.db
      .update(this.checkInConfigTable)
      .set(normalized)
      .where(eq(this.checkInConfigTable.id, current.id))

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

  async getStreakConfigDetail() {
    const now = new Date()
    const current =
      (await this.getCurrentStreakConfig(now)) ??
      (await this.findLatestStreakConfig())
    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '连续签到配置不存在',
      )
    }
    return this.buildStreakConfigDetailView(current, now)
  }

  async getStreakConfigHistoryPage(query: QueryCheckInStreakConfigHistoryPageDto) {
    const page = await this.drizzle.ext.findPagination(this.checkInStreakConfigTable, {
      ...query,
      orderBy:
        query.orderBy?.trim() ||
        JSON.stringify([{ effectiveFrom: 'desc' }, { id: 'desc' }]),
    })

    return {
      ...page,
      list: await Promise.all(
        page.list.map(async (config) => this.buildStreakConfigDetailView(config)),
      ),
    }
  }

  async getStreakConfigHistoryDetail(query: { id: number }) {
    const config = await this.db.query.checkInStreakConfig.findFirst({
      where: { id: query.id },
    })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '连续签到配置不存在',
      )
    }
    return this.buildStreakConfigDetailView(config)
  }

  async publishStreakConfig(
    dto: PublishCheckInStreakConfigDto,
    adminUserId: number,
  ) {
    const rewardRules = this.normalizeStreakRewardRules(dto.rewardRules)
    const now = new Date()
    const effectiveFrom = this.resolvePublishEffectiveFrom(dto, now)

    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_STREAK_MUTATION_LOCK_KEY})`,
      )

      const latest = await this.findLatestStreakConfig(tx)
      const existing = await this.listStreakConfigs(tx)

      for (const config of existing.filter(
        (item) =>
          item.status !== CheckInStreakConfigStatusEnum.DRAFT &&
          item.status !== CheckInStreakConfigStatusEnum.TERMINATED &&
          item.effectiveFrom < effectiveFrom &&
          (item.effectiveTo === null || item.effectiveTo > effectiveFrom),
      )) {
        await tx
          .update(this.checkInStreakConfigTable)
          .set({
            effectiveTo: effectiveFrom,
            status: this.resolveStreakConfigStatus(
              {
                status: config.status,
                effectiveFrom: config.effectiveFrom,
                effectiveTo: effectiveFrom,
              },
              now,
            ),
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakConfigTable.id, config.id))
      }

      for (const config of existing.filter(
        (item) =>
          item.status !== CheckInStreakConfigStatusEnum.DRAFT &&
          item.status !== CheckInStreakConfigStatusEnum.TERMINATED &&
          item.effectiveFrom >= effectiveFrom,
      )) {
        await tx
          .update(this.checkInStreakConfigTable)
          .set({
            status: CheckInStreakConfigStatusEnum.TERMINATED,
            updatedById: adminUserId,
          })
          .where(eq(this.checkInStreakConfigTable.id, config.id))
      }

      const [config] = await tx
        .insert(this.checkInStreakConfigTable)
        .values({
          version: (latest?.version ?? 0) + 1,
          status: this.resolvePublishedConfigStatus(effectiveFrom),
          publishStrategy: dto.publishStrategy,
          effectiveFrom,
          effectiveTo: null,
          updatedById: adminUserId,
        })
        .returning({ id: this.checkInStreakConfigTable.id })

      const insertedRules = await tx
        .insert(this.checkInStreakRuleTable)
        .values(
          rewardRules.map((rule, sortOrder) => ({
            configId: config.id,
            ruleCode: rule.ruleCode,
            streakDays: rule.streakDays,
            repeatable: rule.repeatable,
            status: rule.status,
            sortOrder,
          })),
        )
        .returning({ id: this.checkInStreakRuleTable.id })

      const rewardItemRows = rewardRules.flatMap((rule, ruleIndex) =>
        rule.rewardItems.map((item, sortOrder) => ({
          ruleId: insertedRules[ruleIndex].id,
          assetType: item.assetType,
          assetKey: item.assetKey,
          amount: item.amount,
          sortOrder,
        })),
      )

      if (rewardItemRows.length > 0) {
        await tx.insert(this.checkInStreakRuleRewardItemTable).values(rewardItemRows)
      }
    })

    return true
  }

  async terminateStreakConfig(query: { id: number }, adminUserId: number) {
    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_STREAK_MUTATION_LOCK_KEY})`,
      )

      const current = await tx.query.checkInStreakConfig.findFirst({
        where: { id: query.id },
      })
      if (!current) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '连续签到配置不存在',
        )
      }

      const now = new Date()
      const status = this.resolveStreakConfigStatus(current, now)
      if (status !== CheckInStreakConfigStatusEnum.SCHEDULED) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '仅支持终止未生效的连续签到配置',
        )
      }

      const candidates = (await this.listStreakConfigs(tx)).filter(
        (config) =>
          config.id !== current.id &&
          config.status !== CheckInStreakConfigStatusEnum.DRAFT &&
          config.status !== CheckInStreakConfigStatusEnum.TERMINATED,
      )
      const predecessor = candidates.find(
        (config) => config.effectiveFrom < current.effectiveFrom,
      )
      if (!predecessor) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '终止后将不存在可用的连续签到配置',
        )
      }

      const successor = [...candidates]
        .filter((config) => config.effectiveFrom > current.effectiveFrom)
        .sort((left, right) => {
          const timeDiff =
            left.effectiveFrom.getTime() - right.effectiveFrom.getTime()
          return timeDiff !== 0 ? timeDiff : left.id - right.id
        })[0]

      await tx
        .update(this.checkInStreakConfigTable)
        .set({
          status: CheckInStreakConfigStatusEnum.TERMINATED,
          effectiveTo: now,
          updatedById: adminUserId,
        })
        .where(eq(this.checkInStreakConfigTable.id, current.id))

      const bridgedEffectiveTo = successor?.effectiveFrom ?? null
      await tx
        .update(this.checkInStreakConfigTable)
        .set({
          effectiveTo: bridgedEffectiveTo,
          status: this.resolveStreakConfigStatus(
            {
              status: predecessor.status,
              effectiveFrom: predecessor.effectiveFrom,
              effectiveTo: bridgedEffectiveTo,
            },
            now,
          ),
          updatedById: adminUserId,
        })
        .where(eq(this.checkInStreakConfigTable.id, predecessor.id))
    })

    return true
  }

  protected async findLatestStreakConfig(db = this.db) {
    const [config] = await db
      .select()
      .from(this.checkInStreakConfigTable)
      .orderBy(
        desc(this.checkInStreakConfigTable.version),
        desc(this.checkInStreakConfigTable.id),
      )
      .limit(1)
    return config
  }

  private async buildStreakConfigDetailView(
    config: typeof this.checkInStreakConfigTable.$inferSelect,
    at = new Date(),
  ) {
    const rewardRules = await this.loadStreakRewardRules(config.id)
    const definition = this.parseStreakConfigDefinition({
      ...config,
      rewardRules,
    })
    const status = this.resolveStreakConfigStatus(config, at)

    return {
      id: config.id,
      version: definition.version,
      status,
      publishStrategy: definition.publishStrategy,
      isCurrent: status === CheckInStreakConfigStatusEnum.ACTIVE,
      effectiveFrom: definition.effectiveFrom,
      effectiveTo: definition.effectiveTo,
      rewardRules: definition.rewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  private resolvePublishEffectiveFrom(
    dto: PublishCheckInStreakConfigDto,
    now: Date,
  ) {
    if (dto.publishStrategy === CheckInStreakPublishStrategyEnum.IMMEDIATE) {
      return now
    }

    if (dto.publishStrategy === CheckInStreakPublishStrategyEnum.NEXT_DAY) {
      return dayjs(now)
        .tz(this.getAppTimeZone())
        .add(1, 'day')
        .startOf('day')
        .toDate()
    }

    if (!dto.effectiveFrom) {
      throw new BadRequestException('指定生效时间不能为空')
    }

    const effectiveFrom = new Date(dto.effectiveFrom)
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('指定生效时间非法')
    }
    if (effectiveFrom <= now) {
      throw new BadRequestException('指定生效时间必须晚于当前时间')
    }
    return effectiveFrom
  }

  private resolvePublishedConfigStatus(effectiveFrom: Date) {
    return effectiveFrom > new Date()
      ? CheckInStreakConfigStatusEnum.SCHEDULED
      : CheckInStreakConfigStatusEnum.ACTIVE
  }
}
