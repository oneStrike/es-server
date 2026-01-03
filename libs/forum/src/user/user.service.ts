import { Injectable } from '@nestjs/common'
import { PrismaService } from '@libs/prisma'
import {
  UpdateUserPointsDto,
  UpdateUserLevelDto,
  UpdateUserStatusDto,
  GrantBadgeDto,
  RevokeBadgeDto,
  QueryUserListDto,
  UserProfileDto,
  UserTopicListDto,
  UserReplyListDto,
  UserFavoriteListDto,
  PointRecordDto,
} from './dto/user.dto'
import { UserLevelEnum, UserStatusEnum, UserLevelNames, UserStatusNames } from './user.constant'

/**
 * 用户服务
 */
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 查询用户列表
   * @param queryDto 查询参数
   * @returns 用户列表
   */
  async queryUserList(queryDto: QueryUserListDto): Promise<{ list: UserProfileDto[]; total: number; page: number; pageSize: number }> {
    const { keyword, level, status, page = 1, pageSize = 20 } = queryDto

    const where: any = {
      deletedAt: null,
    }

    if (keyword) {
      where.OR = [
        { user: { username: { contains: keyword } } },
        { user: { nickname: { contains: keyword } } },
      ]
    }

    if (level) {
      where.level = level
    }

    if (status) {
      where.status = status
    }

    const [profiles, total] = await Promise.all([
      this.prisma.forumProfile.findMany({
        where,
        include: {
          user: true,
          badges: {
            include: {
              badge: true,
            },
          },
          _count: {
            select: {
              topics: true,
              replies: true,
              favorites: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumProfile.count({ where }),
    ])

    const list = profiles.map((profile) => this.mapToUserProfileDto(profile))

    return {
      list,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 查看用户资料
   * @param userId 用户ID
   * @returns 用户资料
   */
  async getUserProfile(userId: number): Promise<UserProfileDto> {
    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        badges: {
          include: {
            badge: true,
          },
        },
        _count: {
          select: {
            topics: true,
            replies: true,
            favorites: true,
          },
        },
      },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    return this.mapToUserProfileDto(profile)
  }

  /**
   * 更新用户积分
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateUserPoints(updateDto: UpdateUserPointsDto): Promise<void> {
    const { userId, points, reason } = updateDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    await this.prisma.$transaction(async (tx) => {
      const beforePoints = profile.points
      const afterPoints = beforePoints + points

      await tx.forumProfile.update({
        where: { userId },
        data: {
          points: afterPoints,
        },
      })

      await tx.forumPointRecord.create({
        data: {
          userId,
          points,
          beforePoints,
          afterPoints,
          reason,
        },
      })
    })
  }

  /**
   * 更新用户等级
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateUserLevel(updateDto: UpdateUserLevelDto): Promise<void> {
    const { userId, level } = updateDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    await this.prisma.forumProfile.update({
      where: { userId },
      data: { level },
    })
  }

  /**
   * 更新用户状态
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateUserStatus(updateDto: UpdateUserStatusDto): Promise<void> {
    const { userId, status, reason } = updateDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    await this.prisma.forumProfile.update({
      where: { userId },
      data: { status },
    })
  }

  /**
   * 授予徽章
   * @param grantDto 授予参数
   * @returns 授予结果
   */
  async grantBadge(grantDto: GrantBadgeDto): Promise<void> {
    const { userId, badgeId } = grantDto

    const profile = await this.prisma.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new Error('用户不存在')
    }

    const badge = await this.prisma.forumBadge.findUnique({
      where: { id: badgeId },
    })

    if (!badge) {
      throw new Error('徽章不存在')
    }

    const existing = await this.prisma.forumUserBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })

    if (existing) {
      throw new Error('用户已拥有该徽章')
    }

    await this.prisma.forumUserBadge.create({
      data: {
        userId,
        badgeId,
      },
    })
  }

  /**
   * 撤销徽章
   * @param revokeDto 撤销参数
   * @returns 撤销结果
   */
  async revokeBadge(revokeDto: RevokeBadgeDto): Promise<void> {
    const { userId, badgeId } = revokeDto

    const userBadge = await this.prisma.forumUserBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })

    if (!userBadge) {
      throw new Error('用户未拥有该徽章')
    }

    await this.prisma.forumUserBadge.delete({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })
  }

  /**
   * 查看我的主题
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 主题列表
   */
  async getMyTopics(userId: number, page = 1, pageSize = 20): Promise<{ list: UserTopicListDto[]; total: number; page: number; pageSize: number }> {
    const [topics, total] = await Promise.all([
      this.prisma.forumTopic.findMany({
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
          _count: {
            select: {
              replies: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumTopic.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ])

    const list = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      sectionId: topic.sectionId,
      sectionName: topic.section.name,
      replyCount: topic._count.replies,
      viewCount: topic.viewCount,
      createdAt: topic.createdAt,
    }))

    return {
      list,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 查看我的回复
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 回复列表
   */
  async getMyReplies(userId: number, page = 1, pageSize = 20): Promise<{ list: UserReplyListDto[]; total: number; page: number; pageSize: number }> {
    const [replies, total] = await Promise.all([
      this.prisma.forumReply.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        include: {
          topic: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              likes: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumReply.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ])

    const list = replies.map((reply) => ({
      id: reply.id,
      topicId: reply.topicId,
      topicTitle: reply.topic.title,
      content: reply.content,
      likeCount: reply._count.likes,
      createdAt: reply.createdAt,
    }))

    return {
      list,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 查看我的收藏
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 收藏列表
   */
  async getMyFavorites(userId: number, page = 1, pageSize = 20): Promise<{ list: UserFavoriteListDto[]; total: number; page: number; pageSize: number }> {
    const [favorites, total] = await Promise.all([
      this.prisma.forumTopicFavorite.findMany({
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
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumTopicFavorite.count({
        where: {
          userId,
        },
      }),
    ])

    const list = favorites.map((favorite) => ({
      topicId: favorite.topicId,
      topicTitle: favorite.topic.title,
      sectionId: favorite.topic.sectionId,
      sectionName: favorite.topic.section.name,
      replyCount: favorite.topic._count.replies,
      viewCount: favorite.topic.viewCount,
      createdAt: favorite.createdAt,
    }))

    return {
      list,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 查看积分记录
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 积分记录列表
   */
  async getPointRecords(userId: number, page = 1, pageSize = 20): Promise<{ list: PointRecordDto[]; total: number; page: number; pageSize: number }> {
    const [records, total] = await Promise.all([
      this.prisma.forumPointRecord.findMany({
        where: {
          userId,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.forumPointRecord.count({
        where: {
          userId,
        },
      }),
    ])

    const list = records.map((record) => ({
      id: record.id,
      points: record.points,
      reason: record.reason,
      createdAt: record.createdAt,
    }))

    return {
      list,
      total,
      page,
      pageSize,
    }
  }

  /**
   * 映射到用户资料DTO
   * @param profile 用户资料
   * @returns 用户资料DTO
   */
  private mapToUserProfileDto(profile: any): UserProfileDto {
    return {
      userId: profile.userId,
      username: profile.user?.username || '',
      nickname: profile.user?.nickname || '',
      avatar: profile.user?.avatar,
      points: profile.points,
      level: profile.level,
      levelName: UserLevelNames[profile.level],
      status: profile.status,
      statusName: UserStatusNames[profile.status],
      topicCount: profile._count.topics,
      replyCount: profile._count.replies,
      favoriteCount: profile._count.favorites,
      badges: profile.badges.map((ub: any) => ({
        id: ub.badge.id,
        name: ub.badge.name,
        icon: ub.badge.icon,
        description: ub.badge.description,
      })),
      createdAt: profile.createdAt,
    }
  }
}
