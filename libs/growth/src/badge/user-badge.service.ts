import { PlatformService } from '@libs/platform/database'
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

@Injectable()
export class UserBadgeService extends PlatformService {
  get userBadge() {
    return this.prisma.userBadge
  }

  get userBadgeAssignment() {
    return this.prisma.userBadgeAssignment
  }

  async createBadge(dto: CreateUserBadgeDto) {
    return this.userBadge.create({
      data: dto,
    })
  }

  async updateBadge(dto: UpdateUserBadgeDto) {
    const { id, ...updateData } = dto

    try {
      return await this.userBadge.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('徽章不存在')
        },
      })
    }
  }

  async deleteBadge(dto: { id: number }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.userBadgeAssignment.deleteMany({
          where: { badgeId: dto.id },
        })

        return tx.userBadge.delete({
          where: { id: dto.id },
        })
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('徽章不存在')
        },
      })
    }
  }

  async getBadgeDetail(dto: { id: number }) {
    const badge = await this.userBadge.findUnique({
      where: { id: dto.id },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    return badge
  }

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

  async assignBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    if (!(await this.userBadge.exists({ id: badgeId }))) {
      throw new NotFoundException('徽章不存在')
    }

    if (!(await this.prisma.appUser.exists({ id: userId }))) {
      throw new NotFoundException('用户不存在')
    }

    try {
      return await this.userBadgeAssignment.create({
        data: {
          userId,
          badgeId,
        },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('用户已拥有该徽章')
        },
      })
    }
  }

  async revokeBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    try {
      return await this.userBadgeAssignment.delete({
        where: {
          userId_badgeId: {
            userId,
            badgeId,
          },
        },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('用户徽章记录不存在')
        },
      })
    }
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
