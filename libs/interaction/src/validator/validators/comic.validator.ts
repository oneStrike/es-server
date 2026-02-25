import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

@Injectable()
export class ComicValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.COMIC
  protected readonly modelName = 'work'

  protected getTargetName(): string {
    return '漫画'
  }

  async validate(targetId: number) {
    try {
      const target = await this.prisma.work.findUnique({
        where: { id: targetId },
      })

      if (!target) {
        return {
          valid: false,
          message: '漫画不存在',
        }
      }

      if (target.type !== 1) {
        return {
          valid: false,
          message: '目标不是漫画',
        }
      }

      if (target.deletedAt !== null) {
        return {
          valid: false,
          message: '漫画已被删除',
        }
      }

      return {
        valid: true,
        data: target,
      }
    } catch {
      return {
        valid: false,
        message: '校验漫画时发生错误',
      }
    }
  }
}
