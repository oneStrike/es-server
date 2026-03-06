import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { CounterService } from '../counter/counter.service'

@Injectable()
export class ViewService extends BaseService {
  constructor(private readonly counterService: CounterService) {
    super()
  }

  /**
   * 判断目标是否有效
   * 维持原行为：无效目标直接返回，不抛出异常
   */
  private async isTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<boolean> {
    try {
      await this.counterService.ensureTargetExists(targetType, targetId)
      return true
    } catch {
      return false
    }
  }

  async recordView(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
  ): Promise<void> {
    if (!(await this.isTargetValid(targetType, targetId))) {
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
