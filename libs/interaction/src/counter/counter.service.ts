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
      throw new Error(`未找到模�? ${modelName}`)
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
      throw new Error(`未找到模�? ${modelName}`)
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
      throw new Error(`未找到模�? ${modelName}`)
    }

    await model.update({
      where,
      data: {
        [field]: value,
      },
    })
  }

  // ==================== 新增通用方法 ====================

  /**
   * 根据目标类型获取 Prisma 模型
   * @param client - Prisma 客户端或事务对象
   * @param targetType - 目标类型枚举
   * @returns Prisma 模型对象
   */
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
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }

  /**
   * 根据目标类型获取查询条件
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @returns Prisma where 条件对象
   */
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
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }

  /**
   * 确保目标存在，不存在则抛出 NotFoundException
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @throws NotFoundException 目标不存在时
   */
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
      throw new NotFoundException('Target not found')
    }
  }

  /**
   * 检测是否为 Prisma 重复键错误 (P2002)
   * @param error - 错误对象
   * @returns 是否为重复错误
   */
  isDuplicateError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    )
  }

  /**
   * 应用计数变化（支持增减）
   * @param tx - Prisma 事务对象
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @param field - 计数字段名
   * @param delta - 变化量（正数增加，负数减少）
   */
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

      // 如果更新数量为0，说明目标不存在
      if (updated.count === 0) {
        throw new NotFoundException('Target not found')
      }
      return
    }

    // delta < 0 时，确保不会减到负数
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

  // ==================== 私有方法 ====================

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
      default:
        throw new Error(`不支持的目标类型: ${targetType}`)
    }
  }
}
