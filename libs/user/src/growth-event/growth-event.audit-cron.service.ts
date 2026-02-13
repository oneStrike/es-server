import { BaseService, Prisma } from '@libs/base/database'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  USER_GROWTH_EVENT_AUDIT_ARCHIVE_BATCH_SIZE,
  USER_GROWTH_EVENT_AUDIT_RETENTION_DAYS,
} from './growth-event.constant'

/**
 * 成长事件审计归档定时任务
 * 将过期事件迁移到归档表，降低主表体积
 */
@Injectable()
export class UserGrowthEventAuditCronService extends BaseService {
  private readonly logger = new Logger(UserGrowthEventAuditCronService.name)

  get userGrowthEvent() {
    return this.prisma.userGrowthEvent
  }

  private get userGrowthEventArchive() {
    return (this.prisma as any).userGrowthEventArchive
  }

  @Cron('0 2 * * *')
  async archiveOldEvents() {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(
        cutoffDate.getDate() - USER_GROWTH_EVENT_AUDIT_RETENTION_DAYS,
      )

      let archivedCount = 0
      let lastId: number | undefined

      while (true) {
        const events = await this.userGrowthEvent.findMany({
          where: {
            occurredAt: {
              lt: cutoffDate,
            },
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          orderBy: {
            id: 'asc',
          },
          take: USER_GROWTH_EVENT_AUDIT_ARCHIVE_BATCH_SIZE,
        })

        if (events.length === 0) {
          break
        }

        const archiveRows = events.map((event) => ({
          sourceId: event.id,
          business: event.business,
          eventKey: event.eventKey,
          userId: event.userId,
          targetId: event.targetId,
          ip: event.ip,
          deviceId: event.deviceId,
          occurredAt: event.occurredAt,
          status: event.status,
          ruleRefs: event.ruleRefs ?? Prisma.DbNull,
          pointsDeltaApplied: event.pointsDeltaApplied,
          experienceDeltaApplied: event.experienceDeltaApplied,
          badgeAssigned: event.badgeAssigned ?? Prisma.DbNull,
          context: event.context ?? Prisma.DbNull,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        }))

        const ids = events.map((event) => event.id)

        await this.prisma.$transaction(async (tx) => {
          await (tx).userGrowthEventArchive.createMany({
            data: archiveRows,
          })

          await tx.userGrowthEvent.deleteMany({
            where: {
              id: {
                in: ids,
              },
            },
          })
        })

        archivedCount += events.length
        lastId = events[events.length - 1].id
      }

      if (archivedCount > 0) {
        this.logger.log(`归档审计记录 ${archivedCount} 条`)
      }
    } catch (error) {
      this.logger.error(
        `归档审计记录失败: ${error.message}`,
        error.stack,
      )
    }
  }
}
