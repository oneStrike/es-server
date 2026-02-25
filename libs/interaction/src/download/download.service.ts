import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { BaseInteractionService } from '../base-interaction.service'
import { CounterService } from '../counter/counter.service'
import { InteractionTargetType, InteractionActionType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class DownloadService extends BaseInteractionService {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly counterService: CounterService,
    protected readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  protected getActionType(): InteractionActionType {
    return InteractionActionType.DOWNLOAD
  }

  protected getCancelActionType(): InteractionActionType {
    return InteractionActionType.DOWNLOAD
  }

  protected async checkUserInteracted(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const download = await this.prisma.userDownload.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
    })
    return !!download
  }

  protected async createInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    extraData?: Record<string, unknown>,
  ): Promise<void> {
    const workId = extraData?.workId as number
    const workType = extraData?.workType as number

    await this.prisma.userDownload.create({
      data: {
        targetType,
        targetId,
        userId,
        workId,
        workType,
      },
    })
  }

  protected async deleteInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userDownload.delete({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
    })
  }

  protected getCountField(): string {
    return 'downloadCount'
  }

  async checkStatusBatch(
    targetType: InteractionTargetType,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    const downloads = await this.prisma.userDownload.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const downloadedSet = new Set(downloads.map((d) => d.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, downloadedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 记录下载
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @param workId 作品ID
   * @param workType 作品类型
   */
  async checkDownloadStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkStatus(targetType, targetId, userId)
  }

  async recordDownload(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    workId: number,
    workType: number,
  ): Promise<void> {
    return this.interact(targetType, targetId, userId, { workId, workType })
  }

  async getUserDownloads(
    userId: number,
    targetType?: InteractionTargetType,
    page: number = 0,
    pageSize: number = 15,
  ): Promise<{ list: { targetId: number; targetType: number; createdAt: Date }[]; total: number }> {
    const where: any = { userId }
    if (targetType !== undefined) {
      where.targetType = targetType
    }

    const [downloads, total] = await Promise.all([
      this.prisma.userDownload.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * pageSize,
        take: pageSize,
        select: {
          targetId: true,
          targetType: true,
          createdAt: true,
        },
      }),
      this.prisma.userDownload.count({ where }),
    ])

    return { list: downloads, total }
  }
}
