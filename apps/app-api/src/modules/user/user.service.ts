import type { QueryUserBadgeDto } from '@libs/user/badge'
import { BaseService } from '@libs/base/database'
import { UserBadgeService } from '@libs/user/badge'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { Injectable } from '@nestjs/common'

@Injectable()
export class UserService extends BaseService {
  constructor(
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super()
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return this.sanitizeUser(user)
  }

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
