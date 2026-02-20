import type { PrismaClientType } from '@libs/base/database/prisma.types'
import { UserStatusEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { UserLevelRuleService } from '../level-rule/level-rule.service'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import { UserGrowthEventAntifraudService } from './growth-event.antifraud.service'
import { UserGrowthEventAuditService } from './growth-event.audit.service'
import { UserGrowthEventStatus } from './growth-event.constant'
import {
  UserGrowthEventApplyResult,
  UserGrowthRuleRef,
} from './growth-event.types'

type GrowthRuleUsageClient = Pick<
  PrismaClientType,
  'userPointRecord' | 'userExperienceRecord'
>

/**
 * 成长事件消费者
 * 负责消费成长事件、执行防刷与规则计算，并写入审计结果
 */
@Injectable()
export class UserGrowthEventConsumer extends BaseService {
  constructor(
    private readonly auditService: UserGrowthEventAuditService,
    private readonly antifraudService: UserGrowthEventAntifraudService,
    private readonly levelRuleService: UserLevelRuleService,
  ) {
    super()
  }

  /**
   * 成长事件入口
   * 使用事件总线触发消费逻辑，避免阻塞业务线程
   */
  @OnEvent('user-growth-event')
  private async consume(event: UserGrowthEventDto) {
    try {
      await this.processEvent(event)
    } catch {
      // 事件消费失败不阻断业务主流程，具体失败原因由审计状态体现
    }
  }

  /**
   * 处理成长事件
   * 关键流程：幂等检查 -> 审计落库 -> 防刷校验 -> 规则匹配与发放 -> 回写审计
   */
  private async processEvent(event: UserGrowthEventDto) {
    // 幂等：同一窗口内重复事件直接标记并退出
    const duplicate = await this.auditService.findDuplicate(event)
    if (duplicate) {
      await this.auditService.createEvent(
        event,
        UserGrowthEventStatus.IGNORED_DUPLICATE,
      )
      return
    }

    // 先写入审计记录，确保后续失败可追踪
    const audit = await this.auditService.createEvent(
      event,
      UserGrowthEventStatus.PENDING,
    )

    try {
      // 规则匹配：按业务域与事件键查询可用规则
      const [pointRules, experienceRules, badgeRules] = await Promise.all([
        this.prisma.userPointRule.findMany({
          where: {
            business: event.business,
            eventKey: event.eventKey,
            isEnabled: true,
          },
        }),
        this.prisma.userExperienceRule.findMany({
          where: {
            business: event.business,
            eventKey: event.eventKey,
            isEnabled: true,
          },
        }),
        this.prisma.userBadge.findMany({
          where: {
            business: event.business,
            eventKey: event.eventKey,
            isEnabled: true,
          },
        }),
      ])

      if (
        pointRules.length === 0 &&
        experienceRules.length === 0 &&
        badgeRules.length === 0
      ) {
        // 无匹配规则时审计标记忽略，避免误处理
        await this.auditService.updateStatus(
          audit.id,
          UserGrowthEventStatus.IGNORED_RULE_NOT_FOUND,
        )
        return
      }

      // 防刷：基于规则的最大值与冷却时间做风控判断
      const cooldownSeconds = this.getCooldownSeconds(
        pointRules,
        experienceRules,
      )
      const pointsValue = this.getMaxDelta(pointRules, 'points')
      const experienceValue = this.getMaxDelta(experienceRules, 'experience')
      const antifraudDecision = await this.antifraudService.check(event, {
        cooldownSeconds,
        points: pointsValue,
        experience: experienceValue,
      })
      if (!antifraudDecision.allow) {
        // 命中防刷时记录审计但不发放奖励
        await this.auditService.updateStatus(
          audit.id,
          UserGrowthEventStatus.REJECTED_ANTIFRAUD,
        )
        return
      }

      // 发放规则：在事务内写入积分/经验/徽章记录并更新用户状态
      const result = await this.applyRules(
        event,
        audit.id,
        pointRules,
        experienceRules,
        badgeRules,
      )

      await this.auditService.updateStatus(
        audit.id,
        UserGrowthEventStatus.PROCESSED,
        {
          ...result,
          ruleRefs: result.ruleRefs as unknown as Prisma.InputJsonValue,
          badgeAssigned: result.badgeAssigned
            ? (JSON.parse(
                JSON.stringify(result.badgeAssigned),
              ) as Prisma.InputJsonValue)
            : undefined,
        },
      )
    } catch {
      // 任一环节异常则标记失败，避免阻塞业务主流程
      await this.auditService.updateStatus(
        audit.id,
        UserGrowthEventStatus.FAILED,
      )
    }
  }

  /**
   * 计算规则冷却秒数（取积分与经验规则的最大冷却）
   */
  private getCooldownSeconds(
    pointRules: { cooldownSeconds: number }[],
    experienceRules: { cooldownSeconds: number }[],
  ) {
    const pointCooldown = Math.max(
      0,
      ...pointRules.map((rule) => rule.cooldownSeconds || 0),
    )
    const experienceCooldown = Math.max(
      0,
      ...experienceRules.map((rule) => rule.cooldownSeconds || 0),
    )
    return Math.max(pointCooldown, experienceCooldown)
  }

  /**
   * 获取规则的最大增量值
   * 用于防刷判断的价值评估
   */
  private getMaxDelta<T extends { points?: number, experience?: number }>(
    rules: T[],
    key: 'points' | 'experience',
  ) {
    return Math.max(0, ...rules.map((rule) => rule[key] ?? 0))
  }

  private async getRuleUsageStats(
    tx: GrowthRuleUsageClient,
    model: 'point' | 'experience',
    ruleIds: number[],
    userId: number,
    startOfDay: Date,
  ) {
    if (ruleIds.length === 0) {
      return {
        daily: new Map<number, number>(),
        total: new Map<number, number>(),
        last: new Map<number, Date>(),
      }
    }
    const [dailyCounts, totalCounts, latestRecords] =
      model === 'point'
        ? await Promise.all([
            tx.userPointRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
                createdAt: { gte: startOfDay },
              },
              _count: { _all: true },
            }),
            tx.userPointRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
              },
              _count: { _all: true },
            }),
            tx.userPointRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
              },
              _max: { createdAt: true },
            }),
          ])
        : await Promise.all([
            tx.userExperienceRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
                createdAt: { gte: startOfDay },
              },
              _count: { _all: true },
            }),
            tx.userExperienceRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
              },
              _count: { _all: true },
            }),
            tx.userExperienceRecord.groupBy({
              by: ['ruleId'],
              where: {
                userId,
                ruleId: { in: ruleIds },
              },
              _max: { createdAt: true },
            }),
          ])

    const daily = new Map<number, number>()
    const total = new Map<number, number>()
    const last = new Map<number, Date>()

    for (const item of dailyCounts) {
      if (item.ruleId != null) {
        daily.set(item.ruleId, item._count._all)
      }
    }
    for (const item of totalCounts) {
      if (item.ruleId != null) {
        total.set(item.ruleId, item._count._all)
      }
    }
    for (const item of latestRecords) {
      if (item.ruleId != null && item._max.createdAt) {
        last.set(item.ruleId, item._max.createdAt)
      }
    }

    return { daily, total, last }
  }

  /**
   * 规则发放与用户状态更新
   * 事务边界：积分记录、经验记录、徽章发放与用户积分/经验/等级更新必须保持一致
   */
  private async applyRules(
    event: UserGrowthEventDto,
    eventId: number,
    pointRules: {
      id: number
      points: number
      dailyLimit: number
      totalLimit: number
      cooldownSeconds: number
    }[],
    experienceRules: {
      id: number
      experience: number
      dailyLimit: number
      totalLimit: number
      cooldownSeconds: number
    }[],
    badgeRules: {
      id: number
    }[],
  ): Promise<UserGrowthEventApplyResult> {
    return this.prisma.$transaction(async (tx) => {
      // 用户校验：不存在或封禁直接失败，避免继续发放
      const user = await tx.appUser.findUnique({
        where: { id: event.userId },
      })

      if (!user) {
        throw new Error('USER_NOT_FOUND')
      }

      if (user.status === UserStatusEnum.PERMANENT_BANNED) {
        throw new Error('USER_BANNED')
      }

      const ruleRefs: UserGrowthRuleRef[] = []
      let pointsDeltaApplied = 0
      let experienceDeltaApplied = 0
      const badgeAssigned: { badgeId: number }[] = []
      let currentPoints = user.points
      let currentExperience = user.experience

      // 当日统计窗口用于日上限控制
      const startOfDay = new Date(event.occurredAt)
      startOfDay.setHours(0, 0, 0, 0)

      const pointRuleIds = pointRules.map((rule) => rule.id)
      const experienceRuleIds = experienceRules.map((rule) => rule.id)
      const [pointStats, experienceStats] = await Promise.all([
        this.getRuleUsageStats(
          tx,
          'point',
          pointRuleIds,
          event.userId,
          startOfDay,
        ),
        this.getRuleUsageStats(
          tx,
          'experience',
          experienceRuleIds,
          event.userId,
          startOfDay,
        ),
      ])

      for (const rule of pointRules) {
        // 规则值为 0 时不产生任何记录
        if (rule.points === 0) {
          continue
        }

        if (rule.dailyLimit > 0) {
          const todayCount = pointStats.daily.get(rule.id) ?? 0
          if (todayCount >= rule.dailyLimit) {
            continue
          }
        }

        if (rule.totalLimit > 0) {
          const totalCount = pointStats.total.get(rule.id) ?? 0
          if (totalCount >= rule.totalLimit) {
            continue
          }
        }

        if (rule.cooldownSeconds > 0) {
          const latestCreatedAt = pointStats.last.get(rule.id)
          if (
            latestCreatedAt &&
            event.occurredAt.getTime() - latestCreatedAt.getTime() <
              rule.cooldownSeconds * 1000
          ) {
            continue
          }
        }

        const beforePoints = currentPoints
        const afterPoints = beforePoints + rule.points

        // 写入积分记录与用户积分快照
        await tx.userPointRecord.create({
          data: {
            userId: event.userId,
            ruleId: rule.id,
            eventId,
            points: rule.points,
            beforePoints,
            afterPoints,
            eventKey: event.eventKey,
          },
        })

        await tx.appUser.update({
          where: { id: event.userId },
          data: {
            points: afterPoints,
          },
        })

        currentPoints = afterPoints
        pointsDeltaApplied += rule.points
        ruleRefs.push({
          type: 'point',
          ruleId: rule.id,
          delta: rule.points,
        })
      }

      for (const rule of experienceRules) {
        // 规则值为 0 时不产生任何记录
        if (rule.experience === 0) {
          continue
        }

        if (rule.dailyLimit > 0) {
          const todayCount = experienceStats.daily.get(rule.id) ?? 0
          if (todayCount >= rule.dailyLimit) {
            continue
          }
        }

        if (rule.totalLimit > 0) {
          const totalCount = experienceStats.total.get(rule.id) ?? 0
          if (totalCount >= rule.totalLimit) {
            continue
          }
        }

        if (rule.cooldownSeconds > 0) {
          const latestCreatedAt = experienceStats.last.get(rule.id)
          if (
            latestCreatedAt &&
            event.occurredAt.getTime() - latestCreatedAt.getTime() <
              rule.cooldownSeconds * 1000
          ) {
            continue
          }
        }

        const beforeExperience = currentExperience
        const afterExperience = beforeExperience + rule.experience

        // 写入经验记录与用户经验快照
        await tx.userExperienceRecord.create({
          data: {
            userId: event.userId,
            ruleId: rule.id,
            eventId,
            experience: rule.experience,
            beforeExperience,
            afterExperience,
            eventKey: event.eventKey,
          },
        })

        await tx.appUser.update({
          where: { id: event.userId },
          data: {
            experience: afterExperience,
          },
        })

        currentExperience = afterExperience
        experienceDeltaApplied += rule.experience
        ruleRefs.push({
          type: 'experience',
          ruleId: rule.id,
          delta: rule.experience,
        })
      }

      for (const rule of badgeRules) {
        // 徽章幂等：已拥有则跳过
        const existingBadge = await tx.userBadgeAssignment.findUnique({
          where: {
            userId_badgeId: {
              userId: event.userId,
              badgeId: rule.id,
            },
          },
        })

        if (existingBadge) {
          continue
        }

        // 发放新徽章并记录命中规则
        await tx.userBadgeAssignment.create({
          data: {
            userId: event.userId,
            badgeId: rule.id,
          },
        })

        badgeAssigned.push({ badgeId: rule.id })
        ruleRefs.push({
          type: 'badge',
          ruleId: rule.id,
        })
      }

      if (experienceDeltaApplied !== 0) {
        // 经验变化后重新计算等级，取满足条件的最高等级规则
        const newLevelRule =
          await this.levelRuleService.getHighestLevelRuleByExperience(
            currentExperience,
            tx,
          )

        // 仅在等级变化时更新用户等级
        if (newLevelRule && newLevelRule.id !== user.levelId) {
          await tx.appUser.update({
            where: { id: event.userId },
            data: {
              levelId: newLevelRule.id,
            },
          })
        }
      }

      return {
        pointsDeltaApplied,
        experienceDeltaApplied,
        badgeAssigned: badgeAssigned.length > 0 ? badgeAssigned : undefined,
        ruleRefs,
      }
    })
  }
}
