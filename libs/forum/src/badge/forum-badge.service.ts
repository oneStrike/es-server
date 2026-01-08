import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CreateForumBadgeDto,
  QueryForumBadgeDto,
  UpdateForumBadgeDto,
  AssignBadgeDto,
} from './dto/forum-badge.dto'

@Injectable()
export class ForumBadgeService extends RepositoryService {
  get forumBadge() {
    return this.prisma.forumBadge
  }

  get forumProfileBadge() {
    return this.prisma.forumProfileBadge
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async createBadge(createForumBadgeDto: CreateForumBadgeDto) {
    return this.forumBadge.create({
      data: createForumBadgeDto,
    })
  }

  async updateBadge(id: number, updateForumBadgeDto: UpdateForumBadgeDto) {
    const badge = await this.forumBadge.findUnique({
      where: { id },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    return this.forumBadge.update({
      where: { id },
      data: updateForumBadgeDto,
    })
  }

  async deleteBadge(id: number) {
    const badge = await this.forumBadge.findUnique({
      where: { id },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumProfileBadge.deleteMany({
        where: { badgeId: id },
      })

      return tx.forumBadge.delete({
        where: { id },
      })
    })
  }

  async getBadge(id: number) {
    const badge = await this.forumBadge.findUnique({
      where: { id },
      include: {
        badges: {
          select: {
            id: true,
            profileId: true,
            createdAt: true,
            profile: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
          },
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    return badge
  }

  async getBadges(queryForumBadgeDto: QueryForumBadgeDto) {
    const { name, type, isEnabled, pageIndex = 0, pageSize = 15 } = queryForumBadgeDto

    const where: any = {}

    if (name) {
      where.name = {
        contains: name,
      }
    }

    if (type) {
      where.type = type
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    return this.forumBadge.findPagination({
      where,
      orderBy: [
        {
          order: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      pageIndex,
      pageSize,
    })
  }

  async assignBadge(assignBadgeDto: AssignBadgeDto) {
    const { profileId, badgeId } = assignBadgeDto

    const profile = await this.forumProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new BadRequestException('用户资料不存在')
    }

    const badge = await this.forumBadge.findUnique({
      where: { id: badgeId },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    if (!badge.isEnabled) {
      throw new BadRequestException('该徽章未启用，无法分配')
    }

    const existingBadge = await this.forumProfileBadge.findUnique({
      where: {
        profileId_badgeId: {
          profileId,
          badgeId,
        },
      },
    })

    if (existingBadge) {
      throw new BadRequestException('用户已拥有该徽章')
    }

    return this.forumProfileBadge.create({
      data: {
        profileId,
        badgeId,
      },
    })
  }

  async revokeBadge(profileId: number, badgeId: number) {
    const badge = await this.forumProfileBadge.findUnique({
      where: {
        profileId_badgeId: {
          profileId,
          badgeId,
        },
      },
    })

    if (!badge) {
      throw new BadRequestException('用户徽章记录不存在')
    }

    return this.forumProfileBadge.delete({
      where: {
        profileId_badgeId: {
          profileId,
          badgeId,
        },
      },
    })
  }

  async getUserBadges(profileId: number, queryForumBadgeDto: QueryForumBadgeDto) {
    const { type, isEnabled } = queryForumBadgeDto

    const profile = await this.forumProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new NotFoundException('用户资料不存在')
    }

    const where: any = {
      profileId,
    }

    if (type || isEnabled !== undefined) {
      where.badge = {}
      if (type) {
        where.badge.type = type
      }
      if (isEnabled !== undefined) {
        where.badge.isEnabled = isEnabled
      }
    }

    const profileBadges = await this.forumProfileBadge.findMany({
      where,
      include: {
        badge: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      profileId,
      badges: profileBadges.map((pb) => ({
        ...pb.badge,
        assignedAt: pb.createdAt,
      })),
      total: profileBadges.length,
    }
  }

  async getBadgeUsers(badgeId: number, queryForumBadgeDto: QueryForumBadgeDto) {
    const badge = await this.forumBadge.findUnique({
      where: { id: badgeId },
    })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    const { pageIndex = 0, pageSize = 15 } = queryForumBadgeDto

    const where: any = {
      badgeId,
    }

    return this.forumProfileBadge.findPagination({
      where,
      include: {
        profile: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            level: true,
            point: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      pageIndex,
      pageSize,
    })
  }

  async getBadgeStatistics() {
    const totalBadges = await this.forumBadge.count()

    const typeCounts = await this.forumBadge.groupBy({
      by: ['type'],
      _count: true,
    })

    const enabledCount = await this.forumBadge.count({
      where: { isEnabled: true },
    })

    const disabledCount = await this.forumBadge.count({
      where: { isEnabled: false },
    })

    const totalAssignments = await this.forumProfileBadge.count()

    const topBadges = await this.forumProfileBadge.groupBy({
      by: ['badgeId'],
      _count: true,
      orderBy: {
        _count: {
          badgeId: 'desc',
        },
      },
      take: 5,
    })

    const topBadgesWithDetails = await Promise.all(
      topBadges.map(async (item) => {
        const badge = await this.forumBadge.findUnique({
          where: { id: item.badgeId },
        })
        return {
          badge,
          count: item._count,
        }
      }),
    )

    return {
      totalBadges,
      enabledCount,
      disabledCount,
      totalAssignments,
      typeDistribution: typeCounts.map((item) => ({
        type: item.type,
        count: item._count,
      })),
      topBadges: topBadgesWithDetails,
    }
  }
}
