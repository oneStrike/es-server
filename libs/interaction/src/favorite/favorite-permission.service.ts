import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class FavoritePermissionService extends BaseService {
  constructor(private readonly counterService: CounterService) {
    super()
  }

  async ensureCanFavorite(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    await Promise.all([
      this.ensureUserCanFavorite(userId),
      this.counterService.ensureTargetExists(targetType, targetId),
    ])
  }

  async ensureCanUnfavorite(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    await Promise.all([
      this.ensureUserIsActive(userId),
      this.counterService.ensureTargetExists(targetType, targetId),
    ])
  }

  private async ensureUserCanFavorite(userId: number): Promise<void> {
    const user = await this.ensureUserIsActive(userId)
    const dailyFavoriteLimit = user.level?.dailyFavoriteLimit ?? 0

    if (dailyFavoriteLimit <= 0) {
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usedToday = await this.prisma.userFavorite.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    })

    if (usedToday >= dailyFavoriteLimit) {
      throw new BadRequestException(
        `今日收藏次数已达上限（${dailyFavoriteLimit}）`,
      )
    }
  }

  private async ensureUserIsActive(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
        level: {
          select: {
            dailyFavoriteLimit: true,
          },
        },
      },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法收藏')
    }

    return user
  }
}
