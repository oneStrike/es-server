import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CheckForumLevelPermissionDto,
  CreateForumLevelRuleDto,
  ForumLevelStatisticsDto,
  QueryForumLevelRuleDto,
  UpdateForumLevelRuleDto,
  UserForumLevelInfoDto,
} from './dto/level-rule.dto'
import { ForumLevelRulePermissionEnum } from './level-rule.constant'

/**
 * 等级规则服务
 * 负责管理论坛用户等级规则、权限检查、等级升级等功能
 */
@Injectable()
export class ForumLevelRuleService extends BaseService {
  // 获取等级规则模型
  get forumLevelRule() {
    return this.prisma.appLevelRule
  }

  // 获取用户资料模型
  // get forumProfile() {
  //   return this.prisma.forumProfile
  // }

  // 获取主题模型
  get forumTopic() {
    return this.prisma.forumTopic
  }

  // 获取回复模型
  get forumReply() {
    return this.prisma.forumReply
  }

  // 获取主题点赞模型
  get forumTopicLike() {
    return this.prisma.forumTopicLike
  }

  // 获取主题收藏模型
  get forumTopicFavorite() {
    return this.prisma.forumTopicFavorite
  }

  // 获取回复点赞模型
  get forumReplyLike() {
    return this.prisma.forumReplyLike
  }

  /**
   * 创建等级规则
   * @param dto 等级规则数据
   * @returns 创建的等级规则
   */
  async createLevelRule(dto: CreateForumLevelRuleDto) {
    if (await this.forumLevelRule.exists({ name: dto.name })) {
      throw new BadRequestException('已存在相同等级规则')
    }

    return this.forumLevelRule.create({
      data: dto,
    })
  }

  /**
   * 获取等级规则分页列表
   * @param dto 查询参数
   * @returns 分页的等级规则列表
   */
  async getLevelRulePage(dto: QueryForumLevelRuleDto) {
    return this.forumLevelRule.findPagination({
      where: {
        ...dto,
        isEnabled: dto.isEnabled,
        name: {
          contains: dto.name,
          mode: 'insensitive',
        },
      },
    })
  }

  /**
   * 获取等级规则详情
   * @param id 等级规则ID
   * @returns 等级规则详情
   */
  async getLevelRuleDetail(id: number) {
    return this.forumLevelRule.findUnique({
      where: { id },
    })
  }

  /**
   * 更新等级规则
   * @param updateLevelRuleDto 更新数据
   * @returns 更新后的等级规则
   */
  async updateLevelRule(updateLevelRuleDto: UpdateForumLevelRuleDto) {
    const { id, ...updateData } = updateLevelRuleDto

    if (
      await this.forumLevelRule.exists({
        name: updateData.name,
        id: { not: id },
      })
    ) {
      throw new BadRequestException('已存在相同等级规则')
    }

    return this.forumLevelRule.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除等级规则
   * @param id 等级规则ID
   * @returns 删除结果
   */
  async deleteLevelRule(id: number) {
    const rule = await this.forumLevelRule.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    })

    if (!rule) {
      throw new BadRequestException('等级规则不存在')
    }

    if (rule._count.users > 0) {
      throw new BadRequestException('该等级规则下还有用户，无法删除')
    }

    return this.forumLevelRule.delete({
      where: { id },
    })
  }

  /**
   * 获取用户等级信息
   * @param userId 用户ID
   * @returns 用户等级信息，包括当前等级、进度、权限等
   */
  async getUserLevelInfo(userId: number): Promise<UserForumLevelInfoDto> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (!user.level) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const nextLevelRule = await this.forumLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredExperience: {
          gt: user.experience,
        },
      },
      orderBy: {
        requiredExperience: 'asc',
      },
    })

    let progressPercentage = 0
    let nextLevelExperience: number | undefined

    if (nextLevelRule) {
      nextLevelExperience = nextLevelRule.requiredExperience
      const previousLevelExperience = user.level.requiredExperience
      const totalRange = nextLevelExperience - previousLevelExperience
      const currentProgress = user.experience - previousLevelExperience
      progressPercentage =
        totalRange > 0 ? Math.round((currentProgress / totalRange) * 100) : 100
    } else {
      progressPercentage = 100
    }

    return {
      levelId: user.level.id,
      levelName: user.level.name,
      levelDescription: user.level.description ?? '',
      levelIcon: user.level.icon ?? '',
      levelColor: user.level.color ?? '',
      levelBadge: user.level.badge ?? '',
      currentExperience: user.experience,
      nextLevelExperience,
      progressPercentage,
      permissions: {
        dailyTopicLimit: user.level.dailyTopicLimit,
        dailyReplyCommentLimit: user.level.dailyReplyCommentLimit,
        postInterval: user.level.postInterval,
        dailyLikeLimit: user.level.dailyLikeLimit,
        dailyFavoriteLimit: user.level.dailyFavoriteLimit,
      },
    }
  }

  /**
   * 检查用户等级权限
   * @param dto 等级权限检查DTO
   * @returns 权限检查结果
   */
  async checkLevelPermission(dto: CheckForumLevelPermissionDto) {
    const { userId, permissionType } = dto

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (!user.level) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const level = user.level
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let limit = 0
    let used = 0
    let hasPermission = true

    switch (permissionType) {
      case ForumLevelRulePermissionEnum.DAILY_TOPIC_LIMIT:
        limit = level.dailyTopicLimit
        if (limit > 0) {
          used = await this.forumTopic.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
        }
        break

      case ForumLevelRulePermissionEnum.DAILY_REPLY_COMMENT_LIMIT:
        limit = level.dailyReplyCommentLimit
        if (limit > 0) {
          used = await this.forumReply.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
        }
        break

      case ForumLevelRulePermissionEnum.POST_INTERVAL:
        limit = level.postInterval
        if (limit > 0) {
          const lastTopic = await this.forumTopic.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })

          const lastReply = await this.forumReply.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })

          let lastPostTime: Date | null = null
          if (lastTopic && lastReply) {
            lastPostTime =
              lastTopic.createdAt > lastReply.createdAt
                ? lastTopic.createdAt
                : lastReply.createdAt
          } else if (lastTopic) {
            lastPostTime = lastTopic.createdAt
          } else if (lastReply) {
            lastPostTime = lastReply.createdAt
          }

          if (lastPostTime) {
            const secondsSinceLastPost = Math.floor(
              (Date.now() - lastPostTime.getTime()) / 1000,
            )
            hasPermission = secondsSinceLastPost >= limit
          } else {
            hasPermission = true
          }
        }
        break

      case ForumLevelRulePermissionEnum.DAILY_LIKE_LIMIT:
        limit = level.dailyLikeLimit
        if (limit > 0) {
          const topicLikes = await this.forumTopicLike.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          const replyLikes = await this.forumReplyLike.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          used = topicLikes + replyLikes
          hasPermission = used < limit
        }
        break

      case ForumLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT:
        limit = level.dailyFavoriteLimit
        if (limit > 0) {
          used = await this.forumTopicFavorite.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
        }
        break

      default:
        throw new BadRequestException('不支持的权限类型')
    }

    return {
      hasPermission,
      currentLevel: level.name,
      limit: limit > 0 ? limit : null,
      used: limit > 0 ? used : null,
      remaining: limit > 0 ? limit - used : null,
    }
  }

  /**
   * 获取等级统计信息
   * @returns 等级统计数据
   */
  async getLevelStatistics(): Promise<ForumLevelStatisticsDto> {
    const levels = await this.forumLevelRule.findMany({
      where: {
        isEnabled: true,
      },
      select: {
        id: true,
        name: true,
        isEnabled: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    const allLevelsCount = await this.forumLevelRule.count()

    return {
      totalLevels: allLevelsCount,
      enabledLevels: levels.length,
      levelDistribution: levels.map((item) => ({
        levelId: item.id,
        levelName: item.name,
        userCount: item._count.users,
      })),
    }
  }
}
