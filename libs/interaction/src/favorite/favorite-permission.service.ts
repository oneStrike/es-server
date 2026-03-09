import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { FAVORITE_SUPPORTED_TARGET_TYPES } from '../interaction-target.definition'

@Injectable()
export class FavoritePermissionService extends BaseService {
  constructor(
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
  ) {
    super()
  }

  private async ensureTargetExists(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    await this.interactionTargetAccessService.ensureTargetExists(
      this.prisma,
      targetType,
      targetId,
      { notFoundMessage: 'Target not found' },
    )
  }

  async ensureCanFavorite(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    this.ensureTargetTypeSupported(targetType)

    await Promise.all([
      this.ensureUserCanFavorite(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  async ensureCanUnfavorite(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    this.ensureTargetTypeSupported(targetType)

    await Promise.all([
      this.ensureUserIsActive(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  private ensureTargetTypeSupported(targetType: InteractionTargetTypeEnum) {
    if (!FAVORITE_SUPPORTED_TARGET_TYPES.has(targetType)) {
      throw new BadRequestException('Unsupported favorite target type')
    }
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
      throw new BadRequestException('Daily favorite limit reached')
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
      throw new BadRequestException('User does not exist or is disabled')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('User is muted or banned and cannot favorite')
    }

    return user
  }
}
