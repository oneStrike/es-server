import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../../interaction.constant'
import type { ITargetValidationResult, ITargetValidator } from '../target-validator.interface'

/**
 * 基础目标校验器抽象类
 * 提供通用的校验逻辑
 */
export abstract class BaseTargetValidator implements ITargetValidator {
  /** Prisma 客户端 */
  protected readonly prisma: PrismaClient

  /** 支持的目标类型 */
  abstract readonly targetType: InteractionTargetType

  /** Prisma 模型名称 */
  protected abstract readonly modelName: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * 校验目标是否存在
   */
  async validate(targetId: number): Promise<ITargetValidationResult> {
    try {
      const model = this.getModel()
      const target = await (model as any).findUnique({
        where: { id: targetId },
      })

      if (!target) {
        return {
          valid: false,
          message: `${this.getTargetName()}不存在`,
        }
      }

      // 检查是否有 deletedAt 字段（软删除）
      if ('deletedAt' in target && target.deletedAt !== null) {
        return {
          valid: false,
          message: `${this.getTargetName()}已被删除`,
        }
      }

      return {
        valid: true,
        data: target,
      }
    } catch (error) {
      return {
        valid: false,
        message: `校验${this.getTargetName()}时发生错误`,
      }
    }
  }

  /**
   * 批量校验目标是否存在
   */
  async validateBatch(targetIds: number[]): Promise<number[]> {
    if (targetIds.length === 0) {
      return []
    }

    try {
      const model = this.getModel()
      const targets = await (model as any).findMany({
        where: {
          id: { in: targetIds },
          deletedAt: null,
        },
        select: { id: true },
      })

      return targets.map((t: { id: number }) => t.id)
    } catch (error) {
      return []
    }
  }

  /**
   * 获取目标信息
   */
  async getTargetInfo(targetId: number): Promise<unknown | null> {
    try {
      const model = this.getModel()
      return await (model as any).findUnique({
        where: { id: targetId },
      })
    } catch (error) {
      return null
    }
  }

  /**
   * 获取 Prisma 模型
   */
  protected getModel() {
    return (this.prisma as any)[this.modelName]
  }

  /**
   * 获取目标名称（用于错误信息）
   */
  protected abstract getTargetName(): string
}
