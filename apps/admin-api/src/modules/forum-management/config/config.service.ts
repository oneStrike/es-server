import { ApiErrorCode } from '@libs/common'
import { BusinessException } from '@libs/common/exception'
import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

import {
  CreateBadgeBatchDto,
  CreateBadgeDto,
  CreateLevelRuleBatchDto,
  CreateLevelRuleDto,
  CreatePointRuleBatchDto,
  CreatePointRuleDto,
  CreateSystemConfigDto,
  QueryBadgeDto,
  QueryLevelRuleDto,
  QueryPointRuleDto,
  QuerySystemConfigDto,
  UpdateBadgeDto,
  UpdateLevelRuleDto,
  UpdatePointRuleDto,
  UpdateSystemConfigDto,
} from './dto/config.dto'

@Injectable()
export class ConfigService extends RepositoryService {
  get forumPointRule() {
    return this.prisma.forumPointRule
  }

  get forumLevelRule() {
    return this.prisma.forumLevelRule
  }

  get forumBadge() {
    return this.prisma.forumBadge
  }

  get forumSystemConfig() {
    return this.prisma.forumSystemConfig
  }

  get forumUserBadge() {
    return this.prisma.forumUserBadge
  }

  get forumUser() {
    return this.prisma.forumUser
  }

  get forumPointRecord() {
    return this.prisma.forumPointRecord
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  async createPointRule(dto: CreatePointRuleDto) {
    const existing = await this.forumPointRule.findFirst({
      where: {
        code: dto.code,
        deletedAt: null,
      },
    })

    if (existing) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '规则代码已存在')
    }

    return this.forumPointRule.create({
      data: dto,
      select: { id: true },
    })
  }

  async updatePointRule(id: number, dto: UpdatePointRuleDto) {
    const rule = await this.forumPointRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '积分规则不存在')
    }

    if (dto.code && dto.code !== rule.code) {
      const existing = await this.forumPointRule.findFirst({
        where: {
          code: dto.code,
          deletedAt: null,
          id: { not: id },
        },
      })

      if (existing) {
        throw new BusinessException(ApiErrorCode.COMMON_ERROR, '规则代码已存在')
      }
    }

    return this.forumPointRule.update({
      where: { id },
      data: dto,
      select: { id: true },
    })
  }

  async deletePointRule(id: number) {
    const rule = await this.forumPointRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '积分规则不存在')
    }

    return this.forumPointRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async getPointRulePage(dto: QueryPointRuleDto) {
    const where = {
      deletedAt: null,
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      ...(dto.keyword && {
        OR: [
          { name: { contains: dto.keyword } },
          { code: { contains: dto.keyword } },
        ],
      }),
    }

    const [total, items] = await Promise.all([
      this.forumPointRule.count({ where }),
      this.forumPointRule.findMany({
        where,
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      total,
      items,
      page: dto.page,
      pageSize: dto.pageSize,
    }
  }

  async getPointRule(id: number) {
    const rule = await this.forumPointRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '积分规则不存在')
    }

    return rule
  }

  async createPointRuleBatch(dto: CreatePointRuleBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const results = []
      for (const rule of dto.rules) {
        const existing = await tx.forumPointRule.findFirst({
          where: {
            code: rule.code,
            deletedAt: null,
          },
        })

        if (existing) {
          throw new BusinessException(ApiErrorCode.COMMON_ERROR, `规则代码 ${rule.code} 已存在`)
        }

        const created = await tx.forumPointRule.create({
          data: rule,
          select: { id: true },
        })
        results.push(created)
      }
      return results
    })
  }

  async createLevelRule(dto: CreateLevelRuleDto) {
    const existing = await this.forumLevelRule.findFirst({
      where: {
        level: dto.level,
        deletedAt: null,
      },
    })

    if (existing) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '等级已存在')
    }

    return this.forumLevelRule.create({
      data: dto,
      select: { id: true },
    })
  }

  async updateLevelRule(id: number, dto: UpdateLevelRuleDto) {
    const rule = await this.forumLevelRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '等级规则不存在')
    }

    if (dto.level !== undefined && dto.level !== rule.level) {
      const existing = await this.forumLevelRule.findFirst({
        where: {
          level: dto.level,
          deletedAt: null,
          id: { not: id },
        },
      })

      if (existing) {
        throw new BusinessException(ApiErrorCode.COMMON_ERROR, '等级已存在')
      }
    }

    return this.forumLevelRule.update({
      where: { id },
      data: dto,
      select: { id: true },
    })
  }

  async deleteLevelRule(id: number) {
    const rule = await this.forumLevelRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '等级规则不存在')
    }

    const hasUsers = await this.forumUser.count({
      where: { level: rule.level, deletedAt: null },
    })

    if (hasUsers > 0) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '该等级下存在用户，无法删除')
    }

    return this.forumLevelRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async getLevelRulePage(dto: QueryLevelRuleDto) {
    const where = {
      deletedAt: null,
      ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      ...(dto.keyword && {
        OR: [
          { name: { contains: dto.keyword } },
        ],
      }),
    }

    const [total, items] = await Promise.all([
      this.forumLevelRule.count({ where }),
      this.forumLevelRule.findMany({
        where,
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        orderBy: { level: 'asc' },
      }),
    ])

    return {
      total,
      items,
      page: dto.page,
      pageSize: dto.pageSize,
    }
  }

  async getLevelRule(id: number) {
    const rule = await this.forumLevelRule.findFirst({
      where: { id, deletedAt: null },
    })

    if (!rule) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '等级规则不存在')
    }

    return rule
  }

  async createLevelRuleBatch(dto: CreateLevelRuleBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const results = []
      for (const rule of dto.rules) {
        const existing = await tx.forumLevelRule.findFirst({
          where: {
            level: rule.level,
            deletedAt: null,
          },
        })

        if (existing) {
          throw new BusinessException(ApiErrorCode.COMMON_ERROR, `等级 ${rule.level} 已存在`)
        }

        const created = await tx.forumLevelRule.create({
          data: rule,
          select: { id: true },
        })
        results.push(created)
      }
      return results
    })
  }

  async createBadge(dto: CreateBadgeDto) {
    const existing = await this.forumBadge.findFirst({
      where: {
        code: dto.code,
        deletedAt: null,
      },
    })

    if (existing) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '徽章代码已存在')
    }

    return this.forumBadge.create({
      data: dto,
      select: { id: true },
    })
  }

  async updateBadge(id: number, dto: UpdateBadgeDto) {
    const badge = await this.forumBadge.findFirst({
      where: { id, deletedAt: null },
    })

    if (!badge) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '徽章不存在')
    }

    if (dto.code && dto.code !== badge.code) {
      const existing = await this.forumBadge.findFirst({
        where: {
          code: dto.code,
          deletedAt: null,
          id: { not: id },
        },
      })

      if (existing) {
        throw new BusinessException(ApiErrorCode.COMMON_ERROR, '徽章代码已存在')
      }
    }

    return this.forumBadge.update({
      where: { id },
      data: dto,
      select: { id: true },
    })
  }

  async deleteBadge(id: number) {
    const badge = await this.forumBadge.findFirst({
      where: { id, deletedAt: null },
    })

    if (!badge) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '徽章不存在')
    }

    const hasUsers = await this.forumUserBadge.count({
      where: { badgeId: id },
    })

    if (hasUsers > 0) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '该徽章已被用户拥有，无法删除')
    }

    return this.forumBadge.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async getBadgePage(dto: QueryBadgeDto) {
    const where = {
      deletedAt: null,
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      ...(dto.keyword && {
        OR: [
          { name: { contains: dto.keyword } },
          { code: { contains: dto.keyword } },
        ],
      }),
    }

    const [total, items] = await Promise.all([
      this.forumBadge.count({ where }),
      this.forumBadge.findMany({
        where,
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      total,
      items,
      page: dto.page,
      pageSize: dto.pageSize,
    }
  }

  async getBadge(id: number) {
    const badge = await this.forumBadge.findFirst({
      where: { id, deletedAt: null },
    })

    if (!badge) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '徽章不存在')
    }

    return badge
  }

  async createBadgeBatch(dto: CreateBadgeBatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const results = []
      for (const badge of dto.badges) {
        const existing = await tx.forumBadge.findFirst({
          where: {
            code: badge.code,
            deletedAt: null,
          },
        })

        if (existing) {
          throw new BusinessException(ApiErrorCode.COMMON_ERROR, `徽章代码 ${badge.code} 已存在`)
        }

        const created = await tx.forumBadge.create({
          data: badge,
          select: { id: true },
        })
        results.push(created)
      }
      return results
    })
  }

  async createSystemConfig(dto: CreateSystemConfigDto) {
    const existing = await this.forumSystemConfig.findFirst({
      where: {
        configKey: dto.configKey,
      },
    })

    if (existing) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '配置键已存在')
    }

    return this.forumSystemConfig.create({
      data: dto,
      select: { id: true },
    })
  }

  async updateSystemConfig(id: number, dto: UpdateSystemConfigDto) {
    const config = await this.forumSystemConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '系统配置不存在')
    }

    if (dto.configKey && dto.configKey !== config.configKey) {
      const existing = await this.forumSystemConfig.findFirst({
        where: {
          configKey: dto.configKey,
          id: { not: id },
        },
      })

      if (existing) {
        throw new BusinessException(ApiErrorCode.COMMON_ERROR, '配置键已存在')
      }
    }

    return this.forumSystemConfig.update({
      where: { id },
      data: dto,
      select: { id: true },
    })
  }

  async deleteSystemConfig(id: number) {
    const config = await this.forumSystemConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '系统配置不存在')
    }

    return this.forumSystemConfig.delete({
      where: { id },
    })
  }

  async getSystemConfigPage(dto: QuerySystemConfigDto) {
    const where = {
      ...(dto.type !== undefined && { configType: dto.type }),
      ...(dto.keyword && {
        OR: [
          { configKey: { contains: dto.keyword } },
          { configValue: { contains: dto.keyword } },
          { description: { contains: dto.keyword } },
        ],
      }),
    }

    const [total, items] = await Promise.all([
      this.forumSystemConfig.count({ where }),
      this.forumSystemConfig.findMany({
        where,
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        orderBy: { configKey: 'asc' },
      }),
    ])

    return {
      total,
      items,
      page: dto.page,
      pageSize: dto.pageSize,
    }
  }

  async getSystemConfig(id: number) {
    const config = await this.forumSystemConfig.findUnique({
      where: { id },
    })

    if (!config) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '系统配置不存在')
    }

    return config
  }

  async getSystemConfigByKey(configKey: string) {
    const config = await this.forumSystemConfig.findUnique({
      where: { configKey },
    })

    if (!config) {
      throw new BusinessException(ApiErrorCode.COMMON_ERROR, '系统配置不存在')
    }

    return config
  }

  async batchUpdateSystemConfig(updates: Array<{ configKey: string, configValue: string }>) {
    return this.prisma.$transaction(async (tx) => {
      const results = []
      for (const update of updates) {
        const config = await tx.forumSystemConfig.findUnique({
          where: { configKey: update.configKey },
        })

        if (!config) {
          throw new BusinessException(ApiErrorCode.COMMON_ERROR, `配置键 ${update.configKey} 不存在`)
        }

        const updated = await tx.forumSystemConfig.update({
          where: { configKey: update.configKey },
          data: { configValue: update.configValue },
          select: { id: true },
        })
        results.push(updated)
      }
      return results
    })
  }

  async getForumStatistics() {
    const [
      totalUsers,
      totalTopics,
      totalReplies,
      totalSections,
      todayTopics,
      todayReplies,
      activeUsers,
    ] = await Promise.all([
      this.forumUser.count({ where: { deletedAt: null } }),
      this.forumTopic.count({ where: { deletedAt: null } }),
      this.forumReply.count({ where: { deletedAt: null } }),
      this.forumSection.count({ where: { deletedAt: null } }),
      this.forumTopic.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.forumReply.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.forumUser.count({
        where: {
          deletedAt: null,
          lastActiveAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    return {
      totalUsers,
      totalTopics,
      totalReplies,
      totalSections,
      todayTopics,
      todayReplies,
      activeUsers,
    }
  }

  async getTopSections(limit: number = 10) {
    const sections = await this.forumSection.findMany({
      where: { deletedAt: null, isEnabled: true },
      include: {
        _count: {
          select: {
            topics: true,
          },
        },
      },
      orderBy: {
        topics: {
          _count: 'desc',
        },
      },
      take: limit,
    })

    return sections.map((section) => ({
      id: section.id,
      name: section.name,
      topicCount: section._count.topics,
    }))
  }

  async getTopUsers(limit: number = 10) {
    const users = await this.forumUser.findMany({
      where: { deletedAt: null },
      orderBy: {
        points: 'desc',
      },
      take: limit,
      select: {
        id: true,
        userId: true,
        points: true,
        level: true,
        topicCount: true,
        replyCount: true,
      },
    })

    return users
  }
}
