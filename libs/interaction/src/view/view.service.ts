import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { ViewGrowthService } from './view-growth.service'
import { ViewInteractionService } from './view-interaction.service'
import { ViewPermissionService } from './view-permission.service'

@Injectable()
export class ViewService extends BaseService {
  constructor(
    private readonly viewPermissionService: ViewPermissionService,
    private readonly viewInteractionService: ViewInteractionService,
    private readonly viewGrowthService: ViewGrowthService,
  ) {
    super()
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
    const isTargetValid = await this.viewPermissionService.isTargetValid(
      targetType,
      targetId,
    )

    // 维持原行为：无效目标静默返回
    if (!isTargetValid) {
      return
    }

    await this.prisma.userView.create({
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

    await this.prisma.userView.deleteMany({ where })
  }
}

