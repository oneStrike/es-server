import { DrizzleService } from '@db/core'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
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

  // 获取 AppUser 模型访问器
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 获取 UserLevelRule 模型访问器
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  // 根据用户 ID 获取登录态校验所需的最小用户快照。
  async getUserWithLevel(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
    })

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    return user
  }

  // 验证用户的视图权限 根据视图规则判断用户是否有权限访问特定内容 权限规则说明： - ALL: 所有人可见，无需验证 - INHERIT: 继承父级权限，无需验证 - LOGGED_IN: 需要登录，验证用户存在即可 - VIP: 内容 VIP 阅读必须由 content 权限服务判定
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

  // 验证用户积分是否充足
  async validatePoints(userId: number, points: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { id: true },
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
