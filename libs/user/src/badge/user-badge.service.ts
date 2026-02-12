import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AssignUserBadgeDto,
  CreateUserBadgeDto,
  QueryUserBadgeDto,
  UpdateUserBadgeDto,
} from './dto/user-badge.dto'

/**
 * 用户徽章服务类
 * 负责徽章管理与用户徽章授予/回收
 */
@Injectable()
export class UserBadgeService extends BaseService {
  /**
   * 获取徽章模型
   */
  get userBadge() {
    return this.prisma.userBadge
  }

  /**
   * 获取徽章分配模型
   */
  get userBadgeAssignment() {
    return this.prisma.userBadgeAssignment
  }

  /**
   * 创建徽章
   * @param dto 创建参数
   * @returns 新徽章
   */
  async createBadge(dto: CreateUserBadgeDto) {
    return this.userBadge.create({
      data: dto,
    })
  }

  /**
   * 更新徽章
   * @param dto 更新参数
   * @returns 更新后的徽章
   */
  async updateBadge(dto: UpdateUserBadgeDto) {
    const { id, ...updateData } = dto
    if (!(await this.userBadge.exists({ id }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.userBadge.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除徽章
   * 同步删除分配记录
   * @param dto 删除参数
   * @param dto.id 徽章ID
   * @returns 删除结果
   */
  async deleteBadge(dto: { id: number }) {
    if (!(await this.userBadge.exists({ id: dto.id }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userBadgeAssignment.deleteMany({
        where: { badgeId: dto.id },
      })

      return tx.userBadge.delete({
        where: { id: dto.id },
      })
    })
  }

  /**
   * 获取徽章详情
   * @param dto 查询参数
   * @param dto.id 徽章ID
   * @returns 徽章详情
   */
  async getBadgeDetail(dto: { id: number }) {
    if (!(await this.userBadge.exists({ id: dto.id }))) {
      throw new NotFoundException('徽章不存在')
    }
    return this.userBadge.findUnique({
      where: { id: dto.id },
    })
  }

  /**
   * 查询徽章列表
   * @param dto 查询参数
   * @returns 分页结果
   */
  async getBadges(dto: QueryUserBadgeDto) {
    return this.userBadge.findPagination({
      where: {
        ...dto,
        name: {
          contains: dto.name,
        },
      },
    })
  }

  /**
   * 授予徽章
   * @param dto 授予参数
   * @returns 授予记录
   */
  async assignBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    if (!(await this.userBadge.exists({ id: badgeId }))) {
      throw new NotFoundException('徽章不存在')
    }

    if (!(await this.prisma.appUser.exists({ id: userId }))) {
      throw new NotFoundException('用户不存在')
    }

    const existingBadge = await this.userBadgeAssignment.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })

    if (existingBadge) {
      throw new BadRequestException('用户已拥有该徽章')
    }

    return this.userBadgeAssignment.create({
      data: {
        userId,
        badgeId,
      },
    })
  }

  /**
   * 回收徽章
   * @param dto 回收参数
   * @returns 回收结果
   */
  async revokeBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    const badge = await this.userBadgeAssignment.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })

    if (!badge) {
      throw new BadRequestException('用户徽章记录不存在')
    }

    return this.userBadgeAssignment.delete({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    })
  }

  async getUserBadges(userId: number, dto: QueryUserBadgeDto) {
    const { name, type, isEnabled } = dto

    if (!(await this.prisma.appUser.exists({ id: userId }))) {
      throw new NotFoundException('用户不存在')
    }

    return this.userBadgeAssignment.findMany({
      where: {
        userId,
        badge: {
          name: {
            contains: name,
          },
          type,
          isEnabled,
        },
      },
      include: {
        badge: true,
      },
    })
  }

  async getBadgeUsers(badgeId: number, dto: QueryUserBadgeDto) {
    if (!(await this.userBadge.exists({ id: badgeId }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.userBadgeAssignment.findPagination({
      where: {
        badgeId,
        badge: {
          ...dto,
          name: {
            contains: dto.name,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            level: true,
            point: true,
          },
        },
      },
    })
  }

  async getBadgeStatistics() {
    const [totalBadges, typeCounts, enabledCount, totalAssignments, topBadges] =
      await Promise.all([
        this.userBadge.count(),
        this.userBadge.groupBy({
          by: ['type'],
          _count: true,
        }),
        this.userBadge.count({
          where: { isEnabled: true },
        }),
        this.userBadgeAssignment.count(),
        this.userBadgeAssignment.groupBy({
          by: ['badgeId'],
          _count: true,
          orderBy: {
            _count: {
              badgeId: 'desc',
            },
          },
          take: 5,
        }),
      ])

    const badgeIds = topBadges.map((item) => item.badgeId)
    const badges = await this.userBadge.findMany({
      where: { id: { in: badgeIds } },
    })

    const badgeMap = new Map(badges.map((badge) => [badge.id, badge]))
    const topBadgesWithDetails = topBadges.map((item) => ({
      badge: badgeMap.get(item.badgeId),
      count: item._count,
    }))

    return {
      totalBadges,
      enabledCount,
      disabledCount: totalBadges - enabledCount,
      totalAssignments,
      typeDistribution: typeCounts.map((item) => ({
        type: item.type,
        count: item._count,
      })),
      topBadges: topBadgesWithDetails,
    }
  }
}
