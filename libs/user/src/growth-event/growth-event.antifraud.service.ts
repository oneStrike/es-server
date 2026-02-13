import type {
  GrowthAntifraudConfigDto,
  GrowthAntifraudEventOverrideDto,
  GrowthAntifraudLimitDto,
} from '@libs/system-config'
import { BaseService, Prisma } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import {
  UserGrowthAntifraudDecision,
  UserGrowthEventStatus,
} from './growth-event.types'

/**
 * 成长事件反作弊服务类
 * 基于配置对事件进行限流与风控判定
 */
@Injectable()
export class UserGrowthEventAntifraudService extends BaseService {
  private readonly configCacheTtlMs = 60000
  private configCache: { value: GrowthAntifraudConfigDto | null, expiresAt: number } | null = null

  /**
   * 获取成长事件模型
   */
  get userGrowthEvent() {
    return this.prisma.userGrowthEvent
  }

  /**
   * 执行反作弊校验
   * @param event 成长事件
   * @param options 校验参数
   * @param options.cooldownSeconds 事件冷却秒数
   * @param options.points 积分增量
   * @param options.experience 经验增量
   * @returns 反作弊判定结果
   */
  async check(
    event: UserGrowthEventDto,
    options: {
      cooldownSeconds: number
      points: number
      experience: number
    },
  ): Promise<UserGrowthAntifraudDecision> {
    const config = await this.getConfig()
    if (config?.enabled === false) {
      return { allow: true }
    }

    const override = this.matchOverride(config?.overrides, event)
    const thresholds = {
      pointsThreshold:
        override?.pointsThreshold ?? config?.pointsThreshold ?? undefined,
      experienceThreshold:
        override?.experienceThreshold ?? config?.experienceThreshold ?? undefined,
    }
    const isHighValue = this.isHighValue(thresholds, options)

    const userLimit = this.resolveLimit(
      config,
      override,
      isHighValue,
      'user',
      options.cooldownSeconds,
    )
    const ipLimit = this.resolveLimit(config, override, isHighValue, 'ip')
    const deviceLimit = this.resolveLimit(config, override, isHighValue, 'device')

    const userDecision = await this.checkDimension(
      'user',
      event.userId,
      event,
      userLimit,
    )
    if (!userDecision.allow) {
      return userDecision
    }

    const ipDecision = await this.checkDimension(
      'ip',
      event.ip,
      event,
      ipLimit,
    )
    if (!ipDecision.allow) {
      return ipDecision
    }

    const deviceDecision = await this.checkDimension(
      'device',
      event.deviceId,
      event,
      deviceLimit,
    )
    if (!deviceDecision.allow) {
      return deviceDecision
    }

    return { allow: true }
  }

  /**
   * 获取反作弊配置
   * @returns 反作弊配置
   */
  private async getConfig(): Promise<GrowthAntifraudConfigDto | null> {
    const now = Date.now()
    if (this.configCache && this.configCache.expiresAt > now) {
      return this.configCache.value
    }
    const record = await (this.prisma as any).systemConfig.findUnique({
      where: { id: 1 },
    })
    const value = (record)?.growthAntifraudConfig ?? null
    this.configCache = {
      value,
      expiresAt: now + this.configCacheTtlMs,
    }
    return value
  }

  /**
   * 匹配事件级别的覆盖配置
   * @param overrides 覆盖配置列表
   * @param event 成长事件
   * @returns 匹配的覆盖配置
   */
  private matchOverride(
    overrides: GrowthAntifraudEventOverrideDto[] | undefined,
    event: UserGrowthEventDto,
  ) {
    return overrides?.find(
      (item) => item.business === event.business && item.eventKey === event.eventKey,
    )
  }

  /**
   * 判断是否为高价值事件
   * @param thresholds 阈值配置
   * @param thresholds.pointsThreshold 积分阈值
   * @param thresholds.experienceThreshold 经验阈值
   * @param options 事件增量
   * @param options.points 积分增量
   * @param options.experience 经验增量
   * @returns 是否高价值
   */
  private isHighValue(
    thresholds: { pointsThreshold?: number, experienceThreshold?: number },
    options: { points: number, experience: number },
  ) {
    const pointsHit =
      thresholds.pointsThreshold !== undefined &&
      thresholds.pointsThreshold > 0 &&
      options.points >= thresholds.pointsThreshold
    const experienceHit =
      thresholds.experienceThreshold !== undefined &&
      thresholds.experienceThreshold > 0 &&
      options.experience >= thresholds.experienceThreshold
    return pointsHit || experienceHit
  }

  /**
   * 解析某维度的限流策略
   * @param config 全局配置
   * @param override 覆盖配置
   * @param isHighValue 是否高价值事件
   * @param dimension 维度
   * @param fallbackCooldown 事件冷却秒数
   * @returns 限流参数
   */
  private resolveLimit(
    config: GrowthAntifraudConfigDto | null,
    override: GrowthAntifraudEventOverrideDto | undefined,
    isHighValue: boolean,
    dimension: 'user' | 'ip' | 'device',
    fallbackCooldown?: number,
  ) {
    const baseLimit = this.mergeLimit(
      config?.[dimension],
      override?.[dimension],
      fallbackCooldown,
    )
    if (!isHighValue) {
      return baseLimit
    }

    // 高价值事件优先合并高价值限流配置
    const highValueLimit = this.mergeLimit(
      config?.[`highValue${this.capitalize(dimension)}` as keyof GrowthAntifraudConfigDto] as
      | GrowthAntifraudLimitDto
      | undefined,
      override?.[
        `highValue${this.capitalize(dimension)}` as keyof GrowthAntifraudEventOverrideDto
      ] as GrowthAntifraudLimitDto | undefined,
      fallbackCooldown,
    )

    if (highValueLimit) {
      // 高价值配置覆盖并叠加基础限流
      return this.mergeLimit(baseLimit, highValueLimit, fallbackCooldown)
    }

    return baseLimit
  }

  private mergeLimit(
    base?: GrowthAntifraudLimitDto,
    override?: GrowthAntifraudLimitDto,
    fallbackCooldown?: number,
  ) {
    // 基于覆盖配置合并字段，后者优先
    const merged: GrowthAntifraudLimitDto = {
      ...(base ?? {}),
      ...(override ?? {}),
    }

    if (
      merged.cooldownSeconds === undefined &&
      fallbackCooldown !== undefined
    ) {
      merged.cooldownSeconds = fallbackCooldown
    }

    // 未设置任何限流条件则返回 undefined，视为不限制
    if (
      merged.cooldownSeconds === undefined &&
      merged.dailyLimit === undefined &&
      merged.totalLimit === undefined
    ) {
      return undefined
    }

    return merged
  }

  private capitalize(value: string) {
    if (!value) {
      return value
    }
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  private async checkDimension(
    dimension: 'user' | 'ip' | 'device',
    value: number | string | undefined,
    event: UserGrowthEventDto,
    limit?: GrowthAntifraudLimitDto,
  ): Promise<UserGrowthAntifraudDecision> {
    if (!value || !limit) {
      return { allow: true }
    }

    // 仅统计待处理/已处理事件，排除失败与忽略
    const baseWhere: Prisma.UserGrowthEventWhereInput = {
      business: event.business,
      eventKey: event.eventKey,
      status: {
        in: [
          UserGrowthEventStatus.PENDING,
          UserGrowthEventStatus.PROCESSED,
        ],
      },
      occurredAt: {
        lt: event.occurredAt,
      },
    }

    // 按维度构建筛选条件
    const dimensionWhere =
      dimension === 'user'
        ? { userId: value as number }
        : dimension === 'ip'
          ? { ip: value as string }
          : { deviceId: value as string }

    // 冷却时间限制：窗口内出现过则拒绝
    if (limit.cooldownSeconds && limit.cooldownSeconds > 0) {
      const since = new Date(
        event.occurredAt.getTime() - limit.cooldownSeconds * 1000,
      )
      const hit = await this.userGrowthEvent.findFirst({
        where: {
          ...baseWhere,
          ...dimensionWhere,
          occurredAt: {
            gte: since,
            lt: event.occurredAt,
          },
        },
        orderBy: {
          occurredAt: 'desc',
        },
      })

      if (hit) {
        return { allow: false, reason: `${dimension.toUpperCase()}_COOLDOWN` }
      }
    }

    // 当日次数限制
    if (limit.dailyLimit && limit.dailyLimit > 0) {
      const startOfDay = this.getStartOfDay(event.occurredAt)
      const dailyCount = await this.userGrowthEvent.count({
        where: {
          ...baseWhere,
          ...dimensionWhere,
          occurredAt: {
            gte: startOfDay,
            lt: event.occurredAt,
          },
        },
      })
      if (dailyCount >= limit.dailyLimit) {
        return { allow: false, reason: `${dimension.toUpperCase()}_DAILY_LIMIT` }
      }
    }

    // 累计次数限制
    if (limit.totalLimit && limit.totalLimit > 0) {
      const totalCount = await this.userGrowthEvent.count({
        where: {
          ...baseWhere,
          ...dimensionWhere,
        },
      })
      if (totalCount >= limit.totalLimit) {
        return { allow: false, reason: `${dimension.toUpperCase()}_TOTAL_LIMIT` }
      }
    }

    return { allow: true }
  }

  private getStartOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
}
