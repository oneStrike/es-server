import type { QueryUserBadgeDto } from '@libs/user/badge'
import type { QueryMyPointRecordDto } from './dto/user-point.dto'
import { BaseService } from '@libs/base/database'
import { UserBadgeService } from '@libs/user/badge'
import { QueryUserBalanceRecordDto, UserBalanceService } from '@libs/user/balance'
import { UserLevelRuleService } from '@libs/user/level-rule'
import { UserPointService } from '@libs/user/point'
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
    private readonly userBalanceService: UserBalanceService,
    private readonly userPointService: UserPointService,
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

  async getUserBalance(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        balance: true,
      },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return user
  }

  async getUserBalanceRecords(userId: number, query: QueryUserBalanceRecordDto) {
    return this.userBalanceService.getUserBalanceRecordPage({
      ...query,
      userId,
    })
  }

  async getUserPoints(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        points: true,
      },
    })

    if (!user) {
      throw new Error('用户不存在')
    }

    return user
  }

  async getUserPointRecords(userId: number, query: QueryMyPointRecordDto) {
    return this.userPointService.getPointRecordPage({
      ...query,
      userId,
    })
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user
    return sanitized
  }
}
