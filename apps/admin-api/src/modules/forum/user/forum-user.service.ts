import type { ForumProfileWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ForumPointObjectTypeEnum } from '../../forum.constant'
import {
  AdjustPointsDto,
  CreateForumProfileDto,
  QueryForumProfileDto,
  UpdateForumProfileDto,
} from './dto/forum-user.dto'

/**
 * 论坛用户服务类
 * 提供论坛用户的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumUserService extends RepositoryService {
  get forumProfile() {
    return this.prisma.forumProfile
  }

  get forumLevelRule() {
    return this.prisma.forumLevelRule
  }

  get forumPointRecord() {
    return this.prisma.forumPointRecord
  }

  get clientUser() {
    return this.prisma.clientUser
  }

  /**
   * 创建论坛用户资料
   * @param createForumProfileDto 创建用户资料的数据
   * @returns 创建的用户资料信息
   */
  async createForumProfile(createForumProfileDto: CreateForumProfileDto) {
    const { userId, levelId, ...profileData } = createForumProfileDto

    const existingUser = await this.clientUser.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      throw new BadRequestException('用户不存在')
    }

    const existingProfile = await this.forumProfile.findUnique({
      where: { userId },
    })

    if (existingProfile) {
      throw new BadRequestException('该用户已存在论坛资料')
    }

    if (levelId) {
      const existingLevel = await this.forumLevelRule.findUnique({
        where: { id: levelId },
      })

      if (!existingLevel) {
        throw new BadRequestException('等级不存在')
      }
    }

    return this.forumProfile.create({
      data: {
        ...profileData,
        userId,
        levelId,
      },
    })
  }

  /**
   * 分页查询论坛用户资料列表
   * @param queryForumProfileDto 查询条件
   * @returns 分页的用户资料列表
   */
  async getForumProfilePage(queryForumProfileDto: QueryForumProfileDto) {
    const { userId, ...otherDto } = queryForumProfileDto

    const where: ForumProfileWhereInput = {}

    if (isNotNil(userId)) {
      where.userId = userId
    }

    return this.forumProfile.findPagination({
      where,
      select: {
        id: true,
        userId: true,
        points: true,
        topicCount: true,
        replyCount: true,
        likeCount: true,
        favoriteCount: true,
        isBanned: true,
        createdAt: true,
        updatedAt: true,
        level: {
          select: {
            id: true,
            name: true,
            icon: true,
            requiredPoints: true,
          },
        },
        badges: {
          select: {
            id: true,
            name: true,
            icon: true,
            createdAt: true,
          },
        },
      },
    })
  }

  /**
   * 获取论坛用户资料详情
   * @param id 用户资料ID
   * @returns 用户资料详情信息
   */
  async getForumProfileDetail(id: number) {
    const profile = await this.forumProfile.findUnique({
      where: { id },
      include: {
        level: true,
        badges: true,
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })

    if (!profile) {
      throw new BadRequestException('论坛用户资料不存在')
    }

    return profile
  }

  /**
   * 更新论坛用户资料
   * @param updateForumProfileDto 更新用户资料的数据
   * @returns 更新后的用户资料信息
   */
  async updateForumProfile(updateForumProfileDto: UpdateForumProfileDto) {
    const { id, levelId, ...updateData } = updateForumProfileDto

    const existingProfile = await this.forumProfile.findUnique({
      where: { id },
    })

    if (!existingProfile) {
      throw new BadRequestException('论坛用户资料不存在')
    }

    if (isNotNil(levelId)) {
      const existingLevel = await this.forumLevelRule.findUnique({
        where: { id: levelId },
      })

      if (!existingLevel) {
        throw new BadRequestException('等级不存在')
      }
    }

    return this.forumProfile.update({
      where: { id },
      data: {
        ...updateData,
        levelId,
      },
    })
  }

  /**
   * 软删除论坛用户资料
   * @param id 用户资料ID
   * @returns 删除结果
   */
  async deleteForumProfile(id: number) {
    return this.forumProfile.softDelete({ id })
  }

  /**
   * 调整用户积分
   * @param adjustPointsDto 积分调整数据
   * @returns 调整结果
   */
  async adjustPoints(adjustPointsDto: AdjustPointsDto) {
    const { userId, points, reason } = adjustPointsDto

    const profile = await this.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new BadRequestException('论坛用户资料不存在')
    }

    if (profile.isBanned) {
      throw new BadRequestException('该用户已被封禁，无法调整积分')
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedProfile = await tx.forumProfile.update({
        where: { userId },
        data: {
          points: {
            increment: points,
          },
        },
      })

      await tx.forumPointRecord.create({
        data: {
          userId,
          points,
          beforePoints: profile.points,
          afterPoints: updatedProfile.points,
          objectType: ForumPointObjectTypeEnum.ADMIN,
          objectId: 0,
        },
      })

      return updatedProfile
    })
  }

  /**
   * 更新用户封禁状态
   * @param id 用户资料ID
   * @param isBanned 是否封禁
   * @returns 更新结果
   */
  async updateBanStatus(id: number, isBanned: boolean) {
    const profile = await this.forumProfile.findUnique({
      where: { id },
    })

    if (!profile) {
      throw new BadRequestException('论坛用户资料不存在')
    }

    return this.forumProfile.update({
      where: { id },
      data: { isBanned },
    })
  }
}
