import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 用户权限服务
 * 负责处理用户相关的权限验证，包括视图权限、余额验证、积分验证等
 */
@Injectable()
export class UserPermissionService extends BaseService {
  /**
   * 获取 AppUser 模型访问器
   */
  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 获取 UserLevelRule 模型访问器
   */
  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  /**
   * 根据用户ID获取用户及其会员等级信息
   * @param userId - 用户ID
   * @returns 包含会员等级信息的用户对象
   * @throws BadRequestException 当用户不存在时抛出异常
   */
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

  /**
   * 验证用户的视图权限
   * 根据视图规则判断用户是否有权限访问特定内容
   *
   * @param viewRule - 视图权限规则枚举值
   * @param userId - 用户ID（可选）
   * @param requiredViewLevelId - 要求的会员等级ID（可选）
   *
   * 权限规则说明：
   * - ALL: 所有人可见，无需验证
   * - INHERIT: 继承父级权限，无需验证
   * - LOGGED_IN: 需要登录，验证用户存在即可
   * - MEMBER: 需要会员身份，可进一步限制最低等级
   *
   * @throws BadRequestException 当权限不足时抛出异常
   */
  async validateViewPermission(
    viewRule: WorkViewPermissionEnum,
    userId?: number,
    requiredViewLevelId?: number | null,
  ) {
    // 所有人可见或继承权限时，直接放行
    if (
      viewRule === WorkViewPermissionEnum.ALL ||
      viewRule === WorkViewPermissionEnum.INHERIT
    ) {
      return
    }

    // 需要登录的权限，但未提供用户ID
    if (!userId) {
      throw new BadRequestException('用户不存在')
    }

    const user = await this.getUserWithLevel(userId)

    // 仅需登录即可访问
    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return
    }

    // 需要会员身份
    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      // 验证用户是否有会员等级
      if (!user.levelId || !user.level) {
        throw new BadRequestException('会员等级不足')
      }

      // 如果指定了最低等级要求，验证用户等级是否满足
      if (requiredViewLevelId) {
        const requiredLevel = await this.userLevelRule.findUnique({
          where: { id: requiredViewLevelId },
        })

        if (!requiredLevel) {
          throw new BadRequestException('指定的阅读会员等级不存在')
        }

        // 比较用户当前等级与要求等级的经验值
        if (user.level.requiredExperience < requiredLevel.requiredExperience) {
          throw new BadRequestException('会员等级不足')
        }
      }
    }
  }

  /**
   * 验证用户余额是否充足
   * @param userId - 用户ID
   * @param amount - 需要验证的金额
   * @returns 用户对象
   * @throws BadRequestException 当用户不存在或余额不足时抛出异常
   */
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

  /**
   * 验证用户积分是否充足
   * @param userId - 用户ID
   * @param points - 需要验证的积分数
   * @returns 用户对象
   * @throws BadRequestException 当用户不存在或积分不足时抛出异常
   */
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
