import type { QueryUserBadgeDto } from '@libs/user/badge'
import { BaseService } from '@libs/base/database'
import { UserBadgeService } from '@libs/user/badge'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class UserGrowthOverviewService extends BaseService {
  constructor(
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super()
  }

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
