import { ContentTypeEnum, InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { ViewGrowthService } from './view-growth.service'
import { ViewInteractionService } from './view-interaction.service'
import { ViewPermissionService } from './view-permission.service'

@Injectable()
export class ViewService extends BaseService {
  constructor(
    private readonly viewPermissionService: ViewPermissionService,
    private readonly viewInteractionService: ViewInteractionService,
    private readonly viewGrowthService: ViewGrowthService,
    private readonly interactionTargetAccessService: InteractionTargetAccessService,
  ) {
    super()
  }

  private async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    await this.interactionTargetAccessService.applyTargetCountDelta(
      tx,
      targetType,
      targetId,
      field,
      delta,
    )
  }

  async recordView(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.viewPermissionService.ensureUserCanView(userId)
    await this.viewPermissionService.ensureTargetValid(targetType, targetId)

    await this.prisma.$transaction(async (tx) => {
      await tx.userView.create({
        data: {
          targetType,
          targetId,
          userId,
          ipAddress,
          device,
          userAgent,
          viewedAt: new Date(),
        },
      })

      await this.applyTargetCountDelta(tx, targetType, targetId, 'viewCount', 1)
    })

    await this.viewInteractionService.handleViewRecorded()
    await this.viewGrowthService.rewardViewRecorded(targetType, targetId, userId)
  }

  async getUserViews(
    userId: number,
    targetType?: InteractionTargetTypeEnum,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    return this.prisma.userView.findPagination({
      where: {
        userId,
        ...(targetType !== undefined && { targetType }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { viewedAt: 'desc' },
    })
  }

  async deleteView(viewId: number, userId: number): Promise<void> {
    await this.prisma.userView.deleteMany({
      where: {
        id: viewId,
        userId,
      },
    })
  }

  async deleteViews(viewIds: number[], userId: number): Promise<void> {
    await this.prisma.userView.deleteMany({
      where: {
        id: { in: viewIds },
        userId,
      },
    })
  }

  async clearUserViews(
    userId: number,
    targetType?: InteractionTargetTypeEnum,
  ): Promise<void> {
    const where: any = { userId }
    if (targetType !== undefined) {
      where.targetType = targetType
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userView.deleteMany({ where })

      if (targetType === undefined) {
        await tx.userWorkBrowseState.deleteMany({
          where: { userId },
        })
        return
      }

      if (
        targetType === InteractionTargetTypeEnum.COMIC ||
        targetType === InteractionTargetTypeEnum.NOVEL
      ) {
        await tx.userWorkBrowseState.deleteMany({
          where: {
            userId,
            workType: this.mapTargetTypeToWorkType(targetType),
          },
        })
        return
      }

      if (
        targetType === InteractionTargetTypeEnum.COMIC_CHAPTER ||
        targetType === InteractionTargetTypeEnum.NOVEL_CHAPTER
      ) {
        await tx.userWorkBrowseState.updateMany({
          where: {
            userId,
            workType: this.mapTargetTypeToWorkType(targetType),
          },
          data: {
            lastViewedChapterId: null,
          },
        })
      }
    })
  }

  private mapTargetTypeToWorkType(
    targetType: InteractionTargetTypeEnum,
  ): ContentTypeEnum {
    if (
      targetType === InteractionTargetTypeEnum.COMIC ||
      targetType === InteractionTargetTypeEnum.COMIC_CHAPTER
    ) {
      return ContentTypeEnum.COMIC
    }

    return ContentTypeEnum.NOVEL
  }
}
