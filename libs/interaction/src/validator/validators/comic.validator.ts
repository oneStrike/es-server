import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

/**
 * 漫画校验器
 */
@Injectable()
export class ComicValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.COMIC
  protected readonly modelName = 'work'

  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  protected getTargetName(): string {
    return '漫画'
  }

  /**
   * 校验漫画是否存在
   * 漫画的目标类型是1，需要在work表中校验type=1
   */
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

      // 检查是否是漫画类型
      if (target.type !== 1) {
        return {
          valid: false,
          message: '目标不是漫画',
        }
      }

      // 检查是否被删除
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
    } catch (error) {
      return {
        valid: false,
        message: '校验漫画时发生错误',
      }
    }
  }
}
