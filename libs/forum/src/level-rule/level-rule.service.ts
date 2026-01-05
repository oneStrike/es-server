import type { ForumLevelRuleWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateLevelRuleDto,
  QueryLevelRuleDto,
  UpdateLevelRuleDto,
} from './dto/level-rule.dto'
import { LevelRulePermissionEnum } from './level-rule.constant'

/**
 * 等级规则服务
 * 负责管理论坛用户等级规则、权限检查、等级升级等功能
 */
@Injectable()
export class LevelRuleService extends RepositoryService {
  // 获取等级规则模型
  get forumLevelRule() {
    return this.prisma.forumLevelRule
  }

  // 获取用户资料模型
  get forumProfile() {
    return this.prisma.forumProfile
  }

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
  async createLevelRule(dto: CreateLevelRuleDto) {
    const existingRule = await this.forumLevelRule.findFirst({
      where: {
        name: dto.name,
      },
    })

    if (existingRule) {
      throw new BadRequestException('等级名称已存在')
    }

    return this.forumLevelRule.create({
      data: dto,
    })
  }

  /**
   * 获取等级规则分页列表
   * @param queryLevelRuleDto 查询参数
   * @returns 分页的等级规则列表
   */
  async getLevelRulePage(queryLevelRuleDto: QueryLevelRuleDto) {
    const where: ForumLevelRuleWhereInput = queryLevelRuleDto

    if (queryLevelRuleDto.name) {
      where.name = {
        contains: queryLevelRuleDto.name,
        mode: 'insensitive',
      }
    }

    return this.forumLevelRule.findPagination({
      where,
    })
  }

  /**
   * 获取等级规则详情
   * @param id 等级规则ID
   * @returns 等级规则详情
   */
  async getLevelRuleDetail(id: number) {
    const rule = await this.forumLevelRule.findUnique({
      where: { id },
    })

    if (!rule) {
      throw new BadRequestException('等级规则不存在')
    }

    return rule
  }

  /**
   * 更新等级规则
   * @param updateLevelRuleDto 更新数据
   * @returns 更新后的等级规则
   */
  async updateLevelRule(updateLevelRuleDto: UpdateLevelRuleDto) {
    const { id, ...updateData } = updateLevelRuleDto

    const existingRule = await this.forumLevelRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      throw new BadRequestException('等级规则不存在')
    }

    if (updateData.name && updateData.name !== existingRule.name) {
      const duplicateName = await this.forumLevelRule.findFirst({
        where: {
          name: updateData.name,
          id: { not: id },
        },
      })

      if (duplicateName) {
        throw new BadRequestException('等级名称已存在')
      }
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
            profiles: true,
          },
        },
      },
    })

    if (!rule) {
      throw new BadRequestException('等级规则不存在')
    }

    if (rule._count.profiles > 0) {
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
  async getUserLevelInfo(userId: number) {
    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const currentLevelRule = await this.forumLevelRule.findUnique({
      where: { id: profile.levelId },
    })

    if (!currentLevelRule) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const nextLevelRule = await this.forumLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredPoints: {
          gt: profile.points,
        },
      },
      orderBy: {
        requiredPoints: 'asc',
      },
    })

    let progressPercentage = 0
    let nextLevelPoints: number | undefined

    if (nextLevelRule) {
      nextLevelPoints = nextLevelRule.requiredPoints
      const previousLevelPoints = currentLevelRule.requiredPoints
      const totalRange = nextLevelPoints - previousLevelPoints
      const currentProgress = profile.points - previousLevelPoints
      progressPercentage =
        totalRange > 0 ? Math.round((currentProgress / totalRange) * 100) : 100
    } else {
      progressPercentage = 100
    }

    return {
      levelId: currentLevelRule.id,
      levelName: currentLevelRule.name,
      levelDescription: currentLevelRule.description,
      levelIcon: currentLevelRule.icon,
      levelColor: currentLevelRule.levelColor,
      levelBadge: currentLevelRule.levelBadge,
      currentPoints: profile.points,
      nextLevelPoints,
      progressPercentage,
      permissions: {
        dailyTopicLimit: currentLevelRule.dailyTopicLimit,
        dailyReplyLimit: currentLevelRule.dailyReplyLimit,
        postInterval: currentLevelRule.postInterval,
        maxFileSize: currentLevelRule.maxFileSize,
        dailyLikeLimit: currentLevelRule.dailyLikeLimit,
        dailyFavoriteLimit: currentLevelRule.dailyFavoriteLimit,
        dailyCommentLimit: currentLevelRule.dailyCommentLimit,
      },
    }
  }

  /**
   * 检查用户等级权限
   * @param userId 用户ID
   * @param permissionType 权限类型
   * @returns 权限检查结果
   */
  async checkLevelPermission(
    userId: number,
    permissionType: LevelRulePermissionEnum,
  ) {
    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const levelRule = await this.forumLevelRule.findUnique({
      where: { id: profile.levelId },
    })

    if (!levelRule) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let limit = 0
    let used = 0
    let hasPermission = true
    let message = ''

    switch (permissionType) {
      case LevelRulePermissionEnum.DAILY_TOPIC_LIMIT:
        limit = levelRule.dailyTopicLimit
        if (limit > 0) {
          used = await this.forumTopic.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
          message = hasPermission
            ? '可以发帖'
            : `今日发帖次数已达上限(${limit}次)`
        } else {
          message = '无限制'
        }
        break

      case LevelRulePermissionEnum.DAILY_REPLY_LIMIT:
        limit = levelRule.dailyReplyLimit
        if (limit > 0) {
          used = await this.forumReply.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
          message = hasPermission
            ? '可以回复'
            : `今日回复次数已达上限(${limit}次)`
        } else {
          message = '无限制'
        }
        break

      case LevelRulePermissionEnum.POST_INTERVAL:
        limit = levelRule.postInterval
        if (limit > 0) {
          const lastPost = await this.forumTopic.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })

          if (lastPost) {
            const secondsSinceLastPost = Math.floor(
              (Date.now() - lastPost.createdAt.getTime()) / 1000,
            )
            hasPermission = secondsSinceLastPost >= limit
            message = hasPermission
              ? '可以发帖'
              : `发帖间隔未到，还需等待${limit - secondsSinceLastPost}秒`
          } else {
            hasPermission = true
            message = '可以发帖'
          }
        } else {
          message = '无限制'
        }
        break

      case LevelRulePermissionEnum.MAX_FILE_SIZE:
        limit = levelRule.maxFileSize
        hasPermission = limit > 0
        message = hasPermission ? `最大文件大小为${limit}KB` : '无限制'
        break

      case LevelRulePermissionEnum.DAILY_LIKE_LIMIT:
        limit = levelRule.dailyLikeLimit
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
          message = hasPermission
            ? '可以点赞'
            : `今日点赞次数已达上限(${limit}次)`
        } else {
          message = '无限制'
        }
        break

      case LevelRulePermissionEnum.DAILY_FAVORITE_LIMIT:
        limit = levelRule.dailyFavoriteLimit
        if (limit > 0) {
          used = await this.forumTopicFavorite.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
          message = hasPermission
            ? '可以收藏'
            : `今日收藏次数已达上限(${limit}次)`
        } else {
          message = '无限制'
        }
        break

      case LevelRulePermissionEnum.DAILY_COMMENT_LIMIT:
        limit = levelRule.dailyCommentLimit
        if (limit > 0) {
          used = await this.forumReply.count({
            where: {
              userId,
              createdAt: { gte: today },
            },
          })
          hasPermission = used < limit
          message = hasPermission
            ? '可以评论'
            : `今日评论次数已达上限(${limit}次)`
        } else {
          message = '无限制'
        }
        break

      default:
        throw new BadRequestException('不支持的权限类型')
    }

    return {
      hasPermission,
      currentLevel: levelRule.name,
      limit: limit > 0 ? limit : undefined,
      used: used > 0 ? used : undefined,
      remaining: limit > 0 && used > 0 ? limit - used : undefined,
      message,
    }
  }

  /**
   * 根据积分更新用户等级
   * @param userId 用户ID
   * @returns 等级更新结果
   */
  async updateUserLevelByPoints(userId: number) {
    const profile = await this.forumProfile.findUnique({
      where: { id: userId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const currentLevelRule = await this.forumLevelRule.findUnique({
      where: { id: profile.levelId },
    })

    if (!currentLevelRule) {
      throw new BadRequestException('当前等级规则不存在')
    }

    const newLevelRule = await this.forumLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredPoints: {
          lte: profile.points,
        },
      },
      orderBy: {
        requiredPoints: 'desc',
      },
    })

    if (!newLevelRule) {
      throw new BadRequestException('未找到匹配的等级规则')
    }

    if (newLevelRule.id !== profile.levelId) {
      await this.forumProfile.update({
        where: { id: userId },
        data: {
          levelId: newLevelRule.id,
        },
      })

      return {
        oldLevel: currentLevelRule.name,
        newLevel: newLevelRule.name,
        levelUp: true,
      }
    }

    return {
      oldLevel: currentLevelRule.name,
      newLevel: currentLevelRule.name,
      levelUp: false,
    }
  }

  /**
   * 获取等级统计信息
   * @returns 等级统计数据
   */
  async getLevelStatistics() {
    const levels = await this.forumLevelRule.findMany({
      select: {
        id: true,
        name: true,
        isEnabled: true,
        _count: {
          select: {
            profiles: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    })

    return {
      totalLevels: levels.length,
      enabledLevels: levels.filter((l) => l.isEnabled).length,
      levelDistribution: levels.map((item) => ({
        levelId: item.id,
        levelName: item.name,
        userCount: item._count.profiles,
      })),
    }
  }
}
