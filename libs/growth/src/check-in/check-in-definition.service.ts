import type { Db } from '@db/core'
import type {
  CreateCheckInActivityStreakDto,
  PublishCheckInDailyStreakConfigDto,
  QueryCheckInActivityStreakPageDto,
  QueryCheckInDailyStreakConfigHistoryPageDto,
  UpdateCheckInActivityStreakDto,
  UpdateCheckInActivityStreakStatusDto,
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
  CheckInDailyStreakConfigStatusEnum,
  CheckInDailyStreakPublishStrategyEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

const CHECK_IN_DAILY_STREAK_MUTATION_LOCK_KEY = 1_048_102

/**
 * 签到定义服务。
 *
 * 负责全局签到配置、日常连续签到配置版本，以及活动连续签到定义的后台维护。
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

  async getDailyStreakConfigDetail() {
    const current =
      (await this.getCurrentDailyStreakConfig()) ??
      (await this.findLatestDailyStreakConfig())
    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '日常连续签到配置不存在',
      )
    }
    return this.toDailyStreakConfigDetail(current)
  }

  async getDailyStreakConfigHistoryPage(
    query: QueryCheckInDailyStreakConfigHistoryPageDto,
  ) {
    const page = await this.drizzle.ext.findPagination(
      this.checkInDailyStreakConfigTable,
      {
        ...query,
        orderBy:
          query.orderBy?.trim() ||
          JSON.stringify([{ effectiveFrom: 'desc' }, { id: 'desc' }]),
      },
    )

    return {
      ...page,
      list: page.list.map((item) => this.toDailyStreakConfigDetail(item)),
    }
  }

  async getDailyStreakConfigHistoryDetail(query: { id: number }) {
    const config = await this.db.query.checkInDailyStreakConfig.findFirst({
      where: { id: query.id },
    })
    if (!config) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '日常连续签到配置不存在',
      )
    }
    return this.toDailyStreakConfigDetail(config)
  }

  async publishDailyStreakConfig(
    dto: PublishCheckInDailyStreakConfigDto,
    adminUserId: number,
  ) {
    const rewardRules = this.normalizeStreakRewardRules(dto.rewardRules)
    const effectiveFrom = this.resolveDailyPublishEffectiveFrom(
      dto.publishStrategy,
      dto.effectiveFrom,
    )

    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_DAILY_STREAK_MUTATION_LOCK_KEY})`,
      )

      const now = new Date()
      const latest = await this.findLatestDailyStreakConfig(tx)
      const configs = (await this.listDailyStreakConfigs(tx)).filter(
        (config) =>
          config.status !== CheckInDailyStreakConfigStatusEnum.DRAFT &&
          config.status !== CheckInDailyStreakConfigStatusEnum.TERMINATED,
      )

      for (const config of configs.filter(
        (item) =>
          item.effectiveFrom < effectiveFrom &&
          (item.effectiveTo === null || item.effectiveTo > effectiveFrom),
      )) {
        await tx
          .update(this.checkInDailyStreakConfigTable)
          .set({
            effectiveTo: effectiveFrom,
            status: this.resolveDailyStreakConfigStatus(
              {
                status: config.status,
                effectiveFrom: config.effectiveFrom,
                effectiveTo: effectiveFrom,
              },
              now,
            ),
            updatedById: adminUserId,
          })
          .where(eq(this.checkInDailyStreakConfigTable.id, config.id))
      }

      for (const config of configs.filter(
        (item) => item.effectiveFrom >= effectiveFrom,
      )) {
        await tx
          .update(this.checkInDailyStreakConfigTable)
          .set({
            status: CheckInDailyStreakConfigStatusEnum.TERMINATED,
            updatedById: adminUserId,
          })
          .where(eq(this.checkInDailyStreakConfigTable.id, config.id))
      }

      await tx.insert(this.checkInDailyStreakConfigTable).values({
        version: (latest?.version ?? 0) + 1,
        status: this.resolveDailyStreakConfigStatus(
          {
            status:
              effectiveFrom > now
                ? CheckInDailyStreakConfigStatusEnum.SCHEDULED
                : CheckInDailyStreakConfigStatusEnum.ACTIVE,
            effectiveFrom,
            effectiveTo: null,
          },
          now,
        ),
        publishStrategy: dto.publishStrategy,
        rewardRules,
        effectiveFrom,
        effectiveTo: null,
        updatedById: adminUserId,
      })
    })

    return true
  }

  async terminateDailyStreakConfig(query: { id: number }, adminUserId: number) {
    await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${CHECK_IN_DAILY_STREAK_MUTATION_LOCK_KEY})`,
      )

      const current = await tx.query.checkInDailyStreakConfig.findFirst({
        where: { id: query.id },
      })
      if (!current) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '日常连续签到配置不存在',
        )
      }

      const now = new Date()
      const status = this.resolveDailyStreakConfigStatus(current, now)
      if (status !== CheckInDailyStreakConfigStatusEnum.SCHEDULED) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '仅支持终止未生效的日常连续签到配置',
        )
      }

      const candidates = (await this.listDailyStreakConfigs(tx)).filter(
        (config) =>
          config.id !== current.id &&
          config.status !== CheckInDailyStreakConfigStatusEnum.DRAFT &&
          config.status !== CheckInDailyStreakConfigStatusEnum.TERMINATED,
      )
      const predecessor = candidates.find(
        (config) => config.effectiveFrom < current.effectiveFrom,
      )
      if (!predecessor) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '终止后将不存在可用的日常连续签到配置',
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
        .update(this.checkInDailyStreakConfigTable)
        .set({
          status: CheckInDailyStreakConfigStatusEnum.TERMINATED,
          updatedById: adminUserId,
        })
        .where(eq(this.checkInDailyStreakConfigTable.id, current.id))

      const bridgedEffectiveTo = successor?.effectiveFrom ?? null
      await tx
        .update(this.checkInDailyStreakConfigTable)
        .set({
          effectiveTo: bridgedEffectiveTo,
          status: this.resolveDailyStreakConfigStatus(
            {
              status: predecessor.status,
              effectiveFrom: predecessor.effectiveFrom,
              effectiveTo: bridgedEffectiveTo,
            },
            now,
          ),
          updatedById: adminUserId,
        })
        .where(eq(this.checkInDailyStreakConfigTable.id, predecessor.id))
    })
    return true
  }

  async getActivityStreakPage(query: QueryCheckInActivityStreakPageDto) {
    return this.drizzle.ext.findPagination(this.checkInActivityStreakTable, {
      ...query,
      orderBy:
        query.orderBy?.trim() ||
        JSON.stringify([{ effectiveFrom: 'desc' }, { id: 'desc' }]),
    })
  }

  async getActivityStreakDetail(query: { id: number }) {
    const activity = await this.db.query.checkInActivityStreak.findFirst({
      where: { id: query.id },
    })
    if (!activity) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '活动连续签到不存在',
      )
    }
    return this.toActivityStreakDetail(activity)
  }

  async createActivityStreak(
    dto: CreateCheckInActivityStreakDto,
    adminUserId: number,
  ) {
    const rewardRules = this.normalizeStreakRewardRules(dto.rewardRules)
    await this.db.insert(this.checkInActivityStreakTable).values({
      activityKey: dto.activityKey.trim(),
      title: dto.title.trim(),
      status: dto.status,
      effectiveFrom: this.parseDateTime(dto.effectiveFrom, '活动开始时间'),
      effectiveTo: this.parseDateTime(dto.effectiveTo, '活动结束时间'),
      rewardRules,
      updatedById: adminUserId,
    })
    return true
  }

  async updateActivityStreak(
    dto: UpdateCheckInActivityStreakDto,
    adminUserId: number,
  ) {
    const rewardRules = this.normalizeStreakRewardRules(dto.rewardRules)
    await this.db
      .update(this.checkInActivityStreakTable)
      .set({
        activityKey: dto.activityKey.trim(),
        title: dto.title.trim(),
        status: dto.status,
        effectiveFrom: this.parseDateTime(dto.effectiveFrom, '活动开始时间'),
        effectiveTo: this.parseDateTime(dto.effectiveTo, '活动结束时间'),
        rewardRules,
        updatedById: adminUserId,
      })
      .where(eq(this.checkInActivityStreakTable.id, dto.id))
    return true
  }

  async updateActivityStreakStatus(
    dto: UpdateCheckInActivityStreakStatusDto,
    adminUserId: number,
  ) {
    await this.db
      .update(this.checkInActivityStreakTable)
      .set({
        status: dto.status,
        updatedById: adminUserId,
      })
      .where(eq(this.checkInActivityStreakTable.id, dto.id))
    return true
  }

  async deleteActivityStreak(query: { id: number }) {
    const activity = await this.db.query.checkInActivityStreak.findFirst({
      where: { id: query.id },
      columns: { id: true },
    })
    if (!activity) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '活动连续签到不存在',
      )
    }

    const [progress, grant] = await Promise.all([
      this.db.query.checkInActivityStreakProgress.findFirst({
        where: { activityId: query.id },
        columns: { id: true },
      }),
      this.db.query.checkInStreakGrant.findFirst({
        where: { activityId: query.id },
        columns: { id: true },
      }),
    ])
    if (progress || grant) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '活动连续签到已产生进度或奖励发放事实，不允许删除',
      )
    }

    await this.db
      .delete(this.checkInActivityStreakTable)
      .where(eq(this.checkInActivityStreakTable.id, query.id))
    return true
  }

  private async findLatestDailyStreakConfig(db: Db = this.db) {
    const [config] = await db
      .select()
      .from(this.checkInDailyStreakConfigTable)
      .orderBy(
        desc(this.checkInDailyStreakConfigTable.version),
        desc(this.checkInDailyStreakConfigTable.id),
      )
      .limit(1)
    return config
  }

  private resolveDailyPublishEffectiveFrom(
    strategy: CheckInDailyStreakPublishStrategyEnum,
    effectiveFrom?: string,
  ) {
    if (strategy === CheckInDailyStreakPublishStrategyEnum.IMMEDIATE) {
      return new Date()
    }
    if (strategy === CheckInDailyStreakPublishStrategyEnum.NEXT_DAY) {
      return new Date(
        dayjs
          .tz(new Date(), this.getAppTimeZone())
          .add(1, 'day')
          .startOf('day')
          .toISOString(),
      )
    }
    if (strategy === CheckInDailyStreakPublishStrategyEnum.SCHEDULED_AT) {
      if (!effectiveFrom) {
        throw new BadRequestException('指定时间生效策略必须传 effectiveFrom')
      }
      const scheduledAt = this.parseDateTime(effectiveFrom, '生效开始时间')
      if (scheduledAt <= new Date()) {
        throw new BadRequestException('指定时间生效必须晚于当前时间')
      }
      return scheduledAt
    }
    throw new BadRequestException('不支持的日常连续签到发布策略')
  }

  private parseDateTime(value: string, fieldLabel: string) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldLabel}非法`)
    }
    return parsed
  }

  private toDailyStreakConfigDetail(
    config: typeof this.checkInDailyStreakConfigTable.$inferSelect,
  ) {
    const definition = this.parseDailyStreakConfigDefinition(config)
    const now = new Date()
    const status = this.resolveDailyStreakConfigStatus(config, now)

    return {
      id: config.id,
      version: definition.version,
      status,
      publishStrategy: definition.publishStrategy,
      isCurrent: status === CheckInDailyStreakConfigStatusEnum.ACTIVE,
      effectiveFrom: definition.effectiveFrom,
      effectiveTo: definition.effectiveTo,
      rewardRules: definition.rewardRules,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  private toActivityStreakDetail(
    activity: typeof this.checkInActivityStreakTable.$inferSelect,
  ) {
    const definition = this.parseActivityStreakDefinition(activity)
    return {
      id: activity.id,
      activityKey: definition.activityKey,
      title: definition.title,
      status: definition.status,
      effectiveFrom: definition.effectiveFrom,
      effectiveTo: definition.effectiveTo,
      rewardRules: definition.rewardRules,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
    }
  }
}
