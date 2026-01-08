import { RepositoryService } from '@libs/base/database'
import { PointService } from '@libs/forum/point/point.service'
import { Injectable } from '@nestjs/common'
import { QueryUserListDto, UpdateUserStatusDto } from './dto/user.dto'

/**
 * 用户服务类
 * 提供用户资料查询、状态管理、主题收藏、积分记录等核心业务逻辑
 */
@Injectable()
export class UserService extends RepositoryService {
  constructor(protected readonly pointService: PointService) {
    super()
  }

  /**
   * 获取论坛用户资料模型
   */
  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 查询用户列表
   * @param queryDto - 查询参数，包含用户ID、昵称、状态等过滤条件
   * @returns 分页的用户列表，包含用户信息和徽章信息
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
   * @param userId - 用户ID
   * @returns 用户资料详情，包含用户信息和徽章信息
   * @throws Error 用户不存在
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
   * @param updateDto - 更新参数，包含用户ID、状态和封禁原因
   * @throws Error 用户不存在
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
    return this.prisma.forumPointRecord.findPagination({
      where: {
        userId,
      },
    })
  }
}
