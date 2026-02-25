import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

/**
 * 漫画章节校验器
 */
@Injectable()
export class ComicChapterValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.COMIC_CHAPTER
  protected readonly modelName = 'workChapter'

  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  protected getTargetName(): string {
    return '漫画章节'
  }

  /**
   * 校验漫画章节是否存在
   * 需要关联work表校验作品类型为漫画(type=1)
   */
  async validate(targetId: number) {
    try {
      const chapter = await this.prisma.workChapter.findUnique({
        where: { id: targetId },
        include: { work: true },
      })

      if (!chapter) {
        return {
          valid: false,
          message: '章节不存在',
        }
      }

      // 检查所属作品是否是漫画
      if (chapter.work.type !== 1) {
        return {
          valid: false,
          message: '目标不是漫画章节',
        }
      }

      // 检查是否被删除
      if (chapter.deletedAt !== null) {
        return {
          valid: false,
          message: '章节已被删除',
        }
      }

      return {
        valid: true,
        data: chapter,
      }
    } catch (error) {
      return {
        valid: false,
        message: '校验章节时发生错误',
      }
    }
  }
}
