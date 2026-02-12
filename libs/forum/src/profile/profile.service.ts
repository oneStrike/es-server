import type { PrismaClientType } from '@libs/base/database/prisma.types'
import { UserDefaults, UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { UserPointService } from '@libs/user/point'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  QueryForumProfileListDto,
  UpdateForumProfileStatusDto,
} from './dto/profile.dto'

type ForumProfileTransactionClient = Pick<
  PrismaClientType,
  'userLevelRule' | 'appUser' | 'forumProfile'
>

/**
 * 论坛资料服务类
 * 提供用户资料查询、状态管理、主题收藏、积分记录等核心业务逻辑
 */
@Injectable()
export class ForumProfileService extends BaseService {
  constructor(protected readonly pointService: UserPointService) {
    super()
  }

  /**
   * 获取论坛用户资料模型
   */
  // get forumProfile() {
  //   return this.prisma.forumProfile
  // }

  /**
   * 查询用户资料列表
   * @param queryDto - 查询参数，包含用户ID、昵称、状态等过滤条件
   * @returns 分页的用户资料列表，包含用户信息和徽章信息
   */
  async queryProfileList(queryDto: QueryForumProfileListDto) {
    const { levelId, status, nickname, ...rest } = queryDto

    return this.prisma.appUser.findPagination({
      where: {
        ...rest,
        nickname: { contains: nickname },
        levelId,
        status,
      },
      select: {
        id: true,
        avatar: true,
        nickname: true,
        levelId: true,
        status: true,
        points: true,
        experience: true,
        forumProfile: {
          select: {
            topicCount: true,
            replyCount: true,
            likeCount: true,
            favoriteCount: true,
            signature: true,
            bio: true,
          },
        },
        userBadges: {
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
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: {
        forumProfile: true,
        userBadges: {
          include: {
            badge: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error('用户不存在')
    }
    return user
  }

  /**
   * 更新用户资料状态
   * @param updateDto - 更新参数，包含用户ID、状态和封禁原因
   * @throws Error 用户不存在
   */
  async updateProfileStatus(
    updateDto: UpdateForumProfileStatusDto,
  ): Promise<void> {
    const { userId, status, banReason } = updateDto

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    await this.prisma.appUser.update({
      where: { id: userId },
      data: { status, banReason },
    })
  }

  /**
   * 查看我的主题
   * @param userId - 用户ID
   * @returns 分页的主题列表，包含板块信息和回复数统计
   */
  async getMyTopics(userId: number) {
    return this.prisma.forumTopic.findPagination({
      where: {
        userId,
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
   * @param userId - 用户ID
   * @returns 分页的收藏列表，包含主题信息和回复数统计
   */
  async getMyFavorites(userId: number) {
    return this.prisma.forumTopicFavorite.findPagination({
      where: {
        userId,
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
   * @param userId - 用户ID
   * @returns 分页的积分记录列表
   */
  async getPointRecords(userId: number) {
    return this.prisma.userPointRecord.findPagination({
      where: {
        userId,
      },
    })
  }

  /**
   * 初始化用户论坛资料
   * @param tx - Prisma 事务客户端
   * @param userId - 用户 ID
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async initForumProfile(tx: ForumProfileTransactionClient, userId: number) {
    const defaultLevel = await tx.userLevelRule.findFirst({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })

    if (!defaultLevel) {
      throw new BadRequestException('系统配置错误：找不到默认论坛等级')
    }

    await tx.appUser.update({
      where: { id: userId },
      data: {
        points: UserDefaults.INITIAL_POINTS,
        experience: UserDefaults.INITIAL_EXPERIENCE,
        levelId: defaultLevel.id,
        status: UserStatusEnum.NORMAL,
      },
    })

    await tx.forumProfile.create({
      data: {
        userId,
        topicCount: 0,
        replyCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        signature: '',
        bio: '',
      },
    })
  }
}
