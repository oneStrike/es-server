import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class ViewPermissionService extends BaseService {
  constructor(private readonly counterService: CounterService) {
    super()
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
      throw new BadRequestException('用户已被禁言或封禁，无法浏览')
    }
  }

  async isTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<boolean> {
    try {
      await this.counterService.ensureTargetExists(targetType, targetId)
      return true
    } catch {
      return false
    }
  }
}

