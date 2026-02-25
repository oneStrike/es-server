import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

@Injectable()
export class NovelValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.NOVEL
  protected readonly modelName = 'work'

  protected getTargetName(): string {
    return '小说'
  }

  async validate(targetId: number) {
    try {
      const target = await this.prisma.work.findUnique({
        where: { id: targetId },
      })

      if (!target) {
        return {
          valid: false,
          message: '小说不存在',
        }
      }

      if (target.type !== 2) {
        return {
          valid: false,
          message: '目标不是小说',
        }
      }

      if (target.deletedAt !== null) {
        return {
          valid: false,
          message: '小说已被删除',
        }
      }

      return {
        valid: true,
        data: target,
      }
    } catch {
      return {
        valid: false,
        message: '校验小说时发生错误',
      }
    }
  }
}
