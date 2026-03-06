import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class ViewService extends BaseService {
  private getTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return { id: targetId, type: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL:
        return { id: targetId, type: 2, deletedAt: null }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return { id: targetId, workType: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return { id: targetId, workType: 2, deletedAt: null }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return { id: targetId, deletedAt: null }
      default:
        throw new BadRequestException('Unsupported target type')
    }
  }

  private getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return client.work
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return client.workChapter
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return client.forumTopic
      default:
        throw new BadRequestException('Unsupported target type')
    }
  }

  /**
   * 判断目标是否有效�?   * 维持原行为：无效目标直接返回，不抛出异常�?
   */
  private async isTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<boolean> {
    const model = this.getTargetModel(this.prisma, targetType)
    const target = await model.findFirst({
      where: this.getTargetWhere(targetType, targetId),
      select: { id: true },
    })
    return !!target
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
