import type { QueryUserBadgeDto } from '@libs/user/badge'
import { BaseService } from '@libs/base/database'
import { UserBadgeService } from '@libs/user/badge'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { Injectable, NotFoundException } from '@nestjs/common'

/**
 * 用户成长概览服务
 * 负责聚合用户积分、经验、等级与徽章信息
 */
@Injectable()
export class UserGrowthOverviewService extends BaseService {
  constructor(
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super()
  }

  /**
   * 获取用户成长概览数据
   * @param userId 用户ID
   * @returns 成长概览信息
   */
  async getOverview(userId: number) {
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
      throw new NotFoundException('用户不存在')
    }

    const [levelInfo, badges] = await Promise.all([
      this.userLevelRuleService.getUserLevelInfo(userId),
      this.userBadgeService.getUserBadges(userId, {} as QueryUserBadgeDto),
    ])

    return {
      points: user.points,
      experience: user.experience,
      levelId: user.levelId ?? null,
      levelInfo,
      badges,
    }
  }
}
