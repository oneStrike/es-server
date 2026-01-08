import { RepositoryService } from '@libs/base/database'

import { Injectable } from '@nestjs/common'
import { CreateForumAuditLogDto, QueryForumAuditLogDto } from './dto/forum-audit-log.dto'

@Injectable()
export class ForumAuditLogService extends RepositoryService {
  get forumAuditLog() {
    return this.prisma.forumAuditLog
  }

  async createLog(createForumAuditLogDto: CreateForumAuditLogDto) {
    return this.forumAuditLog.create({
      data: createForumAuditLogDto,
    })
  }

  async getLogs(queryForumAuditLogDto: QueryForumAuditLogDto) {
    const { objectType, objectId, auditStatus, auditBy, pageIndex = 0, pageSize = 15 } = queryForumAuditLogDto

    const where: any = {}

    if (objectType) {
      where.objectType = objectType
    }

    if (objectId) {
      where.objectId = objectId
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    if (auditBy) {
      where.auditBy = auditBy
    }

    return this.forumAuditLog.findPagination({
      where,
      orderBy: {
        auditAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async getEntityLogs(objectType: number, objectId: number, queryForumAuditLogDto: QueryForumAuditLogDto) {
    const { auditStatus, pageIndex = 0, pageSize = 15 } = queryForumAuditLogDto

    const where: any = {
      objectType,
      objectId,
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    return this.forumAuditLog.findPagination({
      where,
      orderBy: {
        auditAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async getLogStatistics(queryForumAuditLogDto: QueryForumAuditLogDto) {
    const { objectType, objectId, auditStatus, auditBy } = queryForumAuditLogDto

    const where: any = {}

    if (objectType) {
      where.objectType = objectType
    }

    if (objectId) {
      where.objectId = objectId
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    if (auditBy) {
      where.auditBy = auditBy
    }

    const total = await this.forumAuditLog.count({ where })

    const statusCounts = await this.forumAuditLog.groupBy({
      by: ['auditStatus'],
      where,
      _count: true,
    })

    const statistics = {
      total,
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    statusCounts.forEach((item) => {
      if (item.auditStatus === 0) {
        statistics.pending = item._count
      } else if (item.auditStatus === 1) {
        statistics.approved = item._count
      } else if (item.auditStatus === 2) {
        statistics.rejected = item._count
      }
    })

    return statistics
  }
}
