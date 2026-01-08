import { BaseService } from '@libs/base/database'

import { IdDto } from '@libs/base/dto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateForumBadgeDto,
  ProfileBadgeDto,
  QueryForumBadgeDto,
  UpdateForumBadgeDto,
} from './dto/forum-badge.dto'

/**
 * 论坛徽章服务类
 * 提供论坛徽章的增删改查、徽章分配与撤销、用户徽章管理等核心业务逻辑
 */
@Injectable()
export class ForumBadgeService extends BaseService {
  /**
   * 获取徽章的 Prisma 模型
   */
  get forumBadge() {
    return this.prisma.forumBadge
  }

  /**
   * 获取用户徽章关联的 Prisma 模型
   */
  get forumProfileBadge() {
    return this.prisma.forumProfileBadge
  }

  /**
   * 获取用户资料的 Prisma 模型
   */
  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 创建新的论坛徽章
   * @param createForumBadgeDto 创建徽章的数据传输对象
   * @returns 创建成功的徽章
   */
  async createBadge(createForumBadgeDto: CreateForumBadgeDto) {
    return this.forumBadge.create({
      data: createForumBadgeDto,
    })
  }

  /**
   * 更新论坛徽章信息
   * @param updateForumBadgeDto 更新徽章的数据传输对象
   * @returns 更新后的徽章
   * @throws NotFoundException 如果徽章不存在
   */
  async updateBadge(updateForumBadgeDto: UpdateForumBadgeDto) {
    const { id, ...data } = updateForumBadgeDto
    if (!(await this.forumBadge.exists({ id }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.forumBadge.update({
      where: { id },
      data,
    })
  }

  /**
   * 删除论坛徽章
   * @param dto 包含徽章 ID 的数据传输对象
   * @returns 删除的徽章
   * @throws NotFoundException 如果徽章不存在
   */
  async deleteBadge(dto: IdDto) {
    if (!(await this.forumBadge.exists({ id: dto.id }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumProfileBadge.deleteMany({
        where: { badgeId: dto.id },
      })

      return tx.forumBadge.delete({
        where: { id: dto.id },
      })
    })
  }

  /**
   * 获取徽章详情
   * @param dto 包含徽章 ID 的数据传输对象
   * @returns 徽章详情，包含最近 10 个拥有该徽章的用户信息
   * @throws NotFoundException 如果徽章不存在
   */
  async getBadge(dto: IdDto) {
    if (!(await this.forumBadge.exists({ id: dto.id }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.forumBadge.findUnique({
      where: { id: dto.id },
    })
  }

  /**
   * 获取徽章列表（分页）
   * @param queryForumBadgeDto 查询参数
   * @returns 分页的徽章列表
   */
  async getBadges(queryForumBadgeDto: QueryForumBadgeDto) {
    return this.forumBadge.findPagination({
      where: {
        ...queryForumBadgeDto,
        name: {
          contains: queryForumBadgeDto.name,
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 为用户分配徽章
   * @param assignBadgeDto 分配徽章的数据传输对象
   * @returns 创建的用户徽章关联
   * @throws BadRequestException 如果用户资料不存在、徽章不存在、徽章未启用或用户已拥有该徽章
   * @throws NotFoundException 如果徽章不存在
   */
  async assignBadge(assignBadgeDto: ProfileBadgeDto) {
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

  /**
   * 撤销用户的徽章
   * @param profileBadgeDto 包含用户资料 ID 和徽章 ID 的数据传输对象
   * @returns 删除的用户徽章关联
   * @throws BadRequestException 如果用户徽章记录不存在
   */
  async revokeBadge(profileBadgeDto: ProfileBadgeDto) {
    const { profileId, badgeId } = profileBadgeDto

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

  /**
   * 获取用户的徽章列表
   * @param profileId 用户资料 ID
   * @param queryForumBadgeDto 查询参数
   * @returns 用户的徽章列表
   * @throws NotFoundException 如果用户资料不存在
   */
  async getUserBadges(
    profileId: number,
    queryForumBadgeDto: QueryForumBadgeDto,
  ) {
    const { name, type, isEnabled } = queryForumBadgeDto

    if (!(await this.forumProfile.exists({ id: profileId }))) {
      throw new NotFoundException('用户资料不存在')
    }

    return this.forumProfileBadge.findMany({
      where: {
        profileId,
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

  /**
   * 获取拥有某个徽章的用户列表（分页）
   * @param badgeId 徽章 ID
   * @param queryForumBadgeDto 查询参数
   * @returns 分页的用户列表
   * @throws NotFoundException 如果徽章不存在
   */
  async getBadgeUsers(badgeId: number, queryForumBadgeDto: QueryForumBadgeDto) {
    if (!(await this.forumBadge.exists({ id: badgeId }))) {
      throw new NotFoundException('徽章不存在')
    }

    return this.forumProfileBadge.findPagination({
      where: {
        badgeId,
        badge: {
          ...queryForumBadgeDto,
          name: {
            contains: queryForumBadgeDto.name,
          },
        },
      },
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
    })
  }

  /**
   * 获取徽章统计信息
   * @returns 徽章统计数据，包括总数、启用/禁用数量、分配总数、类型分布、热门徽章等
   */
  async getBadgeStatistics() {
    const [totalBadges, typeCounts, enabledCount, totalAssignments, topBadges] =
      await Promise.all([
        this.forumBadge.count(),
        this.forumBadge.groupBy({
          by: ['type'],
          _count: true,
        }),
        this.forumBadge.count({
          where: { isEnabled: true },
        }),
        this.forumProfileBadge.count(),
        this.forumProfileBadge.groupBy({
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
    const badges = await this.forumBadge.findMany({
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
