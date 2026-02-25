import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

/**
 * 小说校验器
 */
@Injectable()
export class NovelValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.NOVEL
  protected readonly modelName = 'work'

  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  protected getTargetName(): string {
    return '小说'
  }

  /**
   * 校验小说是否存在
   * 小说的目标类型是2，需要在work表中校验type=2
   */
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

      // 检查是否是小说类型
      if (target.type !== 2) {
        return {
          valid: false,
          message: '目标不是小说',
        }
      }

      // 检查是否被删除
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
    } catch (error) {
      return {
        valid: false,
        message: '校验小说时发生错误',
      }
    }
  }
}
