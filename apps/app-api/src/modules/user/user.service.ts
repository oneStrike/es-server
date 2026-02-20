import type { QueryUserBadgeDto } from '@libs/user/badge'
import { BaseService } from '@libs/base/database'
import { UserBadgeService } from '@libs/user/badge'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { Injectable } from '@nestjs/common'

/**
 * 前台用户服务
 * 负责用户基础资料与成长概览查询
 */
@Injectable()
export class UserService extends BaseService {
  constructor(
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super()
  }

  /**
   * 获取用户资料
   * @param userId 用户ID
   * @returns 用户资料（已脱敏）
   */
  async getUserProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return this.sanitizeUser(user)
  }

  /**
   * 获取用户成长概览
   * @param userId 用户ID
   * @returns 成长概览数据
   */
  async getUserGrowthOverview(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        points: true,
        experience: true,
        levelId: true,
      },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    const [levelInfo, badges] = await Promise.all([
      this.userLevelRuleService.getUserLevelInfo(userId),
      this.userBadgeService.getUserBadges(
        userId,
        {} as QueryUserBadgeDto,
      ),
    ])

    return {
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? null,
      levelInfo,
      badges,
    }
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user
    return sanitized
  }
}
