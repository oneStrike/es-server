import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class CounterService extends BaseService {
  async incrementCount(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = tx[modelName]

    if (!model) {
      throw new Error(`未找到模型: ${modelName}`)
    }

    await model.update({
      where,
      data: {
        [field]: {
          increment: amount,
        },
      },
    })
  }

  async decrementCount(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = tx[modelName]

    if (!model) {
      throw new Error(`未找到模型: ${modelName}`)
    }

    await model.update({
      where,
      data: {
        [field]: {
          decrement: amount,
        },
      },
    })
  }

  async getCount(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
  ): Promise<number> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (this.prisma as any)[modelName]

    if (!model) {
      return 0
    }

    const result = await model.findUnique({
      where,
      select: {
        [field]: true,
      },
    })

    return result?.[field] ?? 0
  }

  async getCounts(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
    field: string,
  ): Promise<Map<number, number>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    const { modelName } = this.getModelInfo(targetType, 0)
    const model = (this.prisma as any)[modelName]

    if (!model) {
      return new Map()
    }

    const results = await model.findMany({
      where: {
        id: { in: targetIds },
      },
      select: {
        id: true,
        [field]: true,
      },
    })

    const countMap = new Map<number, number>()
    for (const result of results) {
      countMap.set(result.id, result[field] ?? 0)
    }

    return countMap
  }

  async setCount(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    value: number,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (this.prisma as any)[modelName]

    if (!model) {
      throw new Error(`未找到模型: ${modelName}`)
    }

    await model.update({
      where,
      data: {
        [field]: value,
      },
    })
  }

  getModel(client: any, targetType: InteractionTargetTypeEnum): any {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return client.work
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return client.workChapter
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return client.forumTopic
      case InteractionTargetTypeEnum.COMMENT:
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }

  getWhere(targetType: InteractionTargetTypeEnum, targetId: number): any {
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
      case InteractionTargetTypeEnum.COMMENT:
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }

  async ensureTargetExists(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    const where = this.getWhere(targetType, targetId)
    const model = this.getModel(this.prisma, targetType)
    const target = await model.findFirst({
      where,
      select: { id: true },
    })

    if (!target) {
      throw new NotFoundException('目标不存在')
    }
  }

  async applyCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ): Promise<void> {
    if (delta === 0) {
      return
    }

    const model = this.getModel(tx, targetType)
    const where = this.getWhere(targetType, targetId)

    if (delta > 0) {
      const updated = await model.updateMany({
        where,
        data: {
          [field]: {
            increment: delta,
          },
        },
      })

      if (updated.count === 0) {
        throw new NotFoundException('目标不存在')
      }
      return
    }

    const amount = Math.abs(delta)
    await model.updateMany({
      where: {
        ...where,
        [field]: { gte: amount },
      },
      data: {
        [field]: {
          decrement: amount,
        },
      },
    })
  }

  private getModelInfo(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): { modelName: string, where: any } {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return {
          modelName: 'work',
          where: { id: targetId },
        }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return {
          modelName: 'workChapter',
          where: { id: targetId },
        }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return {
          modelName: 'forumTopic',
          where: { id: targetId },
        }
      case InteractionTargetTypeEnum.COMMENT:
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }
}
