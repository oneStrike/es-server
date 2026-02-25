import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../interaction.constant'

/**
 * 计数处理器服务
 * 统一处理各种交互计数（点赞数、收藏数、浏览数、评论数、下载数）
 */
@Injectable()
export class CounterService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 增加计数
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param field 计数字段名
   * @param amount 增加数量（默认1）
   */
  async increment(
    targetType: InteractionTargetType,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (this.prisma as any)[modelName]

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

  /**
   * 减少计数
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param field 计数字段名
   * @param amount 减少数量（默认1）
   */
  async decrement(
    targetType: InteractionTargetType,
    targetId: number,
    field: string,
    amount: number = 1,
  ): Promise<void> {
    const { modelName, where } = this.getModelInfo(targetType, targetId)
    const model = (this.prisma as any)[modelName]

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

  /**
   * 获取计数
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param field 计数字段名
   * @returns 当前计数
   */
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

  /**
   * 批量获取计数
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param field 计数字段名
   * @returns 计数映射表
   */
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

  /**
   * 设置计数（用于数据同步）
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param field 计数字段名
   * @param value 计数值
   */
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

  /**
   * 根据目标类型获取模型信息
   */
  private getModelInfo(
    targetType: InteractionTargetType,
    targetId: number,
  ): { modelName: string; where: any } {
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
