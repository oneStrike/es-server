import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class UserPermissionService extends BaseService {
  get appUser() {
    return this.prisma.appUser
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  async getUserWithLevel(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: { level: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    return user
  }

  async validateViewPermission(
    viewRule: WorkViewPermissionEnum,
    userId?: number,
    requiredViewLevelId?: number | null,
  ) {
    if (
      viewRule === WorkViewPermissionEnum.ALL ||
      viewRule === WorkViewPermissionEnum.INHERIT
    ) {
      return
    }

    if (!userId) {
      throw new BadRequestException('用户不存在')
    }

    const user = await this.getUserWithLevel(userId)

    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return
    }

    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      if (!user.levelId || !user.level) {
        throw new BadRequestException('会员等级不足')
      }

      if (requiredViewLevelId) {
        const requiredLevel = await this.userLevelRule.findUnique({
          where: { id: requiredViewLevelId },
        })

        if (!requiredLevel) {
          throw new BadRequestException('指定的阅读会员等级不存在')
        }

        if (user.level.requiredExperience < requiredLevel.requiredExperience) {
          throw new BadRequestException('会员等级不足')
        }
      }
    }
  }

  async validateBalance(userId: number, amount: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (user.balance < amount) {
      throw new BadRequestException('余额不足')
    }

    return user
  }

  async validatePoints(userId: number, points: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (user.points < points) {
      throw new BadRequestException('积分不足')
    }

    return user
  }
}
