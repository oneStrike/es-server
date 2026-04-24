import { DrizzleService } from '@db/core'
import { BusinessErrorCode, WorkViewPermissionEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'

/**
 * 用户权限服务
 * 负责处理用户相关的权限验证，包括视图权限、积分验证等
 */
@Injectable()
export class UserPermissionService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 获取 AppUser 模型访问器
   */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 获取 UserLevelRule 模型访问器
   */
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  /**
   * 根据用户ID获取用户及其会员等级信息
   * @param userId - 用户ID
   * @returns 包含会员等级信息的用户对象
   * @throws BadRequestException 当用户不存在时抛出异常
   */
  async getUserWithLevel(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      with: { level: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
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
        throw new BusinessException(
          BusinessErrorCode.QUOTA_NOT_ENOUGH,
          '会员等级不足',
        )
      }

      // 如果指定了最低等级要求，验证用户等级是否满足
      if (requiredViewLevelId) {
        const requiredLevel = await this.db.query.userLevelRule.findFirst({
          where: { id: requiredViewLevelId },
        })

        if (!requiredLevel) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '指定的阅读会员等级不存在',
          )
        }

        // 比较用户当前等级与要求等级的经验值
        if (user.level.requiredExperience < requiredLevel.requiredExperience) {
          throw new BusinessException(
            BusinessErrorCode.QUOTA_NOT_ENOUGH,
            '会员等级不足',
          )
        }
      }
    }
  }

  /**
   * 验证用户积分是否充足
   * @param userId - 用户ID
   * @param points - 需要验证的积分数
   * @returns 用户对象
   * @throws BadRequestException 当用户不存在或积分不足时抛出异常
   */
  async validatePoints(userId: number, points: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const balance = await this.db.query.userAssetBalance.findFirst({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        assetKey: '',
      },
      columns: {
        balance: true,
      },
    })

    if ((balance?.balance ?? 0) < points) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        '积分不足',
      )
    }

    return user
  }
}
