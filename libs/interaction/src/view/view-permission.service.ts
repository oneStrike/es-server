import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'

@Injectable()
export class ViewPermissionService extends BaseService {
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

  async ensureUserCanView(userId: number): Promise<void> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
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
      throw new BadRequestException('User is muted or banned and cannot view')
    }
  }

  async isTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<boolean> {
    try {
      await this.ensureTargetExists(targetType, targetId)
      return true
    } catch {
      return false
    }
  }
}
