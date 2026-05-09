import { DrizzleService } from '@db/core'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
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
   * @param _requiredViewLevelId - 历史等级阅读字段，目标态不再用于内容阅读
   *
   * 权限规则说明：
   * - ALL: 所有人可见，无需验证
   * - INHERIT: 继承父级权限，无需验证
   * - LOGGED_IN: 需要登录，验证用户存在即可
   * - VIP: 内容 VIP 阅读必须由 content 权限服务判定
   *
   * @throws BadRequestException 当权限不足时抛出异常
   */
  async validateViewPermission(
    viewRule: WorkViewPermissionEnum,
    userId?: number,
    _requiredViewLevelId?: number | null,
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

    await this.getUserWithLevel(userId)

    // 仅需登录即可访问
    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return
    }

    // VIP 阅读不再由成长等级服务判定，避免等级重新参与内容阅读。
    if (viewRule === WorkViewPermissionEnum.VIP) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 阅读权限请使用内容权限服务判定',
      )
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
