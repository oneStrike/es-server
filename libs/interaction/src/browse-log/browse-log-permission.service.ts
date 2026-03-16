import { DrizzleService } from '@db/core'
import { UserStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 浏览权限服务
 * 校验用户浏览内容的权限
 */
@Injectable()
export class BrowseLogPermissionService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * 校验用户是否可以浏览内容
   *
   * @param userId - 用户ID
   * @throws BadRequestException 用户不存在、已禁用或被封禁
   */
  async ensureUserCanView(userId: number): Promise<void> {
    const user = await this.drizzle.db.query.appUser.findFirst({
      where: { id: userId },
      columns: {
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

  /**
   * 校验用户是否可以浏览
   *
   * @param userId - 用户ID
   * @throws BadRequestException 用户不存在、已禁用或被封禁
   */
  async ensureCanBrowse(userId: number): Promise<void> {
    await this.ensureUserCanView(userId)
  }
}
