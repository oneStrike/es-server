import { BaseService, Prisma } from '@libs/base/database'
import { ForumLevelRuleService } from '../level-rule/level-rule.service'
import { ForumPointService } from '../point/point.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { QueryProfileListDto, UpdateProfileStatusDto } from './dto/profile.dto'
import { ForumProfileDefaults } from './profile.constant'

/**
 * 论坛资料服务类
 * 提供用户资料查询、状态管理、主题收藏、积分记录等核心业务逻辑
 */
@Injectable()
export class ForumProfileService extends BaseService {
  constructor(
    protected readonly pointService: ForumPointService,
    private readonly levelRuleService: ForumLevelRuleService,
  ) {
    super()
  }

  /**
   * 获取论坛用户资料模型
   */
  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 查询用户资料列表
   * @param queryDto - 查询参数，包含用户ID、昵称、状态等过滤条件
   * @returns 分页的用户资料列表，包含用户信息和徽章信息
   */
  async queryProfileList(queryDto: QueryProfileListDto) {
    return this.forumProfile.findPagination({
      where: {
        ...queryDto,
        user: {
          nickname: { contains: queryDto.nickname },
        },
      },
      include: {
        user: {
          select: {
            avatar: true,
            nickname: true,
          },
        },
        badges: {
          include: {
            badge: true,
          },
        },
      },
    })
  }

  /**
   * 查看用户资料
   * @param userId - 用户ID
   * @returns 用户资料详情，包含用户信息和徽章信息
   * @throws Error 用户不存在
   */
  async getProfile(userId: number) {
    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        badges: {
          include: {
            badge: true,
          },
        },
      },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }
    return profile
  }

  /**
   * 更新用户资料状态
   * @param updateDto - 更新参数，包含用户ID、状态和封禁原因
   * @throws Error 用户不存在
   */
  async updateProfileStatus(updateDto: UpdateProfileStatusDto): Promise<void> {
    const { userId, status, banReason } = updateDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    await this.prisma.forumProfile.update({
      where: { userId },
      data: { status, banReason },
    })
  }

  /**
   * 查看我的主题
   * @param profileId - 用户资料ID
   * @returns 分页的主题列表，包含板块信息和回复数统计
   */
  async getMyTopics(profileId: number) {
    return this.prisma.forumTopic.findPagination({
      where: {
        profileId,
        deletedAt: null,
      },
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        include: {
          section: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      },
    })
  }

  /**
   * 查看我的收藏
   * @param profileId - 用户资料ID
   * @returns 分页的收藏列表，包含主题信息和回复数统计
   */
  async getMyFavorites(profileId: number) {
    return this.prisma.forumTopicFavorite.findPagination({
      where: {
        profileId,
      },
      include: {
        topic: {
          include: {
            section: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
        },
      },
    })
  }

  /**
   * 查看积分记录
   * @param profileId - 用户资料ID
   * @returns 分页的积分记录列表
   */
  async getPointRecords(profileId: number) {
    return this.prisma.forumPointRecord.findPagination({
      where: {
        profileId,
      },
    })
  }

  /**
   * 初始化用户论坛资料
   * @param tx - Prisma 事务客户端
   * @param userId - 用户 ID
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async initForumProfile(tx: Prisma.TransactionClient, userId: number) {
    const defaultLevel = await tx.forumLevelRule.findFirst({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })

    if (!defaultLevel) {
      throw new BadRequestException('系统配置错误：找不到默认论坛等级')
    }

    await tx.forumProfile.create({
      data: {
        userId,
        points: ForumProfileDefaults.INITIAL_POINTS,
        experience: ForumProfileDefaults.INITIAL_EXPERIENCE,
        levelId: defaultLevel.id,
        topicCount: ForumProfileDefaults.INITIAL_TOPIC_COUNT,
        replyCount: ForumProfileDefaults.INITIAL_REPLY_COUNT,
        likeCount: ForumProfileDefaults.INITIAL_LIKE_COUNT,
        favoriteCount: ForumProfileDefaults.INITIAL_FAVORITE_COUNT,
        signature: ForumProfileDefaults.DEFAULT_SIGNATURE,
        bio: ForumProfileDefaults.DEFAULT_BIO,
        status: ForumProfileDefaults.STATUS_ACTIVE,
      },
    })
  }
}
