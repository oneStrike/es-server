import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetAccessService } from '../interaction-target-access.service'
import { BrowseLogGrowthService } from './browse-log-growth.service'
import { BrowseLogInteractionService } from './browse-log-interaction.service'
import { BrowseLogPermissionService } from './browse-log-permission.service'

@Injectable()
export class BrowseLogService extends BaseService {
  constructor(
    private readonly browseLogPermissionService: BrowseLogPermissionService,
    private readonly browseLogInteractionService: BrowseLogInteractionService,
    private readonly browseLogGrowthService: BrowseLogGrowthService,
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

  async recordBrowseLog(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
    options: {
      skipTargetValidation?: boolean
      deferPostProcess?: boolean
    } = {},
  ): Promise<void> {
    await this.browseLogPermissionService.ensureUserCanView(userId)

    if (!options.skipTargetValidation) {
      await this.browseLogPermissionService.ensureTargetValid(
        targetType,
        targetId,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userBrowseLog.create({
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

    const runPostProcess = async () => {
      await this.browseLogInteractionService.handleBrowseLogRecorded()
      await this.browseLogGrowthService.rewardBrowseLogRecorded(
        targetType,
        targetId,
        userId,
      )
    }

    if (options.deferPostProcess) {
      void runPostProcess().catch(() => undefined)
      return
    }

    await runPostProcess()
  }
}
