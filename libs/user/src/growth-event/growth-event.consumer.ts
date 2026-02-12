import { UserStatusEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import { UserGrowthEventAntifraudService } from './growth-event.antifraud.service'
import { UserGrowthEventAuditService } from './growth-event.audit.service'
import { UserGrowthEventBus } from './growth-event.bus'
import { USER_GROWTH_EVENT_BUS } from './growth-event.constant'
import {
  UserGrowthEventApplyResult,
  UserGrowthEventStatus,
  UserGrowthRuleRef,
} from './growth-event.types'

@Injectable()
export class UserGrowthEventConsumer
  extends BaseService
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe?: () => void

  constructor(
    @Inject(USER_GROWTH_EVENT_BUS)
    private readonly eventBus: UserGrowthEventBus,
    private readonly auditService: UserGrowthEventAuditService,
    private readonly antifraudService: UserGrowthEventAntifraudService,
  ) {
    super()
  }

  onModuleInit() {
    this.unsubscribe = this.eventBus.subscribe(async (event) => this.consume(event))
  }

  onModuleDestroy() {
    this.unsubscribe?.()
  }

  private async consume(event: UserGrowthEventDto) {
    try {
      await this.processEvent(event)
    } catch {

    }
  }

  private async processEvent(event: UserGrowthEventDto) {
    const duplicate = await this.auditService.findDuplicate(event)
    if (duplicate) {
      await this.auditService.createEvent(
        event,
        UserGrowthEventStatus.IGNORED_DUPLICATE,
      )
      return
    }

    const audit = await this.auditService.createEvent(
      event,
      UserGrowthEventStatus.PENDING,
    )

    try {
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
        await this.auditService.updateStatus(
          audit.id,
          UserGrowthEventStatus.IGNORED_RULE_NOT_FOUND,
        )
        return
      }

      const cooldownSeconds = this.getCooldownSeconds(
        pointRules,
        experienceRules,
      )
      const pointsValue = this.getMaxDelta(pointRules, 'points')
      const experienceValue = this.getMaxDelta(experienceRules, 'experience')
      const antifraudDecision = await this.antifraudService.check(
        event,
        {
          cooldownSeconds,
          points: pointsValue,
          experience: experienceValue,
        },
      )
      if (!antifraudDecision.allow) {
        await this.auditService.updateStatus(
          audit.id,
          UserGrowthEventStatus.REJECTED_ANTIFRAUD,
        )
        return
      }

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
      await this.auditService.updateStatus(
        audit.id,
        UserGrowthEventStatus.FAILED,
      )
    }
  }

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

  private getMaxDelta<T extends { points?: number, experience?: number }>(
    rules: T[],
    key: 'points' | 'experience',
  ) {
    return Math.max(
      0,
      ...rules.map((rule) => (rule[key] ?? 0)),
    )
  }

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

      const startOfDay = new Date(event.occurredAt)
      startOfDay.setHours(0, 0, 0, 0)

      for (const rule of pointRules) {
        if (rule.points === 0) {
          continue
        }

        if (rule.dailyLimit > 0) {
          const todayCount = await tx.userPointRecord.count({
            where: {
              userId: event.userId,
              ruleId: rule.id,
              createdAt: {
                gte: startOfDay,
              },
            },
          })
          if (todayCount >= rule.dailyLimit) {
            continue
          }
        }

        if (rule.totalLimit > 0) {
          const totalCount = await tx.userPointRecord.count({
            where: {
              userId: event.userId,
              ruleId: rule.id,
            },
          })
          if (totalCount >= rule.totalLimit) {
            continue
          }
        }

        if (rule.cooldownSeconds > 0) {
          const latestRecord = await tx.userPointRecord.findFirst({
            where: {
              userId: event.userId,
              ruleId: rule.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          if (
            latestRecord &&
            event.occurredAt.getTime() - latestRecord.createdAt.getTime() <
              rule.cooldownSeconds * 1000
          ) {
            continue
          }
        }

        const beforePoints = currentPoints
        const afterPoints = beforePoints + rule.points

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
        if (rule.experience === 0) {
          continue
        }

        if (rule.dailyLimit > 0) {
          const todayCount = await tx.userExperienceRecord.count({
            where: {
              userId: event.userId,
              ruleId: rule.id,
              createdAt: {
                gte: startOfDay,
              },
            },
          })
          if (todayCount >= rule.dailyLimit) {
            continue
          }
        }

        if (rule.totalLimit > 0) {
          const totalCount = await tx.userExperienceRecord.count({
            where: {
              userId: event.userId,
              ruleId: rule.id,
            },
          })
          if (totalCount >= rule.totalLimit) {
            continue
          }
        }

        if (rule.cooldownSeconds > 0) {
          const latestRecord = await tx.userExperienceRecord.findFirst({
            where: {
              userId: event.userId,
              ruleId: rule.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          if (
            latestRecord &&
            event.occurredAt.getTime() - latestRecord.createdAt.getTime() <
              rule.cooldownSeconds * 1000
          ) {
            continue
          }
        }

        const beforeExperience = currentExperience
        const afterExperience = beforeExperience + rule.experience

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
        const newLevelRule = await tx.userLevelRule.findFirst({
          where: {
            isEnabled: true,
            requiredExperience: {
              lte: currentExperience,
            },
          },
          orderBy: {
            requiredExperience: 'desc',
          },
        })

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
