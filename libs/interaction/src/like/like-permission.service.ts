import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'

@Injectable()
export class LikePermissionService extends BaseService {
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
      { notFoundMessage: '目标不存在' },
    )
  }

  async ensureCanLike(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    await Promise.all([
      this.ensureCanLikeUser(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  /**
   * Exposed for flows that already resolve target metadata.
   * This avoids running a second target existence query in the service layer.
   */
  async ensureCanLikeUser(userId: number): Promise<void> {
    await this.ensureUserCanLike(userId)
  }

  async ensureCanUnlike(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    await Promise.all([
      this.ensureUserIsActive(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  private async ensureUserCanLike(userId: number): Promise<void> {
    const user = await this.ensureUserIsActive(userId)
    const dailyLikeLimit = user.level?.dailyLikeLimit ?? 0

    if (dailyLikeLimit <= 0) {
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usedToday = await this.prisma.userLike.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    })

    if (usedToday >= dailyLikeLimit) {
      throw new BadRequestException('今日点赞次数已达上限')
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
            dailyLikeLimit: true,
          },
        },
      },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('用户不存在或已禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户被禁言或封禁，无法点赞')
    }

    return user
  }
}
