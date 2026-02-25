import type { InteractionTargetType } from '../../interaction.constant'
import type { ITargetValidationResult, ITargetValidator } from '../target-validator.interface'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

@Injectable()
export abstract class BaseTargetValidator extends BaseService implements ITargetValidator {
  abstract readonly targetType: InteractionTargetType
  protected abstract readonly modelName: string

  async validate(targetId: number): Promise<ITargetValidationResult> {
    try {
      const model = this.getModel()
      const target = await (model).findUnique({
        where: { id: targetId },
      })

      if (!target) {
        return {
          valid: false,
          message: `${this.getTargetName()}不存在`,
        }
      }

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
    } catch {
      return {
        valid: false,
        message: `校验${this.getTargetName()}时发生错误`,
      }
    }
  }

  async validateBatch(targetIds: number[]): Promise<number[]> {
    if (targetIds.length === 0) {
      return []
    }

    try {
      const model = this.getModel()
      const targets = await (model).findMany({
        where: {
          id: { in: targetIds },
          deletedAt: null,
        },
        select: { id: true },
      })

      return targets.map((t: { id: number }) => t.id)
    } catch {
      return []
    }
  }

  async getTargetInfo(targetId: number): Promise<unknown | null> {
    try {
      const model = this.getModel()
      return await (model).findUnique({
        where: { id: targetId },
      })
    } catch {
      return null
    }
  }

  protected getModel() {
    return (this.prisma as any)[this.modelName]
  }

  protected abstract getTargetName(): string
}
