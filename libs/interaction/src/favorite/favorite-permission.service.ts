import { BusinessModuleEnum, UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { FAVORITE_SUPPORTED_TARGET_TYPES } from '../interaction-target.definition'

/**
 * 收藏权限服务
 * 负责收藏操作的权限校验，包括目标类型支持、用户状态、每日限额等
 */
@Injectable()
export class FavoritePermissionService extends BaseService {
  constructor(
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
  ) {
    super()
  }

  /**
   * 确保目标存在
   * @param targetType 目标类型
   * @param targetId 目标 ID
   */
  private async ensureTargetExists(
    targetType: BusinessModuleEnum,
    targetId: number,
  ): Promise<void> {
    await this.interactionTargetAccessService.ensureTargetExists(
      this.prisma,
      targetType,
      targetId,
      { notFoundMessage: '目标不存在' },
    )
  }

  /**
   * 确保用户可以收藏目标
   * @param userId 用户 ID
   * @param targetType 目标类型
   * @param targetId 目标 ID
   */
  async ensureCanFavorite(
    userId: number,
    targetType: BusinessModuleEnum,
    targetId: number,
  ): Promise<void> {
    this.ensureTargetTypeSupported(targetType)

    await Promise.all([
      this.ensureUserCanFavorite(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  /**
   * 确保用户可以取消收藏
   * @param userId 用户 ID
   * @param targetType 目标类型
   * @param targetId 目标 ID
   */
  async ensureCanUnfavorite(
    userId: number,
    targetType: BusinessModuleEnum,
    targetId: number,
  ): Promise<void> {
    this.ensureTargetTypeSupported(targetType)

    await Promise.all([
      this.ensureUserIsActive(userId),
      this.ensureTargetExists(targetType, targetId),
    ])
  }

  /**
   * 检查目标类型是否支持收藏
   * @param targetType 目标类型
   * @throws {BadRequestException} 不支持的收藏目标类型
   */
  private ensureTargetTypeSupported(targetType: BusinessModuleEnum): void {
    if (!FAVORITE_SUPPORTED_TARGET_TYPES.has(targetType)) {
      throw new BadRequestException('不支持的收藏目标类型')
    }
  }

  /**
   * 确保用户可以执行收藏操作（检查每日限额）
   * @param userId 用户 ID
   * @throws {BadRequestException} 今日收藏次数已达上限
   */
  private async ensureUserCanFavorite(userId: number): Promise<void> {
    const user = await this.ensureUserIsActive(userId)
    const dailyFavoriteLimit = user.level?.dailyFavoriteLimit ?? 0

    if (dailyFavoriteLimit <= 0) {
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usedToday = await this.prisma.userFavorite.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    })

    if (usedToday >= dailyFavoriteLimit) {
      throw new BadRequestException('今日收藏次数已达上限')
    }
  }

  /**
   * 确保用户处于活跃状态
   * @param userId 用户 ID
   * @returns 用户信息（含等级配置）
   * @throws {BadRequestException} 用户不存在、已禁用或被禁言/封禁
   */
  private async ensureUserIsActive(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
        level: {
          select: {
            dailyFavoriteLimit: true,
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
      throw new BadRequestException('用户被禁言或封禁，无法收藏')
    }

    return user
  }
}
