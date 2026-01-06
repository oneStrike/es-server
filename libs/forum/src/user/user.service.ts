import { RepositoryService } from '@libs/base/database'
import { PointService } from '@libs/forum/point/point.service'
import { Injectable } from '@nestjs/common'
import { QueryUserListDto, UpdateUserStatusDto } from './dto/user.dto'

/**
 * 用户服务
 */
@Injectable()
export class UserService extends RepositoryService {
  constructor(protected readonly pointService: PointService) {
    super()
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 查询用户列表
   * @param queryDto 查询参数
   * @returns 用户列表
   */
  async queryUserList(queryDto: QueryUserListDto) {
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
   * @param userId 用户ID
   * @returns 用户资料
   */
  async getUserProfile(userId: number) {
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
   * 更新用户状态
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateUserStatus(updateDto: UpdateUserStatusDto): Promise<void> {
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
   * @param userId 用户ID
   * @returns 主题列表
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
   * @param userId 用户ID
   * @returns 收藏列表
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
   * @param userId 用户ID
   * @returns 积分记录列表
   */
  async getPointRecords(userId: number) {
    return this.prisma.forumPointRecord.findPagination({
      where: {
        userId,
      },
    })
  }
}
