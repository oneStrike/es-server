import { BusinessModuleEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerService,
  GrowthRuleTypeEnum,
} from '@libs/user'
import { Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { resolveInteractionGrowthRuleType } from '../interaction-target-growth-rule'
import { refreshUserLevelByExperience } from '../user-level.helper'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteInteractionService } from './favorite-interaction.service'
import { FavoritePermissionService } from './favorite-permission.service'

/**
 * 收藏服务
 * 提供收藏、取消收藏、查询收藏状态等核心业务逻辑
 */
@Injectable()
export class FavoriteService extends BaseService {
  /** 用户收藏 Prisma 代理 */
  get userFavorite() {
    return this.prisma.userFavorite
  }

  constructor(
    private readonly favoritePermissionService: FavoritePermissionService,
    private readonly favoriteInteractionService: FavoriteInteractionService,
    private readonly favoriteGrowthService: FavoriteGrowthService,
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
    private readonly messageOutboxService: MessageOutboxService,
    private readonly growthLedgerService: GrowthLedgerService,
  ) {
    super()
  }

  /**
   * 批量检查收藏状态
   * @param targetType 目标类型
   * @param targetIds 目标 ID 列表
   * @param userId 用户 ID
   * @returns 目标 ID 与收藏状态的映射
   */
  async checkStatusBatch(
    targetType: BusinessModuleEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const favorites = await this.prisma.userFavorite.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const favoritedSet = new Set(favorites.map((f) => f.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, favoritedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 收藏目标
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async favorite(
    targetType: BusinessModuleEnum,
    targetId: number,
    userId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.create({
          data: {
            targetType,
            targetId,
            user: {
              connect: {
                id: userId,
              },
            },
          },
        })
      } catch (error) {
        // 唯一键冲突：已收藏
        this.handlePrismaBusinessError(error, {
          duplicateMessage: '已收藏',
        })
      }
      let growthRuleType: GrowthRuleTypeEnum | null = null
      if (targetType === BusinessModuleEnum.FORUM) {
        // 增加收藏数
        await this.prisma.forumTopic.applyCountDelta(
          { id: targetId },
          'favoriteCount',
          1,
        )

        // 查询目标作者，避免给自己发通知
        const topic = await tx.forumTopic.findUnique({
          where: { id: targetId, deletedAt: null },
          select: { userId: true },
        })

        if (topic && topic.userId !== userId) {
          // growthRuleType在此处赋值表示收藏自己的帖子不会发放奖励
          growthRuleType = GrowthRuleTypeEnum.TOPIC_FAVORITED
          await this.messageOutboxService.enqueueNotificationEvent(
            {
              eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
              bizKey: `notify:favorite:${targetType}:${targetId}:actor:${userId}:receiver:${topic.userId}`,
              payload: {
                receiverUserId: topic.userId,
                actorUserId: userId,
                type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
                targetType,
                targetId,
                title: '你的内容被收藏了',
                content: '有人收藏了你的内容',
              },
            },
            tx,
          )
        }
      } else {
        growthRuleType =
          targetType === BusinessModuleEnum.COMIC
            ? GrowthRuleTypeEnum.COMIC_WORK_FAVORITE
            : GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE
        await this.prisma.work.applyCountDelta(
          { id: targetId },
          'favoriteCount',
          1,
        )
      }
      if (!growthRuleType) {
        return
      }

      const baseBizKey = `favorite:${targetType}:${targetId}:user:${userId}`
      await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.POINTS,
        ruleType: growthRuleType,
        bizKey: `${baseBizKey}:POINTS`,
        source: 'interaction_favorite',
        remark: `收藏目标 #${targetId}`,
        targetType,
        targetId,
      })

      const experienceResult = await this.growthLedgerService.applyByRule(tx, {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        ruleType: growthRuleType,
        bizKey: `${baseBizKey}:EXPERIENCE`,
        source: 'interaction_favorite',
        remark: `收藏目标 #${targetId}`,
        targetType,
        targetId,
      })

      if (
        experienceResult.success &&
        experienceResult.afterValue !== undefined
      ) {
        await refreshUserLevelByExperience(
          tx,
          userId,
          experienceResult.afterValue,
        )
      }
    })
  }

  /**
   * 取消收藏
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async unfavorite(
    targetType: BusinessModuleEnum,
    targetId: number,
    userId: number,
  ) {
    await this.favoritePermissionService.ensureCanUnfavorite(
      userId,
      targetType,
      targetId,
    )

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.delete({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: '收藏记录不存在',
        })
      }

      // await this.interactionTargetAccessService.applyTargetCountDelta(
      //   tx,
      //   targetType,
      //   targetId,
      //   'favoriteCount',
      //   -1,
      // )
    })
  }

  /**
   * 检查单个目标收藏状态
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   * @returns 是否已收藏
   */
  async checkFavoriteStatus(
    targetType: BusinessModuleEnum,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const favorite = await this.prisma.userFavorite.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
      select: { id: true },
    })
    return !!favorite
  }

  /**
   * 获取用户收藏列表
   * @param userId 用户 ID
   * @param targetType 目标类型（可选）
   * @param pageIndex 页码
   * @param pageSize 每页数量
   * @returns 分页收藏列表
   */
  async getUserFavorites(
    userId: number,
    targetType?: BusinessModuleEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    return this.prisma.userFavorite.findPagination({
      where: {
        userId,
        ...(targetType !== undefined && { targetType }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        targetId: true,
        targetType: true,
        createdAt: true,
      },
    })
  }
}
