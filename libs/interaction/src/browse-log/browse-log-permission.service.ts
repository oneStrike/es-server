import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { VIEW_SUPPORTED_TARGET_TYPES } from '../interaction-target.definition'

@Injectable()
export class BrowseLogPermissionService extends BaseService {
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

  async ensureUserCanView(userId: number): Promise<void> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
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
      throw new BadRequestException('用户被禁言或封禁，无法浏览')
    }
  }

  async ensureTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    this.ensureTargetTypeSupported(targetType)
    await this.ensureTargetExists(targetType, targetId)
  }

  private ensureTargetTypeSupported(targetType: InteractionTargetTypeEnum) {
    if (!VIEW_SUPPORTED_TARGET_TYPES.has(targetType)) {
      throw new BadRequestException('不支持的浏览目标类型')
    }
  }
}
