import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../interaction.constant'
import { TargetValidatorRegistry } from '../validator/target-validator.registry'

@Injectable()
export class ViewService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly validatorRegistry: TargetValidatorRegistry,
  ) {}

  /**
   * 记录浏览
   */
  async recordView(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
  ): Promise<void> {
    // 校验目标是否存在
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
      return
    }

    // 创建浏览记录
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

  /**
   * 获取用户的浏览历史
   */
  async getUserViews(
    userId: number,
    targetType?: InteractionTargetType,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: any[]; total: number }> {
    const where: any = { userId }
    if (targetType !== undefined) {
      where.targetType = targetType
    }

    const [views, total] = await Promise.all([
      this.prisma.userView.findMany({
        where,
        orderBy: { viewedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userView.count({ where }),
    ])

    return { list: views, total }
  }

  /**
   * 删除浏览记录
   */
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

  /**
   * 批量删除浏览记录
   */
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

  /**
   * 清空用户浏览历史
   */
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
