import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class ViewService extends BaseService {
  constructor(
    private readonly validatorRegistry: TargetValidatorRegistry,
  ) {
    super()
  }

  async recordView(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
  ): Promise<void> {
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
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
    targetType?: InteractionTargetType,
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

  async deleteView(
    viewId: number,
    userId: number,
  ): Promise<void> {
    await this.prisma.userView.deleteMany({
      where: {
        id: viewId,
        userId,
      },
    })
  }

  async deleteViews(
    viewIds: number[],
    userId: number,
  ): Promise<void> {
    await this.prisma.userView.deleteMany({
      where: {
        id: { in: viewIds },
        userId,
      },
    })
  }

  async clearUserViews(
    userId: number,
    targetType?: InteractionTargetType,
  ): Promise<void> {
    const where: any = { userId }
    if (targetType !== undefined) {
      where.targetType = targetType
    }

    await this.prisma.userView.deleteMany({ where })
  }
}
