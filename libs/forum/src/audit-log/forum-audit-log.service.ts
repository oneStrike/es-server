import { RepositoryService } from '@libs/base/database'

import { DateRangeDto } from '@libs/base/dto'
import { Injectable } from '@nestjs/common'
import {
  CreateForumAuditLogDto,
  QueryForumAuditLogDto,
} from './dto/forum-audit-log.dto'
import { AuditRoleEnum } from './forum-audit-log.constant'

/**
 * 论坛审核日志服务
 * 提供审核日志的创建、查询、统计等功能
 */
@Injectable()
export class ForumAuditLogService extends RepositoryService {
  /**
   * 获取论坛审核日志 Prisma 客户端
   */
  get forumAuditLog() {
    return this.prisma.forumAuditLog
  }

  /**
   * 创建审核日志
   * @param dto 审核日志数据传输对象
   * @param auditBy 审核人ID
   * @param auditRole 审核人角色
   * @returns 创建的审核日志
   */
  async createLog(
    dto: CreateForumAuditLogDto,
    auditBy: number,
    auditRole: AuditRoleEnum,
  ) {
    if (!auditBy || !auditRole) {
      throw new Error('审核人信息丢失')
    }

    return this.forumAuditLog.create({
      data: {
        ...dto,
        auditBy,
        auditRole,
      },
    })
  }

  /**
   * 获取审核日志列表（分页）
   * @param queryForumAuditLogDto 查询参数
   * @returns 分页的审核日志列表
   */
  async getLogs(queryForumAuditLogDto: QueryForumAuditLogDto) {
    return this.forumAuditLog.findPagination({
      where: queryForumAuditLogDto,
    })
  }

  /**
   * 获取审核日志统计数据
   * @param dto 查询参数
   * @returns 审核统计数据，包含总数、待审核、已通过、已拒绝的数量
   */
  async getLogStatistics(dto: DateRangeDto) {
    const statusCounts = await this.forumAuditLog.groupBy({
      by: ['auditStatus'],
      where: {
        createdAt: {
          gte: dto.startDate,
          lte: dto.endDate,
        },
      },
      _count: true,
    })

    const statistics = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    statusCounts.forEach((item) => {
      statistics.total += item._count
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
