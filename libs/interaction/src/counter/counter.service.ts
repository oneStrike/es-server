import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../interaction.constant'

@Injectable()
export class CounterService extends BaseService {
  async incrementCount(
    tx: any,
    targetType: InteractionTargetType,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (tx)[modelName]

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
    targetType: InteractionTargetType,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (tx)[modelName]

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
    targetType: InteractionTargetType,
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
    targetType: InteractionTargetType,
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
    targetType: InteractionTargetType,
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

  private getModelInfo(
    targetType: InteractionTargetType,
    targetId: number,
  ): { modelName: string, where: any } {
    switch (targetType) {
      case InteractionTargetType.COMIC:
      case InteractionTargetType.NOVEL:
        return {
          modelName: 'work',
          where: { id: targetId },
        }
      case InteractionTargetType.COMIC_CHAPTER:
      case InteractionTargetType.NOVEL_CHAPTER:
        return {
          modelName: 'workChapter',
          where: { id: targetId },
        }
      case InteractionTargetType.FORUM_TOPIC:
        return {
          modelName: 'forumTopic',
          where: { id: targetId },
        }
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }
}
